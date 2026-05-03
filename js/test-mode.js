// 測試模式：用按鈕模擬 NFC 掃描，沒實體卡時開發/排練流程用
// 開關：Ctrl+Shift+T，或 console 跑 toggleTestMode()
// 狀態存 localStorage，重新整理會記住

(function () {
    const KEY = 'chickensoup_test_mode';

    function isOn() {
        return localStorage.getItem(KEY) === '1';
    }

    function apply() {
        const panel = document.getElementById('test-panel');
        if (panel) panel.classList.toggle('show', isOn());
    }

    window.toggleTestMode = function () {
        localStorage.setItem(KEY, isOn() ? '0' : '1');
        apply();
        console.log(`[test] 測試模式: ${isOn() ? '開' : '關'}`);
    };

    // 模擬 ESP 透過 WebSocket 送來的訊息：直接呼叫 nfcManager.handleMessage
    // 跟真的 NFC 掃描走完全一樣的處理路徑，行為一致
    function simulate(msg) {
        if (window.nfcManager && typeof nfcManager.handleMessage === 'function') {
            nfcManager.handleMessage(JSON.stringify(msg));
        } else {
            console.warn('[test] nfcManager 還沒準備好');
        }
    }

    // === 模擬按鈕 ===

    // 萬用卡：依當前頁面表現不同——等待抽籤頁會抽雞湯，soup/panel 階段當任意瓶子
    window.testSimWildcard = () => simulate({ type: 'random_quote' });

    // AI 解鎖卡：在 chat-result-view 揭曉 AI 雞湯
    window.testSimAI = () => simulate({ type: 'ai_reveal' });

    // 卡離開：暫停 hold 計時（給觀眾 hold 中途離開的測試）
    window.testSimHoldEnd = () => simulate({ type: 'nfc_hold_end' });

    // 對應瓶子：根據當前頁面狀態，自動找出該掃哪張瓶身卡
    window.testSimMatchingBottle = function () {
        // 場景 1：在 soup-result-view 的 scan 模式 → 用 finalQuizResult 的 UID
        const soup = document.getElementById('soup-result-view');
        if (soup && soup.classList.contains('active') && window.soupViewMode === 'scan') {
            const uid = window.finalQuizResult?.quote?.nfcUID;
            if (uid) {
                simulate({ type: 'show_context', uid });
            } else {
                console.warn('[test] 找不到 finalQuizResult.quote.nfcUID');
            }
            return;
        }

        // 場景 2：quote-slide-panel 開著 → 查當前開的雞湯編號對應的 UID
        const panel = document.getElementById('quote-slide-panel');
        if (panel && panel.classList.contains('open')) {
            const num = window.currentOpenedQuoteNumber;
            if (num != null) {
                fetch('data/quotes-selected.json')
                    .then(r => r.json())
                    .then(quotes => {
                        const q = quotes.find(qq => qq.number === num);
                        if (q) simulate({ type: 'show_context', uid: q.nfcUID });
                        else console.warn(`[test] 找不到 #${num}`);
                    });
                return;
            }
        }

        console.warn('[test] 目前不在可掃瓶子的頁面（要在 soup-result scan 模式或 quote panel 打開時用）');
    };

    // Ctrl+Shift+T 開關測試模式
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.code === 'KeyT') {
            e.preventDefault();
            window.toggleTestMode();
        }
    });

    // 載入時套用之前的狀態
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', apply);
    } else {
        apply();
    }
})();
