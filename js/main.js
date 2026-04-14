// 用戶選擇（動態，key 為問題 id）
let userSelection = {};

// 問題資料
let questions = [];
let currentQuestionIndex = 0;
let currentSelectedValue = null;
let currentSelectedOption = null; // 新增：用來暫存完整的選項物件
let userAnswers = [];             // 新增：儲存所有答題的完整物件（包含 scores）
let finalQuizResult = null;       // 新增：儲存測驗算出來的結果

// 顯示指定view（帶淡入淡出效果）
window.showView = function(viewId) {
    const currentView = document.querySelector('.view-container.active');
    const nextView = document.getElementById(viewId);
    const logo = document.getElementById('logo');

    if (!nextView) return;

    // 控制全域 Logo 顯示/隱藏 (因為資訊頁面自己有專屬左下角Logo，所以全域的要藏起來)
    if (viewId === 'info-website-view') {
        logo.classList.add('hidden');
    } else {
        logo.classList.remove('hidden');
    }

    if (currentView && currentView !== nextView) {
        currentView.classList.add('fade-out');
        setTimeout(() => {
            currentView.classList.remove('active', 'fade-out', 'fade-in', 'visible');
            nextView.classList.add('active');
            requestAnimationFrame(() => {
                nextView.classList.add('fade-in');
            });
        }, 300);
    } else {
        nextView.classList.add('active', 'fade-in');
    }

    console.log('显示页面:', viewId);
};

const showView = window.showView;

// Accordion 開合（GSAP 動畫）
window.toggleAccordion = function(btn) {
    const content = btn.nextElementSibling;
    const icon = btn.querySelector('.accordion-icon');
    const isOpen = content._accordionOpen;

    if (isOpen) {
        gsap.to(content, {
            height: 0,
            paddingTop: 0,
            paddingBottom: 0,
            duration: 0.35,
            ease: 'sine.inOut',
            onComplete: () => {
                content.style.display = 'none';
                content._accordionOpen = false;
            }
        });
        icon.textContent = '+';
    } else {
        // 先隱藏地測量目標高度與 padding
        content.style.visibility = 'hidden';
        content.style.display = 'block';
        content.style.overflow = 'hidden';
        content.style.height = 'auto';
        content.style.paddingTop = '';
        content.style.paddingBottom = '';
        const targetHeight = content.scrollHeight;
        const computed = window.getComputedStyle(content);
        const targetPaddingTop = parseFloat(computed.paddingTop) || 0;
        const targetPaddingBottom = parseFloat(computed.paddingBottom) || 0;

        // 復原 visibility，從 0 開始動畫
        content.style.visibility = '';
        gsap.fromTo(content,
            { height: 0, paddingTop: 0, paddingBottom: 0 },
            {
                height: targetHeight,
                paddingTop: targetPaddingTop,
                paddingBottom: targetPaddingBottom,
                duration: 0.35,
                ease: 'sine.inOut',
                onComplete: () => {
                    content.style.height = 'auto';
                    content._accordionOpen = true;
                }
            }
        );
        icon.textContent = '−';
    }
};

// 通用 scroll-in 動畫（IntersectionObserver）
const scrollObservers = {};

function initScrollAnim(key, targets) {
    if (scrollObservers[key]) scrollObservers[key].disconnect();

    const scrollRoot = document.getElementById('info-right-panel');
    gsap.set(targets, { opacity: 0, y: 20 });

    let batchTimer = null;
    let batch = [];

    scrollObservers[key] = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                batch.push(entry.target);
                scrollObservers[key].unobserve(entry.target);
            }
        });

        // 收集同一幀內的所有 entry，再一起做 stagger
        clearTimeout(batchTimer);
        batchTimer = setTimeout(() => {
            batch.forEach((el, i) => {
                gsap.to(el, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out', delay: i * 0.06 });
            });
            batch = [];
        }, 20);
    }, { root: scrollRoot, threshold: 0.1 });

    targets.forEach(el => scrollObservers[key].observe(el));
}

function initResearchScrollAnim(pane) {
    const targets = Array.from(pane.querySelectorAll('[data-scroll-anim]'));
    initScrollAnim('research', targets);
}

function initQuotesScrollAnim(items) {
    if (scrollObservers['quotes']) scrollObservers['quotes'].disconnect();

    const scrollRoot = document.getElementById('info-right-panel');
    gsap.set(items, { opacity: 0, y: 40 });

    let initialBatch = true;
    let initialOrder = 0;

    scrollObservers['quotes'] = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const el = entry.target;
                const delay = initialBatch ? initialOrder * 0.05 : 0;
                initialOrder++;
                gsap.to(el, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out', delay });
                scrollObservers['quotes'].unobserve(el);
            }
        });

        // 初始批次結束後，後續 scroll 進來的立刻出現
        setTimeout(() => { initialBatch = false; }, 50);
    }, { root: scrollRoot, threshold: 0.1 });

    items.forEach(el => scrollObservers['quotes'].observe(el));
}

