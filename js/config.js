// 專案配置檔案

window.CONFIG = {
    // WebSocket 設定
    // ⚠ ESP 的 IP — 開機後從 Serial Monitor 或 Windows「行動熱點」看 ESP 拿到的 IP，貼這
    //   只要這行一個地方
    websocket: { url: 'ws://192.168.137.14:81' },

    dataFiles: { quotes: 'data/quotes-selected.json' },

    // 除錯模式：關掉後只印 error
    debug: true
};

// 日誌函數（type: info / warn / error，其餘字串一律當 info）
window.log = function(message, type = 'info') {
    if (!window.CONFIG.debug && type !== 'error') return;
    const prefix = `[${new Date().toLocaleTimeString('zh-TW')}]`;
    const fn = type === 'error' ? console.error : type === 'warn' ? console.warn : console.log;
    fn(prefix, message);
};

// 模式：展覽（NFC 掃瓶子）/ 線上（按鈕取代掃描）
// 優先序：網址 ?nfc=1（展覽）/ ?nfc=0（線上）> 開發面板「切換模式」（記在這台瀏覽器）> 自動判斷
// 自動：本機（start.bat / Live Server）且畫面比手機寬 → 展覽；Vercel、手機、DevTools 手機模擬 → 線上
const MODE_KEY = 'chickensoup_use_nfc';
const autoNFC = (location.protocol === 'file:' || ['localhost', '127.0.0.1'].includes(location.hostname))
    && !matchMedia('(max-width: 767px)').matches;
const nfcParam = new URLSearchParams(location.search).get('nfc');
let savedMode = null;
try { savedMode = localStorage.getItem(MODE_KEY); } catch (e) {}
window.CONFIG.useNFC = nfcParam !== null ? nfcParam === '1'
    : savedMode !== null ? savedMode === '1'
    : autoNFC;
document.documentElement.classList.toggle('no-nfc', !window.CONFIG.useNFC);

// 切到另一個模式並重新整理；切回跟自動判斷一樣時清掉記錄，之後又照自動走
window.toggleSiteMode = function () {
    const next = !window.CONFIG.useNFC;
    if (next === autoNFC) localStorage.removeItem(MODE_KEY);
    else localStorage.setItem(MODE_KEY, next ? '1' : '0');
    location.reload();
};
