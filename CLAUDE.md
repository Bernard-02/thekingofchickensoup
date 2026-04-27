# Chicken Soup Quote — 專案說明

## 專案概述

這是一個互動裝置專案，結合 NFC 技術、網頁前端與 AI，讓觀眾透過回答問題，獲得一句對應的雞湯語錄。作者 Bernard Liew 是本專案語錄的唯一創作者，所有 200 句語錄皆為其親筆撰寫。

---

## 專案結構

```
/
├── index.html              # 主頁面（裝置端）
├── css/style.css           # 全域樣式
├── js/
│   ├── config.js           # 全域設定（WebSocket URL、資料路徑）
│   ├── main.js             # 頁面邏輯、問題渲染、流程控制
│   ├── nfc.js              # NFC WebSocket 通訊（連接 ESP8266）
│   └── context.js          # 脈絡媒體覆蓋層
├── data/
│   ├── quotes.json         # 完整 200 句語錄（備份用，勿直接使用）
│   ├── quotes-selected.json # 篩選後的 100 句（裝置使用的資料來源）
│   ├── questions.json      # 8 題問答資料（動態渲染）
│   └── contexts.json       # 每句話的脈絡媒體資料
└── src/main.cpp            # ESP8266 韌體（PlatformIO）
```

---

## 技術棧

- **前端**：原生 HTML / CSS / JavaScript
- **樣式**：Tailwind CSS（CDN）、自訂 `style.css`
- **動畫**：GSAP 3.12.5（CDN，含 TextPlugin / Flip / MotionPathPlugin / EasePack）
- **字體**：Noto Sans TC（中文）、Helvetica（英文，用 `.en` class 套用）
- **硬體通訊**：WebSocket 連接 ESP8266 NFC 讀取裝置
- **硬體**：ESP8266 + PN532 NFC 模組

---

## 互動流程

```
首頁
  ↓
操作提示（guide-view）
  ↓
8 題問答（question-view，動態渲染自 questions.json）
  ↓
Q8 分叉：
  ├── 「隨緣」→ 等待 NFC（waiting-nfc-view）
  │              ↓
  │           掃 NFC 瓶子 → 抽取語錄（quote-view）
  │              ↓
  │           掃對應編號瓶子 → 查看脈絡
  │
  └── 「想多說」→ AI 聊天（chat-view，開發中）
                   ↓
                AI 用作者口吻產出客製化語錄
                   ↓
                觀眾調整參數（顏色、字體、語氣）
                   ↓
                掃 QR code 帶走（數位卡片）
```

---

## 語錄資料說明

### quotes-selected.json 欄位

```json
{
  "id": "001",
  "number": 1,
  "category": "人生哲理",       // 人生哲理 / 人際關係 / 處世態度
  "textCN": "中文語錄",
  "textEN": "英文翻譯",
  "nfcUID": "04:8D:D5:22:BF:2A:81",  // 對應 NFC 標籤 UID
  "contextId": "001",
  "tags": ["tired"],             // 待完善，篩選用
  "translation": "轉譯後的籤文"  // 模糊的意象描述，用於裝置顯示
}
```

### 語錄分類
- `人生哲理` — 對生命、自我的觀察
- `人際關係` — 對他人、關係的觀察
- `處世態度` — 面對事情的方式

### 轉譯（translation）
每句語錄有一個「轉譯」版本，像籤文一樣——用客觀描述一個場景或意象，不直接說出道理，讓觀眾自行解讀。裝置顯示的是轉譯，掃 NFC 後才看到原句。

---

## 問答設計（questions.json）

8 題單選題，動態渲染。每個選項有 `scores` 物件，對應不同的主題權重，用於加權篩選語錄。

目前的 score 維度（開發中）：
`confused` / `tired` / `hurt` / `action` / `courage` / `let-go` / `perspective` / `patience` / `relationships` / `self-worth` / `overthinking` / `setback`

---

## 設計原則

- **作者口吻**：直接、不繞彎、帶點幽默，不說教、不哄人，像一個稍微走在你前面的朋友說的話
- **不要太多 layer**：裝置給轉譯 → 掃瓶子得原句 → 書裡有脈絡，不超過三層
- **共鳴優先**：句子的目的是讓觀眾感到「被說中」，不是「被建議」

---

## 硬體設定

