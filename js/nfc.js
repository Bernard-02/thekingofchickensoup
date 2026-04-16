// NFC WebSocket 通訊模組

class NFCManager {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.reconnectTimer = null;
        this.heartbeatTimer = null;
        this.reconnectAttempts = 0; // 重連嘗試次數
        this.currentQuoteNumber = -1; // 當前顯示的雞湯編號

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
                this.reconnectAttempts = 0; // 重置重連計數器
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
                case 'connected':
                    log('ESP8266 連線確認', 'info');
                    break;
                case 'random_quote':
                    // 處理隨機抽雞湯（傳遞訊息資料以取得 UID）
                    this.handleRandomQuote(message);
                    break;
                case 'category_selected':
                    // 處理分類選擇（保留向下相容）
                    this.handleCategorySelected(message);
                    break;
                case 'show_context':
                    // 處理顯示脈絡（舊版，保留相容性）
                    this.handleShowContext(message);
                    break;
                case 'toggle_context':
                    // 處理切換脈絡顯示
                    this.handleToggleContext(message);
                    break;
                case 'save_quote':
                    // 處理儲存雞湯
                    this.handleSaveQuote(message);
                    break;
                case 'page_change':
                    // 舊版頁面切換（保留向下相容）
                    this.handlePageChange(message);
                    break;
                case 'nfc_read':
                    this.handleNFCRead(message.data);
                    break;
                case 'nfc_removed':
                    // 不再處理 NFC 移除事件，改用切換邏輯
                    log('收到 NFC 移除訊息（已忽略）', 'info');
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

