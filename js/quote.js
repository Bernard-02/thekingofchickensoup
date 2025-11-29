// 雞湯文頁面邏輯

class QuotePage {
    constructor() {
        this.currentQuote = null;
        this.loadingScreen = document.getElementById('loading-screen');
        this.quoteContent = document.getElementById('quote-content');
    }

    async init() {
        log('雞湯文頁面初始化中...');

        // 顯示過渡動畫
        this.showLoading();

        // 從 localStorage 取得雞湯
        const storedQuote = localStorage.getItem('currentQuote');

        if (storedQuote) {
            // 有從首頁選擇的雞湯
            this.currentQuote = JSON.parse(storedQuote);
            log(`載入儲存的雞湯: #${this.currentQuote.number}`, 'info');

            // 模擬準備雞湯的延遲（1.5秒）
            await this.delay(1500);

            // 顯示雞湯
            this.displayQuote(this.currentQuote);

            // 淡入效果
            this.showQuote();

        } else {
            // 沒有儲存的雞湯，嘗試從 URL 參數載入
            await this.loadFromURL();
        }

        // 設定 NFC 監聽
        this.setupNFCListener();

        log('雞湯文頁面初始化完成');
    }

    async loadFromURL() {
        // 載入資料
        await dataManager.loadQuotes();

        const urlParams = new URLSearchParams(window.location.search);
        const quoteId = urlParams.get('id');
        const category = urlParams.get('category');

        if (quoteId) {
            this.currentQuote = dataManager.getQuoteById(quoteId);
        } else if (category) {
            this.currentQuote = dataManager.getQuoteByCategory(category);
        } else {
            this.currentQuote = dataManager.getRandomQuote();
        }

        if (this.currentQuote) {
            await this.delay(1500);
            this.displayQuote(this.currentQuote);
            this.showQuote();
        } else {
            log('找不到雞湯文', 'error');
        }
    }

    displayQuote(quote) {
        const numberElement = document.getElementById('quote-number');
        const zhElement = document.getElementById('quote-zh');
        const enElement = document.getElementById('quote-en');

        if (numberElement) {
            numberElement.textContent = `#${quote.number}`;
        }

        if (zhElement) {
            zhElement.textContent = quote.textCN;
        }

        if (enElement) {
            enElement.textContent = quote.textEN;
        }

        log(`顯示雞湯文 #${quote.number}: ${quote.textCN}`);
    }

    showLoading() {
        this.loadingScreen.classList.remove('hidden');
        this.quoteContent.classList.add('hidden');
    }

    showQuote() {
        // 隱藏 loading，顯示雞湯
        this.loadingScreen.classList.add('hidden');
        this.quoteContent.classList.remove('hidden');

        // 淡入動畫
        setTimeout(() => {
            this.quoteContent.style.transition = 'opacity 1s ease-in-out';
            this.quoteContent.style.opacity = '1';
        }, 50);
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    setupNFCListener() {
        // NFC 讀取事件已經在 nfc.js 中處理
        // 這裡不需要額外設定
    }
}

// 頁面載入完成後初始化
const quotePage = new QuotePage();

document.addEventListener('DOMContentLoaded', () => {
    // 初始化 WebSocket 連線
    nfcManager.connect();

    // 初始化頁面
    quotePage.init();
});
