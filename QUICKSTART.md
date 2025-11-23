# 快速開始指南

## 立即測試網頁（不需要 ESP8266）

### 1. 啟動本地伺服器

選擇以下任一方式：

**使用 Python:**
```bash
python -m http.server 8000
```

**使用 Node.js:**
```bash
npx http-server
```

**使用 VS Code:**
- 安裝 "Live Server" 擴充功能
- 右鍵點擊 `index.html` → 選擇 "Open with Live Server"

### 2. 開啟瀏覽器

在瀏覽器中開啟：
```
http://localhost:8000
```

### 3. 測試功能

網頁會自動顯示 **NFC 測試頁面**，你可以：

1. **查看 WebSocket 狀態**（目前會顯示未連線，這是正常的）
2. **測試資料載入**（開啟瀏覽器開發者工具，查看 Console）
3. **查看範例雞湯文資料**

## 整合 ESP8266 硬體

### 所需硬體
- ESP8266 開發板（如 NodeMCU、Wemos D1 Mini）
- PN532 NFC 模組
- NFC 標籤（NTAG215 或相容標籤）
- 連接線

### 接線方式

**PN532 (I2C 模式) ↔ ESP8266:**
```
PN532 SDA  → ESP8266 D2 (GPIO4)
PN532 SCL  → ESP8266 D1 (GPIO5)
PN532 VCC  → 3.3V
PN532 GND  → GND
```

### 燒錄 ESP8266

1. 參考 `ESP8266_API_SPEC.md` 中的 Arduino 程式碼
2. 在 Arduino IDE 中：
   - 安裝 ESP8266 開發板
   - 安裝函式庫：
     - `ESP8266WiFi`
     - `WebSocketsServer` (by Markus Sattler)
     - `Adafruit PN532`
     - `ArduinoJson`
3. 選擇開發板（例如：NodeMCU 1.0）
4. 上傳程式

### 連線測試

1. ESP8266 上電後會建立 WiFi AP
   - SSID: `ChickenSoup`
   - 密碼: `12345678`

2. 電腦/手機連接到該 WiFi

3. 開啟網頁 `http://192.168.4.1` 或 `http://localhost:8000`（如果使用本地伺服器）

4. 在測試頁面點擊「連線到 ESP8266」

5. 測試 NFC 感應：
   - 將 NFC 標籤靠近 PN532 模組
   - 觀察測試頁面的「NFC 感應測試」區塊
   - 應該會顯示 NFC 標籤的 UID

## 常見問題

### Q: 網頁顯示空白？
A: 確認使用本地伺服器開啟，不要直接用 `file://` 協定開啟 HTML 檔案。

### Q: WebSocket 一直顯示未連線？
A:
- 檢查是否已連接到 ESP8266 的 WiFi
- 確認 ESP8266 已正常啟動
- 檢查 `js/config.js` 中的 WebSocket URL 是否正確

### Q: NFC 無法讀取？
A:
- 確認接線正確
- 檢查 PN532 模組的模式開關（應設定為 I2C 模式）
- 在 Arduino 序列埠監控視窗查看錯誤訊息

### Q: 中文顯示亂碼？
A: 確認所有檔案都以 UTF-8 編碼儲存。

## 下一步

完成測試後，你可以：

1. **修改資料**: 編輯 `data/quotes.json` 和 `data/contexts.json` 新增你的雞湯文
2. **調整分類**: 在 `js/config.js` 中設定 NFC UID 與分類的對應關係
3. **實作動畫**: 編輯 `js/sketch.js` 加入首頁的 p5.js 動畫
4. **切換到首頁**: 在 `js/config.js` 中設定 `debug: false`

## 展覽部署建議

1. 使用穩定的電源供應 ESP8266
2. 準備備用的 NFC 標籤
3. 使用平板或大螢幕顯示網頁
4. 確保 WiFi 訊號穩定
5. 準備觀眾指引說明

祝你展覽成功！
