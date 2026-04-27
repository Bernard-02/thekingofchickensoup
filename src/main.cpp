#include <ESP8266WiFi.h>
#include <WebSocketsServer.h>
#include <SPI.h>
#include <PN532_SPI.h>
#include <PN532.h>
#include <NfcAdapter.h>
#include <string.h>
#include <NeoPixelBus.h>
#include <Ticker.h>

// ===== WiFi 模式選擇 =====
// true  = AP 模式（ESP8266 創建自己的 WiFi）
// false = Station 模式（連接到你的手機熱點）
#define USE_AP_MODE false   // 改用 Station 模式連接到 Router

// ===== AP 模式設定 =====
const char* ap_ssid = "ChickenSoup-NFC";
const char* ap_password = "nfc12345";

// ===== Station 模式設定（Router WiFi）=====
const char* sta_ssid = "BERNARD-LAPTOP";
const char* sta_password = "550V1!5t";

// ===== WebSocket 設定 =====
#define WS_PORT 81
WebSocketsServer webSocket = WebSocketsServer(WS_PORT);

// ===== PN532 NFC 設定 =====
// PN532 的 SS / SDA / CS 接到 NodeMCU 的 D2 (GPIO4)
#define PN532_SS D2
PN532_SPI pn532spi(SPI, PN532_SS);
NfcAdapter nfc(pn532spi);
PN532 pn532(pn532spi);  // 低階 PN532，用來做 tag emulation

// ===== NFC 卡片類型定義 =====
enum NFCType {
  NFC_WILDCARD,  // 萬用卡（抽雞湯 + 在 soup/panel 階段解鎖任意瓶子）
  NFC_AI,        // AI 解鎖卡（只在 chat-result-view 用來揭曉 AI 原句）
  NFC_OTHER      // 100 張對應雞湯的瓶身卡
};

// ===== 特殊卡片 UID =====
// 萬用卡：在「等待抽籤」頁觸發隨機抽雞湯；在「差最後一步」掃描頁 / quote panel 開啟時，
// 也能當作任意瓶子完成 5 秒解鎖。前端判斷在 js/nfc.js handleRandomQuote。
const String WILDCARD_NFC_UID = "04:83:D5:22:BF:2A:81";

// AI 解鎖卡：「只」在 chat-result-view 用來把粒子散開、揭曉 AI 生成的雞湯。
// 在其他頁面掃這張卡會被忽略（不會觸發隨機抽籤、不會當萬用瓶子）。
const String AI_NFC_UID = "04:A4:68:97:CC:2A:81";

// ===== 開發 fallback =====
// true 時 firmware 一律把任何卡當 wildcard（早期沒有實體 context 卡時用）。
// 正式展覽請保持 false。
#define TEST_ALL_AS_TRIGGER false

// 儲存上次讀取的 UID，避免重複觸發
String lastUID = "";
bool clientConnected = false;

// 時間窗口控制：同一張卡片需要間隔一定時間才能再次觸發
unsigned long lastTriggerTime = 0;  // 上次觸發的時間戳
const unsigned long TRIGGER_COOLDOWN = 1500;  // 冷卻時間（毫秒），1.5秒後可以再掃

// ===== 當前狀態追蹤 =====
int currentQuoteNumber = -1;  // 當前顯示的雞湯編號（由前端更新）
bool waitingForBlankNFC = false;  // 是否等待空白 NFC 卡片進行寫入

// ===== WS2812 燈條設定（左右各一條，同步控制） =====
// 左條：D1 (GPIO5)  右條：D4 (GPIO2)
// D5/D6/D7 被 PN532 SPI 佔用；D2 是 PN532 CS；D8/D3 有 boot strap 風險
// D4 會共用板上藍色 LED，上電/資料更新時會微閃，屬正常現象
// 兩條 5V / GND 與 ESP 共用（共地），data pin 各自獨立
//
// ⚠ 為什麼 D4 (stripR) 改用 NeoPixelBus 的 UART1 method：
// Adafruit_NeoPixel 是 CPU bit-bang，ESP8266 的 WiFi NMI 無法被屏蔽，
// 每次 WiFi/NFC 中斷都會干擾 bit-bang 時序，導致 LED 跳色 / 閃爍。
// NeoEsp8266Uart1Ws2812xMethod 直接用 UART1 硬體電路產生波形，
// 完全不靠 CPU，不會被任何中斷干擾。UART1 TX 固定在 GPIO2 (D4)。
// D1 (stripL) 沒對應硬體腳，只能 bit-bang，仍可能受干擾（但 D1 那條燈條是備用）
#define LED_PIN_L      D1
#define LED_PIN_R      D4   // 註：UART1 method 不會用到這個 #define，pin 是硬體固定的
#define LED_COUNT_L    5
#define LED_COUNT_R    5
// 亮度 peak（0.0 ~ 1.0），0.20 柔和、0.30 亮一些（目前用）、0.40 偏刺眼
#define LED_PEAK       0.30f
// 呼吸到最暗時保留多少底光（0~1）。太低 + gamma 校正後會接近熄滅；想永不熄滅拉到 0.35+
#define LED_FLOOR      0.30f

