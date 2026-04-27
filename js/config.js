// 專案配置檔案

window.CONFIG = {
    // WebSocket 設定
    websocket: {
        // ⚠ ESP 的 IP — 開機後從 Serial Monitor 或 Windows「行動熱點」看 ESP 拿到的 IP，貼這
        //   只要這行一個地方
        url: 'ws://192.168.137.218:81',
        reconnectMinInterval: 200,
        reconnectMaxInterval: 3000,
        heartbeatInterval: 3000,
        heartbeatTimeoutMs: 9000,
        maxReconnectAttempts: 30
    },

    // NFC 分類對應
    nfcCategories: {
        // UID 前綴 -> 分類名稱
        // 可以根據實際 NFC 標籤的 UID 來設定
        'A': 'category1',
        'B': 'category2',
        'C': 'category3'
    },

    // 資料檔案路徑
    dataFiles: {
        quotes: 'data/quotes-selected.json',
        contexts: 'data/contexts.json'
    },

    // 視覺設定
    visual: {
        backgroundColor: '#f2f2f2',
        textColor: '#000000',
        transitionDuration: 500 // 頁面切換時間（毫秒）
    },

    // 除錯模式
    debug: true
};

// 日誌函數
window.log = function(message, type = 'info') {
    if (!window.CONFIG.debug && type !== 'error') return;

    const timestamp = new Date().toLocaleTimeString('zh-TW');
    const prefix = `[${timestamp}]`;

    switch (type) {
        case 'error':
            console.error(prefix, message);
            break;
        case 'warn':
            console.warn(prefix, message);
            break;
        default:
            console.log(prefix, message);
    }

    // 添加到 UI 日誌（如果存在）
    const logContainer = document.getElementById('log-container');
    if (logContainer) {
        const logEntry = document.createElement('p');
        logEntry.className = `log-${type}`;
        logEntry.textContent = `${prefix} ${message}`;
        logContainer.appendChild(logEntry);
        logContainer.scrollTop = logContainer.scrollHeight;
    }
};

// 創建全局別名以便向後兼容
const CONFIG = window.CONFIG;
const log = window.log;