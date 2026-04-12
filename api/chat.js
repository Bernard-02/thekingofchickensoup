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

    const { userMessage, scores, tone, english, englishStyle, length, retranslateOnly, existingCN } = req.body;
    if (!userMessage || !userMessage.trim()) {
        return res.status(400).json({ error: 'Empty message' });
    }

    // 將 0-100 的值對應到 5 個等級（0/25/50/75/100）
    const snap = v => Math.round(Number(v ?? 50) / 25) * 25;
    const toneSnap = snap(tone);
    const lengthSnap = snap(length);
    const enStyleSnap = snap(englishStyle);
    const toneIdx = toneSnap / 25; // 0..4

    const styleDescByLevel = {
        0: 'full Manglish (Malaysian English) — heavy use of lah, mah, lor, walao, aiyo, can or not. Mix Malay/Chinese words. Casual grammar.',
        25: 'casual Manglish-flavored English — sprinkle some lah/lor but stay mostly understandable',
        50: 'natural conversational English',
        75: 'polished, lightly formal English',
        100: 'fully formal, proper English'
    };
    const styleDesc = styleDescByLevel[enStyleSnap];

    // 模式一：只重新翻譯英文
    if (retranslateOnly && existingCN) {
        const translatePrompt = `將以下中文語錄翻譯成英文。翻譯風格：${styleDesc}。

中文原句：${existingCN}

注意：
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

    const lengthDescByLevel = {
        0: '一句最短，10 字內',
        25: '一句話，20 字內',
        50: '1-2 句話',
        75: '2-3 句話',
        100: '一小段，3-4 句'
    };
    const lengthDesc = lengthDescByLevel[lengthSnap];

    const systemPrompt = `你是 Bernard Liew，一個寫雞湯語錄的作者。你的風格是：直接、不繞彎、帶點幽默，不說教、不哄人，像一個稍微走在對方前面的朋友說的話。你的語錄讓人感到「被說中」而不是「被建議」。

以下是你寫過的語錄，請仔細學習這個風格和語感，然後模仿：
${examples}

現在有一個觀眾跟你分享了一些事情。請根據他說的內容，用你的風格寫**5 個版本**的雞湯語錄，對應 5 個語氣層次（由直接到溫暖）：

1. 最直接、最一針見血（像甩你一巴掌的那種）
2. 偏直接、不繞彎（但留一點喘息）
3. 平衡的，直接但有溫度
4. 偏溫暖、帶點鼓勵
5. 最溫暖、最像在哄你打氣（仍保有你的風格，不能變成空話）

所有 5 句的長度：${lengthDesc}

要求：
- 5 句的意思核心一致（都在回應觀眾說的事），只差語氣
- 不要用「加油」「相信自己」「一切都會好的」這種空泛的話
- 要像說話一樣自然，不要太文藝

另外，請把**第 ${toneIdx + 1} 個版本**翻譯成英文，風格：${styleDesc}

如果觀眾說的內容太短、沒有意義、或是亂打的文字，valid 設 false，只填 retry_message（用你的風格引導他再多說一點），tonesCN/textEN 可以空字串。

請用以下 JSON 格式回覆（不要加 markdown code block）：
{
  "valid": true/false,
  "translation": "籤文式的轉譯（客觀描述一個場景或意象，不直接說道理）",
  "tonesCN": ["第1級最直接", "第2級", "第3級平衡", "第4級", "第5級最溫暖"],
  "textEN": "第 ${toneIdx + 1} 個版本的英文翻譯",
  "retry_message": ""
}`;

    // 如果有問答 scores，加到 context 裡
    let userContext = userMessage;
    if (scores && Object.keys(scores).length > 0) {
        const topScores = Object.entries(scores)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([k, v]) => `${k}: ${v}`)
            .join(', ');
        userContext = `[觀眾的問答結果顯示他目前的狀態偏向：${topScores}]\n\n觀眾說：${userMessage}`;
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
