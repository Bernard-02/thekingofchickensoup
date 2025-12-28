// 脈絡媒體管理器
class ContextManager {
    constructor() {
        this.currentQuoteNumber = null;
        this.mediaList = [];
        this.currentIndex = 0;
        this.autoPlayInterval = null;
        this.autoPlayDelay = 5000; // 5秒自動切換

        this.overlay = null;
        this.mediaDisplay = null;
        this.prevBtn = null;
        this.nextBtn = null;
        this.indicatorsContainer = null;
        this.hintElement = null;
    }

    // 初始化
    init() {
        this.overlay = document.getElementById('context-overlay');
        this.mediaDisplay = document.getElementById('context-media-display');
        this.prevBtn = document.getElementById('context-prev');
        this.nextBtn = document.getElementById('context-next');
        this.indicatorsContainer = document.getElementById('context-indicators');
        this.hintElement = document.getElementById('context-hint');

        // 綁定按鈕事件
        this.prevBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // 防止觸發覆蓋層的點擊事件
            this.prev();
        });
        this.nextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.next();
        });

        // 點擊覆蓋層任意位置關閉脈絡
        this.overlay.addEventListener('click', (e) => {
            // 點擊媒體顯示區域、控制按鈕、指示器時不關閉
            const clickedElement = e.target;
            const isMediaDisplay = clickedElement.closest('#context-media-display');
            const isControl = clickedElement.closest('.context-nav-btn');
            const isIndicator = clickedElement.closest('.context-indicators');

            // 如果不是點擊這些元素，就關閉
            if (!isMediaDisplay && !isControl && !isIndicator) {
                log('點擊覆蓋層，關閉脈絡', 'info');
                this.hide();
            }
        });

        log('ContextManager 初始化完成', 'info');
    }

    // 顯示脈絡媒體
    async show(quoteNumber) {
        try {
            log(`準備顯示雞湯 #${quoteNumber} 的脈絡`, 'info');
            this.currentQuoteNumber = quoteNumber;

            // 自動掃描資料夾中的媒體文件
            const mediaList = await this.scanContextFolder(quoteNumber);

            // 如果沒有媒體，顯示空白畫面
            if (mediaList.length === 0) {
                log(`雞湯 #${quoteNumber} 沒有脈絡媒體，顯示空白畫面`, 'info');
                this.showEmptyState();
                return;
            }

            this.mediaList = mediaList;
            this.currentIndex = 0;

            // 重置提示文字為正常提示
            if (this.hintElement) {
                this.hintElement.textContent = '點擊畫面任意位置以返回';
            }

            // 只有在有多個媒體時才創建指示器和控制按鈕
            if (this.mediaList.length > 1) {
                this.createIndicators();
                this.showControls();
                this.startAutoPlay();
            } else {
                // 只有1個媒體，隱藏控制
                this.hideControls();
            }

            // 顯示第一個媒體
            this.renderMedia();

            // 顯示覆蓋層
            this.overlay.classList.remove('hidden');
            setTimeout(() => {
                this.overlay.classList.add('active');
            }, 10);

            log(`顯示脈絡媒體成功，共 ${this.mediaList.length} 個`, 'info');

        } catch (error) {
            log(`載入脈絡媒體失敗: ${error}`, 'error');
        }
    }

    // 顯示空白狀態（脈絡尚未轉換）
    showEmptyState() {
        this.mediaList = [];
        this.currentIndex = 0;

        // 清空媒體顯示區域
        this.mediaDisplay.innerHTML = '';

        // 隱藏控制按鈕
        this.hideControls();

        // 更新提示文字為空白脈絡提示
        if (this.hintElement) {
            this.hintElement.textContent = '此脈絡尚未轉換，點擊畫面任意位置以返回';
        }

        // 顯示覆蓋層（空白畫面）
        this.overlay.classList.remove('hidden');
        setTimeout(() => {
            this.overlay.classList.add('active');
        }, 10);

        log('顯示空白脈絡畫面', 'info');
    }

    // 顯示控制按鈕
    showControls() {
        const controls = document.querySelector('.context-controls');
        if (controls) {
            controls.style.display = 'flex';
        }
    }

    // 隱藏控制按鈕
    hideControls() {
        const controls = document.querySelector('.context-controls');
        if (controls) {
            controls.style.display = 'none';
        }
    }

    // 從 contexts.json 讀取媒體列表
    async scanContextFolder(quoteNumber) {
        try {
            // 嘗試從 contexts.json 讀取配置
            const response = await fetch('data/contexts.json');
            const contexts = await response.json();

            const context = contexts[quoteNumber.toString()];

            if (context && context.media && context.media.length > 0) {
                log(`從 contexts.json 載入雞湯 #${quoteNumber} 的媒體`, 'info');
                return context.media;
            }

            // 如果沒有配置，返回空陣列
            log(`contexts.json 中找不到雞湯 #${quoteNumber} 的配置`, 'warn');
            return [];

        } catch (error) {
            log(`讀取 contexts.json 失敗: ${error}`, 'error');
            return [];
        }
    }

    // 檢查脈絡是否正在顯示
    isShowing() {
        return this.overlay && this.overlay.classList.contains('active');
    }

    // 隱藏脈絡媒體
    hide() {
        log('隱藏脈絡媒體', 'info');

        this.stopAutoPlay();

        this.overlay.classList.remove('active');
        setTimeout(() => {
            this.overlay.classList.add('hidden');
            this.mediaDisplay.innerHTML = '';
            this.currentQuoteNumber = null;
            this.mediaList = [];
            this.currentIndex = 0;
        }, 300);
    }

    // 渲染媒體
    renderMedia() {
        const media = this.mediaList[this.currentIndex];
        this.mediaDisplay.innerHTML = '';

        if (media.type === 'image') {
            const img = document.createElement('img');
            img.src = media.src;
            img.alt = `Context ${this.currentIndex + 1}`;
            this.mediaDisplay.appendChild(img);
        } else if (media.type === 'video') {
            const video = document.createElement('video');
            video.src = media.src;
            video.autoplay = true;
            video.loop = true;
            video.muted = true;
            video.playsInline = true;
            this.mediaDisplay.appendChild(video);
        }

        this.updateControls();
    }

    // 創建指示器
    createIndicators() {
        this.indicatorsContainer.innerHTML = '';

        this.mediaList.forEach((_, index) => {
            const indicator = document.createElement('div');
            indicator.className = 'context-indicator';
            if (index === 0) indicator.classList.add('active');

            indicator.addEventListener('click', () => {
                this.goTo(index);
            });

            this.indicatorsContainer.appendChild(indicator);
        });
    }

    // 更新控制按鈕和指示器
    updateControls() {
        // 更新按鈕狀態
        this.prevBtn.disabled = this.currentIndex === 0;
        this.nextBtn.disabled = this.currentIndex === this.mediaList.length - 1;

        // 更新指示器
        const indicators = this.indicatorsContainer.querySelectorAll('.context-indicator');
        indicators.forEach((indicator, index) => {
            if (index === this.currentIndex) {
                indicator.classList.add('active');
            } else {
                indicator.classList.remove('active');
            }
        });
    }

    // 前一個
    prev() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.renderMedia();
            this.resetAutoPlay();
        }
    }

    // 下一個
    next() {
        if (this.currentIndex < this.mediaList.length - 1) {
            this.currentIndex++;
            this.renderMedia();
            this.resetAutoPlay();
        }
    }

    // 跳轉到指定索引
    goTo(index) {
        if (index >= 0 && index < this.mediaList.length) {
            this.currentIndex = index;
            this.renderMedia();
            this.resetAutoPlay();
        }
    }

    // 啟動自動播放
    startAutoPlay() {
        this.stopAutoPlay();
        this.autoPlayInterval = setInterval(() => {
            if (this.currentIndex < this.mediaList.length - 1) {
                this.next();
            } else {
                // 回到第一個
                this.currentIndex = 0;
                this.renderMedia();
            }
        }, this.autoPlayDelay);
    }

    // 停止自動播放
    stopAutoPlay() {
        if (this.autoPlayInterval) {
            clearInterval(this.autoPlayInterval);
            this.autoPlayInterval = null;
        }
    }

    // 重置自動播放（手動操作後重新計時）
    resetAutoPlay() {
        if (this.mediaList.length > 1) {
            this.startAutoPlay();
        }
    }
}

// 創建全局實例
window.contextManager = new ContextManager();

// 頁面加載後初始化
document.addEventListener('DOMContentLoaded', () => {
    window.contextManager.init();
});