// ⚠ 隔離測試開關：false = 只跑 D4 (stripR)，D1 完全不動
// 用來確認 D4 的 UART1 在「沒有 D1 bit-bang 干擾」時是否完全乾淨
// 測完後改回 true 把 D1 加回來
#define ENABLE_STRIP_L true

// stripR：D4 = GPIO2，UART1 硬體驅動 → 完全不被中斷干擾
NeoPixelBus<NeoGrbFeature, NeoEsp8266Uart1Ws2812xMethod> stripR(LED_COUNT_R);
// stripL：D1 = GPIO5，沒硬體腳，只能 bit-bang
NeoPixelBus<NeoGrbFeature, NeoEsp8266BitBangWs2812xMethod> stripL(LED_COUNT_L, LED_PIN_L);

// Ticker：用軟體計時器把燈條更新獨立出來，不受主 loop 被 NFC SPI 卡住影響
Ticker ledTicker;

// 燈的狀態：由前端透過 WebSocket 控制
// IDLE       = 首頁 / 問答階段   → 白色呼吸
// AWAIT_SCAN = 掃描階段「差最後一步」→ 琥珀色，隨 holdProgress 越來越亮
// REVEALED   = 雞湯揭曉後        → 白色（穩定）
enum LedMode { LED_IDLE, LED_AWAIT_SCAN, LED_REVEALED };
LedMode ledMode = LED_IDLE;

// AWAIT_SCAN 階段由前端推進度（0~1），對應掃描 hold 的 0~5 秒
float ledHoldProgress = 0.0f;

// 顏色 (RGB)
const uint8_t IDLE_R = 255, IDLE_G = 255, IDLE_B = 255;       // 白色
const uint8_t AMBER_R = 230, AMBER_G = 160, AMBER_B = 60;     // 暖琥珀
// （await_scan 階段的整體亮度由 amp range 控制，目前 0.55~0.85）

// ===== NFC Tag 模擬狀態 =====
// 收到 WebSocket 指令後，PN532 切成 Type 4 tag，讓觀眾手機讀取 URL
bool emulateMode = false;
unsigned long emulateStartTime = 0;
const unsigned long EMULATE_TIMEOUT_MS = 30000;  // 30 秒沒人感應就退出

uint8_t ndefBuffer[512];      // 含 2-byte 長度前綴的 NDEF file 內容
uint16_t ndefBufferLen = 0;
uint16_t selectedFile = 0;    // 目前被 SELECT 的檔案 ID (0xE103=CC, 0xE104=NDEF)

// Type 4 tag 的 CC (Capability Container) file，固定 15 bytes
const uint8_t CC_FILE[15] = {
  0x00, 0x0F,              // CCLEN = 15
  0x20,                    // Mapping version 2.0
  0x00, 0x7F,              // MLe (max R-APDU data) = 127
  0x00, 0x7F,              // MLc (max C-APDU data) = 127
  0x04, 0x06,              // NDEF File Control TLV: T=0x04, L=0x06
  0xE1, 0x04,              // NDEF file ID = 0xE104
  0x01, 0xFF,              // Max NDEF file size = 511
  0x00,                    // Read access: free
  0xFF                     // Write access: no write
};

// NDEF Tag Application AID
const uint8_t AID_NDEF[7] = { 0xD2, 0x76, 0x00, 0x00, 0x85, 0x01, 0x01 };

// ===== 網站 URL 設定 =====
const char* QUOTE_BASE_URL = "https://thekingofchickensoup.framer.website/quotes/quote";

// ===== 函數宣告 =====
void setupWiFi();
void webSocketEvent(uint8_t num, WStype_t type, uint8_t * payload, size_t length);
String getUIDString(byte* uid, byte uidLength);
NFCType detectNFCType(String uid);
void sendRandomQuote();
bool writeURLToNFC(int quoteNumber);
void sendWriteResult(bool success, int quoteNumber, String errorMsg = "");
void buildNDEFFromURL(const String& url);
bool startTagEmulation();
void stopTagEmulation();
void handleEmulationStep();
void initLeds();
void updateLeds();
String extractStringField(const String& msg, const char* key);

