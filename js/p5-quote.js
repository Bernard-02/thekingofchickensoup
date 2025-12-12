// p5.js 雞湯文浮動效果
// 使用 instance mode 避免全域污染

let quoteSketch = function(p) {
    let characters = [];
    let canvasCreated = false;

    // 字符類別
    class FloatingChar {
        constructor(char, x, y, size, weight, color, lineHeight) {
            this.char = char;
            this.targetX = x;
            this.targetY = y;
            this.x = x;
            this.y = y;
            this.size = size;
            this.weight = weight;
            this.color = color;
            this.lineHeight = lineHeight;

            // 浮動參數
            this.offsetY = 0;
            this.offsetX = 0;
            this.phase = p.random(p.TWO_PI); // 隨機相位
            this.amplitude = p.random(1, 2); // 浮動幅度（縮小）
            this.frequency = p.random(0.0005, 0.001); // 浮動頻率（更慢）

            // 出現動畫
            this.opacity = 0;
            this.blur = 20;
            this.appeared = false;
            this.appearStartTime = 0;
            this.appearDuration = 1200; // 1.2 秒
        }

        startAppear(delay = 0) {
            setTimeout(() => {
                this.appearStartTime = p.millis();
                this.appeared = true;
            }, delay);
        }

        update() {
            // 浮動效果（X 和 Y 軸都浮動）
            let time = p.millis() * this.frequency;
            this.offsetY = p.sin(time + this.phase) * this.amplitude;
            this.offsetX = p.cos(time * 0.7 + this.phase) * (this.amplitude * 0.5);

            // 出現動畫
            if (this.appeared && this.opacity < 1) {
                let elapsed = p.millis() - this.appearStartTime;
                let progress = p.constrain(elapsed / this.appearDuration, 0, 1);

                // Ease-out
                progress = 1 - p.pow(1 - progress, 3);

                this.opacity = progress;
                this.blur = 20 * (1 - progress);
            }
        }

        display() {
            if (this.opacity <= 0) return;

            p.push();

            // 應用透明度
            let col = p.color(this.color);
            col.setAlpha(this.opacity * 255);
            p.fill(col);

            // 設定字體
            p.textSize(this.size);
            p.textAlign(p.LEFT, p.TOP);

            // 設定字體粗細
            if (this.weight === 'bold') {
                p.drawingContext.font = `bold ${this.size}px Helvetica, "Noto Sans TC", sans-serif`;
            } else if (this.weight === 'medium') {
                p.drawingContext.font = `500 ${this.size}px Helvetica, "Noto Sans TC", sans-serif`;
            } else {
                // 英文字體，加上緊湊的 letter-spacing
                p.drawingContext.font = `normal ${this.size}px Helvetica, "Noto Sans TC", sans-serif`;
                p.drawingContext.letterSpacing = '-0.05em'; // 縮小字母間距
            }

            // 應用模糊（只在需要時）
            // 使用 CSS filter 會影響性能，改用 shadow 模擬模糊
            if (this.blur > 0.1) {
                let blurAmount = this.blur;
                p.drawingContext.shadowBlur = blurAmount;
                p.drawingContext.shadowColor = this.color;
            }

            // 繪製字符（加上浮動偏移）
            p.text(this.char, this.x + this.offsetX, this.y + this.offsetY);

            // 重置 shadow
            if (this.blur > 0.1) {
                p.drawingContext.shadowBlur = 0;
            }

            p.pop();
        }
    }

    p.setup = function() {
        // 創建畫布
        let canvas = p.createCanvas(p.windowWidth, p.windowHeight);
        canvas.parent('p5-quote-canvas');
        canvasCreated = true;

        // 確保 60fps
        p.frameRate(60);
    };

    p.draw = function() {
        // 清空背景
        p.clear();

        // 更新和繪製所有字符
        for (let char of characters) {
            char.update();
            char.display();
        }
    };

    p.windowResized = function() {
        p.resizeCanvas(p.windowWidth, p.windowHeight);
    };

    // 公開方法：設定雞湯文
    p.setQuote = function(number, textZh, textEn) {
        characters = [];

        // 計算布局位置
        let centerX = p.width / 2;
        let centerY = p.height / 2;

        // 編號（24px = 48px * 0.5, medium, 單行）
        let numberY = centerY - 100;
        createMultilineText(number, centerX, numberY, 24, 'medium', '#000000', 800, 1.2, 0, false);

        // 中文（32px = 64px * 0.5, bold, 最大寬度 48rem = 768px）
        let zhY = centerY - 50;
        let zhMaxWidth = Math.min(768, p.width - 64); // 最大寬度或螢幕寬度減去 padding
        createMultilineText(textZh, centerX, zhY, 32, 'bold', '#000000', zhMaxWidth, 1.25, 400, false);

        // 英文（32px = 64px * 0.5, normal, 最大寬度 48rem = 768px, 更緊湊的行高, 以單字為單位）
        let enY = centerY + 10; // 縮小中英文距離
        let enMaxWidth = Math.min(768, p.width - 64);
        createMultilineText(textEn, centerX, enY, 32, 'normal', '#000000', enMaxWidth, 1.1, 800, true);
    };

    // 創建多行文字（支援自動換行）
    function createMultilineText(text, centerX, startY, size, weight, color, maxWidth, lineHeightMultiplier, delay, floatByWord) {
        // 暫時設定字體來測量
        p.textSize(size);
        if (weight === 'bold') {
            p.drawingContext.font = `bold ${size}px Helvetica, "Noto Sans TC", sans-serif`;
        } else if (weight === 'medium') {
            p.drawingContext.font = `500 ${size}px Helvetica, "Noto Sans TC", sans-serif`;
        } else {
            p.drawingContext.font = `normal ${size}px Helvetica, "Noto Sans TC", sans-serif`;
        }

        // 分割成多行
        let words = floatByWord ? text.split(' ') : text.split('');
        let lines = [];
        let currentLine = '';

        for (let i = 0; i < words.length; i++) {
            let separator = floatByWord ? ' ' : '';
            let testLine = currentLine + (currentLine.length > 0 ? separator : '') + words[i];
            let metrics = p.drawingContext.measureText(testLine);

            if (metrics.width > maxWidth && currentLine.length > 0) {
                lines.push(currentLine);
                currentLine = words[i];
            } else {
                currentLine = testLine;
            }
        }
        if (currentLine.length > 0) {
            lines.push(currentLine);
        }

        // 計算行高
        let lineHeight = size * lineHeightMultiplier;

        // 從中心位置開始繪製
        let currentY = startY;

        if (floatByWord) {
            // 英文：以單字為單位浮動
            for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
                let line = lines[lineIndex];
                let lineWidth = p.drawingContext.measureText(line).width;
                let startX = centerX - lineWidth / 2;

                let wordsInLine = line.split(' ');
                let currentX = startX;

                for (let wordIndex = 0; wordIndex < wordsInLine.length; wordIndex++) {
                    let word = wordsInLine[wordIndex];

                    // 為整個單字創建共同的浮動參數
                    let sharedPhase = p.random(p.TWO_PI);
                    let sharedAmplitude = p.random(1, 2);
                    let sharedFrequency = p.random(0.0005, 0.001);

                    // 設定緊湊的字母間距來測量
                    p.drawingContext.letterSpacing = '-0.05em';

                    for (let charIndex = 0; charIndex < word.length; charIndex++) {
                        let char = word[charIndex];
                        let charWidth = p.drawingContext.measureText(char).width;

                        let floatingChar = new FloatingChar(
                            char,
                            currentX,
                            currentY,
                            size,
                            weight,
                            color,
                            lineHeight
                        );

                        // 使用共同的浮動參數
                        floatingChar.phase = sharedPhase;
                        floatingChar.amplitude = sharedAmplitude;
                        floatingChar.frequency = sharedFrequency;

                        floatingChar.startAppear(delay);
                        characters.push(floatingChar);

                        currentX += charWidth * 0.95; // 縮小字母間距
                    }

                    // 重置 letter-spacing
                    p.drawingContext.letterSpacing = '0em';

                    // 加上空格寬度
                    if (wordIndex < wordsInLine.length - 1) {
                        currentX += p.drawingContext.measureText(' ').width;
                    }
                }

                currentY += lineHeight;
            }
        } else {
            // 中文/數字：每個字符獨立浮動
            for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
                let line = lines[lineIndex];
                let lineWidth = p.drawingContext.measureText(line).width;
                let startX = centerX - lineWidth / 2;

                let currentX = startX;
                for (let charIndex = 0; charIndex < line.length; charIndex++) {
                    let char = line[charIndex];
                    let charWidth = p.drawingContext.measureText(char).width;

                    let floatingChar = new FloatingChar(
                        char,
                        currentX,
                        currentY,
                        size,
                        weight,
                        color,
                        lineHeight
                    );
                    floatingChar.startAppear(delay);
                    characters.push(floatingChar);

                    currentX += charWidth;
                }

                currentY += lineHeight;
            }
        }
    }

    // 全域暴露給 quote.js 使用
    window.quoteP5 = p;
};

// 創建 p5 實例
new p5(quoteSketch);
