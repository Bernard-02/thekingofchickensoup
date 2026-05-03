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
// 離開 info-website-view 時要清的 timer / 動畫
let decodeOpenTimer = null;
window.clearDecodeOpenTimer = function() {
    if (decodeOpenTimer) { clearTimeout(decodeOpenTimer); decodeOpenTimer = null; }
};
window.setDecodeOpenTimer = function(fn, delay) {
    if (decodeOpenTimer) clearTimeout(decodeOpenTimer);
    decodeOpenTimer = setTimeout(() => {
        decodeOpenTimer = null;
        fn();
    }, delay);
};

window.showView = function(viewId) {
    const currentView = document.querySelector('.view-container.active');
    const nextView = document.getElementById(viewId);
    const logo = document.getElementById('logo');

    if (!nextView) return;

    // 離開 info-website-view：清 timer + 關 panel + 停粒子，避免殘留
    if (currentView && currentView.id === 'info-website-view' && viewId !== 'info-website-view') {
        if (decodeOpenTimer) { clearTimeout(decodeOpenTimer); decodeOpenTimer = null; }
        if (typeof stopParticles === 'function') stopParticles();
        const panel = document.getElementById('quote-slide-panel');
        const backdrop = document.getElementById('quote-slide-backdrop');
        if (panel) panel.classList.remove('open');
        if (backdrop) backdrop.classList.remove('open');
        window.currentOpenedQuoteNumber = null;
    }

    // 切換 view 就取消所有殘留的掃描 hold 計時
    if (currentView && currentView !== nextView && typeof window.cancelRevealHold === 'function') {
        window.cancelRevealHold();
    }

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
const GUIDE_STEPS = [
    { text: '歡迎來到雞湯王的熬製秘所，\n現在請跟著我的步伐\n獲得專屬於你的雞湯！', btn: '下一步',     image: 'Images/雞湯王出場.png' },
    { text: '請回答5個問題獲取雞湯的製作原料',                                         btn: 'ok，我已了解', image: 'Images/5個問題.png'     },
];
let guideStepIndex = 0;

function goToGuide() {
    showView('guide-view');

    const textEl = document.getElementById('guide-text');
    const btn = document.getElementById('guide-btn');
    const imgEl = document.getElementById('guide-image');

    guideStepIndex = 0;
    textEl.textContent = GUIDE_STEPS[0].text;
    btn.textContent = GUIDE_STEPS[0].btn;
    if (imgEl) imgEl.src = GUIDE_STEPS[0].image;

    gsap.set([imgEl, textEl, btn], { opacity: 0 });
    gsap.set(btn, { y: 20, pointerEvents: 'none' });

    gsap.to(imgEl, { opacity: 1, duration: 0.8, ease: 'power2.out', delay: 0.1 });
    gsap.to(textEl, { opacity: 1, duration: 0.8, ease: 'power2.out', delay: 0.3 });
    gsap.to(btn, { opacity: 1, y: 0, pointerEvents: 'auto', duration: 0.6, ease: 'power2.out', delay: 0.9 });
}

function advanceGuide() {
    const textEl = document.getElementById('guide-text');
    const btn = document.getElementById('guide-btn');
    const imgEl = document.getElementById('guide-image');

    // 第二步之後 → 進入問題
    if (guideStepIndex >= GUIDE_STEPS.length - 1) {
        goToQuestions();
        return;
    }

    // 原地替換文字：fade out → swap → stagger fade in（跟成品頁同一套節奏）
    gsap.set(btn, { pointerEvents: 'none' });
    gsap.to([imgEl, textEl, btn], {
        opacity: 0,
        duration: 0.35,
        ease: 'power2.in',
        onComplete: () => {
            guideStepIndex++;
            const next = GUIDE_STEPS[guideStepIndex];
            textEl.textContent = next.text;
            btn.textContent = next.btn;
            if (imgEl) imgEl.src = next.image;

            gsap.set([imgEl, textEl, btn], { opacity: 0, y: 10 });
            gsap.to(imgEl, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' });
            gsap.to(textEl, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out', delay: 0.15 });
            gsap.to(btn, {
                opacity: 1, y: 0, duration: 0.5, ease: 'power2.out', delay: 0.75,
                onStart: () => { btn.style.pointerEvents = 'auto'; }
            });
        }
    });
}

function goToQuestions() {
    currentQuestionIndex = 0;
    userSelection = {};
    userAnswers = [];
    currentSelectedValue = null;
    currentSelectedOption = null;
    finalQuizResult = null;
    window.finalQuizResult = null;
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
    window.finalQuizResult = null;
    // AI 聊天狀態也要清，避免下一個使用者看到上一個人的結果
    chatAIResult = null;
    lastChatMessage = '';
    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
        chatInput.value = '';
        chatInput.style.height = 'auto';
    }
    // 燈條回到 idle 白色呼吸
    if (typeof window.sendLedMode === 'function') window.sendLedMode('idle');
    showView('home-view');
}

// 渲染問題
function renderQuestion(index) {
    const q = questions[index];
    if (!q) return;

    // 問題文字（fade in）
    const questionEl = document.getElementById('question-text');
    questionEl.textContent = q.text;
    gsap.fromTo(questionEl, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' });

    // 英文題目（已隱藏，保留元素避免版面位移）
    const questionEnEl = document.getElementById('question-text-en');
    if (questionEnEl) questionEnEl.textContent = '';

    // 進度（容器選擇題不顯示題號）
    const progressEl = document.getElementById('question-progress');
    if (q.type === 'container-choice') {
        progressEl.textContent = '';
        progressEl.style.visibility = 'hidden';
    } else {
        // 容器選擇題不計入總數：用除了 container-choice 以外的題數做分母
        const totalQs = questions.filter(qq => qq.type !== 'container-choice').length;
        progressEl.textContent = `${index + 1} / ${totalQs}`;
        progressEl.style.visibility = 'visible';
    }

    // 選項
    const optionsContainer = document.getElementById('question-options');
    optionsContainer.innerHTML = '';
    currentSelectedValue = null;
    currentSelectedOption = null;

    // 確定按鈕
    const confirmBtn = document.getElementById('confirm-question');
    confirmBtn.classList.remove('visible');

    // 右下角雞湯王：單選題才顯示，預設睜眼
    const mascot = document.getElementById('question-mascot');
    if (mascot) {
        if (q.type === 'container-choice') {
            mascot.style.display = 'none';
        } else {
            mascot.src = 'Images/雞湯王.png';
            mascot.style.display = '';
        }
    }

    // 題目 fade in 0.6s 結束後選項緊接進場
    const optionStartDelay = 0.65;

    if (q.type === 'container-choice') {
        renderContainerChoice(q, optionsContainer, confirmBtn, optionStartDelay);
    } else {
        renderSingleChoice(q, optionsContainer, confirmBtn, optionStartDelay);
    }
}

function renderSingleChoice(q, optionsContainer, confirmBtn, optionStartDelay) {
    optionsContainer.classList.remove('container-choice-layout');

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

        gsap.set(btn, { opacity: 0, y: 20, pointerEvents: 'none' });
        gsap.to(btn, { opacity: 1, y: 0, pointerEvents: 'auto', duration: 0.5, ease: 'power2.out', delay: optionStartDelay + i * 0.1 });

        btn.addEventListener('click', () => {
            optionsContainer.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            currentSelectedValue = opt.value;
            currentSelectedOption = opt;
            confirmBtn.classList.add('visible');
            // 雞湯王閉眼（有選項被選時）
            const mascot = document.getElementById('question-mascot');
            if (mascot) mascot.src = 'Images/雞湯王閉眼.png';
        });
    });
}

// 容器選擇題的標題對應到圖檔
const CONTAINER_IMAGE_BY_TITLE = {
    '雞湯學徒的鍋子': 'Images/雞湯學徒的鍋子.png',
    '雞湯王的鍋子':   'Images/雞湯王的鍋子.png',
};

function renderContainerChoice(q, optionsContainer, confirmBtn, optionStartDelay) {
    optionsContainer.classList.add('container-choice-layout');

    q.options.forEach((opt, i) => {
        const box = document.createElement('button');
        box.className = 'container-choice-box';
        box.setAttribute('data-value', opt.value);

        const imgSrc = CONTAINER_IMAGE_BY_TITLE[opt.title];
        let imgEl;
        if (imgSrc) {
            imgEl = document.createElement('img');
            imgEl.src = imgSrc;
            imgEl.alt = opt.title || '';
            imgEl.className = 'container-choice-image';
        } else {
            imgEl = document.createElement('div');
            imgEl.className = 'container-choice-image';
            imgEl.textContent = '圖案';
        }

        const titleEl = document.createElement('div');
        titleEl.className = 'container-choice-title';
        titleEl.textContent = opt.title || '';

        const textEl = document.createElement('div');
        textEl.className = 'container-choice-text';
        textEl.textContent = opt.text;

        box.appendChild(imgEl);
        box.appendChild(titleEl);
        box.appendChild(textEl);
        optionsContainer.appendChild(box);

        gsap.set(box, { opacity: 0, y: 20, pointerEvents: 'none' });
        gsap.to(box, { opacity: 1, y: 0, pointerEvents: 'auto', duration: 0.5, ease: 'power2.out', delay: optionStartDelay + i * 0.1 });

        box.addEventListener('click', () => {
            optionsContainer.querySelectorAll('.container-choice-box').forEach(b => b.classList.remove('selected'));
            box.classList.add('selected');
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
            // 先過 intro 畫面說明要跟 AI 對話，按確定才進真正的 chat-view
            showView('chat-intro-view');
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

        // 只從 selected 的前 50 筆中選（= 有實體 NFC 卡的那 50 句）
        quotes = quotes.slice(0, 50);

        // 動態載入 3D 計分大腦
        const { getQuizResult } = await import('./quizLogic.js');
        finalQuizResult = getQuizResult(userAnswers, quotes);
        window.finalQuizResult = finalQuizResult;

        console.log(`🎯 測驗匹配選中: #${finalQuizResult.quote.number} (痛點組合: ${finalQuizResult.userCombo.join(', ')})`);

        // 直接進入熬製頁（食材結果保留在記憶體，畫面不額外顯示）
        goToCooking();
    } catch (error) {
        console.error('計算結果失敗:', error);
    }
}

// ========== 食材清單 → 熬製 → 雞湯成品 ==========

// 語錄的象限 → 四種食材份量
// 邏輯：主象限對應的食材「明顯多」、次象限「稍微多」、其他維持底線
// 對應：IP=調味料（衝）/ IR=水（淡）/ SP=蔥薑蒜（暖）/ SR=雞（紮實）
const QUADRANT_TO_INGREDIENT = { IP: 'seasoning', IR: 'water', SP: 'aromatics', SR: 'chicken' };

const INGREDIENT_SPEC = {
    chicken:   { name: '雞',     unit: 'g',  base: 200, primaryBoost: 250, secondaryBoost: 100, img: 'Images/雞.png'     },
    water:     { name: '水',     unit: 'ml', base: 400, primaryBoost: 400, secondaryBoost: 150, img: 'Images/水.png'     },
    aromatics: { name: '蔥薑蒜', unit: '份', base: 2,   primaryBoost: 3,   secondaryBoost: 1,   img: 'Images/葱薑蒜.png' },
    seasoning: { name: '調味料', unit: 'g',  base: 5,   primaryBoost: 20,  secondaryBoost: 8,   img: 'Images/調味料.png' },
};

const INGREDIENT_ORDER = ['chicken', 'water', 'aromatics', 'seasoning'];

function computeIngredientsFromQuote(quote) {
    const primaryKey   = QUADRANT_TO_INGREDIENT[quote.quadrant];
    const secondaryKey = QUADRANT_TO_INGREDIENT[quote.quadrantSecondary];

    return INGREDIENT_ORDER.map(key => {
        const spec = INGREDIENT_SPEC[key];
        let amount = spec.base;
        if (key === primaryKey)   amount += spec.primaryBoost;
        if (key === secondaryKey) amount += spec.secondaryBoost;
        return {
            name: spec.name,
            amount: `${amount}${spec.unit}`,
            img: spec.img,
        };
    });
}

function showIngredientView() {
    if (!finalQuizResult) return;
    const list = computeIngredientsFromQuote(finalQuizResult.quote);

    const container = document.getElementById('ingredient-list');
    container.innerHTML = '';
    list.forEach((ing, i) => {
        const card = document.createElement('div');
        card.className = 'ingredient-card';
        card.innerHTML = `
            <img class="ingredient-icon" src="${ing.img}" alt="${ing.name}">
            <div class="ingredient-name">${ing.name}</div>
            <div class="ingredient-amount en">${ing.amount}</div>
        `;
        container.appendChild(card);

        gsap.set(card, { opacity: 0, y: 20 });
        gsap.to(card, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out', delay: 0.3 + i * 0.25 });
    });

    showView('ingredient-view');
}

// ========== 熬製五步驟（純鍵盤互動：空白鍵；幾何圖形佔位） ==========
// 之後實際出圖時，把 setup 函式內的 div / 邊框換成圖檔即可，邏輯都不需要動
const COOKING_STEPS = [
    { title: '剁碎食材',  hint: '按一下空白鍵，把當前的食材剁好',                type: 'chop'   },
    { title: '加水',      hint: '長按空白鍵注水，到 lvl 水位線時放開',           type: 'water'  },
    { title: '開火',      hint: '長按空白鍵點火，火力進到 perfect 區再放開',     type: 'fire'   },
    { title: '撈去浮沫',  hint: '勺子轉到浮沫上時，按空白鍵把它撈起',            type: 'skim'   },
    { title: '撒調味料',  hint: '節奏對到判定圈時，按空白鍵撒下',                type: 'season' },
];

// Step 1 食材順序（之後可以改成從 quiz 結果動態決定）
const STEP1_INGREDIENTS = [
    { label: '雞肉' },
    { label: '葱'   },
    { label: '薑'   },
    { label: '蒜'   },
];

// Step 2 加水
const STEP2_FILL_MS      = 1800;   // 0 → 100% 全長按時間
const STEP2_TARGET_LEVEL = 0.78;
const STEP2_PERFECT_TOL  = 0.06;
const STEP2_OKAY_FLOOR   = 0.55;

// Step 3 開火（賽車起跑風格：指針自動往右跑，按空白鍵停下；perfect 區在 bar 中段）
const STEP3_SWEEP_MS     = 2400;   // 指針從左到右掃完整條的時間
const STEP3_PERFECT_MIN  = 0.55;
const STEP3_PERFECT_MAX  = 0.75;
const STEP3_OKAY_TOL     = 0.18;

// Step 4 撈浮沫
const STEP4_FOAM_COUNT      = 5;
const STEP4_SPOON_PERIOD_MS = 5400;   // 勺子繞一圈的時間（之前 3600，放慢比較好掌握）
const STEP4_HIT_RADIUS_PX   = 40;

// Step 5 節奏調味
const STEP5_NOTE_TRAVEL_MS   = 2200;  // note 從右到判定圈的時間
const STEP5_HIT_PERFECT_MS   = 130;
const STEP5_HIT_GOOD_MS      = 260;
const STEP5_NOTE_SPAWN_TIMES = [0, 600, 1100, 1600, 2300, 2800, 3500, 4200];  // ms

let cookingStepIndex = 0;
let cookingAdvancing = false;

// 每換一個 step 就整個重置；集中管理 cleanup / timeouts，避免 ticker 殘留
let cookingState = { cleanups: [], timeouts: [] };

// 全域空白鍵排程：每個 step 設自己的 onDown / onUp
let cookingKey = { down: null, up: null, isDown: false };

function isCookingViewActive() {
    const v = document.getElementById('cooking-view');
    return !!(v && v.classList.contains('active'));
}

document.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || e.repeat) return;
    if (!isCookingViewActive()) return;
    e.preventDefault();
    if (cookingKey.isDown) return;
    cookingKey.isDown = true;
    if (cookingKey.down) cookingKey.down();
});
document.addEventListener('keyup', (e) => {
    if (e.code !== 'Space') return;
    if (!isCookingViewActive()) return;
    e.preventDefault();
    cookingKey.isDown = false;
    if (cookingKey.up) cookingKey.up();
});

window.goToCooking = function() {
    cookingStepIndex = 0;
    cookingAdvancing = false;
    clearCookingState();
    buildCookingProgressBoxes();
    showView('cooking-view');
    // 進熬製頁不直接跑 step 0，先給觀眾看「接下來請用空白鍵互動」的提示
    // 按一下空白鍵才正式開始
    showCookingIntro();
};

// 熬製前的提示畫面：藏掉鍋子舞台 + 下方進度條，露提示文字 + 「確定」按鈕
// 點按鈕 → 揭曉舞台 + 開始 step 0
function showCookingIntro() {
    const titleEl  = document.getElementById('cooking-step-title');
    const hintEl   = document.getElementById('cooking-hint');
    const kwEl     = document.getElementById('cooking-keyword');
    const stage    = document.getElementById('cooking-stage');
    const ctrls    = document.getElementById('cooking-controls');
    const progress = document.getElementById('cooking-progress-boxes');

    // intro 期間藏掉鍋子舞台跟下方進度條（觀眾還沒進到步驟，先別暴雷）
    if (stage)    stage.style.visibility    = 'hidden';
    if (progress) progress.style.visibility = 'hidden';

    // 視覺順序：小副標「接下來的步驟」→ 大標「請用空白鍵進行互動」
    // DOM 自然順序是 title 先 hint 後，這裡暫時把 hint 移到 title 前面
    const parent = titleEl && titleEl.parentNode;
    if (parent && hintEl && hintEl.parentNode === parent) {
        parent.insertBefore(hintEl, titleEl);
    }

    if (hintEl)  hintEl.textContent  = '接下來的步驟';
    if (titleEl) titleEl.textContent = '請用空白鍵進行互動';
    if (kwEl)    { kwEl.textContent = ''; kwEl.style.opacity = 0; }

    if (ctrls) {
        ctrls.innerHTML = '';
        const btn = document.createElement('button');
        btn.className = 'primary-btn';   // 預設 border 樣式，hover 才填黑
        btn.textContent = '確定';
        btn.addEventListener('click', () => {
            // 還原 DOM 順序，title 回到 hint 前面（讓 step 0 顯示正常的大標→小提示）
            if (parent && titleEl && hintEl) parent.insertBefore(titleEl, hintEl);
            // 還原舞台 + 進度條
            if (stage)    stage.style.visibility    = '';
            if (progress) progress.style.visibility = '';
            renderCookingStep();
        });
        ctrls.appendChild(btn);
    }

    gsap.fromTo([hintEl, titleEl, ctrls],
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out', stagger: 0.1 }
    );
}

function clearCookingState() {
    if (cookingState.cleanups) cookingState.cleanups.forEach(fn => { try { fn(); } catch (e) {} });
    if (cookingState.timeouts) cookingState.timeouts.forEach(clearTimeout);
    cookingState = { cleanups: [], timeouts: [] };
    cookingKey.down = null;
    cookingKey.up   = null;
    cookingKey.isDown = false;
}

function scheduleCookingTimeout(fn, ms) {
    const id = setTimeout(fn, ms);
    cookingState.timeouts.push(id);
    return id;
}

function registerCookingCleanup(fn) {
    cookingState.cleanups.push(fn);
}

function buildCookingProgressBoxes() {
    const container = document.getElementById('cooking-progress-boxes');
    container.innerHTML = '';
    for (let i = 0; i < COOKING_STEPS.length; i++) {
        const box = document.createElement('div');
        box.className = 'cooking-progress-box';
        const fill = document.createElement('div');
        fill.className = 'cooking-progress-fill';
        box.appendChild(fill);
        container.appendChild(box);
    }
}

// 更新第 step box 的 fill 百分比（0~1），前面的 box 強制 100%、後面的 0%
function updateCookingBoxFill(step, fraction) {
    const fills = document.querySelectorAll('#cooking-progress-boxes .cooking-progress-fill');
    fills.forEach((f, i) => {
        if (i < step)        f.style.width = '100%';
        else if (i === step) f.style.width = Math.min(100, Math.max(0, fraction) * 100) + '%';
        else                 f.style.width = '0%';
    });
}

function renderCookingStep() {
    const step = COOKING_STEPS[cookingStepIndex];
    if (!step) return;

    const titleEl = document.getElementById('cooking-step-title');
    const hintEl  = document.getElementById('cooking-hint');
    const kwEl    = document.getElementById('cooking-keyword');
    const stage   = document.getElementById('cooking-stage');
    const ctrls   = document.getElementById('cooking-controls');

    titleEl.textContent = step.title;
    if (hintEl) hintEl.textContent = step.hint;
    if (kwEl)  { kwEl.textContent = ''; kwEl.className = 'mb-4'; kwEl.style.opacity = 0; }
    if (ctrls) ctrls.innerHTML = '';
    if (stage) stage.innerHTML = '';

    clearCookingState();
    updateCookingBoxFill(cookingStepIndex, 0);

    gsap.fromTo(titleEl,
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }
    );

    switch (step.type) {
        case 'chop':   setupStep1Chop();   break;
        case 'water':  setupStep2Water();  break;
        case 'fire':   setupStep3Fire();   break;
        case 'skim':   setupStep4Skim();   break;
        case 'season': setupStep5Season(); break;
    }
}

function advanceCookingStep() {
    if (cookingAdvancing) return;
    cookingAdvancing = true;
    updateCookingBoxFill(cookingStepIndex, 1);

    setTimeout(() => {
        cookingStepIndex++;
        cookingAdvancing = false;
        if (cookingStepIndex >= COOKING_STEPS.length) {
            clearCookingState();
            showSoupResult();
        } else {
            renderCookingStep();
        }
    }, 700);
}

// 顯示 / 隱藏遊戲回饋（複用 cooking-keyword 的位置）
function showCookingFeedback(text, level) {
    const kwEl = document.getElementById('cooking-keyword');
    if (!kwEl) return;
    kwEl.textContent = text;
    kwEl.className = 'cooking-feedback fb-' + level;
    gsap.killTweensOf(kwEl);
    gsap.fromTo(kwEl,
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' }
    );
}

// ============= STEP 1: 剁碎食材 =============
// 4 個食材並排，目前 active 的有外框 highlight。按一下空白鍵 → 刀子掉下、食材變剁碎狀，往下一個
function setupStep1Chop() {
    const stage = document.getElementById('cooking-stage');
    stage.style.cssText = 'position: relative; margin: 0 auto; width: min(480px, 92vw); height: 200px; display: flex; align-items: center; justify-content: center; gap: 1.5rem;';

    const boxes = [];
    STEP1_INGREDIENTS.forEach((ing, i) => {
        const box = document.createElement('div');
        box.className = 'chop-ingredient' + (i === 0 ? ' active' : '');
        box.innerHTML = `
            <div class="chop-shape"></div>
            <div class="chop-label">${ing.label}</div>
        `;
        stage.appendChild(box);
        boxes.push(box);
        gsap.fromTo(box,
            { opacity: 0, y: 12 },
            { opacity: 1, y: 0, duration: 0.4, delay: 0.1 + i * 0.1, ease: 'power2.out' }
        );
    });

    let chopIdx = 0;
    cookingKey.down = () => {
        if (chopIdx >= STEP1_INGREDIENTS.length) return;
        const box = boxes[chopIdx];
        const shape = box.querySelector('.chop-shape');

        const knife = document.createElement('div');
        knife.className = 'chop-knife';
        box.appendChild(knife);
        gsap.fromTo(knife,
            { y: -50, opacity: 1 },
            { y: 25, duration: 0.14, ease: 'power3.in',
              onComplete: () => {
                  shape.classList.add('chopped');
                  gsap.to(knife, { y: -60, opacity: 0, duration: 0.2, ease: 'power2.out',
                      onComplete: () => knife.remove() });
                  gsap.fromTo(box, { x: -3 }, { x: 3, duration: 0.05, repeat: 3, yoyo: true, clearProps: 'x' });
              }
            }
        );

        box.classList.remove('active');
        chopIdx++;
        if (boxes[chopIdx]) boxes[chopIdx].classList.add('active');
        updateCookingBoxFill(cookingStepIndex, chopIdx / STEP1_INGREDIENTS.length);
        if (chopIdx >= STEP1_INGREDIENTS.length) {
            scheduleCookingTimeout(advanceCookingStep, 600);
        }
    };
}

// ============= STEP 2: 加水 =============
// 直立容器（玻璃杯）+ 水位線。長按空白鍵 → 從底部往上注水。放開 → 評分（perfect / 還好 / 不夠水）
function setupStep2Water() {
    const stage = document.getElementById('cooking-stage');
    stage.style.cssText = 'position: relative; margin: 0 auto; width: 140px; height: 320px; display: flex; align-items: flex-end; justify-content: center;';

    const jar = document.createElement('div');
    jar.className = 'water-jar';
    jar.innerHTML = `
        <div class="water-fill"></div>
        <div class="water-target-line" style="bottom: ${STEP2_TARGET_LEVEL * 100}%;"></div>
        <span class="water-lvl-label" style="bottom: ${STEP2_TARGET_LEVEL * 100}%;">lvl</span>
    `;
    stage.appendChild(jar);
    const fillEl = jar.querySelector('.water-fill');

    let level = 0;
    let pressStart = 0;
    let timerId = null;
    let done = false;

    const stopFill = () => { if (timerId) { clearInterval(timerId); timerId = null; } };
    registerCookingCleanup(stopFill);

    cookingKey.down = () => {
        if (done) return;
        pressStart = performance.now();
        stopFill();
        timerId = setInterval(() => {
            const elapsed = performance.now() - pressStart;
            const cur = Math.min(1, level + elapsed / STEP2_FILL_MS);
            fillEl.style.height = (cur * 100) + '%';
            if (cur >= 1) stopFill();
        }, 16);
    };
    cookingKey.up = () => {
        if (done || pressStart === 0) return;
        const elapsed = performance.now() - pressStart;
        level = Math.min(1, level + elapsed / STEP2_FILL_MS);
        stopFill();
        done = true;

        let label, lvKind;
        if (Math.abs(level - STEP2_TARGET_LEVEL) <= STEP2_PERFECT_TOL) { label = 'Perfect！'; lvKind = 'perfect'; }
        else if (level >= STEP2_OKAY_FLOOR)                            { label = '還好';      lvKind = 'okay';    }
        else                                                            { label = '不夠水';    lvKind = 'fail';    }

        showCookingFeedback(label, lvKind);
        // 不再用 level 更新進度條（會看到 75% 卡一下才滿）
        // 進度條維持 0，advanceCookingStep 會直接拉到 1（從 0 → 滿，乾淨）
        scheduleCookingTimeout(advanceCookingStep, 1300);
    };
}

// ============= STEP 3: 開火（賽車起跑式）=============
// 橫向 bar + perfect 區間。指針自動從左掃到右，按一下空白鍵停下。
// 停在 perfect 區 = 火力剛好；其他位置就 perfect=否
function setupStep3Fire() {
    const stage = document.getElementById('cooking-stage');
    stage.style.cssText = 'position: relative; margin: 0 auto; width: min(460px, 92vw); height: 200px; display: flex; align-items: center; justify-content: center;';

    const bar = document.createElement('div');
    bar.className = 'fire-bar';
    bar.innerHTML = `
        <div class="fire-perfect-zone"
             style="left: ${STEP3_PERFECT_MIN * 100}%; width: ${(STEP3_PERFECT_MAX - STEP3_PERFECT_MIN) * 100}%;"></div>
        <span class="fire-zone-label" style="left: ${(STEP3_PERFECT_MIN + STEP3_PERFECT_MAX) / 2 * 100}%;">perfect</span>
        <div class="fire-indicator"></div>
    `;
    stage.appendChild(bar);
    const indicator = bar.querySelector('.fire-indicator');

    let startTime = performance.now();
    let timerId = null;
    let done = false;
    let position = 0;   // 0~1 指針目前在哪

    const tick = () => {
        if (done) return;
        const elapsed = performance.now() - startTime;
        position = (elapsed % STEP3_SWEEP_MS) / STEP3_SWEEP_MS;
        // 來回掃：0→1→0 連續循環，給觀眾多次機會（節奏感更像 pre-start）
        const phase = (elapsed / STEP3_SWEEP_MS) % 2;
        const visualPos = phase <= 1 ? phase : 2 - phase;
        position = visualPos;
        indicator.style.left = (visualPos * 100) + '%';
    };
    timerId = setInterval(tick, 16);
    registerCookingCleanup(() => { if (timerId) { clearInterval(timerId); timerId = null; } });

    cookingKey.down = () => {
        if (done) return;
        done = true;
        if (timerId) { clearInterval(timerId); timerId = null; }
        const level = position;

        const center = (STEP3_PERFECT_MIN + STEP3_PERFECT_MAX) / 2;
        let label, lvKind;
        if (level >= STEP3_PERFECT_MIN && level <= STEP3_PERFECT_MAX) { label = 'Perfect！'; lvKind = 'perfect'; }
        else if (Math.abs(level - center) <= STEP3_OKAY_TOL)          { label = '還好';      lvKind = 'okay';    }
        else if (level < STEP3_PERFECT_MIN)                            { label = '火不夠';    lvKind = 'fail';    }
        else                                                            { label = '火太大';    lvKind = 'fail';    }

        showCookingFeedback(label, lvKind);
        // 進度條維持 0，advanceCookingStep 會直接拉到 1
        scheduleCookingTimeout(advanceCookingStep, 1300);
    };
    cookingKey.up = null;   // 不用 up handler；只看單次 down
}

// ============= STEP 4: 撈去浮沫（俯視） =============
// 圓形鍋面 + 5 顆浮沫散落在勺子的 orbit 圓周上。勺子定速轉，按空白鍵時撈起最近的浮沫
function setupStep4Skim() {
    const stage = document.getElementById('cooking-stage');
    const POT = 320;
    stage.style.cssText = `position: relative; margin: 0 auto; width: ${POT}px; height: ${POT}px;`;

    const pot = document.createElement('div');
    pot.className = 'pot-top';
    stage.appendChild(pot);

    const cx = POT / 2, cy = POT / 2;
    const orbitR = POT * 0.40;

    // 把浮沫放在 orbit 圓周附近，角度盡量分散
    const angles = [];
    let tries = 0;
    while (angles.length < STEP4_FOAM_COUNT && tries < 300) {
        const a = Math.random() * Math.PI * 2;
        const tooClose = angles.some(b => {
            let d = Math.abs(a - b);
            d = Math.min(d, Math.PI * 2 - d);
            return d < Math.PI / 5;
        });
        if (!tooClose) angles.push(a);
        tries++;
    }
    while (angles.length < STEP4_FOAM_COUNT) angles.push(Math.random() * Math.PI * 2);

    const foams = angles.map((a, i) => {
        const r = orbitR * (0.92 + Math.random() * 0.16);
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        const el = document.createElement('div');
        el.className = 'foam-mark';
        el.style.left = (x - 18) + 'px';
        el.style.top  = (y - 18) + 'px';
        stage.appendChild(el);
        gsap.fromTo(el,
            { opacity: 0, scale: 0 },
            { opacity: 1, scale: 1, duration: 0.4, delay: 0.1 + i * 0.06, ease: 'back.out(2)' }
        );
        return { el, x, y, popped: false };
    });

    const spoon = document.createElement('div');
    spoon.className = 'pot-spoon';
    stage.appendChild(spoon);

    let stopped = false;
    const spoonStart = performance.now();
    let spoonX = cx, spoonY = cy - orbitR;

    const tick = () => {
        if (stopped) return;
        const elapsed = performance.now() - spoonStart;
        const angle = (elapsed % STEP4_SPOON_PERIOD_MS) / STEP4_SPOON_PERIOD_MS * Math.PI * 2 - Math.PI / 2;
        spoonX = cx + Math.cos(angle) * orbitR;
        spoonY = cy + Math.sin(angle) * orbitR;
        spoon.style.left = (spoonX - 22) + 'px';
        spoon.style.top  = (spoonY - 10) + 'px';
        spoon.style.transform = `rotate(${angle * 180 / Math.PI + 90}deg)`;
        requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    registerCookingCleanup(() => { stopped = true; });

    let popped = 0;
    cookingKey.down = () => {
        let nearest = null, nearestD = Infinity;
        foams.forEach(f => {
            if (f.popped) return;
            const d = Math.hypot(f.x - spoonX, f.y - spoonY);
            if (d < nearestD) { nearestD = d; nearest = f; }
        });
        if (!nearest || nearestD > STEP4_HIT_RADIUS_PX) return;
        nearest.popped = true;
        popped++;
        gsap.killTweensOf(nearest.el);
        gsap.to(nearest.el, {
            scale: 1.6, opacity: 0, duration: 0.3, ease: 'power2.out',
            onComplete: () => nearest.el.remove()
        });
        updateCookingBoxFill(cookingStepIndex, popped / STEP4_FOAM_COUNT);
        if (popped >= STEP4_FOAM_COUNT) scheduleCookingTimeout(advanceCookingStep, 500);
    };
}

// ============= STEP 5: 撒調味料（節奏：太鼓達人風）=============
// 跑道從右往左滾，notes 一顆顆飛向左側的判定圈。在判定圈附近按空白鍵 = 命中
function setupStep5Season() {
    const stage = document.getElementById('cooking-stage');
    const W = 520, H = 100;
    const SPAWN_X = W - 30, HIT_X = 60;
    stage.style.cssText = `position: relative; margin: 0 auto; width: min(${W}px, 92vw); height: ${H}px;`;

    const lane = document.createElement('div');
    lane.className = 'rhythm-lane';
    stage.appendChild(lane);

    const hitZone = document.createElement('div');
    hitZone.className = 'rhythm-hitzone';
    stage.appendChild(hitZone);

    const distance = SPAWN_X - HIT_X;
    const startTime = performance.now();
    const totalNotes = STEP5_NOTE_SPAWN_TIMES.length;

    const notes = STEP5_NOTE_SPAWN_TIMES.map((spawnTime, idx) => {
        const el = document.createElement('div');
        el.className = 'rhythm-note';
        el.style.left = SPAWN_X + 'px';
        el.style.opacity = 0;
        stage.appendChild(el);
        return { el, spawnTime, idx, hit: false, missed: false };
    });

    let resolved = 0;
    let stopped = false;
    registerCookingCleanup(() => { stopped = true; });

    const tick = () => {
        if (stopped) return;
        const t = performance.now() - startTime;
        notes.forEach(n => {
            if (n.hit || n.missed) return;
            const localT = t - n.spawnTime;
            if (localT < 0) return;
            // 飛過判定圈太久 → miss
            if (localT > STEP5_NOTE_TRAVEL_MS + STEP5_HIT_GOOD_MS) {
                n.missed = true;
                gsap.to(n.el, { opacity: 0, duration: 0.2, onComplete: () => n.el.remove() });
                resolved++;
                showCookingFeedback('miss', 'fail');
                updateCookingBoxFill(cookingStepIndex, resolved / totalNotes);
                if (resolved >= totalNotes) scheduleCookingTimeout(advanceCookingStep, 600);
                return;
            }
            const progress = Math.min(1.05, localT / STEP5_NOTE_TRAVEL_MS);
            n.el.style.left = (SPAWN_X - progress * distance) + 'px';
            n.el.style.opacity = 1;
        });
        requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    cookingKey.down = () => {
        const t = performance.now() - startTime;
        let target = null, bestDelta = Infinity;
        notes.forEach(n => {
            if (n.hit || n.missed) return;
            const noteAtHit = n.spawnTime + STEP5_NOTE_TRAVEL_MS;
            const delta = Math.abs(t - noteAtHit);
            if (delta < bestDelta) { bestDelta = delta; target = n; }
        });
        if (!target || bestDelta > STEP5_HIT_GOOD_MS + 80) return;
        target.hit = true;
        gsap.killTweensOf(target.el);
        gsap.to(target.el, {
            scale: 1.8, opacity: 0, duration: 0.25, ease: 'power2.out',
            onComplete: () => target.el.remove()
        });
        const lvKind = bestDelta <= STEP5_HIT_PERFECT_MS ? 'perfect' : 'okay';
        const label  = bestDelta <= STEP5_HIT_PERFECT_MS ? 'Perfect！' : 'Good';
        showCookingFeedback(label, lvKind);
        resolved++;
        updateCookingBoxFill(cookingStepIndex, resolved / totalNotes);
        if (resolved >= totalNotes) scheduleCookingTimeout(advanceCookingStep, 600);
    };
}

// ========== NFC hold 揭曉（掃描對應瓶子需 hold 5 秒才揭曉）==========
const REVEAL_HOLD_MS = 5000;
let revealHoldMatchedUID = null;
let revealHoldMode       = null;  // 'scan' | 'panel'
let revealHoldStartTime  = 0;
let revealHoldAccum      = 0;
let revealHoldTicker     = null;

function showRevealHoldUI(mode) {
    const id = mode === 'panel' ? 'quote-panel-reveal-hold' : 'scan-reveal-hold';
    const el = document.getElementById(id);
    if (el) el.style.display = '';
}

function hideRevealHoldUI() {
    ['scan-reveal-hold', 'quote-panel-reveal-hold'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
        const fill = el && el.querySelector('.reveal-hold-fill');
        if (fill) fill.style.width = '0%';
    });
}

function updateRevealHoldUI(fraction) {
    ['scan-reveal-hold', 'quote-panel-reveal-hold'].forEach(id => {
        const el = document.getElementById(id);
        if (!el || el.style.display === 'none') return;
        const fill = el.querySelector('.reveal-hold-fill');
        if (fill) fill.style.width = (Math.min(1, fraction) * 100) + '%';
    });
}

function clearRevealHold() {
    if (revealHoldTicker) { clearInterval(revealHoldTicker); revealHoldTicker = null; }
    revealHoldMatchedUID = null;
    revealHoldMode = null;
    revealHoldAccum = 0;
    hideRevealHoldUI();
    // 也把燈條進度歸零（但不切模式，保留 await_scan 等前端決定）
    sendLedProgress(0);
}

// ========== ESP 燈條控制：透過 WebSocket 推狀態 / hold 進度 ==========
// 狀態：idle（白色呼吸）、await_scan（琥珀、隨進度變亮）、revealed（穩定白光）
function sendLedMode(mode) {
    if (!window.nfcManager || !window.nfcManager.ws || !window.nfcManager.isConnected) return;
    try {
        window.nfcManager.ws.send(JSON.stringify({ type: 'led_mode', mode }));
    } catch (e) {}
}

// 進度 0~1，推得太頻繁會塞爆 WS → 最多每 100ms 送一次
let _lastLedProgressSend = 0;
let _lastLedProgressValue = -1;
function sendLedProgress(value) {
    if (!window.nfcManager || !window.nfcManager.ws || !window.nfcManager.isConnected) return;
    const now = performance.now();
    // 極端值（0 / 1）或距上次 >=100ms 且數值有變化才送
    if (value !== 0 && value !== 1 &&
        (now - _lastLedProgressSend < 100 || Math.abs(value - _lastLedProgressValue) < 0.02)) {
        return;
    }
    _lastLedProgressSend = now;
    _lastLedProgressValue = value;
    try {
        window.nfcManager.ws.send(JSON.stringify({ type: 'led_progress', value }));
    } catch (e) {}
}
window.sendLedMode = sendLedMode;
window.sendLedProgress = sendLedProgress;

// 由 nfc.js 在掃到「對應正確瓶子」時呼叫；mode: 'scan' | 'panel' | 'ai'
// 'ai' mode：在 chat-result-view 揭曉 AI 雞湯，hold 滿 5 秒呼叫 revealChatQuote
window.startRevealHold = function(uid, mode) {
    // 如果已在 hold 同一張卡 → 忽略（避免重複）
    if (revealHoldTicker && revealHoldMatchedUID === uid && revealHoldMode === mode) return;

    // 若換卡或換模式 → 重置累積
    if (revealHoldMatchedUID !== uid || revealHoldMode !== mode) {
        revealHoldAccum = 0;
    }

    revealHoldMatchedUID = uid;
    revealHoldMode = mode;
    revealHoldStartTime = performance.now();
    showRevealHoldUI(mode);
    updateRevealHoldUI(revealHoldAccum / REVEAL_HOLD_MS);

    if (revealHoldTicker) clearInterval(revealHoldTicker);
    revealHoldTicker = setInterval(() => {
        const elapsed = performance.now() - revealHoldStartTime;
        const total = Math.min(revealHoldAccum + elapsed, REVEAL_HOLD_MS);
        const frac = total / REVEAL_HOLD_MS;
        updateRevealHoldUI(frac);
        sendLedProgress(frac);  // 推給 ESP 讓琥珀燈跟著變亮

        if (total >= REVEAL_HOLD_MS) {
            clearInterval(revealHoldTicker); revealHoldTicker = null;
            const doReveal = mode === 'panel' ? window.revealQuoteInPanel
                           : mode === 'ai'    ? window.revealChatQuote
                           :                    window.revealQuote;
            revealHoldMatchedUID = null;
            revealHoldMode = null;
            revealHoldAccum = 0;
            hideRevealHoldUI();
            sendLedProgress(1);          // 滿進度
            if (typeof doReveal === 'function') doReveal();
        }
    }, 50);
};

window.cancelRevealHold = clearRevealHold;

// NFC 卡離開：暫停 hold（保留累積進度，給觀眾重放繼續）
window.onNfcHoldEnd = function() {
    if (!revealHoldTicker) return;
    const elapsed = performance.now() - revealHoldStartTime;
    revealHoldAccum = Math.min(revealHoldAccum + elapsed, REVEAL_HOLD_MS - 1);
    clearInterval(revealHoldTicker); revealHoldTicker = null;
    // 燈條回到「等待中」的暗呼吸（不會掉到 idle 白色，因為 led_mode 還是 await_scan）
    sendLedProgress(0);
};

// 熬製已改為純 UI；NFC hold_start 目前只保留作為相容 hook，不做事
window.onNfcHoldStart = function() {};

// ========== 雞湯成品（內容可切換成「差最後一步」掃描提示） ==========
let soupViewMode = 'soup'; // 'soup' | 'scan'

function showSoupResult() {
    if (!finalQuizResult) return;
    soupViewMode = 'soup';
    window.soupViewMode = soupViewMode;
    renderSoupView();
    showView('soup-result-view');
}

function renderSoupView() {
    if (!finalQuizResult) return;
    const q = finalQuizResult.quote;
    const topEl   = document.getElementById('soup-top-label');
    const nameEl  = document.getElementById('soup-name');
    const descEl  = document.getElementById('soup-desc');
    const btn     = document.getElementById('soup-btn');

    const soupName = q.soupName || `#${q.number} 雞湯`;

    if (soupViewMode === 'soup') {
        topEl.textContent = '得到了一鍋';
        topEl.style.display = '';
        nameEl.textContent = soupName;
        nameEl.style.fontSize = '2.5rem';
        if (q.soupDesc) {
            descEl.textContent = q.soupDesc;
            descEl.style.display = '';
        } else {
            descEl.textContent = '';
            descEl.style.display = 'none';
        }
        btn.textContent = '下一步';
        btn.style.display = '';
    } else {
        // scan 模式：差最後一步（沒按鈕，等觀眾實體掃描對應編號 NFC）
        topEl.textContent = '';
        topEl.style.display = 'none';
        nameEl.textContent = '差最後一步了！';
        nameEl.style.fontSize = '2.5rem';
        descEl.textContent = `請拿右邊#${q.number}瓶子掃描鍋子以接住萃取後的${soupName}`;
        descEl.style.display = '';
        btn.style.display = 'none';
    }
}

// 成品頁按鈕動作：第一次點 → 切成掃描提示（同頁替換）；第二次點 → 揭曉原句
window.advanceFromSoup = function() {
    if (soupViewMode === 'soup') {
        // 替換內容：fade out → 切模式 → fade in
        const nodes = ['soup-top-label', 'soup-name', 'soup-desc', 'soup-btn']
            .map(id => document.getElementById(id));
        gsap.to(nodes, {
            opacity: 0, duration: 0.35, ease: 'power2.in',
            onComplete: () => {
                soupViewMode = 'scan';
                window.soupViewMode = soupViewMode;
                renderSoupView();
                // 進入「掃描」階段 → 燈條換琥珀、從最暗開始
                sendLedMode('await_scan');
                sendLedProgress(0);
                gsap.fromTo(nodes,
                    { opacity: 0, y: 10 },
                    { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out', stagger: 0.08 }
                );
            }
        });
    } else {
        // scan 模式：揭曉原句
        revealQuote();
    }
};

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
    // 進入「掃描查脈絡」階段 → 燈條琥珀色，從最暗開始
    if (typeof sendLedMode === 'function') {
        sendLedMode('await_scan');
        sendLedProgress(0);
    }
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
    if (typeof window.cancelRevealHold === 'function') window.cancelRevealHold();
    // 離開「掃描查脈絡」 → 燈條回 idle 白色呼吸
    if (typeof sendLedMode === 'function') sendLedMode('idle');
    document.getElementById('quote-panel-zh').style.color = '';
    document.getElementById('quote-panel-en').style.color = '';
    document.getElementById('quote-slide-panel').classList.remove('open');
    document.getElementById('quote-slide-backdrop').classList.remove('open');
}
window.closeQuotePanel = closeQuotePanel;
window.openQuotePanel = openQuotePanel;
window.buildQuotesList = buildQuotesList;

// 把目前畫面上的粒子 scatter + dissolve，結束後呼叫 onComplete
function dissolveParticles(onComplete) {
    cancelAnimationFrame(particleAnimFrame);
    particleAnimFrame = null;

    const snapshot = [...particleCanvases];
    particleCanvases = [];
    if (snapshot.length === 0) { if (onComplete) onComplete(); return; }

    const allBounds = snapshot.map(({ canvas, w, h }) => ({
        left:   parseFloat(canvas.style.left) + PAD,
        top:    parseFloat(canvas.style.top)  + PAD,
        right:  parseFloat(canvas.style.left) + PAD + w,
        bottom: parseFloat(canvas.style.top)  + PAD + h,
    }));
    const globalCX = (Math.min(...allBounds.map(b => b.left)) + Math.max(...allBounds.map(b => b.right)))  / 2;
    const globalCY = (Math.min(...allBounds.map(b => b.top))  + Math.max(...allBounds.map(b => b.bottom))) / 2;

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

    snapshot.forEach(item => { item.initialCount = item.particles.length; });

    const startTime = performance.now();
    const DURATION = 500;

    function dissolve(now) {
        const t = Math.min((now - startTime) / DURATION, 1);
        const keepFraction = 1 - t;

        let anyLeft = false;
        snapshot.forEach(({ canvas, particles, initialCount }) => {
            const target = Math.floor(initialCount * keepFraction);
            while (particles.length > target) {
                particles.splice(Math.floor(Math.random() * particles.length), 1);
            }

            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
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
            if (onComplete) onComplete();
        }
    }

    particleAnimFrame = requestAnimationFrame(dissolve);
}

// NFC 掃描成功後，粒子 scatter 並 reveal（供 nfc.js 呼叫）
window.revealQuoteInPanel = function() {
    if (typeof window.sendLedMode === 'function') window.sendLedMode('revealed');
    // 立刻顯示 zh/en 文字（粒子在透明底上叠加，慢慢透出）
    document.getElementById('quote-panel-zh').style.color = '';
    document.getElementById('quote-panel-en').style.color = '';

    dissolveParticles(() => {
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
    });
};

// 揭曉原句（NFC 掃描對應瓶子後呼叫）：1s 粒子鋪面 → 自動 dissolve → 按鈕上浮
window.revealQuote = function() {
    if (!finalQuizResult) return;
    if (typeof window.sendLedMode === 'function') window.sendLedMode('revealed');
    const q = finalQuizResult.quote;
    const numEl = document.getElementById('reveal-number');
    const zhEl = document.getElementById('reveal-zh');
    const enEl = document.getElementById('reveal-en');
    const buttons = document.querySelectorAll('#quote-reveal-view .primary-btn');

    numEl.textContent = `#${q.number}`;
    zhEl.textContent = q.textCN || '';
    enEl.textContent = q.textEN || '';

    // 文字先隱藏（粒子蓋住）、雞湯王/按鈕藏起來
    zhEl.style.color = '#f2f2f2';
    enEl.style.color = '#f2f2f2';
    gsap.set(buttons, { opacity: 0, y: 20, pointerEvents: 'none' });

    const mascotHint = document.getElementById('reveal-mascot-hint');
    if (mascotHint) {
        mascotHint.style.display = 'flex';
        gsap.set(mascotHint, { opacity: 0, y: 12 });
    }

    showView('quote-reveal-view');

    // showView 有 300ms fade，等 view active 再量尺寸畫粒子
    setTimeout(() => {
        startParticles([zhEl, enEl]);             // 中文 + 英文一起被粒子蓋住

        setTimeout(() => {
            // Stage 1：中英文同時揭曉（粒子散開 → 字色還原）
            zhEl.style.color = '';
            enEl.style.color = '';
            dissolveParticles(() => {
                // Stage 2：雞湯王 + 翻書提示 fade-in
                if (mascotHint) {
                    gsap.to(mascotHint, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' });
                }
                // Stage 3：兩顆按鈕最後 fade-in
                gsap.to(buttons, {
                    opacity: 1, y: 0, pointerEvents: 'auto',
                    duration: 0.6, delay: 0.5, stagger: 0.12, ease: 'power2.out'
                });
            });
        }, 1000);
    }, 400);
};

// 進入網站瀏覽（Explore 按鈕）
window.goToWebsite = function() {
    showView('info-website-view');
    switchInfoTab('about');
};

// 舊入口：保留為 Website 動作的別名，避免其他地方呼叫時壞掉
window.decodeQuote = window.goToWebsite;

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
    const textEl = document.getElementById('chat-translation-text');
    const enEl   = document.getElementById('chat-en-text');
    const ctxEl  = document.getElementById('chat-context');
    const hintEl = document.getElementById('chat-result-hint');
    const custBtn = document.getElementById('chat-customize-btn');

    // 直接顯示 AI 生成的原句（不再先給轉譯）
    textEl.textContent = chatAIResult.textCN || '';
    if (enEl) {
        enEl.textContent = chatAIResult.textEN || '';
        enEl.style.display = chatAIResult.textEN ? '' : 'none';
    }

    // 脈絡、客製化 dock 預設藏起來（NFC reveal 後才出現）
    if (ctxEl)  { ctxEl.textContent = ''; ctxEl.style.display = 'none'; }

    hintEl.style.opacity = '0.5';
    hintEl.textContent = '掃描裝置以解讀這句雞湯';
    hintEl.style.display = '';

    document.getElementById('chat-result-actions').style.display = 'none';

    // 重置右下角 dock：整塊藏起來、內部 panel 也藏起來、按鈕回到可見狀態
    const dock = document.getElementById('chat-customize-dock');
    const panel = document.getElementById('chat-params-panel');
    if (dock) {
        dock.style.display = 'none';
        gsap.set(dock, { height: 'auto', opacity: 1 });
    }
    if (panel) panel.style.display = 'none';
    if (custBtn) { custBtn.style.display = 'block'; gsap.set(custBtn, { opacity: 1 }); }

    // 文字先隱藏，粒子蓋上去
    textEl.style.color = '#f2f2f2';
    if (enEl && enEl.style.display !== 'none') enEl.style.color = '#f2f2f2';

    showView('chat-result-view');

    // 進入「等待掃描裝置」階段 → 燈條琥珀色，從最暗開始呼吸
    if (typeof sendLedMode === 'function') {
        sendLedMode('await_scan');
        sendLedProgress(0);
    }

    // showView 有 300ms fade，等 view active 再量尺寸畫粒子
    setTimeout(() => {
        const targets = [textEl];
        if (enEl && enEl.style.display !== 'none') targets.push(enEl);
        startParticles(targets);
    }, 400);
}

// 開始 loading 動畫（持續循環直到 API 回應）
let loadingTimeline = null;

function startLoadingAnim(phrases) {
    const zhEl = document.getElementById('chat-loading-zh');
    const enEl = document.getElementById('chat-loading-en');
    zhEl.textContent = '';
    if (enEl) enEl.textContent = '';

    // 支援單一字串（相容舊呼叫）或陣列
    const lines = Array.isArray(phrases)
        ? phrases
        : [phrases || '雞湯生成中...', '正在熬煮你的雞湯...', '火候剛剛好...'];

    // 洗牌，每次進入 loading 順序不同
    for (let i = lines.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [lines[i], lines[j]] = [lines[j], lines[i]];
    }

    loadingTimeline = gsap.timeline({ repeat: -1 });
    lines.forEach(line => {
        loadingTimeline
            .to(zhEl, { duration: line.length * 0.08, text: line, ease: 'none' })
            .to({}, { duration: 0.8 })
            .to(zhEl, { duration: 0.2, text: '', ease: 'none' })
            .to({}, { duration: 0.3 });
    });
}

function stopLoadingAnim() {
    if (loadingTimeline) {
        loadingTimeline.kill();
        loadingTimeline = null;
    }
}

// chat-intro-view 的「確定」按鈕：觀眾看完提示後正式進入 chat-view
window.enterChatView = function() {
    initChatView();
    showView('chat-view');
};

// 監看對話累計次數：第 5 則使用者訊息後讓「對話卡住了？」提示 slide up
function maybeShowStuckHint() {
    const userMsgCount = document.querySelectorAll('#chat-messages-inner .chat-msg-user').length;
    const hint = document.getElementById('stuck-hint');
    if (hint && userMsgCount >= 5) hint.classList.add('show');
}

// 初始化聊天畫面（回到學徒的第一個問候）
window.initChatView = function() {
    // 重啟對話 → 把「卡住提示」藏回去（重新累計到 5 才會再出現）
    const stuckHint = document.getElementById('stuck-hint');
    if (stuckHint) stuckHint.classList.remove('show');

    // ⚠ messages 要加到 chat-messages-inner（max-w-2xl 容器內），不是 chat-messages（外層 scrollable）
    // 加錯地方訊息會跑到 viewport 邊緣 (DevTools 開時特別明顯)
    const inner = document.getElementById('chat-messages-inner');
    if (inner) {
        inner.innerHTML = '';
        const msg = buildChatMessage('apprentice', '最近你一直在想什麼事呢？');
        inner.appendChild(msg);
        gsap.fromTo(msg, { opacity: 0, y: 10 },
            { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' });
        shrinkBubbleToContent(msg.querySelector('.chat-bubble'));
    }
    const wrapper = document.getElementById('chat-input-wrapper');
    if (wrapper) {
        wrapper.style.display = '';
        gsap.set(wrapper, { opacity: 1, y: 0, pointerEvents: 'auto' });
    }
    const input = document.getElementById('chat-input');
    if (input) { input.disabled = false; input.value = ''; }
};

// 建立一則訊息 DOM
function buildChatMessage(role, content) {
    const msg = document.createElement('div');
    msg.className = `chat-msg chat-msg-${role}`;

    if (role === 'apprentice') {
        const avatar = document.createElement('img');
        avatar.src = 'Images/雞湯學徒.png';
        avatar.alt = '';
        avatar.className = 'chat-avatar';
        msg.appendChild(avatar);
    }

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    bubble.textContent = content;
    msg.appendChild(bubble);
    return msg;
}

// 建立「思考文字」訊息（學徒 avatar + 沒有泡泡的斜體打字機文字）
function buildChatThinking() {
    const msg = document.createElement('div');
    msg.className = 'chat-msg chat-msg-apprentice';

    const avatar = document.createElement('img');
    avatar.src = 'Images/雞湯學徒.png';
    avatar.alt = '';
    avatar.className = 'chat-avatar';
    msg.appendChild(avatar);

    const text = document.createElement('div');
    text.className = 'chat-thinking-text';
    text.textContent = '';
    msg.appendChild(text);
    return msg;
}

// 量測泡泡內文字實際換行後最寬的那行，把泡泡 width 設成「最寬一行 + padding + border」
// 為什麼用 JS：CSS 的 fit-content 在內容被 max-width 觸發換行後，box 仍會停在 max-width 不會 shrink
// 因為 text-wrap: balance 會在新寬度下重排，需要疊代量測直到收斂
function shrinkBubbleToContent(bubbleEl) {
    if (!bubbleEl) return;
    bubbleEl.style.width = '';
    let waitAttempts = 0;
    let lastWidth = -1;
    let passes = 0;

    const styles = () => getComputedStyle(bubbleEl);
    const measure = () => {
        // 若父層 view 還沒 active（display 影響 layout），等一下再量
        if ((bubbleEl.offsetParent === null || bubbleEl.offsetWidth === 0) && waitAttempts < 30) {
            waitAttempts++;
            setTimeout(measure, 100);
            return;
        }
        const range = document.createRange();
        range.selectNodeContents(bubbleEl);
        const rects = range.getClientRects();
        if (rects.length === 0) return;
        let maxWidth = 0;
        for (const r of rects) if (r.width > maxWidth) maxWidth = r.width;
        const s = styles();
        const padX = parseFloat(s.paddingLeft) + parseFloat(s.paddingRight);
        const borderX = parseFloat(s.borderLeftWidth) + parseFloat(s.borderRightWidth);
        const newWidth = Math.ceil(maxWidth + padX + borderX);
        // 收斂：寬度沒變 / 變大就停（balance 在新寬度下可能重排造成微小變化）
        if (newWidth === lastWidth || newWidth > lastWidth && lastWidth !== -1) return;
        lastWidth = newWidth;
        bubbleEl.style.width = newWidth + 'px';
        if (++passes < 4) requestAnimationFrame(measure);
    };
    requestAnimationFrame(measure);
}

function appendChatMessage(role, content) {
    const inner = document.getElementById('chat-messages-inner');
    const scroller = document.getElementById('chat-messages');
    if (!inner) return null;
    const msg = buildChatMessage(role, content);
    inner.appendChild(msg);
    gsap.fromTo(msg, { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' });
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
    shrinkBubbleToContent(msg.querySelector('.chat-bubble'));
    return msg;
}

function appendChatThinking() {
    const inner = document.getElementById('chat-messages-inner');
    const scroller = document.getElementById('chat-messages');
    if (!inner) return null;
    const msg = buildChatThinking();
    inner.appendChild(msg);
    gsap.fromTo(msg, { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' });
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
    return msg.querySelector('.chat-thinking-text');
}

// 打字機把一段文字打到某個元素，回傳 Promise
function typewriteTo(el, text, charDelay = 80) {
    return new Promise(resolve => {
        el.textContent = '';
        let i = 0;
        const tick = () => {
            if (i >= text.length) { resolve(); return; }
            el.textContent += text[i++];
            setTimeout(tick, charDelay);
        };
        tick();
    });
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// 純粹打 API 的部分（不碰 UI）
async function fetchChatResult(text) {
    const tone = document.getElementById('param-tone')?.value || 50;
    const enToggle = document.getElementById('param-en-toggle')?.checked || false;
    const length = document.getElementById('param-length')?.value || 25;

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
                userMessage: text,
                scores,
                tone: Number(tone),
                english: enToggle,
                length: Number(length),
            })
        });
        clearTimeout(timeoutId);
        const result = await response.json();
        return { ok: response.ok, result };
    } catch (err) {
        clearTimeout(timeoutId);
        throw err;
    }
}

// 產生學徒的 thinking 腳本（根據觀眾輸入 + 問答結果）— 3 拍
function buildThinkingScript(userText) {
    const truncate = (s, n) => (s && s.length > n) ? s.slice(0, n) + '...' : (s || '');
    const preview = truncate(userText, 12);

    // 取兩個單選題的答案（避開 container-choice）
    const refs = questions
        .map((q, i) => ({ q, ans: userAnswers[i] }))
        .filter(x => x.q && x.ans && x.q.type !== 'container-choice');

    const a1 = refs[0] ? truncate(refs[0].ans.text, 10) : '';
    const a2 = (refs[2] || refs[1]) ? truncate((refs[2] || refs[1]).ans.text, 10) : '';

    const refLine = (a1 && a2) ? `之前你選了「${a1}」和「${a2}」`
                    : a1        ? `之前你選了「${a1}」`
                                : '之前的幾題你也答過了';

    return [
        `你說「${preview}」......`,
        refLine,
        `讓我想想怎麼熬......`,
    ];
}

// 送出自由輸入
window.submitChat = async function() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;
    lastChatMessage = text;

    const hint = document.getElementById('chat-retry-hint');
    if (hint) hint.style.display = 'none';

    // 1. 觀眾的回覆 → 右邊泡泡
    appendChatMessage('user', text);
    // 來回 5+ 次後 slide up「對話卡住了？」提示
    maybeShowStuckHint();

    // 2. 清空輸入框（保留可見但停用、50% 不透明）
    input.value = '';
    input.style.height = 'auto';
    input.disabled = true;
    const wrapper = document.getElementById('chat-input-wrapper');
    if (wrapper) {
        gsap.to(wrapper, { opacity: 0.5, pointerEvents: 'none', duration: 0.35, ease: 'power2.out' });
    }

    // 3. 同時開始 API 呼叫
    const apiPromise = fetchChatResult(text);

    // 4. 學徒 thinking：avatar 旁邊用打字機把思考句依序打出
    await sleep(350);
    const thinkingEl = appendChatThinking();
    const thoughts = buildThinkingScript(text);
    for (let i = 0; i < thoughts.length; i++) {
        await typewriteTo(thinkingEl, thoughts[i], 55);
        if (i < thoughts.length - 1) {
            await sleep(250);
            thinkingEl.textContent = '';
        } else {
            await sleep(200);
        }
    }

    // 5. 共用工具：把 thinking 泡泡換成學徒對話泡泡 + 重新啟用輸入
    const thinkingMsg = thinkingEl ? thinkingEl.closest('.chat-msg') : null;
    const replyAsApprenticeBubble = (content) => {
        if (thinkingMsg) thinkingMsg.remove();
        appendChatMessage('apprentice', content);
        if (wrapper) gsap.to(wrapper, { opacity: 1, pointerEvents: 'auto', duration: 0.35, ease: 'power2.out' });
        const inputEl = document.getElementById('chat-input');
        if (inputEl) {
            inputEl.disabled = false;
            inputEl.value = '';     // 學徒回完訊息 → 輸入框淨空，等觀眾打新內容
            inputEl.style.height = 'auto';
            inputEl.focus();
        }
    };
    const goRetryView = () => {
        showView('chat-loading-view');
        showRetryPrompt();
    };

    // 6. 在 chat-view 等 API 回來再決定 view（亂打的情況不會閃過 loading view）
    //    若 API 比 thinking 慢，使用者會看到最後一句 thinking 留在畫面上幾秒，再轉場
    let apiData = null;
    let apiErr = null;
    try { apiData = await apiPromise; } catch (err) { apiErr = err; }

    if (apiErr) {
        console.error('Fetch error:', apiErr);
        goRetryView();
        return;
    }
    const { ok, result } = apiData;
    if (!ok || result.error) {
        console.error('API error:', result.error, 'detail:', result.detail);
        goRetryView();
        return;
    }
    if (!result.valid) {
        // 亂打/太短：直接在 chat-view 用對話泡泡回應，永遠不切到 loading view
        replyAsApprenticeBubble(result.retry_message || '可以再多說一點嗎？');
        return;
    }
    // valid:true：到這一步才切到 loading view，至少顯示 1.2 秒讓「雞湯生成中」露臉
    showView('chat-loading-view');
    startLoadingAnim();
    await sleep(1200);
    stopLoadingAnim();
    chatAIResult = result;
    showChatResult();
};

// 顯示重試提示（在 loading 頁面）
function showRetryPrompt() {
    stopLoadingAnim();
    const zhEl = document.getElementById('chat-loading-zh');
    const enEl = document.getElementById('chat-loading-en');
    zhEl.textContent = '雞湯熬太久了';
    if (enEl) enEl.textContent = '';
    document.getElementById('chat-retry-section').style.display = '';
}

// 重試上一次的輸入
window.retryLastChat = function() {
    document.getElementById('chat-retry-section').style.display = 'none';
    document.getElementById('chat-input').value = lastChatMessage;
    submitChat();
};

// 從「熬太久」回到對話（保留所有現有訊息，讓觀眾用不同說法再試）
window.goBackToChat = function() {
    document.getElementById('chat-retry-section').style.display = 'none';
    // 把學徒的 thinking 泡泡（如果還掛著）清掉
    const thinkingMsgs = document.querySelectorAll('.chat-msg .chat-thinking-text');
    thinkingMsgs.forEach(t => { const m = t.closest('.chat-msg'); if (m) m.remove(); });
    // 重啟輸入框
    const wrapper = document.getElementById('chat-input-wrapper');
    if (wrapper) gsap.to(wrapper, { opacity: 1, pointerEvents: 'auto', duration: 0.35, ease: 'power2.out' });
    const input = document.getElementById('chat-input');
    if (input) {
        input.disabled = false;
        input.value = '';
        input.style.height = 'auto';
        input.focus();
    }
    showView('chat-view');
};

// NFC 解碼 AI 生成的原句（粒子散開 → 顯示脈絡 + 客製化按鈕）
window.revealChatQuote = function() {
    if (!chatAIResult) return;

    // 已經解析過就不再重播動畫
    const hintEl = document.getElementById('chat-result-hint');
    if (hintEl && hintEl.style.display === 'none') return;

    // 揭曉 → 燈條切回穩定白光（reveal mode）
    if (typeof window.sendLedMode === 'function') window.sendLedMode('revealed');

    const textEl   = document.getElementById('chat-translation-text');
    const enEl     = document.getElementById('chat-en-text');
    const ctxEl    = document.getElementById('chat-context');
    const actions  = document.getElementById('chat-result-actions');

    // 文字恢復顏色，粒子散開
    textEl.style.color = '';
    if (enEl && enEl.style.display !== 'none') enEl.style.color = '';

    dissolveParticles(() => {
        // 粒子散完：藏 hint、顯示脈絡 + 客製化 dock（只露按鈕）+ 左上角導航
        gsap.to(hintEl, {
            opacity: 0, duration: 0.3, ease: 'power2.out',
            onComplete: () => { hintEl.style.display = 'none'; }
        });

        const reasoning = chatAIResult.reasoning || chatAIResult.translation;
        if (ctxEl && reasoning) {
            ctxEl.textContent = reasoning;
            ctxEl.style.display = '';
            gsap.fromTo(ctxEl, { opacity: 0, y: 10 },
                { opacity: 0.7, y: 0, duration: 0.6, delay: 0.3, ease: 'power2.out' });
        }

        // 右下角 dock：初始只露「開始客製化」按鈕
        const dock = document.getElementById('chat-customize-dock');
        if (dock) {
            dock.style.display = 'block';
            gsap.fromTo(dock, { opacity: 0, y: 10 },
                { opacity: 1, y: 0, duration: 0.5, delay: 0.8, ease: 'power2.out' });
        }

        // 左上角 Start Over / Try Again
        gsap.fromTo(actions,
            { display: 'flex', opacity: 0, y: 16 },
            { opacity: 1, y: 0, duration: 0.6, delay: 1.2, ease: 'power2.out' }
        );
    });
};

// 點「開始客製化」→ 按鈕 fade out，dock 高度向上 extend 成 panel
window.enterChatCustomize = function() {
    const ctxEl = document.getElementById('chat-context');
    const btn   = document.getElementById('chat-customize-btn');
    const panel = document.getElementById('chat-params-panel');
    const dock  = document.getElementById('chat-customize-dock');
    if (!dock || !btn || !panel) return;

    if (ctxEl) {
        gsap.to(ctxEl, { opacity: 0, duration: 0.3, ease: 'power2.in',
            onComplete: () => { ctxEl.style.display = 'none'; } });
    }

    // 鎖住 dock 當前高度（= 按鈕高度）
    const h0 = dock.offsetHeight;
    dock.style.height = h0 + 'px';

    // 顯示 panel 但透明
    panel.style.display = 'flex';
    gsap.set(panel, { opacity: 0 });

    // 量展開後的目標高度：暫時藏按鈕 + 解鎖高度 → 讀 offsetHeight → 復原
    const prevBtnDisplay = btn.style.display || 'block';
    btn.style.display = 'none';
    dock.style.height = '';
    const targetH = dock.offsetHeight;
    dock.style.height = h0 + 'px';
    btn.style.display = prevBtnDisplay;

    // 按鈕 fade out → 隱藏
    gsap.to(btn, {
        opacity: 0, duration: 0.25, ease: 'power2.in',
        onComplete: () => { btn.style.display = 'none'; }
    });
    // dock 高度上長
    gsap.to(dock, {
        height: targetH, duration: 0.5, ease: 'power2.inOut', delay: 0.1,
        onComplete: () => { dock.style.height = 'auto'; }
    });
    // panel fade in
    gsap.to(panel, { opacity: 1, duration: 0.4, delay: 0.3, ease: 'power2.out' });
};

// ========= 收藏雞湯卡片 =========

const SAVE_RATIOS = {
    '16:9': { w: 1280, h: 720 },
    '4:5':  { w: 900,  h: 1125 },
    '1:1':  { w: 1000, h: 1000 },
};
const SAVE_DEFAULTS = { ratio: '4:5', bg: '#f2f2f2', text: '#000000', border: '#000000', noBorder: true };

function applySaveCardStyle() {
    const ratio = document.querySelector('input[name="save-ratio"]:checked')?.value || '4:5';
    const bg = document.getElementById('save-bg-color').value;
    const textColor = document.getElementById('save-text-color').value;
    const borderColor = document.getElementById('save-border-color').value;
    const noBorder = document.getElementById('save-no-border').checked;
    const { w, h } = SAVE_RATIOS[ratio];

    const card = document.getElementById('save-card');
    const wrapper = document.getElementById('save-preview-wrapper');
    if (!card || !wrapper) return;

    const availW = wrapper.clientWidth;
    const availH = wrapper.clientHeight;
    const scale = Math.min(availW / w, availH / h, 1);

    card.style.width = w + 'px';
    card.style.height = h + 'px';
    card.style.background = bg;
    card.style.color = textColor;
    card.style.border = noBorder ? 'none' : `2px solid ${borderColor}`;
    card.style.transform = `scale(${scale})`;
    card.style.transformOrigin = 'center';

    // logo 反色：淺底用黑 logo，深底用白 logo
    const logo = document.getElementById('save-card-logo');
    if (logo) {
        const hex = bg.replace('#', '');
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        logo.style.filter = luminance > 0.6 ? 'invert(1)' : 'invert(0)';
    }
}

window.saveChatQuote = function() {
    if (!chatAIResult) return;
    document.getElementById('save-card-text').textContent = chatAIResult.textCN || '';
    const enEl = document.getElementById('save-card-text-en');
    if (enEl) {
        enEl.textContent = chatAIResult.textEN || '';
        enEl.style.display = chatAIResult.textEN ? '' : 'none';
    }
    document.getElementById('save-email').value = '';
    document.getElementById('save-status').textContent = '';
    document.getElementById('save-send-btn').disabled = false;
    resetSaveDefaults(); // 先套預設樣式
    document.getElementById('save-overlay').style.display = 'block';
    // 下一個 frame 才能算容器尺寸
    requestAnimationFrame(applySaveCardStyle);
};

window.closeSaveOverlay = function() {
    document.getElementById('save-overlay').style.display = 'none';
};

window.resetSaveDefaults = function() {
    const ratioInput = document.querySelector(`input[name="save-ratio"][value="${SAVE_DEFAULTS.ratio}"]`);
    if (ratioInput) ratioInput.checked = true;
    document.getElementById('save-bg-color').value = SAVE_DEFAULTS.bg;
    document.getElementById('save-text-color').value = SAVE_DEFAULTS.text;
    document.getElementById('save-border-color').value = SAVE_DEFAULTS.border;
    document.getElementById('save-no-border').checked = SAVE_DEFAULTS.noBorder;
    applySaveCardStyle();
};

window.sendSaveCard = async function() {
    const email = document.getElementById('save-email').value.trim();
    const statusEl = document.getElementById('save-status');
    const btn = document.getElementById('save-send-btn');

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        statusEl.textContent = 'Email 格式好像不太對';
        statusEl.style.color = '#c00';
        return;
    }

    statusEl.style.color = '';
    statusEl.textContent = '雞湯打包中...';
    btn.disabled = true;

    try {
        const card = document.getElementById('save-card');
        // 截圖時先把 scale 拿掉，保證輸出原始尺寸
        const originalTransform = card.style.transform;
        card.style.transform = 'none';

        const canvas = await html2canvas(card, {
            backgroundColor: null,
            scale: 1,
            useCORS: true,
            logging: false,
        });

        card.style.transform = originalTransform;

        const pngBase64 = canvas.toDataURL('image/png');

        statusEl.textContent = '寄送中...';

        const resp = await fetch('/api/send-card', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email,
                pngBase64,
                quoteTextCN: chatAIResult?.textCN || '',
            }),
        });

        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err.error || '寄送失敗');
        }

        statusEl.style.color = '';
        statusEl.textContent = '寄出了！請去收信箱看看（可能在垃圾信）。';
        setTimeout(() => {
            closeSaveOverlay();
        }, 2500);
    } catch (err) {
        console.error('[sendSaveCard]', err);
        statusEl.style.color = '#c00';
        statusEl.textContent = '寄送失敗：' + err.message;
        btn.disabled = false;
    }
};