// ===== 設定 =====
void setup() {
  Serial.begin(115200);
  delay(100);
  Serial.println("\n\n=== NFC Page Controller with WebSocket ===");

  // ⚠ LED 初始化必須最先做，這樣即使後面 WiFi 連不上 / PN532 沒插，
  // 燈條還是能正常運作（LED 等不及 setup 跑完，預設會卡在 power-on 全亮白）
  initLeds();
  // 30fps（33ms 間隔）— 比 50fps 給 WiFi 多一倍喘息空檔，跳閃機率明顯降低
  // 呼吸用 30fps 視覺上看不出差別
  ledTicker.attach_ms(33, updateLeds);
  Serial.println("LEDs ready (L=D1, R=D4) — ticker 30fps");

  // 初始化 WiFi
  setupWiFi();

  // 初始化 WebSocket
  webSocket.begin();
  webSocket.onEvent(webSocketEvent);
  Serial.printf("WebSocket 伺服器啟動於 port %d\n", WS_PORT);

  // 初始化 NFC（沒插 PN532 也不會 hang，但讀卡功能會 disable）
  Serial.println("Initializing NFC reader...");
  nfc.begin();
  Serial.println("NFC reader ready!");

  Serial.println("\n系統初始化完成！");
  Serial.println("========================================\n");
}

// ===== WS2812 燈條 =====
void initLeds() {
  if (ENABLE_STRIP_L) {
    stripL.Begin();
    stripL.ClearTo(RgbColor(0, 0, 0)); stripL.Show();
  }
  // NeoPixelBus 沒有 setBrightness，亮度在 updateLeds 用 LED_PEAK + gamma 直接算
  stripR.Begin();
  stripR.ClearTo(RgbColor(0, 0, 0)); stripR.Show();
}

// gamma 2.2 校正：把 0~1 的感知亮度 → 實際 PWM 值 0~255
// 人眼對亮度是對數反應，直接輸出 sin 會讓低亮度段跳很大
static inline uint8_t gammaByte(float v) {
  if (v <= 0.0f) return 0;
  if (v >= 1.0f) return 255;
  return (uint8_t)(powf(v, 2.2f) * 255.0f + 0.5f);
}

// 依 ledMode 更新兩條燈條
// 由 Ticker 每 20ms 呼叫一次（50 fps），不依賴主 loop
// 用 exp(sin) 自然呼吸曲線 + gamma 校正
void updateLeds() {
  unsigned long now = millis();

  float bR, bG, bB;   // 基礎顏色（0~1）
  float amp;          // 呼吸當下的亮度係數（0~1）

  if (ledMode == LED_IDLE) {
    bR = IDLE_R / 255.0f; bG = IDLE_G / 255.0f; bB = IDLE_B / 255.0f;
    // Sebastian Sonntag 的自然呼吸公式：exp(sin(t))
    // 週期 4 秒；輸出範圍 1/e ~ e，normalize 成 0~1
    // 暗期停留久、亮起來快，接近真人吸吐節奏
    float phase = (now % 4000) / 4000.0f * 2.0f * (float)PI;
    float raw = expf(sinf(phase)) - 0.36787944f;   // 0 ~ ~2.35
    amp = raw / 2.35040239f;                        // 0 ~ 1
    amp = LED_FLOOR + (1.0f - LED_FLOOR) * amp;     // 底光 LED_FLOOR，不完全熄滅
  } else if (ledMode == LED_AWAIT_SCAN) {
    // 掃描階段：琥珀色
    bR = AMBER_R / 255.0f; bG = AMBER_G / 255.0f; bB = AMBER_B / 255.0f;
    if (ledHoldProgress > 0.01f) {
      // 偵測到 NFC → 直接切滿亮度（避免琥珀色在低 PWM 偏紅的色偏問題）
      amp = 1.0f;
    } else {
      // 等待掃描：琥珀色呼吸
      // amp 範圍 0.55 ~ 0.85（之前 0.30 ~ 0.60，把暗端跟亮端都拉高 ~25 個百分點）
      float phase = (now % 3500) / 3500.0f * 2.0f * (float)PI;
      float raw = expf(sinf(phase)) - 0.36787944f;
      float breath = raw / 2.35040239f;
      amp = 0.55f + 0.30f * breath;
    }
  } else {
    // REVEALED：穩定白光（輕微呼吸讓它不死板）
    bR = IDLE_R / 255.0f; bG = IDLE_G / 255.0f; bB = IDLE_B / 255.0f;
    float phase = (now % 2500) / 2500.0f * 2.0f * (float)PI;
    float raw = expf(sinf(phase)) - 0.36787944f;
    amp = 0.85f + 0.15f * (raw / 2.35040239f);
  }

  // 最終線性亮度 = 基礎色 × 呼吸 amp × peak 上限
  float linR = bR * amp * LED_PEAK;
  float linG = bG * amp * LED_PEAK;
  float linB = bB * amp * LED_PEAK;

  uint8_t r = gammaByte(linR);
  uint8_t g = gammaByte(linG);
  uint8_t b = gammaByte(linB);

  // ClearTo 把整條設成同一色，等同跑 N 次 SetPixelColor 但更快
  RgbColor color(r, g, b);
  if (ENABLE_STRIP_L) {
    // stripL (BitBang) 是阻塞，會佔 CPU 約 150µs（5 顆 × 24 bit × 1.25µs）
    stripL.ClearTo(color);
    stripL.Show();
  }
  // stripR (UART1) 是非阻塞，呼叫 Show() 會把資料丟到硬體 buffer，硬體背景送出
  stripR.ClearTo(color);
  stripR.Show();
}

