// p5.js 動畫腳本（首頁動畫）

let canvas;
let chineseText = '這個人超會寫雞湯。';
let englishText = 'The King of Chicken Soup';

// 文字輪播相關變數
let textRotationIndex = 0;
let lastRotationTime = 0;
let rotationInterval = 60000; // 60秒 = 1分鐘
let alternateTexts = [];

// 下雪效果相關變數
let snowflakes = [];
let isSnowing = false;
let isFadingOut = false;
let fadeOutAlpha = 255;
const maxSnowflakes = 200;

function setup() {
    // 建立畫布並附加到 #p5-canvas
    const container = select('#p5-canvas');
    if (container) {
        canvas = createCanvas(windowWidth, windowHeight);
        canvas.parent('p5-canvas');
    } else {
        canvas = createCanvas(windowWidth, windowHeight);
    }

    // 設定文字屬性
    textAlign(CENTER, CENTER);

    // 載入替代文字資料
    loadAlternateTexts();

    // 初始化時間
    lastRotationTime = millis();
}

function draw() {
    // 背景色
    background(242);

    // 檢查是否在首頁（只有 home-view 顯示時才繪製標題）
    const homeView = document.getElementById('home-view');
    const isHomePage = homeView && !homeView.classList.contains('hidden');

    // 只在首頁顯示文字標題
    if (isHomePage) {
        // 檢查是否需要切換文字
        checkTextRotation();

        // 繪製中文標題（每個字獨立浮動）
        drawFloatingText(chineseText, width / 2, height / 2 - 30, 80, 'Noto Sans TC', 'bold', 0);

        // 繪製英文標題（每個字母獨立浮動，縮小字母間距）
        drawFloatingText(englishText, width / 2, height / 2 + 50, 56, 'Helvetica', 'medium', -2);
    }

    // 繪製下雪效果（所有頁面都可用）
    if (isSnowing || isFadingOut) {
        updateSnow();
        drawSnow();

        // 處理淡出效果
        if (isFadingOut) {
            fadeOutAlpha -= 5;
            if (fadeOutAlpha <= 0) {
                isFadingOut = false;
                fadeOutAlpha = 255;
                snowflakes = [];
            }
        }
    }
}

// 繪製浮動文字（每個字符獨立浮動）
function drawFloatingText(txt, centerX, centerY, size, font, weight, letterSpacing = 0) {
    push();
    fill(0);
    textFont(font);
    textSize(size);

    // 設定字重
    if (weight === 'bold') {
        textStyle(BOLD);
    } else {
        textStyle(NORMAL);
    }

    // 計算整個文字的總寬度（包含字母間距）
    let totalWidth = 0;
    for (let i = 0; i < txt.length; i++) {
        let char = txt.charAt(i);
        totalWidth += textWidth(char) + letterSpacing;
    }
    totalWidth -= letterSpacing; // 移除最後一個字符後的間距

    let startX = centerX - totalWidth / 2;

    // 繪製每個字符，各自獨立浮動
    let currentX = startX;
    for (let i = 0; i < txt.length; i++) {
        let char = txt.charAt(i);
        let charWidth = textWidth(char);

        // 每個字符有不同的浮動偏移（基於字符索引和時間）
        let floatOffset = sin(frameCount * 0.015 + i * 0.5) * 2;

        // 繪製字符
        text(char, currentX + charWidth / 2, centerY + floatOffset);

        // 移動到下一個字符位置（加上字母間距）
        currentX += charWidth + letterSpacing;
    }

    pop();
}

// 視窗大小改變時調整畫布
function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
}

// 載入替代文字資料
async function loadAlternateTexts() {
    try {
        const response = await fetch('data/alternate-texts.json');
        alternateTexts = await response.json();

        if (alternateTexts.length > 0) {
            log(`✅ 載入了 ${alternateTexts.length} 組替代文字`);
        }
    } catch (error) {
        log(`❌ 載入替代文字失敗: ${error.message}`, 'error');
        alternateTexts = [];
    }
}

// 檢查並執行文字輪播
function checkTextRotation() {
    if (alternateTexts.length === 0) return;

    const currentTime = millis();

    // 檢查是否達到輪播間隔
    if (currentTime - lastRotationTime >= rotationInterval) {
        // 切換到下一組文字
        textRotationIndex = (textRotationIndex + 1) % alternateTexts.length;

        const newText = alternateTexts[textRotationIndex];
        chineseText = newText.textCN;
        englishText = newText.textEN;

        log(`文字輪播: 切換到 #${textRotationIndex + 1} - ${chineseText}`);

        // 更新時間
        lastRotationTime = currentTime;
    }
}

// 重置文字輪播（當返回首頁時可調用）
function resetTextRotation() {
    textRotationIndex = 0;
    lastRotationTime = millis();

    if (alternateTexts.length > 0) {
        chineseText = alternateTexts[0].textCN;
        englishText = alternateTexts[0].textEN;
    } else {
        // 如果沒有載入替代文字，使用預設文字
        chineseText = '這個人超會寫雞湯。';
        englishText = 'The King of Chicken Soup';
    }

    log('文字輪播已重置');
}

// ===== 下雪效果函數 =====

// 雪花類別
class Snowflake {
    constructor(startFromTop = false) {
        this.x = random(width);
        // 如果是初始化，隨機分佈在整個畫面；否則從頂部開始
        this.y = startFromTop ? random(-100, -10) : random(0, height);
        this.size = random(1, 6);
        this.speed = random(1, 3);
        this.drift = random(-0.5, 0.5);
        this.opacity = random(150, 255);
    }

    update() {
        this.y += this.speed;
        this.x += this.drift;

        // 如果雪花落到底部，重置到頂部（只在非淡出模式下）
        if (!isFadingOut && this.y > height) {
            this.y = random(-100, -10);
            this.x = random(width);
        }

        // 如果雪花飄出畫面兩側，重置位置
        if (this.x > width + 10) {
            this.x = -10;
        } else if (this.x < -10) {
            this.x = width + 10;
        }
    }

    display() {
        noStroke();
        // 淡藍色雪花 (RGB: 173, 216, 230 = Light Blue)
        // 如果正在淡出，調整整體透明度
        let finalOpacity = isFadingOut ? (this.opacity * fadeOutAlpha / 255) : this.opacity;
        fill(173, 216, 230, finalOpacity);
        ellipse(this.x, this.y, this.size);
    }
}

// 更新雪花
function updateSnow() {
    // 如果雪花數量不足且不在淡出模式，添加新雪花
    if (!isFadingOut) {
        while (snowflakes.length < maxSnowflakes) {
            // 新增的雪花從頂部開始（startFromTop = true）
            snowflakes.push(new Snowflake(true));
        }
    }

    // 更新每個雪花
    for (let flake of snowflakes) {
        flake.update();
    }
}

// 繪製雪花
function drawSnow() {
    for (let flake of snowflakes) {
        flake.display();
    }
}

// 切換下雪效果
function toggleSnow() {
    isSnowing = !isSnowing;

    // 按鈕文字和樣式保持不變，不做任何更新

    if (!isSnowing) {
        // 啟動淡出效果
        isFadingOut = true;
        fadeOutAlpha = 255;
        log('下雪效果淡出中...');
    } else {
        // 開啟下雪效果，初始化雪花分佈在整個畫面
        isFadingOut = false;
        fadeOutAlpha = 255;
        snowflakes = [];
        // 立即創建雪花，分佈在整個畫面（startFromTop = false）
        for (let i = 0; i < maxSnowflakes; i++) {
            snowflakes.push(new Snowflake(false));
        }
        log('下雪效果已開啟');
    }
}