// 切換資訊網站面板
window.switchInfoTab = function(tabId) {
    // 隱藏所有面板
    document.querySelectorAll('.info-pane').forEach(pane => pane.classList.add('hidden'));

    // 重置所有導航按鈕
    document.querySelectorAll('.info-nav-btn').forEach(btn => {
        btn.classList.remove('active-tab');
    });

    // 顯示目標面板
    const targetPane = document.getElementById(`info-pane-${tabId}`);
    if (targetPane) {
        targetPane.classList.remove('hidden');

        if (tabId === 'about') {
            // About：段落逐一從下往上 fade in
            const paragraphs = Array.from(targetPane.querySelectorAll('p, a'));
            gsap.fromTo(paragraphs,
                { opacity: 0, y: 16 },
                { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out', stagger: 0.1 }
            );
        } else if (tabId === 'research') {
            // Research：scroll into view 才觸發動畫
            initResearchScrollAnim(targetPane);
        } else {
            const children = Array.from(targetPane.children);
            gsap.fromTo(children,
                { opacity: 0, y: 20 },
                { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out', stagger: 0.08 }
            );
        }
    }

    // 加底線到 active 按鈕
    const targetBtn = document.getElementById(`tab-btn-${tabId}`);
    if (targetBtn) targetBtn.classList.add('active-tab');

    // 右側內容回到頂部
    const rightPanel = document.getElementById('info-right-panel');
    if (rightPanel) rightPanel.scrollTop = 0;

    // Research anchor 展開/收合
    const researchAnchors = document.getElementById('research-anchors');
    if (tabId === 'research') {
        researchAnchors.classList.remove('hidden');
    } else {
        researchAnchors.classList.add('hidden');
    }
};

// 回到 info 頁面右側頂部
window.scrollInfoToTop = function() {
    const rightPanel = document.getElementById('info-right-panel');
    if (rightPanel) rightPanel.scrollTo({ top: 0, behavior: 'smooth' });
};

// Scroll 到 research 指定 part
window.scrollToResearchPart = function(event, partId) {
    event.preventDefault();

    const target = document.getElementById(partId);
    if (!target) return;

    // 更新 anchor btn 的 active 狀態
    document.querySelectorAll('.research-anchor-btn').forEach(btn => {
        btn.classList.remove('active-anchor');
    });
    event.currentTarget.classList.add('active-anchor');

    // scroll
    const scrollParent = document.querySelector('#info-pane-research').parentElement;
    scrollParent.scrollTo({ top: target.offsetTop - 96, behavior: 'smooth' });
};

// 導航
function goToGuide() {
    showView('guide-view');

    // 步驟 1、2、3 依序 fade in，CTA 最後往上 fade in
    const steps = document.querySelectorAll('#guide-view .step-card');
    const cta = document.querySelector('#guide-view .primary-btn');

    gsap.set([...steps, cta], { opacity: 0 });
    gsap.set(cta, { y: 20, pointerEvents: 'none' });

    steps.forEach((step, i) => {
        gsap.to(step, { opacity: 1, duration: 1, ease: 'power2.out', delay: 0.3 + i * 0.4 });
    });

    const ctaDelay = 0.3 + steps.length * 0.4 + 0.3;
    gsap.to(cta, { opacity: 1, y: 0, pointerEvents: 'auto', duration: 0.6, ease: 'power2.out', delay: ctaDelay });
}

function goToQuestions() {
    currentQuestionIndex = 0;
    userSelection = {};
    userAnswers = [];
    currentSelectedValue = null;
    currentSelectedOption = null;
    finalQuizResult = null;
    renderQuestion(currentQuestionIndex);
    showView('question-view');
}

function restart() {
    userSelection = {};
    currentQuestionIndex = 0;
    currentSelectedValue = null;
    currentSelectedOption = null;
    userAnswers = [];
    finalQuizResult = null;
    document.getElementById('quote-actions').classList.remove('visible');
    showView('home-view');
}

// 渲染問題
function renderQuestion(index) {
    const q = questions[index];
    if (!q) return;

    // 問題文字（打字機效果）
    const questionEl = document.getElementById('question-text');
    questionEl.textContent = '';
    gsap.to(questionEl, { duration: q.text.length * 0.05, text: q.text, ease: 'none' });

    // 英文題目
    const questionEnEl = document.getElementById('question-text-en');
    questionEnEl.textContent = '';
    if (q.textEN) {
        const enDelay = q.text.length * 0.05 + 0.3;
        gsap.to(questionEnEl, { duration: q.textEN.length * 0.015, text: q.textEN, ease: 'none', delay: enDelay });
    }

    // 進度
    document.getElementById('question-progress').textContent = `${index + 1} / ${questions.length}`;

    // 選項
    const optionsContainer = document.getElementById('question-options');
    optionsContainer.innerHTML = '';
    currentSelectedValue = null;
    currentSelectedOption = null;

    // 確定按鈕
    const confirmBtn = document.getElementById('confirm-question');
    confirmBtn.classList.remove('visible');

    // 打字機結束後，選項依序從下往上 fade in
    const cnDuration = q.text.length * 0.05;
    const enDuration = q.textEN ? (cnDuration + 0.3 + q.textEN.length * 0.015) : cnDuration;
    const typewriterDuration = Math.max(cnDuration, enDuration);

    q.options.forEach((opt, i) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.setAttribute('data-value', opt.value);

        const numberSpan = document.createElement('span');
        numberSpan.className = 'option-number';
        numberSpan.textContent = `${'①②③④⑤⑥⑦⑧'[i]}`;

        btn.appendChild(numberSpan);
        btn.appendChild(document.createTextNode(opt.text));
        optionsContainer.appendChild(btn);

        // 初始隱藏且不可互動，打字機結束後依序進場
        gsap.set(btn, { opacity: 0, y: 20, pointerEvents: 'none' });
        gsap.to(btn, { opacity: 1, y: 0, pointerEvents: 'auto', duration: 0.8, ease: 'power2.out', delay: typewriterDuration + 0.5 + i * 0.1 });

        // 綁定點擊事件
        btn.addEventListener('click', () => {
            optionsContainer.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            currentSelectedValue = opt.value;
            currentSelectedOption = opt;
            confirmBtn.classList.add('visible');
        });
    });
}

// 確定按鈕點擊 → 前進到下一題或分叉
function confirmQuestion() {
    if (!currentSelectedValue) return;

    const q = questions[currentQuestionIndex];
    userSelection[q.id] = currentSelectedValue;
    userAnswers.push(currentSelectedOption); // 儲存包含計分的完整物件
    console.log(`${q.id} 確認:`, currentSelectedValue);

    // Q8（最後一題）— 分叉
    if (currentQuestionIndex === questions.length - 1) {
        if (window.nfcManager) {
            nfcManager.userAnswers = userAnswers; // 把完整的計分陣列交給 NFC Manager
        }
        if (currentSelectedValue === 'chat') {
            showView('chat-view');
        } else {
            // 跳過 NFC，直接計算結果並顯示轉譯
            calculateAndShowTranslation();
        }
        return;
    }

    // 下一題
    currentQuestionIndex++;
    currentSelectedValue = null;
    renderQuestion(currentQuestionIndex);
}

// 計算結果並顯示轉譯
async function calculateAndShowTranslation() {
    try {
        // 載入雞湯資料
        const response = await fetch('data/quotes-selected.json');
        let quotes = await response.json();
        
        // 只從前 50 句中選擇 (唯一抽籤卡專用限制)
        quotes = quotes.filter(q => q.number <= 50);

        // 動態載入 3D 計分大腦
        const { getQuizResult } = await import('./quizLogic.js');
        finalQuizResult = getQuizResult(userAnswers, quotes);

        console.log(`🎯 測驗匹配選中: #${finalQuizResult.quote.number} (痛點組合: ${finalQuizResult.userCombo.join(', ')})`);

        // 上方提示：3 句雞湯味的招呼語隨機挑一個
        const soupTeasers = [
            '雞湯的香味出來啦！',
            '你聞到雞湯的味道了嗎？',
            '是不是有什麼東西滾了？'
        ];
        const teaser = soupTeasers[Math.floor(Math.random() * soupTeasers.length)];
        document.getElementById('translation-hint').textContent = teaser;
        // 下方仍顯示該句雞湯的籤文轉譯
        document.getElementById('translation-text').textContent = finalQuizResult.quote.translation;
        showView('translation-view');
    } catch (error) {
        console.error('計算結果失敗:', error);
    }
}

// 建立 quotes list
let allQuotes = [];
let selectedQuoteNumber = null;

// 書本頁碼：第 1 句在 P10，每句 1 頁，每 50 句後有 2 頁其他內容
function getQuotePage(quoteNumber) {
    const gaps = Math.floor((quoteNumber - 1) / 50) * 2;
    return 9 + quoteNumber + gaps;
}

async function buildQuotesList(highlightNumber) {
    if (allQuotes.length === 0) {
        const res = await fetch('data/quotes-selected.json');
        allQuotes = await res.json();
    }

    selectedQuoteNumber = highlightNumber;
    const container = document.getElementById('quotes-list');
    container.innerHTML = '';

    allQuotes.forEach(q => {
        const item = document.createElement('div');
        item.className = 'flex items-baseline gap-4 px-2 py-2 border-t-2 border-black cursor-pointer last:border-b-2';
        item.id = `quote-item-${q.number}`;
        const pageNumber = getQuotePage(q.number);
        item.innerHTML = `
            <span class="en flex-shrink-0 text-lg tracking-tight" style="width: 3.5rem;">#${q.number}</span>
            <span class="flex-1 flex flex-col">
                <span class="text-lg leading-relaxed">${q.translation}</span>
                <span class="quote-page en text-lg text-right opacity-40 tracking-tight">P${pageNumber}</span>
            </span>
        `;

        item.addEventListener('click', () => openQuotePanel(q));

        container.appendChild(item);
    });

    // 每個 list item scroll into view 才 fade in（一條條進場）
    initQuotesScrollAnim(Array.from(container.children));

    // scroll 到抽中的那句，並閃爍提示
    if (highlightNumber) {
        setTimeout(() => {
            const target = document.getElementById(`quote-item-${highlightNumber}`);
            const scrollParent = document.querySelector('#info-pane-quotes').parentElement;
            if (target && scrollParent) {
                // 對齊到 quotes 按鈕那一行的高度
                const navBtn = document.getElementById('tab-btn-quotes');
                const navTop = navBtn ? navBtn.getBoundingClientRect().top - scrollParent.getBoundingClientRect().top : 96;
                scrollParent.scrollTo({ top: target.offsetTop - navTop, behavior: 'smooth' });
                // 確保 item 可見後閃一下
                gsap.to(target, { opacity: 1, y: 0, duration: 0 });
                setTimeout(() => {
                    // 先設定黑底白字
                    gsap.set(target, { backgroundColor: '#000', color: '#fff' });
                    // 停留 1s 後 fade out
                    gsap.to(target, {
                        backgroundColor: 'transparent', color: '#000', duration: 0.6, ease: 'power2.out', delay: 1,
                        onComplete: () => { target.style.removeProperty('background-color'); target.style.removeProperty('color'); }
                    });
                }, 600);
            }
        }, 300);
    }
}

// Canvas particle 系統（支援多元素）
let particleCanvases = [];
let particleAnimFrame = null;

// 用 Range 取得實際文字的 bounding rect（相對於 el）
function getTextBounds(el) {
    const elRect = el.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(el);
    const rects = Array.from(range.getClientRects());
    if (rects.length === 0) return { left: 0, top: 0, width: elRect.width, height: elRect.height };

    const left   = Math.min(...rects.map(r => r.left))   - elRect.left;
    const top    = Math.min(...rects.map(r => r.top))    - elRect.top;
    const right  = Math.max(...rects.map(r => r.right))  - elRect.left;
    const bottom = Math.max(...rects.map(r => r.bottom)) - elRect.top;
    return { left, top, width: right - left, height: bottom - top };
}

const FADE_ZONE = 30; // 邊緣淡出範圍（px）

function makeParticles(w, h) {
    const count = Math.floor((w * h) / 60);
    const fadeZone = Math.min(FADE_ZONE, w * 0.2, h * 0.4);

    const pts = Array.from({ length: count }, () => {
        const x = Math.random() * w;
        const y = Math.random() * h;
        // 距最近邊緣的距離，0=邊緣，1=內部
        const margin = Math.min(x, y, w - x, h - y);
        const edgeFactor = Math.min(margin / fadeZone, 1);
        const r = edgeFactor * 2.5 + 0.3 + Math.random() * 0.2;

        return {
            x, y, r,
            vx: (Math.random() - 0.5) * 0.3,
            vy: (Math.random() - 0.5) * 0.3,
        };
    });

    // 預先跑 120 幀
    for (let i = 0; i < 120; i++) {
        pts.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            if (p.x < 0 || p.x > w) p.vx *= -1;
            if (p.y < 0 || p.y > h) p.vy *= -1;
        });
    }

    return pts;
}

