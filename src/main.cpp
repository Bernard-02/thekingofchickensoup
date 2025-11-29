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
const char* sta_ssid = "Louisa";
const char* sta_password = "85098222";

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
  NFC_CATEGORY,  // 分類卡片（3張）
  NFC_QUOTE,     // 雞湯文卡片（200張）
  NFC_BLANK,     // 空白卡片（可寫入）
  NFC_UNKNOWN    // 未知卡片
};

// 分類卡片對應
struct CategoryMapping {
  String uid;       // NFC 卡片的 UID
  String category;  // 分類名稱
};

// 定義 3 張分類 NFC
CategoryMapping categoryMappings[] = {
  {"04:83:D5:22:BF:2A:81", "人生哲理"},
  {"04:82:D5:22:BF:2A:81", "人際關係"},
  {"04:8D:D5:22:BF:2A:81", "處世態度"}
};

const int categoryCount = sizeof(categoryMappings) / sizeof(categoryMappings[0]);

// 儲存上次讀取的 UID，避免重複觸發
String lastUID = "";
bool clientConnected = false;

// 時間窗口控制：同一張卡片需要間隔一定時間才能再次觸發
unsigned long lastTriggerTime = 0;  // 上次觸發的時間戳
const unsigned long TRIGGER_COOLDOWN = 2000;  // 冷卻時間（毫秒），建議 2-5 秒

// ===== 函數宣告 =====
void setupWiFi();
void webSocketEvent(uint8_t num, WStype_t type, uint8_t * payload, size_t length);
String getUIDString(byte* uid, byte uidLength);
NFCType detectNFCType(String uid);
String getCategoryForUID(String uid);
void sendCategorySelection(String uid, String category);
void sendQuoteDisplay(String quoteId);

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

    case WStype_TEXT:
      Serial.printf("[%u] 收到訊息: %s\n", num, payload);
      break;
  }
}

// ===== 主迴圈 =====
void loop() {
  webSocket.loop();  // 處理 WebSocket 連線

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
    unsigned long currentTime = millis();

    if (nfcType == NFC_CATEGORY) {
      // 分類卡片特殊邏輯：
      // 1. 如果是新卡片（UID 不同），直接觸發
      // 2. 如果是同一張卡片，需要滿足兩個條件：
      //    a) 卡片曾經移除過（lastUID 被清空）
      //    b) 距離上次觸發超過冷卻時間

      if (currentUID != lastUID) {
        // 新卡片，直接觸發
        shouldProcess = true;
      } else if (lastUID == "") {
        // 卡片移除後重新放置
        if (currentTime - lastTriggerTime >= TRIGGER_COOLDOWN) {
          shouldProcess = true;
        } else {
          // 冷卻時間未到
          unsigned long remainingTime = (TRIGGER_COOLDOWN - (currentTime - lastTriggerTime)) / 1000;
          Serial.print("冷卻中，請等待 ");
          Serial.print(remainingTime + 1);
          Serial.println(" 秒後再試");
          delay(200);
          return;
        }
      }
    } else {
      // 其他卡片：只有 UID 改變時才處理
      shouldProcess = (currentUID != lastUID);
    }

    if (shouldProcess) {
      lastUID = currentUID;
      lastTriggerTime = currentTime;  // 記錄觸發時間

      Serial.println("=================================");
      Serial.println("NFC Tag Detected!");
      Serial.println("---------------------------------");
      Serial.print("UID: ");
      Serial.println(currentUID);

      switch(nfcType) {
        case NFC_CATEGORY: {
          // 分類卡片 - 發送分類選擇訊息
          String category = getCategoryForUID(currentUID);
          Serial.print("Type: Category - ");
          Serial.println(category);
          Serial.println("=================================\n");

          // 總是嘗試發送 WebSocket 訊息（即使沒有連線也發送，因為可能正在重連）
          sendCategorySelection(currentUID, category);

          // 如果沒有連線，也印出備用訊息
          if (!clientConnected) {
            Serial.println(">>> 注意：WebSocket 未連線，但已嘗試發送 <<<");
          }
          break;
        }

        case NFC_QUOTE: {
          // 雞湯文卡片 - 顯示脈絡頁面
          Serial.println("Type: Quote Card");
          Serial.println("=================================\n");

          // 總是嘗試發送
          sendQuoteDisplay(currentUID);

          if (!clientConnected) {
            Serial.println(">>> 注意：WebSocket 未連線，但已嘗試發送 <<<");
          }
          break;
        }

        case NFC_BLANK: {
          // 空白卡片 - 儲存當前雞湯
          Serial.println("Type: Blank Card (Save)");
          Serial.println("=================================\n");

          // 總是嘗試發送
          webSocket.broadcastTXT("{\"type\":\"save_quote\"}");

          if (!clientConnected) {
            Serial.println(">>> 注意：WebSocket 未連線，但已嘗試發送 <<<");
          }
          break;
        }

        default:
          Serial.println("Type: Unknown");
          Serial.println("=================================\n");
          break;
      }
    }

    delay(200);  // 減少延遲，提高切換速度
  } else {
    // 沒有偵測到標籤時，清空 lastUID
    if (lastUID != "") {
      Serial.println("Tag removed.\n");
      lastUID = "";
    }
    delay(50);  // 大幅縮短延遲，快速檢測新卡片
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
  // 檢查是否為分類卡片
  for (int i = 0; i < categoryCount; i++) {
    if (uid == categoryMappings[i].uid) {
      return NFC_CATEGORY;
    }
  }

  // TODO: 檢查是否為雞湯文卡片（200張）
  // 這部分之後會從 quotes.json 讀取

  // TODO: 檢查是否為空白卡片
  // 目前暫時所有未知卡片都視為空白卡片

  return NFC_UNKNOWN;
}

// 根據 UID 查找分類
String getCategoryForUID(String uid) {
  for (int i = 0; i < categoryCount; i++) {
    if (uid == categoryMappings[i].uid) {
      return categoryMappings[i].category;
    }
  }
  return "未知分類";
}

// 透過 WebSocket 發送分類選擇訊息
void sendCategorySelection(String uid, String category) {
  // 建立 JSON 訊息
  // 格式: {"type":"category_selected","uid":"04:83:D5:22:BF:2A:81","category":"人生哲理"}
  String message = "{\"type\":\"category_selected\",\"uid\":\"" + uid + "\",\"category\":\"" + category + "\"}";

  webSocket.broadcastTXT(message);
  Serial.println("已發送分類選擇: " + message);
}

// 透過 WebSocket 發送雞湯顯示訊息
void sendQuoteDisplay(String quoteId) {
  // 建立 JSON 訊息
  // 格式: {"type":"show_context","quoteId":"001"}
  String message = "{\"type\":\"show_context\",\"quoteId\":\"" + quoteId + "\"}";

  webSocket.broadcastTXT(message);
  Serial.println("已發送脈絡顯示: " + message);
}