    // 處理隨機抽雞湯（唯一抽籤卡專用，只從前 50 句選擇）
    async handleRandomQuote(message = {}) {
        log('收到隨機抽雞湯指令（唯一抽籤卡）', 'info');

        // AI 路線：在 chat-result-view 時，改成解碼 AI 原句
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

            // 只從 selected 的前 50 筆中選（= 有實體 NFC 卡的那 50 句）
            quotes = quotes.slice(0, 50);

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

    // 處理分類選擇（保留向下相容）
    async handleCategorySelected(message) {
        const { uid, category } = message;
        log(`分類選擇! UID: ${uid}, 分類: ${category}`, 'info');

        try {
            // 載入雞湯資料
            const response = await fetch(CONFIG.dataFiles.quotes);
            const quotes = await response.json();

            // 篩選該分類的雞湯
            const categoryQuotes = quotes.filter(q => q.category === category);

            if (categoryQuotes.length === 0) {
                log(`分類 ${category} 沒有雞湯文`, 'warn');
                return;
            }

            // 隨機選擇一句
            const randomQuote = categoryQuotes[Math.floor(Math.random() * categoryQuotes.length)];
            log(`隨機選中: #${randomQuote.number} - ${randomQuote.textCN}`, 'info');

            // 儲存到 localStorage，供 quote.html 使用
            localStorage.setItem('currentQuote', JSON.stringify(randomQuote));
            localStorage.setItem('selectedCategory', category);

            // 跳轉到 quote.html（會顯示過渡動畫）
            window.location.href = 'quote.html';

        } catch (error) {
            log(`載入雞湯失敗: ${error}`, 'error');
        }
    }

    // 處理切換脈絡顯示（新版）
    // 新版：掃 NFC → 開 quote panel 並 reveal 原句
    // （舊版的 contextManager 滿版脈絡已廢棄）
    async handleToggleContext(message) {
        return this.handleShowContext(message);
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
                return;
            }

            log(`✓ 找到匹配的雞湯: #${matchedQuote.number}`, 'info');

            // 在掃描提示頁（translation-view）且 UID 匹配抽中瓶號 → 揭曉原句
            const translationView = document.getElementById('translation-view');
            if (translationView && translationView.classList.contains('active')) {
                const expected = window.finalQuizResult && window.finalQuizResult.quote
                    ? window.finalQuizResult.quote.number
                    : null;
                if (expected === matchedQuote.number) {
                    if (typeof window.revealQuote === 'function') {
                        window.revealQuote();
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

            // panel 已開 → UID 完全對應才 reveal，否則 shake 錯誤提示
            const openedNumber = window.currentOpenedQuoteNumber;
            if (openedNumber === matchedQuote.number) {
                if (typeof window.revealQuoteInPanel === 'function') {
                    window.revealQuoteInPanel();
                }
            } else {
                log(`⚠ 錯誤的瓶子：面板是 #${openedNumber}，掃的是 #${matchedQuote.number}`, 'warn');
                this.shakeWrongBottleHint();
            }
        } catch (error) {
            log(`處理 NFC 掃描時發生錯誤: ${error}`, 'error');
        }
    }

    // 處理儲存雞湯（此函數現在由 ESP8266 主動觸發寫入，這裡保留用於 UI 回饋）
    handleSaveQuote(message) {
        log('儲存雞湯功能觸發', 'info');

        // 取得當前雞湯
        const currentQuote = localStorage.getItem('currentQuote');

        if (currentQuote) {
            const quote = JSON.parse(currentQuote);
            log(`準備儲存雞湯 #${quote.number} 到 NFC`, 'info');
            // 注意：實際寫入是由 ESP8266 處理，這裡只是顯示提示
        } else {
            log('沒有雞湯可以儲存', 'warn');
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

    // 處理頁面切換 (舊版，保留向下相容)
    handlePageChange(message) {
        const { uid, page } = message;
        log(`NFC 偵測到! UID: ${uid}, 切換到頁面: ${page}`, 'info');

        // 根據頁面名稱切換到對應的 HTML 頁面
        const pageMap = {
            'quote': 'quote.html',
            'context': 'context.html',
            'home': 'index.html'
        };

        const targetPage = pageMap[page];
        if (targetPage) {
            log(`正在跳轉到: ${targetPage}`, 'info');
            window.location.href = targetPage;
        } else {
            log(`未知的頁面: ${page}`, 'warn');
        }

        // 觸發回調
        if (this.onReadCallback) {
            this.onReadCallback({ uid, page });
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
                ${data.page ? `<p class="mt-2">頁面: ${data.page}</p>` : ''}
                ${data.content ? `<p class="mt-2">內容: ${data.content}</p>` : ''}
            `;
        }

        // 如果有頁面資訊,自動切換頁面
        if (data.page && window.app) {
            const pageId = data.page + '-page';
            log(`自動切換到頁面: ${pageId}`, 'info');
            window.app.showPage(pageId);
        }

        // 觸發回調
        if (this.onReadCallback) {
            this.onReadCallback(data);
        }
    }

    // 處理 NFC 移除
    handleNFCRemoved(data) {
        log(`NFC 標籤移除: UID=${data.uid}`, 'info');

        // 隱藏脈絡媒體覆蓋層
        if (window.contextManager) {
            window.contextManager.hide();
        }

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

    // 舊版：滿版警告（保留但不再使用）
    showWrongBottleWarning(correctNumber, scannedNumber) {
        const overlay = document.createElement('div');
        overlay.id = 'wrong-bottle-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(255, 255, 255, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 300;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;

        overlay.innerHTML = `
            <div style="
                position: fixed;
                bottom: 8vh;
                left: 50%;
                transform: translateX(-50%);
                text-align: center;
                color: #000;
                width: 100%;
                padding: 0 2rem;
            ">
                <p style="font-size: 1rem; font-weight: 500;">好像有點不對，請掃描對應編號的瓶子。</p>
            </div>
        `;

        document.body.appendChild(overlay);

        // 淡入
        setTimeout(() => {
            overlay.style.opacity = '1';
        }, 10);

        // 2秒後淡出並移除
        setTimeout(() => {
            overlay.style.opacity = '0';
            setTimeout(() => overlay.remove(), 300);
        }, 2000);

        // 點擊關閉
        overlay.addEventListener('click', () => {
            overlay.style.opacity = '0';
            setTimeout(() => overlay.remove(), 300);
        });
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

        // 檢查是否達到最大重連次數
        const maxAttempts = CONFIG.websocket.maxReconnectAttempts || 10;

        if (this.reconnectAttempts >= maxAttempts) {
            log(`已達最大重連次數 (${maxAttempts})，暫停重連。請檢查 ESP8266 是否運行中。`, 'warn');
            this.updateUIStatus(false, '連線失敗');
            return;
        }

        this.reconnectAttempts++;
        const delay = CONFIG.websocket.reconnectInterval;

        log(`嘗試重新連線... (${this.reconnectAttempts}/${maxAttempts})`, 'info');

        this.reconnectTimer = setTimeout(() => {
            this.connect();
        }, delay);
    }

    // 更新 UI 狀態
    updateUIStatus(connected, customMessage = null) {
        const statusDot = document.getElementById('ws-status');
        const statusText = document.getElementById('ws-status-text');

        if (statusDot) {
            statusDot.className = connected
                ? 'w-4 h-4 rounded-full bg-green-500'
                : 'w-4 h-4 rounded-full bg-red-500';
        }

        if (statusText) {
            if (customMessage) {
                statusText.textContent = customMessage;
            } else {
                statusText.textContent = connected ? '已連線' : '未連線';
            }
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
window.NFCManager = NFCManager;
window.nfcManager = new NFCManager();

// 創建全局別名以便向後兼容
const nfcManager = window.nfcManager;