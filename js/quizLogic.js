// 1. 定義我們的 3D 維度與對應的 Tags
const DIMENSIONS = {
  state: ['tired', 'confused', 'overthinking', 'hurt'],
  challenge: ['relationships', 'self-worth', 'setback', 'action'],
  remedy: ['let-go', 'perspective', 'courage', 'patience']
};

/**
 * 計算測驗結果並篩選出最適合的金句
 * @param {Array} userAnswers - 觀眾選定的選項陣列，例如：[{ value: "tired", scores: { tired: 1, "let-go": 1 } }, ...]
 * @param {Array} quotesDB - 從 quotes-selected.json 載入的金句陣列
 * @returns {Object} - 最終匹配到的金句物件與分析結果
 */
export function getQuizResult(userAnswers, quotesDB) {
  // --- 第一步：初始化計分板並加總分數 ---
  let scoreBoard = {};
  
  // 將所有標籤初始化為 0 分
  Object.values(DIMENSIONS).flat().forEach(tag => {
    scoreBoard[tag] = 0;
  });

  // 遍歷使用者的答案來加分
  userAnswers.forEach(answer => {
    if (answer.scores) {
      for (const [tag, point] of Object.entries(answer.scores)) {
        if (scoreBoard[tag] !== undefined) {
          scoreBoard[tag] += point;
        }
      }
    }
  });

  // --- 第二步：找出每個維度的最高分 Tag ---
  // 輔助函數：從特定維度中找出最高分的 Tag
  const getTopTag = (tagsArray) => {
    let topTag = tagsArray[0];
    let maxScore = -1;
    
    tagsArray.forEach(tag => {
      if (scoreBoard[tag] > maxScore) {
        maxScore = scoreBoard[tag];
        topTag = tag;
      } else if (scoreBoard[tag] === maxScore) {
        // 如果同分，隨機二選一，增加一點變化性
        if (Math.random() > 0.5) topTag = tag;
      }
    });
    return topTag;
  };

  const topState = getTopTag(DIMENSIONS.state);
  const topChallenge = getTopTag(DIMENSIONS.challenge);
  const topRemedy = getTopTag(DIMENSIONS.remedy);

  const targetCombo = [topState, topChallenge, topRemedy];
  console.log("🎯 使用者的 3D 痛點組合包:", targetCombo);

  // --- 第三步：漏斗式降級匹配金句 ---
  let matchedQuotes = [];

  // 🏆 第一志願：三個標籤 100% 全中
  matchedQuotes = quotesDB.filter(quote => 
    targetCombo.every(tag => quote.tags.includes(tag))
  );

  // 🥈 第二志願：如果找不到全中的，退而求其次 (情緒 + 課題) 或 (情緒 + 處方)
  if (matchedQuotes.length === 0) {
    console.log("⚠️ 找不到 100% 匹配，啟動降級匹配 (第二志願)");
    matchedQuotes = quotesDB.filter(quote => 
      (quote.tags.includes(topState) && quote.tags.includes(topChallenge)) ||
      (quote.tags.includes(topState) && quote.tags.includes(topRemedy))
    );
  }

  // 🥉 第三志願：如果還是沒有，至少確保金句符合當下的「情緒狀態」
  if (matchedQuotes.length === 0) {
    console.log("⚠️ 啟動終極保底匹配 (第三志願)");
    matchedQuotes = quotesDB.filter(quote => quote.tags.includes(topState));
  }

  // 萬一發生極端狀況 (理論上不會)，隨機給一句
  if (matchedQuotes.length === 0) {
    matchedQuotes = quotesDB;
  }

  // --- 第四步：從篩選出的金句池中，隨機抽出一句回傳 ---
  const finalQuote = matchedQuotes[Math.floor(Math.random() * matchedQuotes.length)];

  return {
    userCombo: targetCombo, // 可以把這個組合包回傳給前端，用來顯示 "你現在可能處於...狀態"
    quote: finalQuote
  };
}