// ===== WiFi 設定 =====
void setupWiFi() {
  Serial.println("========================================");

  #if USE_AP_MODE
    // === AP 模式（創建自己的 WiFi）===
    Serial.println("使用 AP 模式");
    Serial.println("========================================");

    WiFi.mode(WIFI_AP);
    WiFi.softAP(ap_ssid, ap_password);

    IPAddress IP = WiFi.softAPIP();
    Serial.println("\n✓ AP 模式啟動成功！");
    Serial.println("----------------------------------------");
    Serial.printf("WiFi 名稱 (SSID): %s\n", ap_ssid);
    Serial.printf("WiFi 密碼:        %s\n", ap_password);
    Serial.printf("IP 位址:          %s\n", IP.toString().c_str());
    Serial.println("----------------------------------------");
    Serial.println("\n使用步驟:");
    Serial.println("1. 用電腦/手機連接到上述 WiFi");
    Serial.println("2. 開啟瀏覽器輸入 IP 位址");
    Serial.printf("3. WebSocket URL: ws://%s:81\n", IP.toString().c_str());
    Serial.println("========================================\n");

  #else
    // === Station 模式（連接到手機熱點）===
    Serial.println("使用 Station 模式（連接到手機熱點）");
    Serial.println("========================================");

    WiFi.mode(WIFI_STA);
    WiFi.setSleepMode(WIFI_NONE_SLEEP);
    WiFi.setAutoReconnect(true);
    WiFi.setAutoConnect(true);
    WiFi.persistent(true);
    WiFi.setOutputPower(20.5f);

    // 不用 WiFi.config 強制固定 IP — Windows 行動熱點 (ICS) 會擋掉
    // 改用 DHCP，連上後印 IP，貼到 js/config.js 即可

    Serial.printf("連線中: %s", sta_ssid);
    WiFi.begin(sta_ssid, sta_password);

    // 每 200ms poll 一次（比原本 500ms 反應更快）；最多 ~6 秒
    // 6 秒內沒連上就讓 setup() 繼續往下跑，loop() 裡的重連邏輯會接手
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 30) {
      delay(200);
      Serial.print(".");

      // 每 5 次顯示當前狀態
      if (attempts % 5 == 0 && attempts > 0) {
        Serial.printf("\n狀態碼: %d ", WiFi.status());
        // 狀態碼: 0=閒置, 1=無SSID, 3=已連線, 4=連線失敗, 6=連線遺失
      }

      attempts++;
    }

    Serial.println();

    if (WiFi.status() == WL_CONNECTED) {
      Serial.printf("\n>>> IP: %s   ← 貼到 js/config.js 第 7 行\n\n",
                    WiFi.localIP().toString().c_str());
    } else {
      Serial.println("\n✗ WiFi 連線失敗！");
      Serial.println("----------------------------------------");
      Serial.printf("最終狀態碼: %d\n", WiFi.status());
      Serial.println("\n狀態碼說明:");
      Serial.println("  0 = WL_IDLE_STATUS (閒置)");
      Serial.println("  1 = WL_NO_SSID_AVAIL (找不到 WiFi 名稱)");
      Serial.println("  4 = WL_CONNECT_FAILED (密碼錯誤)");
      Serial.println("  6 = WL_DISCONNECTED (斷線)");
      Serial.println("----------------------------------------");
      Serial.println("\n請檢查:");
      Serial.println("1. iPhone 熱點名稱是否完全一致");
      Serial.printf("   程式中: '%s'\n", sta_ssid);
      Serial.println("2. iPhone 熱點設定:");
      Serial.println("   - 允許其他人加入: 開啟");
      Serial.println("   - 使用 2.4GHz (非 5GHz)");
      Serial.println("3. 密碼是否正確");
      Serial.println("4. 試試看改 iPhone 熱點名稱為英文");
      Serial.println("   (例如: 'Bernard-iPhone')");
      Serial.println("========================================\n");
    }
  #endif
}

