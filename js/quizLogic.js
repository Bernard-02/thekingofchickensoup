// 四象限抽籤邏輯
// 軸：內在 (I) / 人際 (S) × 用力 (P) / 放下 (R)
// 四象限：IP / IR / SP / SR

const QUADRANTS = ['IP', 'IR', 'SP', 'SR'];

/**
 * 計算測驗結果並篩選金句
 * @param {Array} userAnswers - 使用者選的選項陣列，每個含 scores: { IP/IR/SP/SR: 1 }
 * @param {Array} quotesDB - quotes-selected.json 的金句陣列（每句有 quadrant 主 tag，可選 quadrantSecondary 副 tag）
 * @returns {Object} - { quote, userCombo: [primary, secondary] }
 */
export function getQuizResult(userAnswers, quotesDB) {
    // 累計四象限分數
    const scoreBoard = { IP: 0, IR: 0, SP: 0, SR: 0 };
    userAnswers.forEach(answer => {
        if (!answer || !answer.scores) return;
        for (const [quad, pt] of Object.entries(answer.scores)) {
            if (scoreBoard[quad] !== undefined) scoreBoard[quad] += pt;
        }
    });

    // 排序取主/次象限
    const ranked = QUADRANTS
        .map(q => ({ q, s: scoreBoard[q] + Math.random() * 0.01 })) // 加點抖動讓同分時隨機排序
        .sort((a, b) => b.s - a.s);
    const primary = ranked[0].q;
    const secondary = ranked[1].q;

    console.log(`🎯 使用者象限組合：主 ${primary} / 次 ${secondary}`, scoreBoard);

    // 為每句算權重：
    //   主 tag 對上主象限 → 1.0
    //   副 tag 對上主象限 → 0.5
    //   主 tag 對上次象限 → 0.5
    //   副 tag 對上次象限 → 0.25
    //   無 tag 對上 → 0
    const weighted = quotesDB.map(quote => {
        let w = 0;
        const main = quote.quadrant;
        const sub = quote.quadrantSecondary;
        if (main === primary) w += 1.0;
        if (sub === primary) w += 0.5;
        if (main === secondary) w += 0.5;
        if (sub === secondary) w += 0.25;
        return { quote, w };
    }).filter(x => x.w > 0);

    // 保底：如果完全沒 match（理論上不會），隨機給一句
    if (weighted.length === 0) {
        const finalQuote = quotesDB[Math.floor(Math.random() * quotesDB.length)];
        return { userCombo: [primary, secondary], quote: finalQuote };
    }

    // 依權重隨機抽（weighted random）
    const total = weighted.reduce((acc, x) => acc + x.w, 0);
    let r = Math.random() * total;
    let pick = weighted[0];
    for (const item of weighted) {
        r -= item.w;
        if (r <= 0) { pick = item; break; }
    }

    return {
        userCombo: [primary, secondary],
        scoreBoard,
        quote: pick.quote
    };
}
