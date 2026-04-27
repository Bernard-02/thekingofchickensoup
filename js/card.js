// card.js — 從 URL hash 解卡片資料，渲染卡片，提供存 PNG
// URL 格式： https://.../card.html#d=<base64-url-of-json>
// JSON 欄位：{ cn, en?, r?, bg?, txt?, bd?, nb? }
//   cn: 中文語錄（必填）
//   en: 英文翻譯（可選）
//   r : reasoning/解讀文字（可選）
//   bg: 背景色 hex（預設 #f2f2f2）
//   txt: 文字色 hex（預設 #000）
//   bd: 邊框色 hex（預設 #000）
//   nb: 1 = 無邊框

(function () {
    'use strict';

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
        const el = document.getElementById('error-msg');
        el.textContent = msg;
        el.style.display = '';
    }

    function render(data) {
        if (!data || !data.cn) {
            showError('卡片資料壞掉了，再感應一次試試看？');
            return;
        }

        const card = document.getElementById('card');
        const cnEl = document.getElementById('card-cn');
        const enEl = document.getElementById('card-en');
        const rEl = document.getElementById('card-reasoning');

        cnEl.textContent = data.cn;

        if (data.en) {
            enEl.textContent = data.en;
            enEl.style.display = '';
        }

        if (data.r) {
            rEl.textContent = data.r;
            rEl.style.display = '';
        }

        // 樣式
        const bg = data.bg || '#f2f2f2';
        const txt = data.txt || '#000000';
        const bd = data.bd || '#000000';
        card.style.background = bg;
        card.style.color = txt;
        document.body.style.background = bg;
        card.style.borderColor = bd;
        if (data.nb) card.classList.add('no-border');

        document.getElementById('card-wrap').style.display = '';
        document.getElementById('actions').style.display = '';
        document.getElementById('hint').style.display = '';
    }

    window.savePNG = async function () {
        const card = document.getElementById('card');
        const btn = document.getElementById('save-btn');
        btn.disabled = true;
        btn.textContent = '處理中...';
        try {
            const canvas = await html2canvas(card, {
                backgroundColor: null,
                scale: 2,
                useCORS: true,
                logging: false,
            });
            // 觸發下載
            const link = document.createElement('a');
            link.download = 'chicken-soup-quote.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
            btn.textContent = '再存一次';
        } catch (e) {
            console.error('[card] 存圖失敗:', e);
            btn.textContent = '失敗，再試試';
        } finally {
            btn.disabled = false;
        }
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