const PAD = 10; // 超出邊界的緩衝

function startParticles(elements) {
    stopParticles();

    const collected = [];

    elements.forEach(el => {
        const elRect = el.getBoundingClientRect();
        el.style.position = 'relative';

        // 每一行各自一個 canvas
        const range = document.createRange();
        range.selectNodeContents(el);
        const lineRects = Array.from(range.getClientRects());

        lineRects.forEach(lineRect => {
            const w = lineRect.width;
            const h = lineRect.height;
            const left = lineRect.left - elRect.left;
            const top  = lineRect.top  - elRect.top;

            const canvas = document.createElement('canvas');
            canvas.width  = w + PAD * 2;
            canvas.height = h + PAD * 2;
            canvas.style.cssText = `position:absolute;left:${left - PAD}px;top:${top - PAD}px;pointer-events:none;z-index:10;`;
            el.appendChild(canvas);

            collected.push({ canvas, particles: makeParticles(w, h), w, h });
        });
    });

    particleCanvases = collected;

    function draw() {
        particleCanvases.forEach(({ canvas, particles, w, h }) => {
            const ctx = canvas.getContext('2d');
            // 清除整個 canvas（padding 區透明）
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            // 灰底只填文字區
            ctx.fillStyle = '#f2f2f2';
            ctx.fillRect(PAD, PAD, w, h);
            // 黑色粒子（座標偏移 PAD）
            particles.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;
                if (p.x < 0 || p.x > w) p.vx *= -1;
                if (p.y < 0 || p.y > h) p.vy *= -1;
                ctx.beginPath();
                ctx.arc(p.x + PAD, p.y + PAD, p.r, 0, Math.PI * 2);
                ctx.fillStyle = '#000';
                ctx.fill();
            });
        });
        particleAnimFrame = requestAnimationFrame(draw);
    }
    draw();
}