// 收到 ESP8266 回報「觀眾已感應到」→ 收尾 UI
window.onNFCEmulateRead = function () {
    clearTimeout(window._nfcShareTimeout);
    const btn = document.getElementById('save-nfc-btn');
    const statusEl = document.getElementById('save-nfc-status');
    if (btn) { btn.disabled = false; btn.textContent = '感應手機帶走'; }
    if (statusEl) {
        statusEl.style.color = '';
        statusEl.textContent = '送出了！觀眾手機應該已經開啟卡片';
        setTimeout(() => { statusEl.textContent = ''; }, 4000);
    }
};

// ESP8266 回報超時未感應
window.onNFCEmulateTimeout = function () {
    clearTimeout(window._nfcShareTimeout);
    const btn = document.getElementById('save-nfc-btn');
    const statusEl = document.getElementById('save-nfc-status');
    if (btn) { btn.disabled = false; btn.textContent = '感應手機帶走'; }
    if (statusEl) {
        statusEl.style.color = '#c00';
        statusEl.textContent = '超時了，再按一次試試';
    }
};

// 把卡片資料 + 當前樣式 base64 編進 URL，透過 WebSocket 丟給 ESP8266 做 NFC 模擬
window.shareCardViaNFC = function () {
    if (!chatAIResult) return;
    const statusEl = document.getElementById('save-nfc-status');
    const btn = document.getElementById('save-nfc-btn');

    if (!window.nfcManager || !nfcManager.isConnected) {
        statusEl.style.color = '#c00';
        statusEl.textContent = '裝置未連線，先檢查 WebSocket';
        return;
    }

    const payload = {
        cn: chatAIResult.textCN || '',
        en: chatAIResult.textEN || '',
        r: chatAIResult.reasoning || '',
        bg: document.getElementById('save-bg-color')?.value || SAVE_DEFAULTS.bg,
        txt: document.getElementById('save-text-color')?.value || SAVE_DEFAULTS.text,
        bd: document.getElementById('save-border-color')?.value || SAVE_DEFAULTS.border,
        nb: document.getElementById('save-no-border')?.checked ? 1 : 0,
    };

    // UTF-8 → base64url
    const utf8 = new TextEncoder().encode(JSON.stringify(payload));
    let binary = '';
    for (const b of utf8) binary += String.fromCharCode(b);
    const b64 = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const origin = location.origin.includes('http') ? location.origin : 'https://chicken-soup-quote.vercel.app';
    const url = `${origin}/card.html#d=${b64}`;

    console.log('[shareCardViaNFC] URL 長度:', url.length, 'URL:', url);

    if (url.length > 840) {
        statusEl.style.color = '#c00';
        statusEl.textContent = '資料太長，NFC 卡塞不下（' + url.length + ' bytes）';
        return;
    }

    const sent = nfcManager.emulateNDEF(url);
    if (!sent) {
        statusEl.style.color = '#c00';
        statusEl.textContent = '指令送不出去，再試一次';
        return;
    }

    statusEl.style.color = '';
    statusEl.textContent = '把手機靠近裝置（約 30 秒內）...';
    btn.disabled = true;
    btn.textContent = '等待感應中...';

    // 30 秒後自動重置
    clearTimeout(window._nfcShareTimeout);
    window._nfcShareTimeout = setTimeout(() => {
        btn.disabled = false;
        btn.textContent = '感應手機帶走';
        statusEl.textContent = '';
    }, 30000);
};