// ===== WebSocket 事件處理 =====
void webSocketEvent(uint8_t num, WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      Serial.printf("[%u] 客戶端斷線\n", num);
      clientConnected = false;
      break;

    case WStype_CONNECTED: {
      IPAddress ip = webSocket.remoteIP(num);
      Serial.printf("[%u] 客戶端連線, IP: %d.%d.%d.%d\n",
                    num, ip[0], ip[1], ip[2], ip[3]);
      clientConnected = true;

      // 發送歡迎訊息
      webSocket.sendTXT(num, "{\"type\":\"connected\",\"message\":\"Connected to NFC Controller\"}");
      break;
    }

    case WStype_TEXT: {
      Serial.printf("[%u] 收到訊息: %s\n", num, payload);

      // 解析 JSON 訊息
      String msg = String((char*)payload);

      // 處理心跳訊息：echo 回去，讓前端 watchdog 能偵測 ESP 是否還活著
      if (msg.indexOf("\"type\":\"heartbeat\"") >= 0) {
        webSocket.sendTXT(num, "{\"type\":\"heartbeat\"}");
        return;
      }

      // 前端推送燈條模式：{"type":"led_mode","mode":"idle"|"await_scan"|"revealed"}
      if (msg.indexOf("\"type\":\"led_mode\"") >= 0) {
        String mode = extractStringField(msg, "mode");
        if (mode == "idle") {
          ledMode = LED_IDLE;
          ledHoldProgress = 0.0f;
        } else if (mode == "await_scan") {
          ledMode = LED_AWAIT_SCAN;
          ledHoldProgress = 0.0f;
        } else if (mode == "revealed") {
          ledMode = LED_REVEALED;
          ledHoldProgress = 0.0f;
        }
        Serial.printf("LED 模式切換: %s\n", mode.c_str());
        return;
      }

      // 前端推送 hold 進度：{"type":"led_progress","value":0.0~1.0}
      if (msg.indexOf("\"type\":\"led_progress\"") >= 0) {
        int s = msg.indexOf("\"value\":");
        if (s > 0) {
          s += 8;
          int e = msg.indexOf("}", s);
          if (e < 0) e = msg.length();
          String v = msg.substring(s, e);
          v.trim();
          ledHoldProgress = v.toFloat();
        }
        return;
      }

      // 前端查到 UID 對應的雞湯編號後回報：{"type":"log_scan","uid":"...","match":"#11"}
      // 用來在 Serial Monitor 看到「這張實體卡對應哪一號」
      if (msg.indexOf("\"type\":\"log_scan\"") >= 0) {
        String uid = extractStringField(msg, "uid");
        String match = extractStringField(msg, "match");
        Serial.println("---------------------------------");
        Serial.printf(">>> [標號] UID %s  →  %s\n", uid.c_str(), match.c_str());
        Serial.println("---------------------------------");
        return;
      }

      // 處理前端發送的當前雞湯編號更新
      // 格式: {"type":"update_current_quote","quoteNumber":1}
      if (msg.indexOf("\"type\":\"update_current_quote\"") >= 0) {
        int numStart = msg.indexOf("\"quoteNumber\":") + 14;
        int numEnd = msg.indexOf("}", numStart);
        if (numStart > 13 && numEnd > numStart) {
          String numStr = msg.substring(numStart, numEnd);
          numStr.trim();
          currentQuoteNumber = numStr.toInt();
          Serial.printf("已更新當前雞湯編號: %d\n", currentQuoteNumber);
        }
      }

      // 處理前端要求進入 NFC tag 模擬模式
      // 格式: {"type":"emulate_ndef","url":"https://..."}
      if (msg.indexOf("\"type\":\"emulate_ndef\"") >= 0) {
        String url = extractStringField(msg, "url");
        if (url.length() > 0) {
          Serial.println("收到模擬請求, URL: " + url);
          buildNDEFFromURL(url);
          if (startTagEmulation()) {
            webSocket.broadcastTXT("{\"type\":\"nfc_emulate_ready\"}");
          } else {
            webSocket.broadcastTXT("{\"type\":\"nfc_emulate_timeout\"}");
          }
        }
      }
      break;
    }

    default:
      // 其他 WebSocket 事件類型（忽略）
      break;
  }
}

