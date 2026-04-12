// Vercel Serverless Function — Gemini API proxy
// API key 存在 Vercel 環境變數 GEMINI_API_KEY，不會暴露給前端

const fs = require('fs');
const path = require('path');

// 載入語錄作為 few-shot examples
let quotesCache = null;
function loadQuotes() {
    if (quotesCache) return quotesCache;
    try {
        const filePath = path.join(process.cwd(), 'data', 'quotes-selected.json');
        const data = fs.readFileSync(filePath, 'utf-8');
        quotesCache = JSON.parse(data);
    } catch (e) {
        quotesCache = [];
    }
    return quotesCache;
}

module.exports = async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

    const { userMessage, scores, tone, english, englishStyle, length, retranslateOnly, existingCN, avoidCN } = req.body;
    if (!userMessage || !userMessage.trim()) {
        return res.status(400).json({ error: 'Empty message' });
    }

    // 將 0-100 的值對應到 5 個等級（0/25/50/75/100）
    const snap = v => Math.round(Number(v ?? 50) / 25) * 25;
    const toneSnap = snap(tone);
    const lengthSnap = snap(length);
    const enStyleSnap = snap(englishStyle);
    const toneIdx = toneSnap / 25; // 0..4

    // Manglish / English 風格 SOP：等級越小 → 越 Manglish
    // 每個等級都給具體規則，讓 Gemini 有明確的操作依據
    const MANGLISH_SOP = `Manglish (馬式英文) 轉換規則參考：
- 句末語氣詞：can → can lah / can or not、yes → yes lah、ok → ok lor、sure → sure one、good → good mah
- 驚嘆：Oh my god → walao、Oh no → aiyo、wow → wah、really → really ah / really meh
- 強調：very tired → damn tired / tired die、a lot → got a lot
- 疑問：Don't you think? → izzit?、Do you know? → you know or not?
- 代名詞省略：I am tired → tired lah / so tired lah
- 直接的 Chinglish 結構：because + 逗號、mix 一點 Malay/粵語詞（kaya, kopi, makan, sudah, aiya）
- 允許破碎/省略語法（像口語），不要太工整`;

    const styleDescByLevel = {
        0: `FULL MANGLISH — 大量使用 Manglish。必須至少符合 3 項以上規則：句末加 lah/lor/mah/meh、用 aiyo/walao/wah、可加 Malay 詞、用破碎口語語法。不要寫成標準英文。\n${MANGLISH_SOP}`,
        25: `Manglish-flavored — 用 1-2 個 Manglish 特徵（例如：句末加一次 lah / 用一次 walao），整體仍可懂，但一眼看出是馬來西亞人在講話。\n${MANGLISH_SOP}`,
        50: `Natural conversational English — 不 Manglish，也不正式。像朋友間平常聊天的英文。可以用縮寫 (you're, don't, it's)。`,
        75: `Polished conversational English — 輕微偏正式。減少縮寫，句子結構完整，但不會太書面。`,
        100: `FULLY FORMAL English — 完全正式書面英文。不用縮寫，句子完整，像寫文章或演講稿那樣。避免 slang、語氣詞。`
    };
    const styleDesc = styleDescByLevel[enStyleSnap];

    // 模式一：只重新翻譯英文
    if (retranslateOnly && existingCN) {
        const translatePrompt = `將以下中文語錄翻譯成英文。

中文原句：${existingCN}

⚠ 英文風格硬性要求：${styleDesc}

寫完後**請自己檢查**是否符合上述風格等級，不符合就重寫。

其他注意：
- 不要改變原意
- 中文的語氣和口吻不會影響英文翻譯的風格
- 只回傳英文翻譯，不要加任何其他文字或格式`;

        try {
            const result = await callGemini(apiKey, translatePrompt, '你是一個翻譯專家。');
            return res.status(200).json({ textEN: result.trim() });
        } catch (err) {
            return res.status(502).json({ error: err.message });
        }
    }

    // 模式二：完整生成雞湯（一次產出 5 個語氣版本）
    const quotes = loadQuotes();
    const shuffled = [...quotes].sort(() => Math.random() - 0.5);
    const examples = shuffled.slice(0, 30).map(q => `- ${q.textCN}`).join('\n');

    // 長度規則：字數硬性限制，避免 Gemini 忽略長度指令
    const lengthDescByLevel = {
        0: '**極短**：一句話，總共 8-15 個中文字（含標點）。必須是一行就講完。',
        25: '**短**：一句話，總共 16-25 個中文字（含標點）。',
        50: '**中**：1-2 句話，總共 26-45 個中文字（含標點）。',
        75: '**長**：2-3 句話，總共 46-70 個中文字（含標點）。',
        100: '**很長**：3-4 句話，一小段，總共 71-100 個中文字（含標點）。'
    };
    const lengthDesc = lengthDescByLevel[lengthSnap];

    const systemPrompt = `你是 Bernard Liew，一個寫雞湯語錄的作者。你的風格是：直接、不繞彎、帶點幽默，不說教、不哄人，像一個稍微走在對方前面的朋友說的話。你的語錄讓人感到「被說中」而不是「被建議」。

以下是你寫過的語錄，請仔細學習這個風格和語感，然後模仿：
${examples}

現在有一個觀眾跟你分享了一些事情。請根據他說的內容，用你的風格寫**5 個版本**的雞湯語錄，對應 5 個語氣層次（由直接到溫暖）。

⚠ 每個等級有明確的 SOP，請嚴格遵守：

**Level 1｜最說教、最一針見血**（像甩一巴掌）
- 結構：直接指出事實 / 反問挑戰（例："你在等什麼？"、"那不是累，是你不想面對。"）
- 不加鋪墊（不要 "其實"、"你可以"、"或許" 這類開頭）
- 不加溫柔包裝（不寫 "知道你累"、"你已經很努力了"）
- 語氣是冷的、切的，但不是罵人。是「朋友直接戳破你」那種
- 可以短、可以反問、可以用否定句

**Level 2｜偏直接、不繞彎**
- 像 Level 1 但留一點喘息：指出事實 + 一句觀察
- 仍不哄人、不鋪墊
- 允許用輕微的自嘲或幽默

**Level 3｜平衡的，直接但有溫度**
- 結構：一句觀察 + 一句提醒（例："你已經累了，別再跟自己講道理。"）
- 承認事實但不冷酷
- 可以有比喻，但要精準

**Level 4｜偏溫暖、帶點鼓勵**
- 可以用「知道你...」「你不是...」這類承認開頭
- 給一個小方向或小希望，但不能空泛
- 像朋友拍肩膀說話

**Level 5｜最雞湯、最像在哄你打氣**
- 完全溫暖、有希望感
- 可以用比喻、意象去包裝（星辰、光、河流這類）
- **但仍然不能用「加油」「相信自己」「一切都會好的」這種空話**
- 要有具體的圖像或動作，不是空洞鼓勵

⚠ 長度硬性要求（5 句都必須遵守）：${lengthDesc}
寫完每一句後，**請自己數字數**，不在範圍內就重寫，直到符合為止。

要求：
- 5 句的意思核心一致（都在回應觀眾說的事），只差語氣
- 不要用「加油」「相信自己」「一切都會好的」這種空泛的話
- 要像說話一樣自然，不要太文藝

另外，請把**第 ${toneIdx + 1} 個版本**翻譯成英文。

⚠ 英文風格硬性要求：${styleDesc}

寫完英文後，**請自己檢查**是否符合上述風格等級，不符合就重寫。

${Array.isArray(avoidCN) && avoidCN.length > 0 ? `⚠ 重要：你之前已經寫過這些版本，請**不要重複**（連相似的意思、相似的結構都避開，換新的角度或比喻）：
${avoidCN.filter(Boolean).map((s, i) => `${i + 1}. ${s}`).join('\n')}

