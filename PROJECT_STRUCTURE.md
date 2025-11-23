# 專案架構說明

## 頁面結構

### 1. index.html - 首頁
- **用途**: 展覽首頁
- **內容**: 顯示「這個人超會寫雞湯。」
- **互動**: 靜態頁面，無滾動
- **特點**: 極簡設計，文字置中

### 2. quote.html - 雞湯文顯示頁
- **用途**: 顯示選中的雞湯文
- **內容**:
  - 中文雞湯文（大字）
  - 英文翻譯（小字，置於中文下方）
- **互動**:
  - NFC 感應 → 跳轉到脈絡頁面
- **URL 參數**:
  - `?id=1` - 顯示特定 ID 的雞湯文
  - `?category=category1` - 從特定分類隨機選擇
  - 無參數 - 隨機選擇任一雞湯文

**範例**:
```
quote.html?id=1
quote.html?category=category2
quote.html
```

### 3. context.html - 脈絡詳情頁
- **用途**: 顯示雞湯文背後的脈絡故事
- **內容**:
  - 標題
  - 脈絡內容（文字/影片/音訊）
- **互動**:
  - NFC 標籤移除 → 返回雞湯文頁面
- **URL 參數**:
  - `?id=1` - 顯示特定 ID 的脈絡資料

**範例**:
```
context.html?id=1
```

## 資料結構

### quotes.json - 雞湯文資料

```json
{
  "id": 1,                    // 唯一 ID
  "zh": "中文雞湯文",          // 中文內容
  "en": "English translation", // 英文翻譯
  "category": "category1",     // 分類（category1/2/3）
  "contextId": 1               // 對應的脈絡 ID
}
```

**目前資料**:
1. 除了期待天空一直不會下雨，你還可以學會在雨天跳舞。
2. 人生所有的點都是連結在一起的。
3. 向前看，過去讓它過去。
4. 每件事情發生都有它的原因。
5. 時間是人際關係的衡量標準之一。

### contexts.json - 脈絡資料

```json
{
  "id": 1,                     // 唯一 ID
  "quoteId": 1,                // 對應的雞湯文 ID
  "type": "text",              // 類型：text/video/audio
  "title": "標題",
  "content": "文字內容",        // type=text 時使用
  "videoUrl": "影片網址",      // type=video 時使用
  "audioUrl": "音訊網址",      // type=audio 時使用
  "description": "描述"        // 選填，用於影片/音訊的說明
}
```

## 互動流程

```
首頁 (index.html)
  「這個人超會寫雞湯。」

  ↓ （手動或 NFC 觸發跳轉）

雞湯文頁 (quote.html?category=category1)
  中文雞湯文
  English translation

  ↓ （NFC 感應）

脈絡頁 (context.html?id=1)
  標題
  脈絡內容

  ↓ （NFC 移除）

返回雞湯文頁 (quote.html)
```

## NFC 互動邏輯

### 首頁 → 雞湯文頁
- **觸發**: NFC 感應
- **邏輯**:
  1. 讀取 NFC UID
  2. 根據 UID 判斷分類（config.js 中設定）
  3. 跳轉到 `quote.html?category=XXX`
  4. 頁面隨機從該分類中選擇一則雞湯文顯示

### 雞湯文頁 → 脈絡頁
- **觸發**: NFC 感應
- **邏輯**:
  1. 取得當前顯示的雞湯文的 `contextId`
  2. 跳轉到 `context.html?id=XXX`
  3. 顯示對應的脈絡內容

### 脈絡頁 → 雞湯文頁
- **觸發**: NFC 標籤移除
- **邏輯**:
  1. ESP8266 偵測到標籤離開
  2. 發送 `nfc_removed` 訊息
  3. 頁面執行 `window.history.back()` 返回

## JavaScript 模組說明

### config.js
- WebSocket 設定
- NFC 分類對應規則
- 資料檔案路徑
- 除錯模式開關

### nfc.js
- WebSocket 連線管理
- NFC 讀取/寫入/移除事件處理
- 心跳機制
- 自動重連

### data.js
- 資料載入（quotes.json, contexts.json）
- 資料查詢方法：
  - `getQuoteById(id)` - 根據 ID 取得雞湯文
  - `getQuoteByCategory(category)` - 從分類隨機選擇
  - `getRandomQuote()` - 隨機選擇任一雞湯文
  - `getContextById(id)` - 根據 ID 取得脈絡
  - `getCategoryFromUID(uid)` - 根據 NFC UID 判斷分類

### quote.js
- 雞湯文頁面邏輯
- 顯示雞湯文（中英文）
- 監聽 NFC 感應事件

### context.js
- 脈絡頁面邏輯
- 顯示脈絡內容（文字/影片/音訊）
- 監聽 NFC 移除事件

## CSS 設計

### 顏色
- 背景：`#f2f2f2`
- 文字：`#000000`（黑色）

### 字體
- 中文：思源黑體 (Noto Sans TC)
- 英文：Helvetica

### 排版
- 所有頁面：全螢幕置中，無滾動
- 文字對齊：center align
- 響應式設計：手機和桌面都適用

## 開發模式 vs 正式模式

### 開發模式 (debug: true)
- 顯示詳細日誌
- 測試頁面可用
- 主控台輸出所有訊息

### 正式模式 (debug: false)
- 最小化日誌
- 只顯示錯誤訊息
- 優化效能

## 未來擴展計劃

- [ ] 首頁動畫（p5.js）
- [ ] 傳輸頁面動畫效果
- [ ] 新增更多雞湯文（目標 200 則）
- [ ] 影片和音訊脈絡內容
- [ ] NFC 寫入功能實作
- [ ] 資料統計功能