function stopParticles() {
    cancelAnimationFrame(particleAnimFrame);
    particleAnimFrame = null;
    particleCanvases.forEach(({ canvas }) => canvas.remove());
    particleCanvases = [];
}

// 開啟 slide panel
function openQuotePanel(quote) {
    window.currentOpenedQuoteNumber = quote.number;
    const panel = document.getElementById('quote-slide-panel');
    const nfcSection = document.getElementById('quote-panel-nfc');
    const revealSection = document.getElementById('quote-panel-reveal');

    const zhEl = document.getElementById('quote-panel-zh');
    const enEl = document.getElementById('quote-panel-en');

    // 填入文字
    nfcSection.classList.add('hidden');
    document.getElementById('quote-panel-number').textContent = `#${quote.number}`;
    zhEl.textContent = quote.textCN;
    enEl.textContent = quote.textEN;
    revealSection.classList.remove('hidden');

    // 立刻隱藏文字（避免閃爍），重置 hint
    zhEl.style.color = '#f2f2f2';
    enEl.style.color = '#f2f2f2';
    document.getElementById('quote-panel-hint').textContent = '雞湯的香味出來啦！';

    // 開啟 panel
    panel.classList.add('open');
    document.getElementById('quote-slide-backdrop').classList.add('open');

    // 立刻啟動粒子（canvas 位置相對父元素，不依賴 panel 位置）
    requestAnimationFrame(() => startParticles([zhEl, enEl]));
}

// 關閉 slide panel
function closeQuotePanel() {
    window.currentOpenedQuoteNumber = null;
    stopParticles();
    document.getElementById('quote-panel-zh').style.color = '';
    document.getElementById('quote-panel-en').style.color = '';
    document.getElementById('quote-slide-panel').classList.remove('open');
    document.getElementById('quote-slide-backdrop').classList.remove('open');
}
window.closeQuotePanel = closeQuotePanel;
window.openQuotePanel = openQuotePanel;
window.buildQuotesList = buildQuotesList;

// NFC 掃描成功後，粒子 scatter 並 reveal（供 nfc.js 呼叫）
window.revealQuoteInPanel = function() {
    cancelAnimationFrame(particleAnimFrame);
    particleAnimFrame = null;

    // 立刻顯示 zh/en 文字（粒子在透明底上叠加，慢慢透出）
    document.getElementById('quote-panel-zh').style.color = '';
    document.getElementById('quote-panel-en').style.color = '';

    const snapshot = [...particleCanvases];
    particleCanvases = [];

    // 計算所有 canvas 合併後的全局中心點
    const allBounds = snapshot.map(({ canvas, w, h }) => ({
        left:   parseFloat(canvas.style.left) + PAD,
        top:    parseFloat(canvas.style.top)  + PAD,
        right:  parseFloat(canvas.style.left) + PAD + w,
        bottom: parseFloat(canvas.style.top)  + PAD + h,
    }));
    const globalCX = (Math.min(...allBounds.map(b => b.left)) + Math.max(...allBounds.map(b => b.right)))  / 2;
    const globalCY = (Math.min(...allBounds.map(b => b.top))  + Math.max(...allBounds.map(b => b.bottom))) / 2;

    // 給每個粒子疊加向外的速度
    snapshot.forEach(({ canvas, particles }) => {
        const canvasLeft = parseFloat(canvas.style.left) + PAD;
        const canvasTop  = parseFloat(canvas.style.top)  + PAD;
        const localCX = globalCX - canvasLeft;
        const localCY = globalCY - canvasTop;
        particles.forEach(p => {
            const dx = p.x - localCX || 0.1;
            const dy = p.y - localCY || 0.1;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const boost = Math.random() * 0.4 + 0.1;
            p.vx += (dx / dist) * boost;
            p.vy += (dy / dist) * boost;
        });
    });

    // 記錄初始粒子數量
    snapshot.forEach(item => { item.initialCount = item.particles.length; });

    // 0.5s 內根據進度移除粒子，透明底讓文字從粒子之間透出
    const startTime = performance.now();
    const DURATION = 500;

    function dissolve(now) {
        const t = Math.min((now - startTime) / DURATION, 1);
        const keepFraction = 1 - t;

        let anyLeft = false;
        snapshot.forEach(({ canvas, particles, initialCount }) => {
            // 按比例隨機移除粒子
            const target = Math.floor(initialCount * keepFraction);
            while (particles.length > target) {
                particles.splice(Math.floor(Math.random() * particles.length), 1);
            }

            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            // 透明底，zh/en 文字從粒子之間透出
            particles.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;
                ctx.beginPath();
                ctx.arc(p.x + PAD, p.y + PAD, p.r, 0, Math.PI * 2);
                ctx.fillStyle = '#000';
                ctx.fill();
            });

            if (particles.length > 0) anyLeft = true;
        });

        if (anyLeft || t < 1) {
            particleAnimFrame = requestAnimationFrame(dissolve);
        } else {
            particleAnimFrame = null;
            snapshot.forEach(({ canvas }) => canvas.remove());

            // hint 文字：先 fade out，停留 2s，再換字 fade in
            const hint = document.getElementById('quote-panel-hint');
            gsap.to(hint, {
                opacity: 0, duration: 0.4, ease: 'power2.out',
                onComplete: () => {
                    const page = window.currentOpenedQuoteNumber ? getQuotePage(window.currentOpenedQuoteNumber) : null;
                    hint.textContent = page ? `翻閱書本第 ${page} 頁以了解這句的脈絡` : '翻閱書本以了解這句的脈絡';
                    gsap.to(hint, { opacity: 0.5, duration: 0.6, delay: 0.5, ease: 'power2.out' });
                }
            });
        }
    }

    particleAnimFrame = requestAnimationFrame(dissolve);
};

