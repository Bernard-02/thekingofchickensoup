// NFC WebSocket 通訊模組

// 把 UID 對應的編號回傳給 ESP，讓它印在 Serial Monitor 上
// 方便測試時對照實體卡 / quotes-selected.json 的標號
function logScanToEsp(uid, matchText) {
    if (!window.nfcManager || !window.nfcManager.ws || !window.nfcManager.isConnected) return;
    try {
        window.nfcManager.ws.send(JSON.stringify({
            type: 'log_scan', uid, match: matchText
        }));
    } catch (e) {}
}

class NFCManager {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.currentQuoteNumber = -1; // 當前顯示的雞湯編號

        // 事件回調
        this.onWriteCallback = null;
        this.onConnectCallback = null;
        this.onDisconnectCallback = null;
    }

    // 連線到 ESP8266 — 最樸素的 vanilla WebSocket
    // 開 → 用 → 斷了 setTimeout 2 秒重連，沒了
    // 沒有 library、沒有 heartbeat watchdog、沒有複雜的重連邏輯
    connect(url = CONFIG.websocket.url) {
        log(`連線到 ${url}`);
        this._url = url;
        this.ws = new WebSocket(url);

        this.ws.addEventListener('open', () => {
            log('WebSocket 連線成功', 'info');
            this.isConnected = true;
            this.updateUIStatus(true);
            if (this.onConnectCallback) this.onConnectCallback();
        });

        this.ws.addEventListener('message', (event) => {
            this.handleMessage(event.data);
        });

        this.ws.addEventListener('close', () => {
            log('WebSocket 連線關閉，2 秒後重連', 'warn');
            this.isConnected = false;
            this.updateUIStatus(false);
            if (this.onDisconnectCallback) this.onDisconnectCallback();
            // 純粹斷了再連，沒有指數 backoff、沒有 retry limit
            setTimeout(() => this.connect(this._url), 2000);
        });

        // error 不用處理 — close 會跟著 fire，重連在那邊做就好
    }

    // 處理接收到的訊息
    handleMessage(data) {
        try {
            const message = JSON.parse(data);
            log(`收到訊息: ${JSON.stringify(message)}`, 'info');

            switch (message.type) {
                case 'connected':
                    log('ESP8266 連線確認', 'info');
                    break;
                case 'nfc_hold_start':
                    // 觸發卡剛被放上去 → 通知熬製頁開始 5 秒 hold 計時
                    if (typeof window.onNfcHoldStart === 'function') window.onNfcHoldStart();
                    break;
                case 'nfc_hold_end':
                    // 觸發卡離開 → 暫停 hold 計時（保留目前進度）
                    if (typeof window.onNfcHoldEnd === 'function') window.onNfcHoldEnd();
                    break;
                case 'random_quote':
                    // 萬用卡：隨機抽雞湯 / soup / panel 階段當任意瓶子
                    this.handleRandomQuote(message);
                    break;
                case 'ai_reveal':
                    // AI 解鎖卡：只在 chat-result-view 揭曉 AI 原句
                    this.handleAIReveal();
                    break;
                case 'show_context':
                    // 處理顯示脈絡（舊版，保留相容性）
                    this.handleShowContext(message);
                    break;
                case 'nfc_write_success':
                    this.handleNFCWriteSuccess(message.data);
                    break;
                case 'nfc_write_error':
                    this.handleNFCWriteError(message.data);
                    break;
                case 'nfc_emulate_ready':
                    // 韌體已切成模擬模式，等待觀眾感應
                    if (typeof window.onNFCEmulateReady === 'function') window.onNFCEmulateReady();
                    break;
                case 'nfc_emulate_read':
                    // 觀眾手機讀到了 → 通知前端收尾
                    if (typeof window.onNFCEmulateRead === 'function') window.onNFCEmulateRead();
                    break;
                case 'nfc_emulate_timeout':
                    // 模擬模式超時，回到 reader 模式
                    if (typeof window.onNFCEmulateTimeout === 'function') window.onNFCEmulateTimeout();
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

    // 處理萬用卡（抽籤 + soup/panel 階段當任意瓶子）
    async handleRandomQuote(message = {}) {
        log('收到萬用卡掃描指令', 'info');
        logScanToEsp('(wildcard)', '萬用卡');

        // 熬製頁（fallback 舊韌體沒發 nfc_hold_start）：當成 hold_start 啟動計時
        const cookingView = document.getElementById('cooking-view');
        if (cookingView && cookingView.classList.contains('active')) {
            log('在熬製頁：把 wildcard 當成 hold_start', 'info');
            if (typeof window.onNfcHoldStart === 'function') window.onNfcHoldStart();
            return;
        }

        // 展覽行為：萬用卡——
        // 在 soup-result-view scan 模式（差最後一步）掃到萬用卡
        // → 當成正確瓶子已掃到，啟動 5 秒 reveal hold
        const soupView = document.getElementById('soup-result-view');
        if (soupView && soupView.classList.contains('active') && window.soupViewMode === 'scan') {
            log('soup scan 頁掃到萬用卡：啟動 reveal hold', 'info');
            if (typeof window.startRevealHold === 'function') {
                window.startRevealHold('WILDCARD', 'scan');
            }
            return;
        }

        // 展覽行為：quote panel 已開時掃萬用卡 → 一樣當成匹配，啟動 reveal hold
        const panel = document.getElementById('quote-slide-panel');
        if (panel && panel.classList.contains('open')) {
            log('quote panel 已開、掃到萬用卡：啟動 reveal hold', 'info');
            if (typeof window.startRevealHold === 'function') {
                window.startRevealHold('WILDCARD', 'panel');
            }
            return;
        }

        // 檢查當前是否在 waiting-nfc-view 頁面
        const waitingView = document.getElementById('waiting-nfc-view');
        if (!waitingView || !waitingView.classList.contains('active')) {
            log('NFC 掃描無效：必須在等待 NFC 頁面才能掃描', 'warn');
            return;
        }

        try {
            // 載入雞湯資料
            const response = await fetch(CONFIG.dataFiles.quotes);
            let quotes = await response.json();

            if (quotes.length === 0) {
                log('沒有雞湯資料', 'warn');
                return;
            }

            // 從 selected 的 100 筆中選（= 有實體 NFC 卡的那 100 句）
            quotes = quotes.slice(0, 100);

            // 🧠 匯入我們的 3D 計分邏輯大腦
            const { getQuizResult } = await import('./quizLogic.js');
            
            let finalQuote;
            let resultCombo = [];
            
            // 如果有做測驗 (存在 userAnswers)，就使用 3D 匹配邏輯
            if (this.userAnswers && this.userAnswers.length > 0) {
                const result = getQuizResult(this.userAnswers, quotes);
                finalQuote = result.quote;
                resultCombo = result.userCombo;
                log(`🎯 測驗匹配選中: #${finalQuote.number} (痛點組合: ${resultCombo.join(', ')})`, 'info');
            } else {
                // 否則維持原本的隨機盲抽邏輯 (防呆機制)
                finalQuote = quotes[Math.floor(Math.random() * quotes.length)];
                log(`隨機選中: #${finalQuote.number}`, 'info');
            }

            // 發送當前雞湯編號給 ESP8266
            this.updateCurrentQuote(finalQuote.number);

            // 切到 Quotes 頁、跑 list 入場動畫 + scroll 到抽中那句
            if (typeof window.showView === 'function') {
                window.switchInfoTab('quotes');
                window.showView('info-website-view');
                if (typeof window.buildQuotesList === 'function') {
                    await window.buildQuotesList(finalQuote.number);
                }

                // list 動畫大約 2.5s 跑完後自動 slide in 對應 quote panel
                // 用 main.js 的 setDecodeOpenTimer → 離開 view 會自動 cancel，避免殘留
                const openFn = () => {
                    if (typeof window.openQuotePanel === 'function') {
                        log(`自動 slide in quote panel #${finalQuote.number}`, 'info');
                        window.openQuotePanel(finalQuote);
                    } else {
                        log('警告：openQuotePanel 未定義，無法自動開啟 panel', 'warn');
                    }
                };
                if (typeof window.setDecodeOpenTimer === 'function') {
                    window.setDecodeOpenTimer(openFn, 2800);
                } else {
                    setTimeout(openFn, 2800);
                }
            }

        } catch (error) {
            log(`載入雞湯失敗: ${error}`, 'error');
        }
    }

    // 處理 AI 解鎖卡：只在 chat-result-view 有效，揭曉 AI 生成的原句
    handleAIReveal() {
        log('收到 AI 解鎖卡掃描指令', 'info');
        logScanToEsp('(ai)', 'AI 解鎖卡');

        const chatResultView = document.getElementById('chat-result-view');
        if (chatResultView && chatResultView.classList.contains('active')) {
            log('在 AI 結果頁，觸發解碼 AI 原句', 'info');
            if (typeof window.revealChatQuote === 'function') {
                window.revealChatQuote();
            } else {
                log('警告：revealChatQuote 函數未定義', 'warn');
            }
            return;
        }

        log('不在 chat-result-view，AI 卡掃描忽略（這張卡只能用來解鎖 AI 雞湯）', 'info');
    }

    async handleShowContext(message) {
        const { uid } = message;
        log(`掃描到 NFC UID: "${uid}"`, 'info');

        try {
            const response = await fetch(CONFIG.dataFiles.quotes);
            const quotes = await response.json();
            const matchedQuote = quotes.find(q => q.nfcUID === uid);

            if (!matchedQuote) {
                log(`找不到匹配的雞湯，UID: ${uid}`, 'warn');
                logScanToEsp(uid, '(未登錄)');
                return;
            }

            log(`✓ 找到匹配的雞湯: #${matchedQuote.number}`, 'info');
            logScanToEsp(uid, `#${matchedQuote.number}`);

            // 在「差最後一步」掃描提示頁（soup-result-view scan 模式）
            // UID 對上抽中的瓶號 → 啟動 5 秒 hold，hold 滿才揭曉
            const soupView = document.getElementById('soup-result-view');
            const inScanPrompt =
                soupView && soupView.classList.contains('active') && window.soupViewMode === 'scan';
            if (inScanPrompt) {
                const expected = window.finalQuizResult && window.finalQuizResult.quote
                    ? window.finalQuizResult.quote.number
                    : null;
                if (expected === matchedQuote.number) {
                    if (typeof window.startRevealHold === 'function') {
                        window.startRevealHold(uid, 'scan');
                    }
                } else {
                    log(`⚠ 錯誤的瓶子：應掃 #${expected}，掃的是 #${matchedQuote.number}`, 'warn');
                    this.shakeWrongBottleHint();
                }
                return;
            }

            const panel = document.getElementById('quote-slide-panel');
            const isOpen = panel && panel.classList.contains('open');

            // panel 沒開就忽略（不自動開）
            if (!isOpen) {
                log('panel 未開啟，忽略 NFC 掃描', 'info');
                return;
            }

            // panel 已開 → UID 完全對應 → 啟動 5 秒 hold
            const openedNumber = window.currentOpenedQuoteNumber;
            if (openedNumber === matchedQuote.number) {
                if (typeof window.startRevealHold === 'function') {
                    window.startRevealHold(uid, 'panel');
                }
            } else {
                log(`⚠ 錯誤的瓶子：面板是 #${openedNumber}，掃的是 #${matchedQuote.number}`, 'warn');
                this.shakeWrongBottleHint();
            }
        } catch (error) {
            log(`處理 NFC 掃描時發生錯誤: ${error}`, 'error');
        }
    }

    // 發送當前顯示的雞湯編號給 ESP8266
    updateCurrentQuote(quoteNumber) {
        // 無論是否連線，都先儲存到本地
        this.currentQuoteNumber = quoteNumber;
        log(`已更新本地雞湯編號: ${quoteNumber}`, 'info');

        if (!this.isConnected || !this.ws) {
            log('未連線，無法發送雞湯編號給 ESP8266', 'warn');
            return false;
        }

        try {
            const message = JSON.stringify({
                type: 'update_current_quote',
                quoteNumber: quoteNumber
            });
            this.ws.send(message);
            log(`已發送當前雞湯編號給 ESP8266: ${quoteNumber}`, 'sent');
            return true;
        } catch (error) {
            log(`發送雞湯編號失敗: ${error}`, 'error');
            return false;
        }
    }

    // 處理 NFC 寫入成功
    handleNFCWriteSuccess(data) {
        const { quoteNumber, url } = data;
        log(`NFC 寫入成功！雞湯 #${quoteNumber}`, 'info');

        // 顯示成功提示（可以用更好的 UI，這裡先用 alert）
        const currentQuote = localStorage.getItem('currentQuote');
        if (currentQuote) {
            const quote = JSON.parse(currentQuote);

            // 驗證寫入的編號與當前顯示的一致
            if (quote.number === quoteNumber) {
                // 創建成功提示 overlay
                this.showWriteSuccessOverlay(quote, url);
            } else {
                log(`警告：寫入的編號 (${quoteNumber}) 與當前顯示的 (${quote.number}) 不一致`, 'warn');
            }
        }

        const resultDiv = document.getElementById('nfc-write-result');
        if (resultDiv) {
            resultDiv.innerHTML = `<p class="text-green-600">✓ 雞湯 #${quoteNumber} 已儲存到 NFC！</p>`;
        }

        if (this.onWriteCallback) {
            this.onWriteCallback(true, data);
        }
    }

    // 顯示寫入成功的 overlay
    showWriteSuccessOverlay(quote, url) {
        // 創建 overlay
        const overlay = document.createElement('div');
        overlay.id = 'write-success-overlay';
        overlay.className = 'fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50';
        overlay.innerHTML = `
            <div class="bg-white rounded-2xl p-8 mx-4 max-w-md text-center transform scale-0 transition-transform duration-300">
                <div class="text-6xl mb-4">✓</div>
                <h2 class="text-2xl font-bold mb-2">儲存成功！</h2>
                <p class="text-lg text-gray-600 mb-4">雞湯 #${quote.number} 已寫入 NFC 卡片</p>
                <p class="text-sm text-gray-400 mb-6 break-all">${url}</p>
                <p class="text-base text-gray-500">用手機掃描這張卡片<br>即可隨時查看這句雞湯</p>
            </div>
        `;

        document.body.appendChild(overlay);

        // 動畫效果
        setTimeout(() => {
            overlay.querySelector('div').classList.remove('scale-0');
            overlay.querySelector('div').classList.add('scale-100');
        }, 50);

        // 3 秒後自動關閉
        setTimeout(() => {
            overlay.querySelector('div').classList.remove('scale-100');
            overlay.querySelector('div').classList.add('scale-0');
            setTimeout(() => overlay.remove(), 300);
        }, 3000);

        // 點擊關閉
        overlay.addEventListener('click', () => {
            overlay.querySelector('div').classList.remove('scale-100');
            overlay.querySelector('div').classList.add('scale-0');
            setTimeout(() => overlay.remove(), 300);
        });
    }

    // 處理 NFC 寫入錯誤
    handleNFCWriteError(data) {
        const { quoteNumber, error } = data;
        log(`NFC 寫入失敗: ${error}`, 'error');

        // 錯誤訊息對應
        const errorMessages = {
            'no_quote_displayed': '目前沒有顯示任何雞湯，請先選擇一個分類',
            'write_failed': '寫入失敗，請確認 NFC 卡片放置正確',
            'card_removed': 'NFC 卡片已移除，請重新放置卡片'
        };

        const message = errorMessages[error] || `發生錯誤：${error}`;

        // 顯示錯誤提示
        this.showWriteErrorOverlay(message);

        const resultDiv = document.getElementById('nfc-write-result');
        if (resultDiv) {
            resultDiv.innerHTML = `<p class="text-red-600">✗ ${message}</p>`;
        }

        if (this.onWriteCallback) {
            this.onWriteCallback(false, data);
        }
    }

    // 顯示寫入失敗的 overlay
    showWriteErrorOverlay(message) {
        const overlay = document.createElement('div');
        overlay.id = 'write-error-overlay';
        overlay.className = 'fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50';
        overlay.innerHTML = `
            <div class="bg-white rounded-2xl p-8 mx-4 max-w-md text-center transform scale-0 transition-transform duration-300">
                <div class="text-6xl mb-4 text-red-500">✗</div>
                <h2 class="text-2xl font-bold mb-2 text-red-600">儲存失敗</h2>
                <p class="text-lg text-gray-600">${message}</p>
            </div>
        `;

        document.body.appendChild(overlay);

        setTimeout(() => {
            overlay.querySelector('div').classList.remove('scale-0');
            overlay.querySelector('div').classList.add('scale-100');
        }, 50);

        setTimeout(() => {
            overlay.querySelector('div').classList.remove('scale-100');
            overlay.querySelector('div').classList.add('scale-0');
            setTimeout(() => overlay.remove(), 300);
        }, 2500);

        overlay.addEventListener('click', () => {
            overlay.querySelector('div').classList.remove('scale-100');
            overlay.querySelector('div').classList.add('scale-0');
            setTimeout(() => overlay.remove(), 300);
        });
    }

    // 新版：在 quote panel 的 hint 文字上顯示錯誤提示 + 抖動
    shakeWrongBottleHint() {
        const hint = document.getElementById('quote-panel-hint');
        const panelContent = document.getElementById('quote-panel-content');
        if (!hint) return;

        const originalText = hint.dataset.originalText || hint.textContent;
        hint.dataset.originalText = originalText;

        const prefixes = [
            '人生難免會遇到一些挫折。',
            '人非聖賢，孰能無過，拿錯瓶子也沒關係。',
            '再用心檢查你手上的瓶子編號。'
        ];
        const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
        hint.textContent = `${prefix}這不是對應的瓶子，請再試一次。`;
        hint.style.color = '#c00';
        hint.style.opacity = '1';

        // 抖動：panel 左右來回 ~8px
        if (panelContent && typeof gsap !== 'undefined') {
            gsap.fromTo(panelContent,
                { x: -8 },
                { x: 0, duration: 0.45, ease: 'elastic.out(1.2, 0.3)', clearProps: 'x' }
            );
        }

        // 2.5 秒後還原 hint
        clearTimeout(this._wrongBottleTimer);
        this._wrongBottleTimer = setTimeout(() => {
            hint.style.color = '';
            hint.style.opacity = '0.5';
            hint.textContent = originalText;
        }, 2500);
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

    // 要求 ESP8266 進入 NFC tag 模擬模式，把 url 當成 NDEF 給觀眾手機讀
    // 成功後韌體會發 { type: 'nfc_emulate_read' }；timeout 會發 { type: 'nfc_emulate_timeout' }
    emulateNDEF(url) {
        if (!this.isConnected || !this.ws) {
            log('未連線，無法進入模擬模式', 'error');
            return false;
        }
        try {
            // 為了和既有 firmware 訊息格式相容，直接平攤欄位到頂層
            const msg = JSON.stringify({ type: 'emulate_ndef', url });
            this.ws.send(msg);
            log(`發送模擬指令: ${msg}`, 'sent');
            return true;
        } catch (e) {
            log(`模擬指令失敗: ${e}`, 'error');
            return false;
        }
    }

    // 請求讀取 NFC
    requestRead() {
        return this.send('nfc_read_request');
    }

    // 不再用 heartbeat — vanilla WebSocket 斷了 onclose 就會 fire，重連邏輯在 connect() 裡
    startHeartbeat() {}
    stopHeartbeat() {}

    // 更新 UI 狀態
    // 展覽行為：整個指示器永遠隱藏，觀眾不會看到任何「已連線/未連線」的提示
    // 要除錯時直接看 console log（log 還會繼續印），或臨時把下面那行 display = 'none' 換成 'flex'
    // 右下角小指示器（CSS 預設半透明，hover 才滿不透明）
    // 點 / 紅 = 沒連線、綠 = 已連線。觀眾不太會注意到，給你後台 debug 用
    updateUIStatus(connected, customMessage = null) {
        const statusDot = document.getElementById('ws-status');
        const statusText = document.getElementById('ws-status-text');

        if (statusDot) statusDot.classList.toggle('connected', connected);

        if (statusText) {
            statusText.textContent = customMessage || (connected ? '已連線' : '未連線');
        }
    }

    // 主動斷線：用 library 的 close()，這樣它就不會再自動重連
    disconnect() {
        if (this.ws) {
            this.ws.close();
        }
        this.stopHeartbeat();
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
window.NFCManager = NFCManager;
window.nfcManager = new NFCManager();

// 創建全局別名以便向後兼容
const nfcManager = window.nfcManager;