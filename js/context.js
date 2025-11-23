// 脈絡頁面邏輯

class ContextPage {
    constructor() {
        this.currentContext = null;
        this.currentNFCUid = null;
    }

    async init() {
        log('脈絡頁面初始化中...');

        // 載入資料
        await dataManager.loadContexts();

        // 從 URL 參數取得脈絡 ID
        const urlParams = new URLSearchParams(window.location.search);
        const contextId = urlParams.get('id');

        if (contextId) {
            this.currentContext = dataManager.getContextById(parseInt(contextId));
            if (this.currentContext) {
                this.displayContext(this.currentContext);
            } else {
                log('找不到脈絡資料', 'error');
            }
        }

        // 設定 NFC 監聽（當標籤移除時返回雞湯文頁面）
        this.setupNFCListener();

        log('脈絡頁面初始化完成');
    }

    displayContext(context) {
        const titleElement = document.getElementById('context-title');
        const contentElement = document.getElementById('context-content');

        if (titleElement) {
            titleElement.textContent = context.title;
        }

        if (contentElement) {
            if (context.type === 'text') {
                contentElement.innerHTML = `<p class="text-center">${context.content}</p>`;
            } else if (context.type === 'video') {
                contentElement.innerHTML = `
                    <div class="mb-6">
                        <video controls class="w-full rounded-lg mx-auto max-w-2xl">
                            <source src="${context.videoUrl}" type="video/mp4">
                            您的瀏覽器不支援影片播放。
                        </video>
                    </div>
                    ${context.description ? `<p class="text-center mt-4">${context.description}</p>` : ''}
                `;
            } else if (context.type === 'audio') {
                contentElement.innerHTML = `
                    <div class="mb-6 flex justify-center">
                        <audio controls class="w-full max-w-md">
                            <source src="${context.audioUrl}" type="audio/mpeg">
                            您的瀏覽器不支援音訊播放。
                        </audio>
                    </div>
                    ${context.description ? `<p class="text-center mt-4">${context.description}</p>` : ''}
                `;
            }
        }

        log(`顯示脈絡: ${context.title}`);
    }

    setupNFCListener() {
        // NFC 讀取事件：記錄當前 NFC UID
        nfcManager.onRead((data) => {
            this.currentNFCUid = data.uid;
            log(`記錄 NFC UID: ${data.uid}`);
        });

        // NFC 移除事件：返回上一頁（雞湯文頁面）
        nfcManager.onRemove((data) => {
            log('NFC 標籤移除，返回雞湯文頁面');
            // 返回上一頁
            window.history.back();
        });
    }
}

// 頁面載入完成後初始化
const contextPage = new ContextPage();

document.addEventListener('DOMContentLoaded', () => {
    contextPage.init();
});