// 進入解籤畫面
window.decodeQuote = async function() {
    if (!finalQuizResult) return;

    const finalQuote = finalQuizResult.quote;

    // 通知 NFC Manager (ESP8266) 當前顯示的雞湯編號
    if (window.nfcManager) {
        window.nfcManager.updateCurrentQuote(finalQuote.number);
    }

    // 確保一進來是顯示 Quotes 畫面
    switchInfoTab('quotes');
    showView('info-website-view');

    // 建立 list 並 scroll 到抽中的句子
    await buildQuotesList(finalQuote.number);

    // list 動畫 ~2.5s 跑完後自動 slide in 對應 quote panel
    setTimeout(() => {
        if (typeof openQuotePanel === 'function') {
            openQuotePanel(finalQuote);
        }
    }, 2800);
};

// 載入問題資料
async function loadQuestions() {
    try {
        const response = await fetch('data/questions.json');
        questions = await response.json();
        console.log(`載入 ${questions.length} 題問題`);
    } catch (error) {
        console.error('載入問題失敗:', error);
    }
}

// 載入 About 與 Research 資訊資料
async function loadInfoData() {
    try {
        const response = await fetch('data/info.json');
        const data = await response.json();

        // About 中文
        const aboutZhHtml = data.about.zh.map(text => `<p>${text}</p>`).join('');
        document.getElementById('about-zh').innerHTML = aboutZhHtml;

        // About 英文
        const aboutEnHtml = data.about.en.map(text => `<p>${text}</p>`).join('');
        document.getElementById('about-en').innerHTML = aboutEnHtml;

    } catch (error) {
        console.error('載入資訊資料失敗:', error);
    }
}

// ============ AI 聊天路線 ============

let chatAIResult = null; // 儲存 AI 生成的結果（含 tonesCN 陣列）
let lastChatMessage = ''; // 儲存最後一次輸入的文字

// 把 slider 0-100 值對應到 5 個等級 index 0..4
function snapToneIdx(v) { return Math.round(Number(v ?? 50) / 25); }

// API 端點：Vercel 上用相對路徑，本地用完整網址
const IS_LOCAL = location.protocol === 'file:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
const API_URL = IS_LOCAL ? 'https://chicken-soup-quote.vercel.app/api/chat' : '/api/chat';

// 顯示結果頁面
function showChatResult() {
    document.getElementById('chat-translation-text').textContent = chatAIResult.translation;
    document.getElementById('chat-result-hint').style.opacity = '0.5';
    document.getElementById('chat-result-hint').textContent = '掃描裝置以解讀這句雞湯';
    document.getElementById('chat-result-hint').style.display = '';
    document.getElementById('chat-result-actions').style.display = 'none';
    document.getElementById('chat-params-panel').style.display = 'none';
    showView('chat-result-view');
}

// 開始 loading 動畫（持續循環直到 API 回應）
let loadingTimeline = null;

function startLoadingAnim(zhText = '雞湯生成中...', enText = 'Your chicken soup is brewing...') {
    const zhEl = document.getElementById('chat-loading-zh');
    const enEl = document.getElementById('chat-loading-en');
    zhEl.textContent = '';
    enEl.textContent = '';

    loadingTimeline = gsap.timeline({ repeat: -1 });
    loadingTimeline
        .to(zhEl, { duration: zhText.length * 0.08, text: zhText, ease: 'none' })
        .to(enEl, { duration: enText.length * 0.04, text: enText, ease: 'none' }, `>0.3`)
        .to({}, { duration: 0.5 })
        .to(zhEl, { duration: 0.2, text: '', ease: 'none' })
        .to(enEl, { duration: 0.2, text: '', ease: 'none' }, '<')
        .to({}, { duration: 0.3 });
}

function stopLoadingAnim() {
    if (loadingTimeline) {
        loadingTimeline.kill();
        loadingTimeline = null;
    }
}

