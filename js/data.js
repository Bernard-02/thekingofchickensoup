// 資料管理模組

class DataManager {
    constructor() {
        this.quotes = [];
        this.contexts = [];
        this.currentQuote = null;
    }

    // 載入雞湯文資料
    async loadQuotes() {
        try {
            const response = await fetch(CONFIG.dataFiles.quotes);
            if (!response.ok) {
                throw new Error('無法載入雞湯文資料');
            }
            this.quotes = await response.json();
            log(`已載入 ${this.quotes.length} 則雞湯文`);
            return this.quotes;
        } catch (error) {
            log(`載入雞湯文失敗: ${error}`, 'error');
            // 使用範例資料
            this.quotes = this.getSampleQuotes();
            return this.quotes;
        }
    }

    // 載入脈絡資料
    async loadContexts() {
        try {
            const response = await fetch(CONFIG.dataFiles.contexts);
            if (!response.ok) {
                throw new Error('無法載入脈絡資料');
            }
            this.contexts = await response.json();
            log(`已載入 ${this.contexts.length} 則脈絡資料`);
            return this.contexts;
        } catch (error) {
            log(`載入脈絡資料失敗: ${error}`, 'error');
            // 使用範例資料
            this.contexts = this.getSampleContexts();
            return this.contexts;
        }
    }

    // 根據分類取得隨機雞湯文
    getQuoteByCategory(category) {
        const categoryQuotes = this.quotes.filter(q => q.category === category);
        if (categoryQuotes.length === 0) {
            log(`找不到分類 ${category} 的雞湯文`, 'warn');
            return null;
        }
        const randomIndex = Math.floor(Math.random() * categoryQuotes.length);
        this.currentQuote = categoryQuotes[randomIndex];
        return this.currentQuote;
    }

    // 根據 NFC UID 判斷分類
    getCategoryFromUID(uid) {
        // 根據 UID 的第一個字元判斷分類（可以根據實際需求調整）
        const firstChar = uid.charAt(0).toUpperCase();

        if (CONFIG.nfcCategories[firstChar]) {
            return CONFIG.nfcCategories[firstChar];
        }

        // 預設使用 UID 的數值來分配分類
        const uidValue = parseInt(uid.replace(/[^0-9]/g, ''), 10);
        const categories = ['category1', 'category2', 'category3'];
        const categoryIndex = uidValue % 3;
        return categories[categoryIndex];
    }

    // 根據 ID 取得脈絡資料
    getContextById(id) {
        return this.contexts.find(c => c.id === id);
    }

    // 根據 ID 取得雞湯文
    getQuoteById(id) {
        const quote = this.quotes.find(q => q.id === id);
        if (quote) {
            this.currentQuote = quote;
        }
        return quote;
    }

    // 隨機取得任一雞湯文
    getRandomQuote() {
        if (this.quotes.length === 0) {
            log('沒有可用的雞湯文', 'warn');
            return null;
        }
        const randomIndex = Math.floor(Math.random() * this.quotes.length);
        this.currentQuote = this.quotes[randomIndex];
        return this.currentQuote;
    }

    // 範例雞湯文資料
    getSampleQuotes() {
        return [
            {
                id: 1,
                text: "每一次的失敗，都是通往成功的墊腳石。",
                category: "category1",
                contextId: 1
            },
            {
                id: 2,
                text: "不要害怕改變，因為改變是成長的開始。",
                category: "category1",
                contextId: 2
            },
            {
                id: 3,
                text: "相信自己，你比想像中更強大。",
                category: "category2",
                contextId: 3
            },
            {
                id: 4,
                text: "夢想不會逃跑，逃跑的永遠是自己。",
                category: "category2",
                contextId: 4
            },
            {
                id: 5,
                text: "今天的努力，是明天的希望。",
                category: "category3",
                contextId: 5
            },
            {
                id: 6,
                text: "人生沒有如果，只有後果和結果。",
                category: "category3",
                contextId: 6
            }
        ];
    }

    // 範例脈絡資料
    getSampleContexts() {
        return [
            {
                id: 1,
                quoteId: 1,
                type: "text",
                title: "關於失敗與成功",
                content: "這句話源自於一位企業家的親身經歷。他在創業初期經歷了三次失敗，但每次失敗都讓他學到寶貴的經驗，最終在第四次創業時獲得成功。"
            },
            {
                id: 2,
                quoteId: 2,
                type: "video",
                title: "擁抱改變的力量",
                videoUrl: "https://example.com/video1.mp4",
                description: "一部關於如何面對生活中變化的短片。"
            },
            {
                id: 3,
                quoteId: 3,
                type: "text",
                title: "自信的重要性",
                content: "心理學研究顯示，自信是成功的關鍵因素之一。相信自己的能力，能夠激發內在潛能，克服各種困難。"
            },
            {
                id: 4,
                quoteId: 4,
                type: "text",
                title: "追夢的勇氣",
                content: "許多成功人士的共同點就是敢於追夢。他們不害怕失敗，勇於踏出舒適圈，最終實現了自己的夢想。"
            },
            {
                id: 5,
                quoteId: 5,
                type: "text",
                title: "堅持的力量",
                content: "今天的努力不一定馬上看到成果，但持續累積的力量終將帶來改變。就像種子需要時間發芽，成功也需要耐心等待。"
            },
            {
                id: 6,
                quoteId: 6,
                type: "text",
                title: "接受與前進",
                content: "過去已經發生的事情無法改變，重要的是如何面對當下和未來。接受結果，從中學習，然後繼續前進。"
            }
        ];
    }
}

// 全域資料管理器實例
const dataManager = new DataManager();