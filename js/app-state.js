// 單頁面應用狀態管理系統

class AppStateManager {
    constructor() {
        // 當前狀態: 'home' | 'quote'
        this.currentState = 'home';

        // 資料儲存
        this.currentQuote = null;

        // DOM 元素快取
        this.views = {
            home: null,
            quote: null
        };

        // 狀態切換回調
        this.onStateChangeCallbacks = [];

        log('AppStateManager 初始化完成');
    }

    // 初始化（綁定 DOM 元素）
    init() {
        this.views.home = document.getElementById('home-view');
        this.views.quote = document.getElementById('quote-view');

        // 預設顯示首頁
        this.showView('home');

        log('AppStateManager DOM 綁定完成');
    }

    // 切換狀態（主要方法）
    async switchTo(newState, data = null) {
        if (this.currentState === newState) {
            log(`已經在 ${newState} 狀態，忽略切換`, 'warn');
            return;
        }

        log(`狀態切換: ${this.currentState} -> ${newState}`);

        // 1. 執行退出動畫
        await this.exitState(this.currentState);

        // 2. 更新狀態
        const oldState = this.currentState;
        this.currentState = newState;

        // 3. 根據新狀態載入資料
        if (newState === 'quote' && data) {
            this.currentQuote = data;
        }

        // 4. 執行進入動畫
        await this.enterState(newState);

        // 5. 觸發回調
        this.onStateChangeCallbacks.forEach(callback => {
            callback(newState, oldState, data);
        });

        log(`狀態切換完成: ${newState}`);
    }

    // 退出當前狀態的動畫
    async exitState(state) {
        const view = this.views[state];
        if (!view) return;

        return new Promise((resolve) => {
            // 淡出動畫
            view.style.transition = 'opacity 0.3s ease-out';
            view.style.opacity = '0';

            setTimeout(() => {
                view.classList.add('hidden');
                resolve();
            }, 300);
        });
    }

    // 進入新狀態的動畫
    async enterState(state) {
        const view = this.views[state];
        if (!view) return;

        return new Promise((resolve) => {
            // 先顯示但透明
            view.classList.remove('hidden');
            view.style.opacity = '0';

            // 根據不同狀態執行不同的進入邏輯
            if (state === 'quote' && this.currentQuote) {
                // 雞湯頁：顯示雞湯文
                this.displayQuote(this.currentQuote);
            }

            // 淡入動畫
            setTimeout(() => {
                view.style.transition = 'opacity 0.5s ease-in';
                view.style.opacity = '1';

                setTimeout(() => {
                    resolve();
                }, 500);
            }, 50);
        });
    }

    // 直接顯示某個 view（無動畫）
    showView(state) {
        // 隱藏所有 view
        Object.values(this.views).forEach(view => {
            if (view) {
                view.classList.add('hidden');
                view.style.opacity = '0';
            }
        });

        // 顯示目標 view
        const targetView = this.views[state];
        if (targetView) {
            targetView.classList.remove('hidden');
            targetView.style.opacity = '1';
            this.currentState = state;
        }
    }

    // 顯示雞湯文
    displayQuote(quote) {
        // 使用 HTML 元素顯示雞湯
        const numberElement = document.getElementById('quote-number-text');
        const zhElement = document.getElementById('quote-zh-text');
        const enElement = document.getElementById('quote-en-text');

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

        // 通知 ESP8266 當前顯示的雞湯編號
        if (nfcManager && nfcManager.isConnected) {
            nfcManager.updateCurrentQuote(quote.number);
        }
    }

    // 返回上一個狀態
    async goBack() {
        if (this.currentState === 'quote') {
            // 從雞湯頁返回首頁
            await this.switchTo('home');
        }
    }

    // 註冊狀態變更監聽器
    onStateChange(callback) {
        this.onStateChangeCallbacks.push(callback);
    }

    // 取得當前狀態
    getState() {
        return this.currentState;
    }

    // 取得當前資料
    getCurrentData() {
        if (this.currentState === 'quote') {
            return this.currentQuote;
        }
        return null;
    }
}

// 全域狀態管理器實例
const appState = new AppStateManager();

// 明確掛載到 window，確保全域可存取
if (typeof window !== 'undefined') {
    window.appState = appState;
}