// 送出自由輸入
window.submitChat = async function() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;
    lastChatMessage = text;

    // 進入 loading
    showView('chat-loading-view');
    startLoadingAnim();

    // 收集參數
    const tone = document.getElementById('param-tone')?.value || 50;
    const enToggle = document.getElementById('param-en-toggle')?.checked || false;
    const englishStyle = document.getElementById('param-english')?.value || 50;
    const length = document.getElementById('param-length')?.value || 50;

    // 收集問答 scores
    const scores = {};
    userAnswers.forEach(opt => {
        if (opt && opt.scores) {
            Object.entries(opt.scores).forEach(([k, v]) => {
                scores[k] = (scores[k] || 0) + v;
            });
        }
    });

    // 30 秒超時
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
                userMessage: text,
                scores,
                tone: Number(tone),
                english: enToggle,
                englishStyle: Number(englishStyle),
                length: Number(length),
            })
        });
        clearTimeout(timeoutId);

        const result = await response.json();
        stopLoadingAnim();

        if (!response.ok || result.error) {
            console.error('API error:', result.error, 'detail:', result.detail);
            showRetryPrompt();
            return;
        }

        if (!result.valid) {
            stopLoadingAnim();
            alert(result.retry_message || '可以再多說一點嗎？');
            showView('chat-view');
            return;
        }

        chatAIResult = result;
        showChatResult();

    } catch (err) {
        clearTimeout(timeoutId);
        console.error('Fetch error:', err);
        stopLoadingAnim();
        showRetryPrompt();
    }
};

// 顯示重試提示（在 loading 頁面）
function showRetryPrompt() {
    stopLoadingAnim();
    const zhEl = document.getElementById('chat-loading-zh');
    const enEl = document.getElementById('chat-loading-en');
    zhEl.textContent = '雞湯熬太久了';
    enEl.textContent = 'The soup took too long...';
    document.getElementById('chat-retry-section').style.display = '';
}

// 重試上一次的輸入
window.retryLastChat = function() {
    document.getElementById('chat-retry-section').style.display = 'none';
    document.getElementById('chat-input').value = lastChatMessage;
    submitChat();
};

// NFC 解碼 AI 生成的原句
window.revealChatQuote = function() {
    if (!chatAIResult) return;

    // 已經解析過就不再重播動畫
    const hintEl = document.getElementById('chat-result-hint');
    if (hintEl && hintEl.style.display === 'none') return;

    const translationEl = document.getElementById('chat-translation-text');
    const hint = document.getElementById('chat-result-hint');
    const actions = document.getElementById('chat-result-actions');

    // 依當前語氣 slider 選對應版本
    const idx = snapToneIdx(document.getElementById('param-tone')?.value);
    const currentCN = (chatAIResult.tonesCN && chatAIResult.tonesCN[idx]) || chatAIResult.textCN;
    chatAIResult.textCN = currentCN;

    // 轉譯 fade out → 換成原句 fade in
    gsap.to(translationEl, {
        opacity: 0, duration: 0.4, ease: 'power2.out',
        onComplete: () => {
            translationEl.textContent = currentCN;
            gsap.to(translationEl, { opacity: 1, duration: 0.6, ease: 'power2.out' });
        }
    });

    // hint fade out → 換字 → fade in
    gsap.to(hint, {
        opacity: 0, duration: 0.4, ease: 'power2.out',
        onComplete: () => {
            hint.textContent = '';
            hint.style.display = 'none';
        }
    });

    // 顯示左下角按鈕 + 右下角參數
    const paramsPanel = document.getElementById('chat-params-panel');
    gsap.fromTo(actions,
        { display: 'flex', opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 0.6, delay: 1.5, ease: 'power2.out' }
    );
    gsap.fromTo(paramsPanel,
        { display: 'flex', opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 0.6, delay: 1.8, ease: 'power2.out' }
    );
};

// 再回答一次
window.retryChatInput = function() {
    const input = document.getElementById('chat-input');
    input.value = '';
    input.style.height = 'auto';
    input.style.overflow = 'hidden';
    chatAIResult = null;
    showView('chat-view');
};

// 參數調整後重新生成（留在同一頁面）
let paramDebounceTimer = null;

let seasoningTimeline = null;

function stopSeasoning(textEl, enEl) {
    if (textEl) gsap.killTweensOf(textEl);
    if (enEl) gsap.killTweensOf(enEl);
    if (seasoningTimeline) { seasoningTimeline.kill(); seasoningTimeline = null; }
}

function setParamsDisabled(disabled) {
    const panel = document.getElementById('chat-params-panel');
    const actions = document.getElementById('chat-result-actions');
    if (disabled) {
        panel.classList.add('params-disabled');
        actions.classList.add('params-disabled');
    } else {
        panel.classList.remove('params-disabled');
        actions.classList.remove('params-disabled');
    }
}

