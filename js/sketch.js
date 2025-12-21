// p5.js 動畫腳本（首頁動畫）

let canvas;
let chineseText = '這個人超會寫雞湯。';
let englishText = 'The King of Chicken Soup';

// 文字輪播相關變數
let textRotationIndex = 0;
let lastRotationTime = 0;
let rotationInterval = 60000; // 60秒 = 1分鐘
let alternateTexts = [];

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

    // 檢查是否需要切換文字
    checkTextRotation();

    // 繪製中文標題（每個字獨立浮動）
    drawFloatingText(chineseText, width / 2, height / 2 - 30, 80, 'Noto Sans TC', 'bold', 0);

    // 繪製英文標題（每個字母獨立浮動，縮小字母間距）
    drawFloatingText(englishText, width / 2, height / 2 + 50, 56, 'Helvetica', 'medium', -2);
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
