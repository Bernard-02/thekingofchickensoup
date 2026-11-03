// card.js — 從 URL hash 解卡片資料，排版成 1080×1920 → 拍成 PNG 當預覽，提供儲存
// URL 格式： https://.../card.html#d=<base64-url-of-json>
// JSON 欄位：{ n?, cn, en?, r?, bg?, txt?, bd?, nb? }
//   n : 雞湯編號（可選，AI 雞湯沒有）
//   cn: 中文語錄（必填）
//   en: 英文翻譯（可選）
//   r : reasoning/解讀文字（可選）
//   bg: 背景色 hex（預設 #f2f2f2）
//   txt: 文字色 hex（預設 #000）
//   bd: 邊框色 hex（預設 #000）
//   nb: 1 = 無邊框

(function () {
    'use strict';

    // iOS 的 <a download> 只會存到「檔案」，要叫出分享選單才有「儲存影像」進相簿
    const IS_IOS = /iPhone|iPad|iPod/.test(navigator.userAgent)
        || (/Mac/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
    let imgFile = null;

    function decodeBase64Url(b64) {
        // base64url → base64
        const padded = b64.replace(/-/g, '+').replace(/_/g, '/');
        const binary = atob(padded + '='.repeat((4 - padded.length % 4) % 4));
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return new TextDecoder().decode(bytes);
    }

    function parseHash() {
        const hash = location.hash.replace(/^#/, '');
        if (!hash) return null;
        const params = new URLSearchParams(hash);
        const d = params.get('d');
        if (!d) return null;
        try {
            return JSON.parse(decodeBase64Url(d));
        } catch (e) {
            console.error('[card] 無法解析資料:', e);
            return null;
        }
    }

    function showError(msg) {
        document.getElementById('loading').style.display = 'none';
        const el = document.getElementById('error-msg');
        el.textContent = msg;
        el.style.display = '';
    }

    function setText(id, text) {
        const el = document.getElementById(id);
        el.textContent = text || '';
        el.style.display = text ? '' : 'none';
    }

    async function render(data) {
        if (!data || !data.cn) {
            showError('卡片資料壞掉了，再感應一次試試看？');
            return;
        }

        setText('card-num', data.n ? `#${data.n}` : '');
        setText('card-cn', data.cn);
        setText('card-en', data.en);
        setText('card-reasoning', data.r);

        // 樣式
        const card = document.getElementById('card');
        const bg = data.bg || '#f2f2f2';
        card.style.background = bg;
        card.style.color = data.txt || '#000000';
        card.style.borderColor = data.bd || '#000000';
        card.classList.toggle('no-border', !!data.nb);
        document.body.style.background = bg;

        // logo：淺底用黑 logo，深底用白 logo（html2canvas 不支援 filter，只能換檔）
        const [r, g, b] = [1, 3, 5].map(i => parseInt(bg.slice(i, i + 2), 16));
        const logo = document.getElementById('card-logo');
        logo.src = (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? 'Logo/雞湯Logo.png' : 'Logo/雞湯Logo White.png';

        // 字型（unicode-range 分檔，要指定這段字才會載到對的檔）、logo 都到齊才拍
        await Promise.all([
            document.fonts.load('500 64px "Noto Sans TC"', data.cn),
            document.fonts.load('400 48px "Inter"', `#${data.n || ''} ${data.en || ''}`),
            logo.decode().catch(() => {}),
        ]);
        await document.fonts.ready;

        try {
            const canvas = await html2canvas(card, { scale: 1, backgroundColor: null, logging: false });
            const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
            imgFile = new File([blob], `chicken-soup-${data.n || 'quote'}.png`, { type: 'image/png' });
        } catch (e) {
            console.error('[card] 出圖失敗:', e);
            showError('卡片做不出來，重新整理再試一次？');
            return;
        }

        const img = document.getElementById('card-img');
        if (img.src) URL.revokeObjectURL(img.src);
        img.src = URL.createObjectURL(imgFile);
        img.style.display = '';
        document.getElementById('loading').style.display = 'none';
        document.getElementById('actions').style.display = '';
        if (matchMedia('(pointer: coarse)').matches) document.getElementById('hint').style.display = '';
    }

    window.savePNG = async function () {
        if (!imgFile) return;
        if (IS_IOS && navigator.canShare && navigator.canShare({ files: [imgFile] })) {
            try { await navigator.share({ files: [imgFile] }); } catch (e) { /* 使用者關掉分享選單 */ }
            return;
        }
        const link = document.createElement('a');
        link.download = imgFile.name;
        link.href = document.getElementById('card-img').src;
        link.click();
    };

    // 啟動
    const data = parseHash();
    if (data) {
        render(data);
    } else {
        showError('這個網址沒有帶卡片資料，請從裝置那邊感應一次。');
    }

    // hash 改變時重新渲染（例如從另一張卡片來）
    window.addEventListener('hashchange', () => {
        const d = parseHash();
        if (d) render(d);
    });
})();
