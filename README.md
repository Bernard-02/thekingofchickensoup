# Chicken Soup Quote - 雞湯文互動展覽

一個基於 NFC 互動的雞湯文展覽網頁應用程式，使用 p5.js 和 ESP8266。

## 專案結構

```
Chicken Soup Quote/
├── index.html              # 主頁面
├── css/
│   └── style.css          # 樣式表
├── js/
│   ├── config.js          # 配置文件
│   ├── nfc.js             # NFC WebSocket 通訊模組
│   ├── data.js            # 資料管理模組
│   ├── sketch.js          # p5.js 動畫腳本
│   └── app.js             # 主應用程式邏輯
├── data/
│   ├── quotes.json        # 雞湯文資料
│   └── contexts.json      # 脈絡詳情資料
├── assets/                # 媒體資源（影片、音訊等）
├── ESP8266_API_SPEC.md    # ESP8266 API 規格文件
└── README.md              # 本文件
```

## 功能說明

### 1. 首頁 (Home Page)
- 循環播放動畫（使用 p5.js）
- 等待使用者用 NFC 標籤進行互動
- 根據 NFC UID 自動選擇分類

### 2. 雞湯文顯示頁 (Quote Page)
- 顯示根據分類隨機選擇的雞湯文
- 簡潔的排版設計

### 3. 脈絡詳情覆蓋層 (Context Overlay)
- NFC 感應時彈出覆蓋層
- 顯示雞湯文背後的脈絡（文字、影片、音訊）
- NFC 標籤移除時自動關閉

### 4. NFC 寫入頁 (Write Page)
- 將雞湯文寫入空白 NFC 標籤
- 顯示傳輸動畫
- 即時顯示寫入狀態

### 5. NFC 測試頁 (Test Page)
- WebSocket 連線測試
- NFC 讀取測試
- NFC 寫入測試
- 通訊日誌顯示

## 技術棧

- **前端框架**: 原生 JavaScript (ES6+)
- **CSS 框架**: Tailwind CSS
- **動畫庫**: p5.js
- **通訊協定**: WebSocket
- **硬體**: ESP8266 + PN532 NFC 模組
- **資料格式**: JSON

## 開始使用

### 前置需求

1. ESP8266 開發板
2. PN532 NFC 讀寫模組
3. NFC 標籤（NTAG215 或相容標籤）
4. 支援 WebSocket 的現代瀏覽器

### 安裝步驟

#### 1. 前端設定

直接用瀏覽器開啟 `index.html` 即可（建議使用本地伺服器）。

使用 Python 啟動本地伺服器：
```bash
# Python 3
python -m http.server 8000

# 或使用 Node.js http-server
npx http-server
```

然後在瀏覽器開啟 `http://localhost:8000`

#### 2. ESP8266 設定

1. 安裝 Arduino IDE
2. 安裝 ESP8266 開發板支援
3. 安裝必要的函式庫：
   - ESP8266WiFi
   - WebSocketsServer
   - PN532
   - ArduinoJson

4. 參考 `ESP8266_API_SPEC.md` 中的程式碼範例
5. 修改 WiFi SSID 和密碼（如需要）
6. 上傳程式到 ESP8266

#### 3. 連線設定

1. 連接到 ESP8266 的 WiFi（預設 SSID: `ChickenSoup`）
2. 修改 `js/config.js` 中的 WebSocket URL（如果 IP 不同）
3. 開啟網頁，點擊「連線到 ESP8266」

## 配置說明

### 修改 WebSocket URL

編輯 `js/config.js`:

```javascript
const CONFIG = {
    websocket: {
        url: 'ws://192.168.4.1:81', // 修改為你的 ESP8266 IP
        // ...
    }
};
```

### 修改 NFC 分類對應

編輯 `js/config.js`:

```javascript
nfcCategories: {
    'A': 'category1',  // UID 開頭為 A 的標籤 → 分類 1
    'B': 'category2',  // UID 開頭為 B 的標籤 → 分類 2
    'C': 'category3',  // UID 開頭為 C 的標籤 → 分類 3
}
```

### 新增雞湯文

編輯 `data/quotes.json`:

```json
{
  "id": 7,
  "text": "你的雞湯文內容",
  "category": "category1",
  "contextId": 7
}
```

### 新增脈絡資料

編輯 `data/contexts.json`:

```json
{
  "id": 7,
  "quoteId": 7,
  "type": "text",  // 可以是 "text", "video", "audio"
  "title": "標題",
  "content": "詳細內容"
}
```

## 開發模式

專案預設啟用除錯模式，會：
- 在主控台輸出詳細日誌
- 預設顯示測試頁面而非首頁
- 在測試頁面顯示通訊日誌

若要關閉除錯模式，編輯 `js/config.js`:

```javascript
debug: false
```

## 頁面切換邏輯

```
首頁 (home-page)
  └─ NFC 感應 → 選擇分類 → 雞湯文頁面 (quote-page)
                               └─ NFC 感應 → 顯示脈絡覆蓋層 (context-overlay)
                                              └─ NFC 移除 → 關閉覆蓋層
```

## 互動流程

1. **選擇分類**: 觀眾在首頁選擇一個 NFC 標籤
2. **顯示雞湯文**: 系統根據 NFC UID 判斷分類，隨機顯示該分類的雞湯文
3. **查看脈絡**: 觀眾再次感應 NFC 標籤，彈出脈絡詳情覆蓋層
4. **關閉詳情**: 拿走 NFC 標籤，覆蓋層自動關閉
5. **寫入標籤**: （可選）觀眾可以將喜歡的雞湯文寫入空白 NFC 標籤帶走

## 視覺設計

- **背景色**: `#f2f2f2`
- **文字色**: `#000000`
- **中文字體**: 思源黑體 (Noto Sans TC)
- **英文字體**: Helvetica
- **設計風格**: 極簡黑白

## 疑難排解

### WebSocket 無法連線
- 確認已連接到 ESP8266 的 WiFi
- 檢查 ESP8266 的 IP 位址是否正確
- 查看瀏覽器主控台的錯誤訊息

### NFC 無法讀取
- 確認 PN532 模組已正確連接到 ESP8266
- 檢查 ESP8266 的序列埠輸出
- 確認 NFC 標籤相容性

### 頁面切換異常
- 開啟除錯模式查看日誌
- 檢查瀏覽器主控台的 JavaScript 錯誤

## 未來擴展

- [ ] 實作首頁動畫（文字排列效果）
- [ ] 新增音訊播放支援
- [ ] 優化 NFC 寫入頁面的動畫
- [ ] 新增更多雞湯文和脈絡資料
- [ ] 支援多語言
- [ ] 資料統計功能（觀眾互動記錄）

## 授權

本專案為教育用途。

## 聯絡方式

如有問題或建議，請聯絡專案作者。