// ===== 主迴圈 =====
void loop() {
  unsigned long currentTime = millis();

  // 燈條動畫改由 Ticker 以 50fps 獨立推進，這裡不用再手動呼叫 updateLeds()

  // 檢查 WiFi 連線狀態（Station 模式，非阻塞）
  #if !USE_AP_MODE
  static unsigned long lastWiFiCheck = 0;
  static bool reconnecting = false;
  static wl_status_t lastStatus = WL_IDLE_STATUS;

  wl_status_t status = WiFi.status();
  if (status != lastStatus) {
    if (status == WL_CONNECTED) {
      Serial.printf("✓ WiFi 已連線：%s\n", WiFi.localIP().toString().c_str());
      reconnecting = false;
    } else if (lastStatus == WL_CONNECTED) {
      Serial.println("✗ WiFi 斷線");
    }
    lastStatus = status;
  }

  if (status != WL_CONNECTED) {
    // 每 3 秒嘗試重連一次（不阻塞 loop）
    if (currentTime - lastWiFiCheck >= 3000) {
      lastWiFiCheck = currentTime;
      if (!reconnecting) {
        Serial.println("嘗試重新連線 WiFi...");
        WiFi.begin(sta_ssid, sta_password);
        reconnecting = true;
      } else {
        Serial.print(".");
      }
    }
  }
  #endif

  webSocket.loop();  // 處理 WebSocket 連線

  // 模擬模式優先處理（期間不讀瓶子）
  if (emulateMode) {
    if (millis() - emulateStartTime > EMULATE_TIMEOUT_MS) {
      Serial.println("模擬超時，退出");
      stopTagEmulation();
      webSocket.broadcastTXT("{\"type\":\"nfc_emulate_timeout\"}");
    } else {
      handleEmulationStep();
    }
    return;
  }

  // NFC 輪詢節流：只每 150ms 讀一次 tagPresent（免得 loop 被卡慢、燈條動畫跳）
  // 這段時間之間 loop 會快速空轉 → updateLeds() 可以 50fps 更新
  static unsigned long lastNfcPoll = 0;
  if (currentTime - lastNfcPoll < 150) return;
  lastNfcPoll = currentTime;

  if (nfc.tagPresent()) {
    // 燈條狀態改由前端透過 WebSocket 推送（led_mode / led_progress），
    // 這邊不再自動因為有卡就切色

    // 快速讀取 UID（不讀取完整 NDEF 資料，避免 "Failed read page" 錯誤）
    NfcTag tag = nfc.read();

    // 檢查讀取是否成功
    if (tag.getUidLength() == 0) {
      Serial.println("[DEBUG] UID 長度為 0，讀取失敗");
      return;  // 下次 loop 的 NFC 節流會自然等 150ms
    }

    // 讀取 UID
    byte uid[7];
    unsigned int uidLength = tag.getUidLength();
    tag.getUid(uid, uidLength);
    String currentUID = getUIDString(uid, uidLength);

    // 檢查 UID 是否有效
    if (currentUID.length() < 10) {
      Serial.printf("[DEBUG] UID 太短: %s (長度: %d)\n", currentUID.c_str(), currentUID.length());
      return;  // 下次 loop 的 NFC 節流會自然等 150ms
    }

    // 除錯：顯示偵測到的 UID（即使重複）
    if (currentUID != lastUID) {
      Serial.printf("[DEBUG] 偵測到新卡片 UID: %s (上次: %s)\n", currentUID.c_str(), lastUID.c_str());
    }

    // 偵測 NFC 類型
    NFCType nfcType = detectNFCType(currentUID);

    // 任何卡片都只在 UID 改變時觸發一次（要重觸發需移開再放回）
    bool shouldProcess = (currentUID != lastUID);

    if (shouldProcess) {
      lastUID = currentUID;
      lastTriggerTime = currentTime;

      Serial.println("=================================");
      Serial.println("NFC Tag Detected!");
      Serial.println("---------------------------------");
      Serial.print("UID: ");
      Serial.println(currentUID);

      if (nfcType == NFC_WILDCARD) {
        // 萬用卡 - 隨機抽一句雞湯（同時前端會用它當 soup/panel 階段的萬用瓶子）
        Serial.println("Type: Wildcard Card (隨機抽雞湯 / 萬用瓶子)");
        Serial.println("=================================\n");

        sendRandomQuote();
      } else if (nfcType == NFC_AI) {
        // AI 解鎖卡 - 只在 chat-result-view 用來揭曉 AI 原句
        Serial.println("Type: AI Reveal Card (僅 chat-result-view 解鎖)");
        Serial.println("=================================\n");

        if (clientConnected) {
          webSocket.broadcastTXT("{\"type\":\"ai_reveal\"}");
          Serial.println("已發送 AI 解鎖指令");
        } else {
          Serial.println(">>> 注意：WebSocket 未連線 <<<");
        }
      } else {
        // 其他卡片 - 顯示脈絡
        Serial.println("Type: Context Card (顯示脈絡)");
        Serial.println("=================================\n");

        // 發送完整的 UID 給前端，由前端去 quotes.json 查找對應編號
        Serial.printf("發送 UID: %s\n", currentUID.c_str());

        // 發送 show_context 訊息給前端（包含 UID）
        if (clientConnected) {
          String message = "{\"type\":\"show_context\",\"uid\":\"" + currentUID + "\"}";
          webSocket.broadcastTXT(message);
          Serial.println("已發送顯示脈絡指令");
        } else {
          Serial.println(">>> 注意：WebSocket 未連線 <<<");
        }
      }

      // 所有卡片都發送 nfc_hold_start（揭曉頁需要它累計 5 秒 hold）
      if (clientConnected) {
        webSocket.broadcastTXT("{\"type\":\"nfc_hold_start\"}");
        Serial.println("已發送 nfc_hold_start");
      }
    }
  } else {
    // 燈條狀態完全由前端決定，這邊只負責 NFC 通訊

    // 沒有偵測到標籤時，清空 lastUID；無論哪種卡片都通知前端 hold 結束
    if (lastUID != "") {
      Serial.println("Tag removed.\n");
      lastUID = "";
      if (clientConnected) {
        webSocket.broadcastTXT("{\"type\":\"nfc_hold_end\"}");
        Serial.println("已發送 nfc_hold_end");
      }
    }
    // 每 2 秒印一次心跳，確認 loop 有在跑、tagPresent 只是一直 false
    static unsigned long lastHeartbeat = 0;
    if (currentTime - lastHeartbeat >= 2000) {
      Serial.printf("[scan] no tag (heap=%u)\n", ESP.getFreeHeap());
      lastHeartbeat = currentTime;
    }
  }
}

