// 專案配置檔案

const CONFIG = {
    // WebSocket 設定
    websocket: {
        // ESP8266 的 IP 位址（Station 模式 - 連接到 Louisa Router）
        url: 'ws://192.168.50.177:81',
        reconnectInterval: 3000, // 重連間隔（毫秒）
        heartbeatInterval: 30000 // 心跳間隔（毫秒）
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
        quotes: 'data/quotes.json',
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
function log(message, type = 'info') {
    if (!CONFIG.debug && type !== 'error') return;

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
}