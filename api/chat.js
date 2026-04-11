// Vercel Serverless Function — Gemini API proxy
// API key 存在 Vercel 環境變數 GEMINI_API_KEY，不會暴露給前端

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

    const { userMessage, scores, tone, english, englishStyle, length } = req.body;
    if (!userMessage || !userMessage.trim()) {
        return res.status(400).json({ error: 'Empty message' });
    }

    // 語氣描述
    const toneDesc = tone > 70 ? '更溫暖、更雞湯、更鼓勵' : tone < 30 ? '更直接、更說教、更一針見血' : '平衡的，直接但不失溫度';
    const lengthDesc = length > 70 ? '可以寫長一點，一小段話（2-3句）' : length < 30 ? '精簡到一句話就好' : '1-2句話';

    let englishInstruction = '';
    if (english) {
        const styleDesc = englishStyle > 70 ? 'formal, proper English' : englishStyle < 30 ? 'casual Manglish (Malaysian English with local flavour)' : 'natural conversational English';
        englishInstruction = `\n\n同時提供英文翻譯，風格是 ${styleDesc}。`;
    }

    const systemPrompt = `你是 Bernard Liew，一個寫雞湯語錄的作者。你的風格是：直接、不繞彎、帶點幽默，不說教、不哄人，像一個稍微走在對方前面的朋友說的話。你的語錄讓人感到「被說中」而不是「被建議」。

以下是你寫過的一些語錄範例，請模仿這個風格：
- 有些事情你放不下，不是因為重要，是因為你還沒找到下一個東西可以拿。
- 你覺得自己沒有在進步，但你已經不是去年那個你了。
- 水龍頭關不緊，一直滴，但水費其實沒多少。你以為自己在崩潰，其實只是在漏氣。
- 第一次煮的菜，有點鹹，但還是吃完了。
- 不是每條路都要走到底，有些路是用來練腳力的。
- 你不需要所有人都懂你，你只需要你懂你自己就夠了。
- 累了就停下來，但不要坐太久，屁股會痛。

現在有一個觀眾跟你分享了一些事情。請根據他說的內容，用你的風格寫一句雞湯語錄給他。

要求：
- 語氣：${toneDesc}
- 長度：${lengthDesc}
- 不要用「加油」「相信自己」「一切都會好的」這種空泛的話
- 要像說話一樣自然，不要太文藝${englishInstruction}

如果觀眾說的內容太短、沒有意義、或是亂打的文字，請回覆一句引導他再多說一點的話（用你的風格），不要硬生成雞湯。

請用以下 JSON 格式回覆（不要加 markdown code block）：
{
  "valid": true/false,
  "translation": "轉譯版本（像籤文一樣，用客觀場景描述，不直接說道理）",
  "textCN": "中文語錄原句",
  "textEN": "英文翻譯（如果有要求的話，沒有就空字串）",
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
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [
                        { role: 'user', parts: [{ text: userContext }] }
                    ],
                    systemInstruction: { parts: [{ text: systemPrompt }] },
                    generationConfig: {
                        temperature: 0.9,
                        maxOutputTokens: 512,
                    }
                })
            }
        );

        if (!response.ok) {
            const err = await response.text();
            console.error('Gemini API error:', err);
            return res.status(502).json({ error: 'Gemini API error' });
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
            return res.status(502).json({ error: 'Empty response from Gemini' });
        }

        // 嘗試解析 JSON（Gemini 有時會加 markdown code block）
        const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const result = JSON.parse(cleaned);

        return res.status(200).json(result);
    } catch (err) {
        console.error('Server error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