### 開機流程（固定 3 步）
1. 開 Windows 行動熱點
2. 插 ESP（看 Serial Monitor 印的 IP）
3. 對照 `js/config.js` 第 7 行，IP 不一樣就改一個數字

### 為什麼是這個流程
- Windows 行動熱點 (ICS) 不接受 client 用 `WiFi.config` 強制固定 IP，會擋掉
- 所以韌體放棄固定 IP，乖乖用 DHCP
- ICS 對同一個 MAC 通常給同一個 IP，所以「貼一次」展演整天不用再改
- 如果換真的 router，到 router 後台設 DHCP 保留即可一勞永逸

### 設定點
- WebSocket URL：`js/config.js` 第 7 行（單一一個地方）
- Hotspot SSID/密碼：`src/main.cpp` 的 `sta_ssid` / `sta_password`，目前是 `BERNARD-LAPTOP` / `550V1!5t`，2.4GHz
- WebSocket client 上限：`platformio.ini` 的 `WEBSOCKETS_SERVER_CLIENT_MAX=10`（撐多次刷新留下的殭屍連線）
- 頁面 refresh 主動 close socket：`js/main.js` 的 `beforeunload` listener
- NFC 掃描邏輯在 `js/nfc.js`，資料來源從 `CONFIG.dataFiles.quotes` 讀取

### 特殊 NFC 卡片
| 角色 | UID | 功能 |
|------|-----|------|
| 萬用卡 | `04:83:D5:22:BF:2A:81` | 在「等待抽籤」抽一句雞湯；在 soup scan / quote panel 階段也能當任意瓶子完成解鎖 |
| AI 解鎖卡 | `04:A4:68:97:CC:2A:81` | 「只」在 chat-result-view 揭曉 AI 原句，其他頁面掃了會忽略 |
| 100 張瓶身卡 | 各自登錄在 `data/quotes-selected.json` 的 `nfcUID` | 解鎖各自對應編號的雞湯（在 scan 頁掃對的編號才會啟動 5 秒 reveal hold）|

韌體分派：萬用卡 → `random_quote`；AI 卡 → `ai_reveal`；其他 → `show_context`（前端用 UID 對應到雞湯）。

### NodeMCU (ESP8266) 腳位配置

**PN532 NFC 模組（SPI 介面）**
| PN532 | NodeMCU | GPIO |
|-------|---------|------|
| SCK   | D5      | GPIO14 |
| MISO  | D6      | GPIO12 |
| MOSI  | D7      | GPIO13 |
| SS / CS | D2    | GPIO4 |
| VCC   | 3V3     | — |
| GND   | GND     | — |

**WS2812 燈條（兩條，同步控制）**
| 燈條  | DIN | NodeMCU | GPIO | 韌體驅動方式 |
|-------|-----|---------|------|--------------|
| 左條  | DIN | D1      | GPIO5 | NeoPixelBus BitBang（CPU 軟體 bit-bang，可能受 WiFi 中斷干擾偶爾跳色） |
| 右條  | DIN | D4      | **GPIO2 鎖死** | NeoPixelBus **UART1** 硬體驅動（不受任何中斷干擾，乾淨穩定） |

- **D4 不能改成其他腳位** — UART1 TX 在 ESP8266 上硬體就是 GPIO2，要換腳就要把韌體 method 改成 BitBang
- 兩條燈條的 5V / GND 與 ESP 共用（**必須共地**，沒共地會整條不亮）
- 每條 5 顆 LED（`LED_COUNT_L = LED_COUNT_R = 5`）
- D4 的板上藍色 LED 跟 GPIO2 共用，更新時微閃為正常

**避用腳位**
- D5 / D6 / D7：被 PN532 SPI 佔用
- D2：PN532 CS
- D8 / D3：boot strap 風險（開機會拉 high/low，可能害 ESP 起不來或第一顆 LED 亮錯色）

---

## 待完成事項

1. 幫 100 句語錄補齊標籤（用主題關鍵字）
2. 設計加權篩選邏輯（根據 8 題 scores 篩出最對應的語錄）
3. 建立獨立的 `quotes.html`（網站整合，列表顯示 200 句轉譯）
4. AI 聊天路線實作（用作者口吻產出客製化語錄）
5. 客製化卡片產生器（調參數、預覽、QR code 帶走）
6. 書的頁碼資料補齊（之後加進 quotes-selected.json）
