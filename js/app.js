// 主應用程式邏輯

class App {
    constructor() {
        this.currentPage = 'home-page';
        this.isOverlayActive = false;
    }

    // 初始化應用程式
    async init() {
        log('應用程式初始化中...');

        // 載入資料
        await dataManager.loadQuotes();
        await dataManager.loadContexts();

        // 設定 NFC 事件監聽器
        this.setupNFCListeners();

        // 設定 UI 事件
        this.setupUIEvents();

        // 預設顯示測試頁面（開發用）
        // 正式版本應該顯示首頁
        if (CONFIG.debug) {
            this.showPage('test-page');
        } else {
            this.showPage('home-page');
        }

        log('應用程式初始化完成');
    }

    // 設定 NFC 監聽器
    setupNFCListeners() {
        // NFC 讀取事件
        nfcManager.onRead((data) => {
            this.handleNFCRead(data);
        });

        // NFC 寫入事件
        nfcManager.onWrite((success, data) => {
            this.handleNFCWrite(success, data);
        });

        // 連線事件
        nfcManager.onConnect(() => {
            log('NFC 管理器已連線');
        });

        // 斷線事件
        nfcManager.onDisconnect(() => {
            log('NFC 管理器已斷線', 'warn');
        });
    }

    // 設定 UI 事件
    setupUIEvents() {
        // WebSocket 連線按鈕
        const connectBtn = document.getElementById('ws-connect-btn');
        if (connectBtn) {
            connectBtn.addEventListener('click', () => {
                nfcManager.connect();
            });
        }

        // NFC 寫入按鈕
        const writeBtn = document.getElementById('write-nfc-btn');
        if (writeBtn) {
            writeBtn.addEventListener('click', () => {
                const input = document.getElementById('write-data-input');
                if (input && input.value) {
                    nfcManager.writeNFC(input.value);
                } else {
                    log('請輸入要寫入的資料', 'warn');
                }
            });
        }
    }

    // 處理 NFC 讀取
    handleNFCRead(data) {
        const { uid, content } = data;

        // 判斷目前在哪個頁面
        if (this.currentPage === 'home-page') {
            // 首頁：根據 UID 選擇分類並顯示雞湯文
            const category = dataManager.getCategoryFromUID(uid);
            const quote = dataManager.getQuoteByCategory(category);

            if (quote) {
                this.displayQuote(quote);
                this.showPage('quote-page');
            }
        } else if (this.currentPage === 'quote-page') {
            // 雞湯文頁面：顯示脈絡詳情
            if (dataManager.currentQuote) {
                const context = dataManager.getContextById(
                    dataManager.currentQuote.contextId
                );
                if (context) {
                    this.displayContext(context);
                    this.showOverlay(true);
                }
            }
        } else if (this.currentPage === 'write-page') {
            // 寫入頁面不處理讀取
            log('目前在寫入頁面，忽略 NFC 讀取', 'info');
        }
    }

    // 處理 NFC 寫入
    handleNFCWrite(success, data) {
        if (success) {
            log('NFC 寫入成功');
            // 可以在這裡加入成功動畫
        } else {
            log('NFC 寫入失敗', 'error');
        }
    }

    // 顯示雞湯文
    displayQuote(quote) {
        const textElement = document.getElementById('quote-text');
        const categoryElement = document.getElementById('quote-category');

        if (textElement) {
            textElement.textContent = quote.text;
        }

        if (categoryElement) {
            categoryElement.textContent = `分類: ${quote.category}`;
        }
    }

    // 顯示脈絡詳情
    displayContext(context) {
        const contentElement = document.getElementById('context-content');

        if (!contentElement) return;

        let html = `<h2 class="text-3xl font-bold mb-6">${context.title}</h2>`;

        if (context.type === 'text') {
            html += `<p class="text-lg leading-relaxed">${context.content}</p>`;
        } else if (context.type === 'video') {
            html += `
                <div class="mb-4">
                    <video controls class="w-full rounded-lg">
                        <source src="${context.videoUrl}" type="video/mp4">
                        您的瀏覽器不支援影片播放。
                    </video>
                </div>
                <p class="text-lg leading-relaxed">${context.description || ''}</p>
            `;
        } else if (context.type === 'audio') {
            html += `
                <div class="mb-4">
                    <audio controls class="w-full">
                        <source src="${context.audioUrl}" type="audio/mpeg">
                        您的瀏覽器不支援音訊播放。
                    </audio>
                </div>
                <p class="text-lg leading-relaxed">${context.description || ''}</p>
            `;
        }

        contentElement.innerHTML = html;
    }

    // 切換頁面
    showPage(pageId) {
        // 隱藏所有頁面
        const pages = document.querySelectorAll('.page');
        pages.forEach(page => {
            page.classList.remove('active');
        });

        // 顯示指定頁面
        const targetPage = document.getElementById(pageId);
        if (targetPage) {
            targetPage.classList.add('active');
            this.currentPage = pageId;
            log(`切換到頁面: ${pageId}`);
        }
    }

    // 顯示/隱藏覆蓋層
    showOverlay(show) {
        const overlay = document.getElementById('context-overlay');
        if (overlay) {
            if (show) {
                overlay.classList.add('active');
                this.isOverlayActive = true;
            } else {
                overlay.classList.remove('active');
                this.isOverlayActive = false;
            }
        }
    }
}

// 全域應用程式實例
window.app = new App();

// DOM 載入完成後初始化
document.addEventListener('DOMContentLoaded', () => {
    window.app.init();
});