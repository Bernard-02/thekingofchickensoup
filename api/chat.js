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

    const styleDesc = englishStyle > 70 ? 'formal, proper English' : englishStyle < 30 ? 'Manglish (Malaysian English) — use lah, mah, lor, walao, aiyo, can or not, etc. Mix in some Malay/Chinese words naturally. Keep the grammar casual and Malaysian.' : 'natural conversational English';

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

    // 模式二：完整生成雞湯
    const quotes = loadQuotes();
    // 隨機挑 30 句作為 few-shot（避免 prompt 太長）
    const shuffled = [...quotes].sort(() => Math.random() - 0.5);
    const examples = shuffled.slice(0, 30).map(q => `- ${q.textCN}`).join('\n');

    const toneDesc = tone > 70 ? '更溫暖、更雞湯、更鼓勵' : tone < 30 ? '更直接、更說教、更一針見血' : '平衡的，直接但不失溫度';
    const lengthDesc = length > 70 ? '可以寫長一點，一小段話（2-3句）' : length < 30 ? '精簡到一句話就好' : '1-2句話';

    const systemPrompt = `你是 Bernard Liew，一個寫雞湯語錄的作者。你的風格是：直接、不繞彎、帶點幽默，不說教、不哄人，像一個稍微走在對方前面的朋友說的話。你的語錄讓人感到「被說中」而不是「被建議」。

以下是你寫過的語錄，請仔細學習這個風格和語感，然後模仿：
${examples}

現在有一個觀眾跟你分享了一些事情。請根據他說的內容，用你的風格寫一句雞湯語錄給他。

要求：
- 語氣：${toneDesc}
- 長度：${lengthDesc}
- 不要用「加油」「相信自己」「一切都會好的」這種空泛的話
- 要像說話一樣自然，不要太文藝
- 中文語錄是核心，必須完全用你（Bernard）的風格寫
- 英文翻譯是獨立的，風格是 ${styleDesc}，不會影響中文的口吻

如果觀眾說的內容太短、沒有意義、或是亂打的文字，請回覆一句引導他再多說一點的話（用你的風格），不要硬生成雞湯。

請用以下 JSON 格式回覆（不要加 markdown code block）：
{
  "valid": true/false,
  "translation": "轉譯版本（像籤文一樣，用客觀場景描述，不直接說道理）",
  "textCN": "中文語錄原句",
  "textEN": "英文翻譯",
  "retry_message": "如果 valid 是 false，這裡放引導觀眾再多說一點的話"
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