` : ''}如果觀眾說的內容太短、沒有意義、或是亂打的文字，valid 設 false，只填 retry_message（用你的風格引導他再多說一點），tonesCN/textEN 可以空字串。

請用以下 JSON 格式回覆（不要加 markdown code block）：
{
  "valid": true/false,
  "translation": "籤文式的轉譯（客觀描述一個場景或意象，不直接說道理）",
  "tonesCN": ["第1級最直接", "第2級", "第3級平衡", "第4級", "第5級最溫暖"],
  "textEN": "第 ${toneIdx + 1} 個版本的英文翻譯",
  "retry_message": ""
}`;

    // 12 個維度字典：狀態描述 + 寫作方向 + 避免事項
    const DIMENSION_DICT = {
        'confused':      { label: '迷失 / 沒方向感', write: '幫他看清現在站在哪',          avoid: '給具體建議' },
        'tired':         { label: '耗盡 / 沒力氣',   write: '允許他停下來，不用更努力',    avoid: '叫他再撐' },
        'hurt':          { label: '受傷 / 被辜負',   write: '承認那件事真的痛',            avoid: '正能量式「都是為你好」' },
        'action':        { label: '卡住沒動 / 拖延', write: '直接戳破他在等什麼',          avoid: '溫柔安慰' },
        'courage':       { label: '要跨出去但怕',    write: '承認怕，同時提醒邁出一步的重量', avoid: '空話加油' },
        'let-go':        { label: '放不下 / 太用力抓', write: '讓他看到鬆手的輕盈',          avoid: '講「人生無常」大道理' },
        'perspective':   { label: '鑽牛角尖 / 看不到全貌', write: '換一個視角或比喻',       avoid: '說教式講理' },
        'patience':      { label: '急 / 等不及結果', write: '把節奏拉慢，講「現在」的價值', avoid: '叫他耐心' },
        'relationships': { label: '人際困擾 / 跟人拉扯', write: '聚焦在他跟自己的關係',     avoid: '教他怎麼處理對方' },
        'self-worth':    { label: '不夠好 / 自我懷疑', write: '不要證明他夠好，直接把前提打掉', avoid: '說「你很棒」' },
        'overthinking':  { label: '想太多 / 在腦袋裡打架', write: '戳破「想」跟「做」的差距', avoid: '叫他別想' },
        'setback':       { label: '挫折 / 走得比想像累', write: '承認路難走，別假裝沒事',    avoid: '勵志雞湯' }
    };

    // 如果有問答 scores，取前 3 高的維度，查字典並加到 context 裡
    let userContext = userMessage;
    if (scores && Object.keys(scores).length > 0) {
        const top = Object.entries(scores)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .filter(([k]) => DIMENSION_DICT[k]);

        if (top.length > 0) {
            const profile = top.map(([k, v], i) => {
                const d = DIMENSION_DICT[k];
                return `${i + 1}. ${d.label}（分數 ${v}）\n   寫作方向：${d.write}\n   避免：${d.avoid}`;
            }).join('\n');

            userContext = `[觀眾問答結果顯示他目前的狀態特徵（由強到弱）：
${profile}

請在寫 5 個版本時，把這些特徵當成理解觀眾的背景。不是要直接把關鍵字塞進句子，而是用這些切入角度去回應他接下來說的話。]

觀眾說：${userMessage}`;
        }
    }

    try {
        const text = await callGemini(apiKey, userContext, systemPrompt);

        // 嘗試解析 JSON
        let cleaned = text;
        cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/g, '');
        cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            return res.status(502).json({ error: 'Cannot parse Gemini response', detail: text });
        }

        try {
            const result = JSON.parse(jsonMatch[0]);
            // 保底：確保 tonesCN 是長度 5 的陣列
            if (result.valid) {
                if (!Array.isArray(result.tonesCN) || result.tonesCN.length !== 5) {
                    const fallback = result.textCN || (Array.isArray(result.tonesCN) ? result.tonesCN[0] : '') || '';
                    result.tonesCN = new Array(5).fill(fallback);
                }
                result.textCN = result.tonesCN[toneIdx] || result.tonesCN[2];
            }
            return res.status(200).json(result);
        } catch (parseErr) {
            return res.status(502).json({ error: 'JSON parse failed', detail: text });
        }
    } catch (err) {
        return res.status(502).json({ error: err.message });
    }
}

// 呼叫 Gemini API（自動 fallback 不同模型）
async function callGemini(apiKey, userText, systemText) {
    const models = ['gemini-2.5-flash', 'gemini-2.5-pro'];
    const requestBody = JSON.stringify({
        contents: [
            { role: 'user', parts: [{ text: userText }] }
        ],
        systemInstruction: { parts: [{ text: systemText }] },
        generationConfig: {
            temperature: 0.9,
            maxOutputTokens: 2048,
        }
    });

    let response;
    for (const model of models) {
        response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: requestBody,
            }
        );
        if (response.ok) break;
        console.log(`Model ${model} failed, trying next...`);
    }

    if (!response.ok) {
        const err = await response.text();
        console.error('All Gemini models failed:', err);
        throw new Error('Gemini API error');
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty response from Gemini');
    return text;
}
