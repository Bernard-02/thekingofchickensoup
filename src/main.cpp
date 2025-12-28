#include <ESP8266WiFi.h>
#include <WebSocketsServer.h>
#include <SPI.h>
#include <PN532_SPI.h>
#include <PN532.h>
#include <NfcAdapter.h>

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

// ===== NFC 卡片類型定義 =====
enum NFCType {
  NFC_TRIGGER,   // 觸發卡片（抽雞湯）
  NFC_OTHER      // 其他卡片（儲存用）
};

// ===== 觸發卡片設定 =====
// 只有這張卡片會觸發隨機抽雞湯
const String TRIGGER_NFC_UID = "04:83:D5:22:BF:2A:81";  // 人生哲理卡片

// 儲存上次讀取的 UID，避免重複觸發
String lastUID = "";
bool clientConnected = false;

// 時間窗口控制：同一張卡片需要間隔一定時間才能再次觸發
unsigned long lastTriggerTime = 0;  // 上次觸發的時間戳
const unsigned long TRIGGER_COOLDOWN = 1500;  // 冷卻時間（毫秒），1.5秒後可以再掃

// ===== 當前狀態追蹤 =====
int currentQuoteNumber = -1;  // 當前顯示的雞湯編號（由前端更新）
bool waitingForBlankNFC = false;  // 是否等待空白 NFC 卡片進行寫入

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

// ===== 設定 =====
void setup() {
  Serial.begin(115200);
  delay(100);
  Serial.println("\n\n=== NFC Page Controller with WebSocket ===");

  // 初始化 WiFi AP 模式
  setupWiFi();

  // 初始化 WebSocket
  webSocket.begin();
  webSocket.onEvent(webSocketEvent);
  Serial.printf("WebSocket 伺服器啟動於 port %d\n", WS_PORT);

  // 初始化 NFC
  Serial.println("Initializing NFC reader...");
  nfc.begin();
  Serial.println("NFC reader ready!");

  Serial.println("\n系統初始化完成！");
  Serial.println("========================================\n");
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
    WiFi.disconnect();  // 先斷開之前的連線
    delay(100);

    Serial.printf("正在連接到: %s\n", sta_ssid);
    Serial.printf("密碼長度: %d\n", strlen(sta_password));
    Serial.print("連線中");

    WiFi.begin(sta_ssid, sta_password);

    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 30) {
      delay(500);
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
      IPAddress IP = WiFi.localIP();
      Serial.println("\n✓ WiFi 連線成功！");
      Serial.println("----------------------------------------");
      Serial.printf("已連接到:  %s\n", sta_ssid);
      Serial.printf("ESP8266 IP: %s\n", IP.toString().c_str());
      Serial.println("----------------------------------------");
      Serial.println("\n使用步驟:");
      Serial.println("1. 確保你的電腦也連接到相同的熱點");
      Serial.println("2. 開啟瀏覽器輸入上方的 ESP8266 IP");
      Serial.printf("3. WebSocket URL: ws://%s:81\n", IP.toString().c_str());
      Serial.println("4. 記得更新網頁 js/config.js 中的 IP！");
      Serial.println("========================================\n");
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
      break;
    }
  }
}

// ===== 主迴圈 =====
void loop() {
  webSocket.loop();  // 處理 WebSocket 連線

  // 取得當前時間（在外層作用域，讓整個 loop 都能使用）
  unsigned long currentTime = millis();

  if (nfc.tagPresent()) {
    // 快速讀取 UID（不讀取完整 NDEF 資料，避免 "Failed read page" 錯誤）
    NfcTag tag = nfc.read();

    // 檢查讀取是否成功
    if (tag.getUidLength() == 0) {
      delay(50);  // 短暫延遲後重試
      return;
    }

    // 讀取 UID
    byte uid[7];
    unsigned int uidLength = tag.getUidLength();
    tag.getUid(uid, uidLength);
    String currentUID = getUIDString(uid, uidLength);

    // 檢查 UID 是否有效
    if (currentUID.length() < 10) {
      delay(50);
      return;
    }

    // 偵測 NFC 類型
    NFCType nfcType = detectNFCType(currentUID);

    // 檢查是否可以觸發
    bool shouldProcess = false;

    if (nfcType == NFC_TRIGGER) {
      // 觸發卡片：只有 UID 改變時才觸發（需要移開再放回）
      shouldProcess = (currentUID != lastUID);
    } else {
      // 脈絡卡片：只有 UID 改變時才觸發（新卡片）
      shouldProcess = (currentUID != lastUID);
    }

    if (shouldProcess) {
      lastUID = currentUID;
      lastTriggerTime = currentTime;

      Serial.println("=================================");
      Serial.println("NFC Tag Detected!");
      Serial.println("---------------------------------");
      Serial.print("UID: ");
      Serial.println(currentUID);

      if (nfcType == NFC_TRIGGER) {
        // 觸發卡片 - 隨機抽一句雞湯
        Serial.println("Type: Trigger Card (隨機抽雞湯)");
        Serial.println("=================================\n");

        sendRandomQuote();

        if (!clientConnected) {
          Serial.println(">>> 注意：WebSocket 未連線，但已嘗試發送 <<<");
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
    }

    delay(200);
  } else {
    // 沒有偵測到標籤時，清空 lastUID
    if (lastUID != "") {
      Serial.println("Tag removed.\n");
      lastUID = "";
    }
    delay(50);
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
  // 檢查是否為觸發卡片
  if (uid == TRIGGER_NFC_UID) {
    return NFC_TRIGGER;
  }
  // 其他所有卡片都是儲存用
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
