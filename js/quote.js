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
            // 初始隱藏
            numberElement.style.opacity = '0';
            numberElement.style.filter = 'blur(20px)';
        }

        if (zhElement) {
            zhElement.textContent = quote.textCN;
            // 初始隱藏
            zhElement.style.opacity = '0';
            zhElement.style.filter = 'blur(20px)';
        }

        if (enElement) {
            enElement.textContent = quote.textEN;
            // 初始隱藏
            enElement.style.opacity = '0';
            enElement.style.filter = 'blur(20px)';
        }

        log(`顯示雞湯文 #${quote.number}: ${quote.textCN}`);

        // 通知 ESP8266 當前顯示的雞湯編號（用於 NFC 寫入驗證）
        if (nfcManager && nfcManager.isConnected) {
            nfcManager.updateCurrentQuote(quote.number);
        } else {
            // 如果還沒連線，等待連線後再發送
            const checkConnection = setInterval(() => {
                if (nfcManager && nfcManager.isConnected) {
                    nfcManager.updateCurrentQuote(quote.number);
                    clearInterval(checkConnection);
                }
            }, 500);

            // 10 秒後停止檢查
            setTimeout(() => clearInterval(checkConnection), 10000);
        }
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
            this.quoteContent.style.transition = 'opacity 0.5s ease-in-out';
            this.quoteContent.style.opacity = '1';

            // 模糊到清晰效果（依序出現）
            // 編號先出現
            this.blurToSharp('quote-number', 1200);

            // 中文延遲 0.4 秒後出現
            setTimeout(() => {
                this.blurToSharp('quote-zh', 1200);
            }, 400);

            // 英文延遲 0.8 秒後出現
            setTimeout(() => {
                this.blurToSharp('quote-en', 1200);
            }, 800);
        }, 50);
    }

    blurToSharp(elementId, duration = 1500) {
        const element = document.getElementById(elementId);
        if (!element) return;

        const startTime = Date.now();
        const maxBlur = 20; // 最大模糊程度（px）
        const frameInterval = 16; // 約 60fps

        // 設定初始狀態
        element.style.filter = `blur(${maxBlur}px)`;
        element.style.opacity = '0';

        const interval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            let progress = Math.min(elapsed / duration, 1); // 0 到 1

            // Ease-out 效果
            progress = 1 - Math.pow(1 - progress, 3);

            // 計算當前模糊值和透明度
            const currentBlur = maxBlur * (1 - progress);
            const currentOpacity = progress;

            // 應用效果
            element.style.filter = `blur(${currentBlur}px)`;
            element.style.opacity = currentOpacity;

            // 完成時清除定時器並恢復原始狀態
            if (progress >= 1) {
                element.style.filter = 'none';
                element.style.opacity = '1';
                clearInterval(interval);
            }
        }, frameInterval);
    }

    decodeText(elementId, duration = 2000) {
        const element = document.getElementById(elementId);
        if (!element) return;

        const originalText = element.textContent;
        const length = originalText.length;

        // 分類字符集
        const numberChars = '0123456789';
        const englishChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
        const chineseChars = '一二三四五六七八九十百千萬億兆京垓秭穰溝澗正載極恆河沙阿僧祇那由他不可思議無量大數的是在有人我不了這個你他她它們她們它們我們你們他們也都要能會就上來';

        const startTime = Date.now();
        const frameInterval = 30; // 每 30 毫秒更新一次

        const interval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            let progress = Math.min(elapsed / duration, 1); // 0 到 1

            // Ease-out 效果：開始快，結束慢
            progress = 1 - Math.pow(1 - progress, 3); // cubic ease-out

            element.textContent = originalText
                .split('')
                .map((char, index) => {
                    // 空格和標點符號直接顯示
                    if (char === ' ' || /[，。！？、：；""''（）《》#.\-,!?;:'"()]/.test(char)) {
                        return char;
                    }

                    // 根據進度決定是否顯示正確字符
                    const charProgress = index / length;
                    if (progress > charProgress) {
                        return char;
                    }

                    // 根據字符類型選擇對應的亂碼字符集
                    let randomChars = englishChars;
                    if (/[0-9]/.test(char)) {
                        randomChars = numberChars;
                    } else if (/[\u4e00-\u9fa5]/.test(char)) {
                        // 中文字符
                        randomChars = chineseChars;
                    } else if (/[a-zA-Z]/.test(char)) {
                        randomChars = englishChars;
                    }

                    // 顯示隨機字符
                    return randomChars[Math.floor(Math.random() * randomChars.length)];
                })
                .join('');

            // 完成時清除定時器並顯示完整文字
            if (progress >= 1) {
                element.textContent = originalText;
                clearInterval(interval);
            }
        }, frameInterval);
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