// 控制面板變動即時更新預覽
document.addEventListener('DOMContentLoaded', () => {
    ['save-bg-color', 'save-text-color', 'save-border-color'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', applySaveCardStyle);
    });
    const noBorderCb = document.getElementById('save-no-border');
    if (noBorderCb) noBorderCb.addEventListener('change', applySaveCardStyle);
    document.querySelectorAll('input[name="save-ratio"]').forEach(el => {
        el.addEventListener('change', applySaveCardStyle);
    });
    window.addEventListener('resize', () => {
        if (document.getElementById('save-overlay').style.display === 'block') {
            applySaveCardStyle();
        }
    });
});

// 換鍋子：保留前 5 題答案，把 q6 的選擇清掉，回到題目頁讓觀眾重選分岔
// 用在 chat-result-view（拿到 AI 雞湯後想換成雞湯王熬製）
// 也用在 chat-view（聊到一半反悔）
window.goBackToFork = function() {
    // 清掉 q6 之後的所有結果
    chatAIResult = null;
    finalQuizResult = null;
    window.finalQuizResult = null;
    lastChatMessage = '';
    const chatInput = document.getElementById('chat-input');
    if (chatInput) { chatInput.value = ''; chatInput.style.height = 'auto'; }

    // 把 q6（最後一題）的紀錄拔掉，前面 5 題答案保留
    const lastIdx = questions.length - 1;
    const lastQ   = questions[lastIdx];
    if (lastQ && userSelection[lastQ.id]) delete userSelection[lastQ.id];
    if (userAnswers.length > lastIdx) userAnswers = userAnswers.slice(0, lastIdx);

    // 回到 q6 頁面讓觀眾重選
    currentQuestionIndex = lastIdx;
    currentSelectedValue = null;
    currentSelectedOption = null;
    renderQuestion(currentQuestionIndex);
    showView('question-view');
};