// ===== 輔助函數 =====

// 將 UID byte array 轉換為字串格式 (例如 "04:83:D5:22:BF:2A:81")
String getUIDString(byte* uid, byte uidLength) {
  String uidString = "";
  for (byte i = 0; i < uidLength; i++) {
    if (uid[i] < 0x10) uidString += "0";
    uidString += String(uid[i], HEX);
    if (i < uidLength - 1) uidString += ":";
  }
  uidString.toUpperCase();
  return uidString;
}

// 偵測 NFC 卡片類型
NFCType detectNFCType(String uid) {
  // 測試模式：一律當作 wildcard（早期沒有實體 context 卡時用）
  if (TEST_ALL_AS_TRIGGER) {
    return NFC_WILDCARD;
  }
  if (uid == WILDCARD_NFC_UID) {
    return NFC_WILDCARD;
  }
  if (uid == AI_NFC_UID) {
    return NFC_AI;
  }
  return NFC_OTHER;
}

// 透過 WebSocket 發送隨機抽雞湯訊息
void sendRandomQuote() {
  // 發送訊息給前端，讓前端從 200 句中隨機抽一句
  // 格式: {"type":"random_quote"}
  String message = "{\"type\":\"random_quote\"}";

  webSocket.broadcastTXT(message);
  Serial.println("已發送隨機抽雞湯指令");
}

// 寫入 URL 到 NFC 卡片
bool writeURLToNFC(int quoteNumber) {
  // 組合完整 URL
  // 例如: https://thekingofchickensoup.framer.website/quotes/quote1
  String url = String(QUOTE_BASE_URL) + String(quoteNumber);

  Serial.print("準備寫入 URL: ");
  Serial.println(url);

  // 確認卡片還在讀取範圍內
  if (!nfc.tagPresent()) {
    Serial.println("錯誤：NFC 卡片已移除");
    return false;
  }

  // 讀取 NFC 標籤
  NfcTag tag = nfc.read();

  // 建立 NDEF 訊息
  NdefMessage message = NdefMessage();

  // 添加 URI record
  // URI record type 會自動處理 https:// 前綴
  message.addUriRecord(url.c_str());

  // 寫入 NFC
  bool success = nfc.write(message);

  if (success) {
    Serial.println("NDEF URL 寫入成功！");
  } else {
    Serial.println("NDEF URL 寫入失敗");
  }

  return success;
}

