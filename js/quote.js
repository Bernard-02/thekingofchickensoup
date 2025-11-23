// 雞湯文頁面邏輯

class QuotePage {
    constructor() {
        this.currentQuote = null;
    }

    async init() {
        log('雞湯文頁面初始化中...');

        // 載入資料
        await dataManager.loadQuotes();

        // 從 URL 參數取得雞湯文 ID 或隨機選擇
        const urlParams = new URLSearchParams(window.location.search);
        const quoteId = urlParams.get('id');
        const category = urlParams.get('category');

        if (quoteId) {
            // 根據 ID 顯示特定雞湯文
            this.currentQuote = dataManager.getQuoteById(parseInt(quoteId));
        } else if (category) {
            // 根據分類隨機選擇
            this.currentQuote = dataManager.getQuoteByCategory(category);
        } else {
            // 隨機選擇任一雞湯文
            this.currentQuote = dataManager.getRandomQuote();
        }

        if (this.currentQuote) {
            this.displayQuote(this.currentQuote);
        } else {
            log('找不到雞湯文', 'error');
        }

        // 設定 NFC 監聽（當感應時跳轉到脈絡頁面）
        this.setupNFCListener();

        log('雞湯文頁面初始化完成');
    }

    displayQuote(quote) {
        const zhElement = document.getElementById('quote-zh');
        const enElement = document.getElementById('quote-en');

        if (zhElement) {
            zhElement.textContent = quote.zh;
        }

        if (enElement) {
            enElement.textContent = quote.en;
        }

        log(`顯示雞湯文: ${quote.zh}`);
    }

    setupNFCListener() {
        // NFC 讀取事件：跳轉到脈絡頁面
        nfcManager.onRead((data) => {
            log('NFC 感應，跳轉到脈絡頁面');
            if (this.currentQuote) {
                // 跳轉到脈絡頁面，並帶上 contextId
                window.location.href = `context.html?id=${this.currentQuote.contextId}`;
            }
        });
    }
}

// 頁面載入完成後初始化
const quotePage = new QuotePage();

document.addEventListener('DOMContentLoaded', () => {
    quotePage.init();
});