// 再回答一次
window.retryChatInput = function() {
    const input = document.getElementById('chat-input');
    input.value = '';
    input.style.height = 'auto';
    input.style.overflow = 'hidden';
    chatAIResult = null;
    initChatView();
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

    gsap.to(textEl, {
        opacity: 0, duration: 0.3, ease: 'power2.out',
        onComplete: () => {
            textEl.textContent = '';
            gsap.to(textEl, { opacity: 1, duration: 0.1 });
            if (seasoningTimeline) seasoningTimeline.kill();
            seasoningTimeline = gsap.timeline({ repeat: -1 });
            seasoningTimeline
                .to(textEl, { duration: zhSeason.length * 0.08, text: zhSeason, ease: 'none' })
                .to({}, { duration: 0.8 })
                .to(textEl, { duration: 0.2, text: '', ease: 'none' })
                .to({}, { duration: 0.3 });
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

    // English toggle → 顯示/隱藏英文文字
    const enToggle = document.getElementById('param-en-toggle');
    if (enToggle) {
        enToggle.addEventListener('change', () => {
            const enTextEl = document.getElementById('chat-en-text');

            if (enToggle.checked) {
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
            if (!chatAIResult || !Array.isArray(chatAIResult.tonesCN) || chatAIResult.tonesCN.length === 0) return;
            const idx = snapToneIdx(toneSlider.value);
            const safeIdx = (idx >= 0 && idx < chatAIResult.tonesCN.length) ? idx : 2;
            const newCN = chatAIResult.tonesCN[safeIdx] || chatAIResult.textCN;
            if (!newCN || newCN === chatAIResult.textCN) return;
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
        // WS 連線後推一次 idle 狀態給 ESP（ESP 剛開機不知道 app 在哪個階段）
        nfcManager.onConnect(() => {
            setTimeout(() => { if (typeof sendLedMode === 'function') sendLedMode('idle'); }, 100);
        });
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

    // 預先量好最終寬高並鎖住：寬度讓打字機從左打到右，高度避免英文出現時中文被擠上去
    [[zhEl, zhText], [enEl, enText]].forEach(([el, txt]) => {
        el.textContent = txt;
        el.style.minWidth = el.offsetWidth + 'px';
        el.style.minHeight = el.offsetHeight + 'px';
        el.style.textAlign = 'left';
        el.textContent = '';
    });

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