async function regenerateWithParams() {
    if (!lastChatMessage) return;

    const textEl = document.getElementById('chat-translation-text');
    const enEl = document.getElementById('chat-en-text');

    // 禁用參數面板 + 左上按鈕
    setParamsDisabled(true);

    // 打字機動畫顯示「調味中...」
    const zhSeason = '雞湯正在調味中...';

    const enSeason = 'Seasoning your chicken soup...';

    gsap.to(textEl, {
        opacity: 0, duration: 0.3, ease: 'power2.out',
        onComplete: () => {
            textEl.textContent = '';
            gsap.to(textEl, { opacity: 1, duration: 0.1 });
            if (seasoningTimeline) seasoningTimeline.kill();
            const enVisible = enEl.style.display !== 'none';
            seasoningTimeline = gsap.timeline({ repeat: -1 });
            seasoningTimeline
                .to(textEl, { duration: zhSeason.length * 0.08, text: zhSeason, ease: 'none' });
            if (enVisible) {
                seasoningTimeline.to(enEl, { duration: enSeason.length * 0.04, text: enSeason, ease: 'none' }, `>0.3`);
            }
            seasoningTimeline
                .to({}, { duration: 0.5 })
                .to(textEl, { duration: 0.2, text: '', ease: 'none' });
            if (enVisible) {
                seasoningTimeline.to(enEl, { duration: 0.2, text: '', ease: 'none' }, '<');
            }
            seasoningTimeline.to({}, { duration: 0.3 });
        }
    });
    if (enEl.style.display !== 'none') {
        gsap.to(enEl, {
            opacity: 0, duration: 0.3, ease: 'power2.out',
            onComplete: () => {
                enEl.textContent = '';
                gsap.to(enEl, { opacity: 1, duration: 0.1 });
            }
        });
    }

    const tone = document.getElementById('param-tone')?.value || 50;
    const enToggle = document.getElementById('param-en-toggle')?.checked || false;
    const englishStyle = document.getElementById('param-english')?.value || 50;
    const length = document.getElementById('param-length')?.value || 50;

    const scores = {};
    userAnswers.forEach(opt => {
        if (opt && opt.scores) {
            Object.entries(opt.scores).forEach(([k, v]) => {
                scores[k] = (scores[k] || 0) + v;
            });
        }
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
                userMessage: lastChatMessage,
                scores,
                tone: Number(tone),
                english: enToggle,
                englishStyle: Number(englishStyle),
                length: Number(length),
                avoidCN: (chatAIResult && Array.isArray(chatAIResult.tonesCN)) ? chatAIResult.tonesCN : [],
            })
        });
        clearTimeout(timeoutId);

        const result = await response.json();

        if (!response.ok || result.error || !result.valid) {
            stopSeasoning(textEl, enEl);
            textEl.style.opacity = 1;
            textEl.textContent = chatAIResult.textCN;
            if (enEl.style.display !== 'none') {
                enEl.style.opacity = 1;
                enEl.textContent = chatAIResult.textEN || '';
            }
            setParamsDisabled(false);
            return;
        }

        chatAIResult = result;
        stopSeasoning(textEl, enEl);

        // fade in 新文字
        gsap.to(textEl, {
            opacity: 0, duration: 0.3,
            onComplete: () => {
                textEl.textContent = chatAIResult.textCN;
                gsap.to(textEl, { opacity: 1, duration: 0.4 });
            }
        });
        if (enEl.style.display !== 'none') {
            gsap.to(enEl, {
                opacity: 0, duration: 0.3,
                onComplete: () => {
                    enEl.textContent = chatAIResult.textEN || '';
                    gsap.to(enEl, { opacity: 1, duration: 0.4 });
                }
            });
        }

        setParamsDisabled(false);

    } catch (err) {
        clearTimeout(timeoutId);
        console.error('Regenerate error:', err);
        stopSeasoning(textEl, enEl);
        // 調味失敗，恢復原本文字
        textEl.style.opacity = 1;
        textEl.textContent = chatAIResult.textCN;
        if (enEl.style.display !== 'none') {
            enEl.style.opacity = 1;
            enEl.textContent = chatAIResult.textEN || '';
        }
        setParamsDisabled(false);
    }
}

// 只重新翻譯英文（中文保持不變）
async function retranslateEnglish() {
    if (!chatAIResult || !lastChatMessage) return;

    const enEl = document.getElementById('chat-en-text');
    if (enEl.style.display === 'none') return;

    setParamsDisabled(true);

    // 英文部分顯示 loading
    gsap.to(enEl, {
        opacity: 0, duration: 0.2,
        onComplete: () => {
            enEl.textContent = 'Translating...';
            gsap.to(enEl, { opacity: 1, duration: 0.2 });
        }
    });

    const englishStyle = document.getElementById('param-english')?.value || 50;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
                userMessage: lastChatMessage,
                scores: {},
                tone: 50,
                english: true,
                englishStyle: Number(englishStyle),
                length: 50,
                retranslateOnly: true,
                existingCN: chatAIResult.textCN,
            })
        });
        clearTimeout(timeoutId);

        const result = await response.json();
        if (response.ok && result.textEN) {
            chatAIResult.textEN = result.textEN;
            gsap.to(enEl, {
                opacity: 0, duration: 0.2,
                onComplete: () => {
                    enEl.textContent = result.textEN;
                    gsap.to(enEl, { opacity: 1, duration: 0.3 });
                }
            });
        } else {
            enEl.textContent = chatAIResult.textEN || '';
        }
    } catch (err) {
        clearTimeout(timeoutId);
        enEl.textContent = chatAIResult.textEN || '';
    }

    setParamsDisabled(false);
}