// 發送寫入結果到前端
void sendWriteResult(bool success, int quoteNumber, String errorMsg) {
  String message;

  if (success) {
    // 成功訊息
    // 格式: {"type":"nfc_write_success","quoteNumber":1,"url":"https://..."}
    String url = String(QUOTE_BASE_URL) + String(quoteNumber);
    message = "{\"type\":\"nfc_write_success\",\"quoteNumber\":" + String(quoteNumber) +
              ",\"url\":\"" + url + "\"}";
  } else {
    // 失敗訊息
    // 格式: {"type":"nfc_write_error","quoteNumber":1,"error":"write_failed"}
    message = "{\"type\":\"nfc_write_error\",\"quoteNumber\":" + String(quoteNumber) +
              ",\"error\":\"" + errorMsg + "\"}";
  }

  webSocket.broadcastTXT(message);
  Serial.println("已發送寫入結果: " + message);
}

// 從 JSON 文字裡抓出某個 key 的字串值（不完整 JSON parser，只處理 "key":"value"）
String extractStringField(const String& msg, const char* key) {
  String pattern = "\"";
  pattern += key;
  pattern += "\":\"";
  int s = msg.indexOf(pattern);
  if (s < 0) return "";
  s += pattern.length();
  int e = msg.indexOf("\"", s);
  if (e < 0) return "";
  return msg.substring(s, e);
}

// 把 URL 轉成 NDEF file 內容（含 2-byte 長度前綴），存到 ndefBuffer
void buildNDEFFromURL(const String& url) {
  String uri = url;
  uint8_t prefixCode = 0x00;  // 0x00 = no prefix abbreviation
  if (uri.startsWith("https://")) { uri = uri.substring(8); prefixCode = 0x04; }
  else if (uri.startsWith("http://")) { uri = uri.substring(7); prefixCode = 0x03; }
  else if (uri.startsWith("https://www.")) { uri = uri.substring(12); prefixCode = 0x02; }

  uint16_t uriLen = uri.length();
  uint16_t payloadLen = 1 + uriLen;              // prefix code + URI
  uint16_t ndefRecordLen = 4 + payloadLen;       // header + typeLen + payloadLen + type + payload

  if ((size_t)(ndefRecordLen + 2) > sizeof(ndefBuffer)) {
    Serial.println("NDEF 太長，塞不下 buffer");
    ndefBufferLen = 0;
    return;
  }

  ndefBuffer[0] = (ndefRecordLen >> 8) & 0xFF;    // NLEN high
  ndefBuffer[1] = ndefRecordLen & 0xFF;           // NLEN low
  ndefBuffer[2] = 0xD1;                           // NDEF header: MB=1, ME=1, SR=1, TNF=001
  ndefBuffer[3] = 0x01;                           // Type length
  ndefBuffer[4] = (uint8_t)payloadLen;            // Payload length (short record, 1 byte)
  ndefBuffer[5] = 'U';                            // Type "U"
  ndefBuffer[6] = prefixCode;
  for (uint16_t i = 0; i < uriLen; i++) ndefBuffer[7 + i] = (uint8_t)uri[i];
  ndefBufferLen = 2 + ndefRecordLen;

  Serial.printf("NDEF 準備完成，共 %u bytes (URI=%s, prefix=0x%02X)\n",
                ndefBufferLen, uri.c_str(), prefixCode);
}

// 切進 Type 4 tag 模擬模式
// ⚠ 已停用：PN532 的 card emulation 無法被 iPhone 可靠讀取（Apple 不支援 Mifare Classic、
// iPhone 靠近會先跳 Wallet），已改走實體 NTAG 貼紙流程。保留 stub 讓舊 WebSocket 指令不報錯。
bool startTagEmulation() {
  Serial.println("tag emulation 已停用（iPhone 不相容）");
  return false;
}

// 處理一輪 APDU — stub
void handleEmulationStep() {
  stopTagEmulation();
}

// 退出模擬模式，回到一般 reader 模式
void stopTagEmulation() {
  emulateMode = false;
  selectedFile = 0;
  // 重新初始化 SAM 讓 PN532 回到 reader 模式
  pn532.SAMConfig();
  Serial.println("已退出模擬模式，恢復 reader");
}
