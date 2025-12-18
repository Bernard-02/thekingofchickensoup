// p5.js 動畫腳本（首頁動畫）

let canvas;
let chineseText = '這個人超會寫雞湯。';
let englishText = 'THE KING OF CHICKEN SOUP';

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
}

function draw() {
    // 背景色
    background(242);

    // 繪製中文標題（每個字獨立浮動）
    drawFloatingText(chineseText, width / 2, height / 2 - 30, 80, 'Noto Sans TC', 'bold');

    // 繪製英文標題（每個字母獨立浮動）
    drawFloatingText(englishText, width / 2, height / 2 + 50, 56, 'Helvetica', 'medium');
}

// 繪製浮動文字（每個字符獨立浮動）
function drawFloatingText(txt, centerX, centerY, size, font, weight) {
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

    // 計算整個文字的總寬度
    let totalWidth = textWidth(txt);
    let startX = centerX - totalWidth / 2;

    // 繪製每個字符，各自獨立浮動
    let currentX = startX;
    for (let i = 0; i < txt.length; i++) {
        let char = txt.charAt(i);
        let charWidth = textWidth(char);

        // 每個字符有不同的浮動偏移（基於字符索引和時間）
        let floatOffset = sin(frameCount * 0.02 + i * 0.5) * 4;

        // 繪製字符
        text(char, currentX + charWidth / 2, centerY + floatOffset);

        // 移動到下一個字符位置
        currentX += charWidth;
    }

    pop();
}

// 視窗大小改變時調整畫布
function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
}
