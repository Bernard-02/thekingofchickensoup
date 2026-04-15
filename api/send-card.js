// 寄送雞湯卡片到使用者 email
// 需要 Vercel 環境變數：GMAIL_USER / GMAIL_APP_PASSWORD

const nodemailer = require('nodemailer');

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { email, pngBase64, quoteTextCN } = req.body || {};

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Invalid email' });
    }
    if (!pngBase64 || typeof pngBase64 !== 'string') {
        return res.status(400).json({ error: 'Missing PNG data' });
    }

    const gmailUser = process.env.GMAIL_USER;
    const gmailPass = process.env.GMAIL_APP_PASSWORD;
    if (!gmailUser || !gmailPass) {
        return res.status(500).json({ error: 'Gmail credentials not configured' });
    }

    // 把 dataURL 剝成 raw base64
    const b64 = pngBase64.replace(/^data:image\/png;base64,/, '');
    const buffer = Buffer.from(b64, 'base64');

    const preview = (quoteTextCN || '你的雞湯').slice(0, 40);

    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: gmailUser, pass: gmailPass },
        });

        await transporter.sendMail({
            from: `"這個人超會寫雞湯" <${gmailUser}>`,
            to: email,
            subject: '你的雞湯到了',
            text: `附上你剛收藏的那句雞湯：\n\n${preview}\n\n— 這個人超會寫雞湯`,
            html: `
                <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:24px;">
                    <p style="font-size:16px;line-height:1.6;color:#000;">附上你剛收藏的那句雞湯。</p>
                    <p style="font-size:18px;line-height:1.6;color:#000;margin:24px 0;">${preview}</p>
                    <img src="cid:quote-card" alt="雞湯卡片" style="width:100%;border:1px solid #000;" />
                    <p style="font-size:12px;color:#888;margin-top:24px;">— 這個人超會寫雞湯</p>
                </div>
            `,
            attachments: [
                {
                    filename: 'chicken-soup-quote.png',
                    content: buffer,
                    cid: 'quote-card',
                },
            ],
        });

        return res.status(200).json({ ok: true });
    } catch (err) {
        console.error('[send-card]', err);
        return res.status(502).json({ error: err.message });
    }
};
