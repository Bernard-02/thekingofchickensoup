// p5.js 動畫腳本（首頁動畫）

let quotes = [];
let canvas;

function setup() {
    // 建立畫布
    const container = document.getElementById('p5-canvas-container');
    if (container) {
        canvas = createCanvas(windowWidth, windowHeight);
        canvas.parent('p5-canvas-container');
    }

    // 設定背景色
    background('#f2f2f2');

    // 載入範例文字（之後會從資料庫載入）
    quotes = [
        '相信自己',
        '堅持到底',
        '永不放棄',
        '夢想成真',
        '勇往直前'
    ];
}

function draw() {
    // 暫時只顯示簡單的背景
    // 等確認 NFC 功能正常後再實作動畫
    background('#f2f2f2');

    // 可以在這裡加入文字動畫
    // 例如：漂浮的文字、粒子效果等
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
}

// p5.js 的 preload 函數（如果需要載入資源）
function preload() {
    // 可以在這裡載入字體、圖片等資源
}