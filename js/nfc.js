// NFC WebSocket 通訊模組

class NFCManager {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.reconnectTimer = null;
        this.heartbeatTimer = null;

        // 事件回調
        this.onReadCallback = null;
        this.onWriteCallback = null;
        this.onConnectCallback = null;
        this.onDisconnectCallback = null;
        this.onRemoveCallback = null;
    }

    // 連線到 ESP8266
    connect(url = CONFIG.websocket.url) {
        try {
            log(`嘗試連線到 ${url}`);
            this.ws = new WebSocket(url);

            this.ws.onopen = () => {
                log('WebSocket 連線成功', 'info');
                this.isConnected = true;
                this.updateUIStatus(true);
                this.startHeartbeat();

                if (this.onConnectCallback) {
                    this.onConnectCallback();
                }
            };

            this.ws.onmessage = (event) => {
                this.handleMessage(event.data);
            };

            this.ws.onerror = (error) => {
                log(`WebSocket 錯誤: ${error}`, 'error');
            };

            this.ws.onclose = () => {
                log('WebSocket 連線關閉', 'warn');
                this.isConnected = false;
                this.updateUIStatus(false);
                this.stopHeartbeat();

                if (this.onDisconnectCallback) {
                    this.onDisconnectCallback();
                }

                // 自動重連
                this.scheduleReconnect();
            };

        } catch (error) {
            log(`連線失敗: ${error}`, 'error');
        }
    }

    // 處理接收到的訊息
    handleMessage(data) {
        try {
            const message = JSON.parse(data);
            log(`收到訊息: ${JSON.stringify(message)}`, 'info');

            switch (message.type) {
                case 'nfc_read':
                    this.handleNFCRead(message.data);
                    break;
                case 'nfc_removed':
                    this.handleNFCRemoved(message.data);
                    break;
                case 'nfc_write_success':
                    this.handleNFCWriteSuccess(message.data);
                    break;
                case 'nfc_write_error':
                    this.handleNFCWriteError(message.data);
                    break;
                case 'heartbeat':
                    // 心跳回應
                    break;
                default:
                    log(`未知的訊息類型: ${message.type}`, 'warn');
            }
        } catch (error) {
            log(`解析訊息失敗: ${error}`, 'error');
        }
    }

    // 處理 NFC 讀取
    handleNFCRead(data) {
        log(`NFC 讀取: UID=${data.uid}`, 'info');

        // 更新 UI
        const resultDiv = document.getElementById('nfc-read-result');
        if (resultDiv) {
            resultDiv.innerHTML = `
                <p class="font-semibold">偵測到 NFC 標籤！</p>
                <p class="mt-2">UID: ${data.uid}</p>
                ${data.content ? `<p class="mt-2">內容: ${data.content}</p>` : ''}
            `;
        }

        // 觸發回調
        if (this.onReadCallback) {
            this.onReadCallback(data);
        }
    }

    // 處理 NFC 移除
    handleNFCRemoved(data) {
        log(`NFC 標籤移除: UID=${data.uid}`, 'info');

        // 更新 UI
        const resultDiv = document.getElementById('nfc-read-result');
        if (resultDiv) {
            resultDiv.innerHTML = '<p>等待 NFC 標籤...</p>';
        }

        // 觸發回調
        if (this.onRemoveCallback) {
            this.onRemoveCallback(data);
        }
    }

    // 處理 NFC 寫入成功
    handleNFCWriteSuccess(data) {
        log('NFC 寫入成功', 'info');

        const resultDiv = document.getElementById('nfc-write-result');
        if (resultDiv) {
            resultDiv.innerHTML = '<p class="text-green-600">✓ 寫入成功！</p>';
        }

        if (this.onWriteCallback) {
            this.onWriteCallback(true, data);
        }
    }

    // 處理 NFC 寫入錯誤
    handleNFCWriteError(data) {
        log(`NFC 寫入失敗: ${data.error}`, 'error');

        const resultDiv = document.getElementById('nfc-write-result');
        if (resultDiv) {
            resultDiv.innerHTML = `<p class="text-red-600">✗ 寫入失敗: ${data.error}</p>`;
        }

        if (this.onWriteCallback) {
            this.onWriteCallback(false, data);
        }
    }

    // 發送訊息
    send(type, data = {}) {
        if (!this.isConnected || !this.ws) {
            log('未連線，無法發送訊息', 'error');
            return false;
        }

        try {
            const message = JSON.stringify({ type, data });
            this.ws.send(message);
            log(`發送訊息: ${message}`, 'sent');
            return true;
        } catch (error) {
            log(`發送訊息失敗: ${error}`, 'error');
            return false;
        }
    }

    // 寫入 NFC
    writeNFC(content) {
        return this.send('nfc_write', { content });
    }

    // 請求讀取 NFC
    requestRead() {
        return this.send('nfc_read_request');
    }

    // 心跳
    startHeartbeat() {
        this.heartbeatTimer = setInterval(() => {
            if (this.isConnected) {
                this.send('heartbeat');
            }
        }, CONFIG.websocket.heartbeatInterval);
    }

    stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    // 重新連線
    scheduleReconnect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }

        this.reconnectTimer = setTimeout(() => {
            log('嘗試重新連線...', 'info');
            this.connect();
        }, CONFIG.websocket.reconnectInterval);
    }

    // 更新 UI 狀態
    updateUIStatus(connected) {
        const statusDot = document.getElementById('ws-status');
        const statusText = document.getElementById('ws-status-text');

        if (statusDot) {
            statusDot.className = connected
                ? 'w-4 h-4 rounded-full bg-green-500'
                : 'w-4 h-4 rounded-full bg-red-500';
        }

        if (statusText) {
            statusText.textContent = connected ? '已連線' : '未連線';
        }
    }

    // 斷線
    disconnect() {
        if (this.ws) {
            this.ws.close();
        }
        this.stopHeartbeat();
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }
    }

    // 設定事件監聽器
    onRead(callback) {
        this.onReadCallback = callback;
    }

    onRemove(callback) {
        this.onRemoveCallback = callback;
    }

    onWrite(callback) {
        this.onWriteCallback = callback;
    }

    onConnect(callback) {
        this.onConnectCallback = callback;
    }

    onDisconnect(callback) {
        this.onDisconnectCallback = callback;
    }
}

// 全域 NFC 管理器實例
const nfcManager = new NFCManager();