document.addEventListener('DOMContentLoaded', async () => {
    // 載入問題與資訊資料
    await loadQuestions();
    await loadInfoData();

    // 確定按鈕
    document.getElementById('confirm-question').addEventListener('click', confirmQuestion);

    // 參數變動 → debounce 重新生成
    function onParamChange() {
        clearTimeout(paramDebounceTimer);
        paramDebounceTimer = setTimeout(() => {
            if (chatAIResult && lastChatMessage) regenerateWithParams();
        }, 800);
    }

    // English toggle → 顯示/隱藏英文文字 + Manglish↔Formal slider
    const enToggle = document.getElementById('param-en-toggle');
    if (enToggle) {
        enToggle.addEventListener('change', () => {
            const enTextEl = document.getElementById('chat-en-text');
            const enStyleWrapper = document.getElementById('param-en-style-wrapper');
            enStyleWrapper.style.display = enToggle.checked ? 'flex' : 'none';

            if (enToggle.checked) {
                // 顯示英文（用已有的 AI 結果）
                if (chatAIResult && chatAIResult.textEN) {
                    enTextEl.textContent = chatAIResult.textEN;
                    enTextEl.style.display = '';
                    gsap.fromTo(enTextEl, { opacity: 0 }, { opacity: 1, duration: 0.4 });
                }
            } else {
                enTextEl.style.display = 'none';
            }
        });
    }

    // Tone slider → 即時切換已預生成的版本（不打 API），並 lazy 更新英文翻譯
    const toneSlider = document.getElementById('param-tone');
    if (toneSlider) {
        toneSlider.addEventListener('change', () => {
            if (!chatAIResult || !Array.isArray(chatAIResult.tonesCN)) return;
            const idx = snapToneIdx(toneSlider.value);
            const newCN = chatAIResult.tonesCN[idx] || chatAIResult.textCN;
            if (newCN === chatAIResult.textCN) return;
            chatAIResult.textCN = newCN;

            // 只有在已經 reveal（hint 已隱藏）後才需要視覺切換
            const hint = document.getElementById('chat-result-hint');
            const revealed = hint && hint.style.display === 'none';
            if (!revealed) return;

            const textEl = document.getElementById('chat-translation-text');
            const enEl = document.getElementById('chat-en-text');
            stopSeasoning(textEl, enEl);
            textEl.style.opacity = 1;
            gsap.to(textEl, {
                opacity: 0, duration: 0.2, ease: 'power2.out',
                onComplete: () => {
                    textEl.textContent = newCN;
                    gsap.to(textEl, { opacity: 1, duration: 0.35 });
                }
            });
            // 英文若開著，重新翻譯配合新中文
            if (enEl && enEl.style.display !== 'none') {
                retranslateEnglish();
            }
        });
    }

    // Length slider → 中英文都重新生成（會拿到新的 5 版 tonesCN）
    const lengthSlider = document.getElementById('param-length');
    if (lengthSlider) lengthSlider.addEventListener('change', onParamChange);

    // 中文字體切換
    const fontZhSelect = document.getElementById('param-font-zh');
    if (fontZhSelect) {
        fontZhSelect.addEventListener('change', () => {
            const textEl = document.getElementById('chat-translation-text');
            if (!textEl) return;
            textEl.classList.remove('font-noto-sans-tc', 'font-noto-serif-tc');
            textEl.classList.add(`font-${fontZhSelect.value}`);
        });
    }

    // 英文字體切換
    const fontEnSelect = document.getElementById('param-font-en');
    if (fontEnSelect) {
        fontEnSelect.addEventListener('change', () => {
            const enEl = document.getElementById('chat-en-text');
            if (!enEl) return;
            enEl.classList.remove('font-helvetica', 'font-times-new-roman');
            enEl.classList.add(`font-${fontEnSelect.value}`);
        });
    }

    // English style slider 變動 → 只重新翻譯英文
    const enStyleSlider = document.getElementById('param-english');
    if (enStyleSlider) {
        enStyleSlider.addEventListener('change', () => {
            clearTimeout(paramDebounceTimer);
            paramDebounceTimer = setTimeout(() => {
                if (chatAIResult && lastChatMessage) retranslateEnglish();
            }, 800);
        });
    }

    // 聊天輸入框邏輯
    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
        const lineHeight = parseFloat(getComputedStyle(chatInput).lineHeight) || 28;
        const maxLines = 4;
        const maxScrollHeight = lineHeight * maxLines + 16; // pt padding

        // IME 組字中不過濾（避免把注音符號吃掉）
        let isComposing = false;
        chatInput.addEventListener('compositionstart', () => { isComposing = true; });
        chatInput.addEventListener('compositionend', () => {
            isComposing = false;
            chatInput.dispatchEvent(new Event('input'));
        });

        chatInput.addEventListener('input', () => {
            if (isComposing) return; // 組字中不過濾
            // 過濾：只允許中文、注音、英文、基本標點、空格（連續空格壓成一個）
            let val = chatInput.value;
            val = val.replace(/[^\u4e00-\u9fff\u3000-\u303f\u3100-\u312f\u31a0-\u31bfa-zA-Z0-9\s，。？！、；：「」''""—…·,.?!;:'"()\-\n]/g, '');
            val = val.replace(/ {2,}/g, ' ');
            if (val !== chatInput.value) chatInput.value = val;

            // 自動調整高度：先重置再量
            chatInput.style.height = 'auto';
            chatInput.style.overflow = 'hidden';
            const scrollH = chatInput.scrollHeight;
            if (scrollH > maxScrollHeight) {
                chatInput.style.height = maxScrollHeight + 'px';
                chatInput.style.overflow = 'auto';
            } else {
                chatInput.style.height = scrollH + 'px';
            }

        });

        // Enter 送出，Shift+Enter 換行
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (chatInput.value.trim().length > 0) submitChat();
            }
        });
    }

    // 初始化 WebSocket
    console.log('檢查 nfcManager:', window.nfcManager);
    console.log('檢查 CONFIG:', window.CONFIG);

    if (window.nfcManager) {
        console.log('準備連接 WebSocket...');
        nfcManager.connect();
    } else {
        console.error('錯誤：nfcManager 未定義！');
    }

    // 首頁動畫
    startHomeAnimation();
});

// 首頁打字機動畫（循環）
let homeTimeline = null;

function startHomeAnimation() {
    const zhEl = document.getElementById('home-title-zh');
    const enEl = document.getElementById('home-title-en');
    const cta = document.getElementById('home-cta');
    const logo = document.getElementById('logo');

    const zhText = '這個人超會寫雞湯';
    const enText = 'The King of Chicken Soup';

    // 初始隱藏 logo
    gsap.set(logo, { opacity: 0 });

    // 第一輪：打字 → btn fade in → logo fade in
    const zhDur = zhText.length * 0.1;
    const enDur = enText.length * 0.04;
    const enStart = zhDur + 0.3;
    const firstRoundEnd = enStart + enDur;

    gsap.to(zhEl, { duration: zhDur, text: zhText, ease: 'none' });
    gsap.to(enEl, { duration: enDur, text: enText, ease: 'none', delay: enStart });

    // btn float up fade in
    gsap.to(cta, {
        opacity: 1, y: 0, pointerEvents: 'auto', duration: 0.8, ease: 'power2.out',
        delay: firstRoundEnd + 0.3
    });
    gsap.set(cta, { y: 20 });

    // logo fade in
    gsap.to(logo, {
        opacity: 1, duration: 0.8, ease: 'power2.out',
        delay: firstRoundEnd + 0.8,
        onComplete: () => startHomeTitleLoop(zhEl, enEl, zhText, enText)
    });
}

function startHomeTitleLoop(zhEl, enEl, zhText, enText) {
    const zhDur = zhText.length * 0.1;
    const enDur = enText.length * 0.04;

    homeTimeline = gsap.timeline({ repeat: -1, delay: 2 });
    homeTimeline
        // 清空
        .to(zhEl, { duration: 0.3, text: '', ease: 'none' })
        .to(enEl, { duration: 0.3, text: '', ease: 'none' }, '<')
        .to({}, { duration: 0.5 })
        // 重新打字
        .to(zhEl, { duration: zhDur, text: zhText, ease: 'none' })
        .to(enEl, { duration: enDur, text: enText, ease: 'none' }, `>0.3`)
        .to({}, { duration: 2 }); // 停留 2 秒再循環
}
