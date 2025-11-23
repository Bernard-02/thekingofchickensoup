# 學校 WiFi 設定指南

## 概述

學校的 WiFi 通常比家用 WiFi 更複雜。本文件說明如何修改 ESP8266 代碼以連接不同類型的學校 WiFi。

## 學校 WiFi 的常見類型

### 1. WPA2-Personal（有密碼的一般 WiFi）

**特徵**：
- 需要輸入一組密碼
- 連接後直接可以使用網路
- 最簡單的情況

**Arduino 代碼範例**：

```cpp
#include <ESP8266WiFi.h>
#include <WebSocketsServer.h>
#include <Wire.h>
#include <PN532_I2C.h>
#include <PN532.h>
#include <ArduinoJson.h>

// ===== WiFi 設定 =====
// 改成學校的 WiFi 資訊
const char* ssid = "SchoolWiFi";           // 學校 WiFi 名稱
const char* password = "school_password";   // 學校 WiFi 密碼

// WebSocket 伺服器
WebSocketsServer webSocket = WebSocketsServer(81);

// NFC 讀取器
PN532_I2C pn532i2c(Wire);
PN532 nfc(pn532i2c);

String lastUID = "";
bool tagPresent = false;

void setup() {
  Serial.begin(115200);
  delay(100);

  // ===== 連接到學校 WiFi（Station 模式）=====
  Serial.println();
  Serial.print("Connecting to ");
  Serial.println(ssid);

  WiFi.mode(WIFI_STA);  // 設定為 Station 模式
  WiFi.begin(ssid, password);

  // 等待連接
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.println("WiFi connected!");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());  // 顯示分配到的 IP
  } else {
    Serial.println();
    Serial.println("WiFi connection failed!");
    // 可以選擇進入 AP 模式作為備用
    startAPMode();
  }

  // 啟動 WebSocket 伺服器
  webSocket.begin();
  webSocket.onEvent(webSocketEvent);

  // 初始化 NFC 讀取器
  nfc.begin();
  nfc.SAMConfig();
}

void loop() {
  webSocket.loop();
  checkNFC();
}

// 備用：如果無法連接到學校 WiFi，啟動 AP 模式
void startAPMode() {
  Serial.println("Starting AP mode...");
  WiFi.mode(WIFI_AP);
  WiFi.softAP("ChickenSoup", "12345678");
  IPAddress IP = WiFi.softAPIP();
  Serial.print("AP IP: ");
  Serial.println(IP);
}

void checkNFC() {
  uint8_t uid[] = { 0, 0, 0, 0, 0, 0, 0 };
  uint8_t uidLength;

  bool success = nfc.readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, &uidLength);

  if (success) {
    String currentUID = getUIDString(uid, uidLength);

    if (!tagPresent || currentUID != lastUID) {
      tagPresent = true;
      lastUID = currentUID;
      sendNFCRead(currentUID);
    }
  } else {
    if (tagPresent) {
      sendNFCRemoved(lastUID);
      tagPresent = false;
      lastUID = "";
    }
  }
}

String getUIDString(uint8_t uid[], uint8_t uidLength) {
  String uidString = "";
  for (uint8_t i = 0; i < uidLength; i++) {
    if (uid[i] < 0x10) uidString += "0";
    uidString += String(uid[i], HEX);
  }
  uidString.toUpperCase();
  return uidString;
}

void sendNFCRead(String uid) {
  StaticJsonDocument<200> doc;
  doc["type"] = "nfc_read";
  doc["data"]["uid"] = uid;
  doc["data"]["timestamp"] = millis();

  String output;
  serializeJson(doc, output);
  webSocket.broadcastTXT(output);
}

void sendNFCRemoved(String uid) {
  StaticJsonDocument<200> doc;
  doc["type"] = "nfc_removed";
  doc["data"]["uid"] = uid;
  doc["data"]["timestamp"] = millis();

  String output;
  serializeJson(doc, output);
  webSocket.broadcastTXT(output);
}

void webSocketEvent(uint8_t num, WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_CONNECTED:
      Serial.println("Client connected");
      break;

    case WStype_DISCONNECTED:
      Serial.println("Client disconnected");
      break;

    case WStype_TEXT:
      handleWebSocketMessage(payload, length);
      break;
  }
}

void handleWebSocketMessage(uint8_t * payload, size_t length) {
  StaticJsonDocument<200> doc;
  DeserializationError error = deserializeJson(doc, payload);

  if (error) {
    Serial.println("JSON parse error");
    return;
  }

  String type = doc["type"];

  if (type == "heartbeat") {
    StaticJsonDocument<100> response;
    response["type"] = "heartbeat";
    response["data"]["timestamp"] = millis();

    String output;
    serializeJson(response, output);
    webSocket.broadcastTXT(output);
  }
  else if (type == "nfc_write") {
    String content = doc["data"]["content"];
    writeNFC(content);
  }
}

void writeNFC(String content) {
  StaticJsonDocument<200> doc;
  doc["type"] = "nfc_write_success";
  doc["data"]["content"] = content;

  String output;
  serializeJson(doc, output);
  webSocket.broadcastTXT(output);
}
```

**重要修改說明**：
1. 將 `WiFi.softAP()` 改為 `WiFi.begin(ssid, password)`
2. 設定 `WiFi.mode(WIFI_STA)` 使用 Station 模式
3. 使用 `WiFi.localIP()` 獲取 ESP8266 的 IP 位址
4. 前端需要連接到相同的學校 WiFi，並修改 `js/config.js` 中的 WebSocket URL

---

### 2. WPA2-Enterprise（需要帳號密碼認證）

**特徵**：
- 需要輸入帳號和密碼（例如學號和密碼）
- 使用 PEAP、TTLS 或其他企業級認證方式
- 較為複雜

**Arduino 代碼範例**：

```cpp
#include <ESP8266WiFi.h>
#include <WebSocketsServer.h>
#include <Wire.h>
#include <PN532_I2C.h>
#include <PN532.h>
#include <ArduinoJson.h>

// 外部 C 函數聲明（用於企業級 WiFi）
extern "C" {
  #include "user_interface.h"
  #include "wpa2_enterprise.h"
}

// ===== WiFi 設定 =====
const char* ssid = "SchoolWiFi-Enterprise";  // 學校 WiFi 名稱
const char* username = "student123";          // 你的學號或帳號
const char* password = "your_password";       // 你的密碼
const char* identity = "student123";          // 通常與 username 相同

// WebSocket 伺服器
WebSocketsServer webSocket = WebSocketsServer(81);

// NFC 讀取器
PN532_I2C pn532i2c(Wire);
PN532 nfc(pn532i2c);

String lastUID = "";
bool tagPresent = false;

void setup() {
  Serial.begin(115200);
  delay(100);

  // ===== 連接到 WPA2-Enterprise WiFi =====
  Serial.println();
  Serial.print("Connecting to WPA2-Enterprise: ");
  Serial.println(ssid);

  WiFi.mode(WIFI_STA);

  // 設定企業級認證
  wifi_station_set_enterprise_identity((uint8*)identity, strlen(identity));
  wifi_station_set_enterprise_username((uint8*)username, strlen(username));
  wifi_station_set_enterprise_password((uint8*)password, strlen(password));

  wifi_station_set_wpa2_enterprise_auth(1);  // 啟用 WPA2-Enterprise

  WiFi.begin(ssid);

  // 等待連接
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 40) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.println("WiFi connected!");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println();
    Serial.println("WiFi connection failed!");
    Serial.print("Status: ");
    Serial.println(WiFi.status());
  }

  // 啟動 WebSocket 伺服器
  webSocket.begin();
  webSocket.onEvent(webSocketEvent);

  // 初始化 NFC 讀取器
  nfc.begin();
  nfc.SAMConfig();
}

void loop() {
  webSocket.loop();
  checkNFC();
}

void checkNFC() {
  uint8_t uid[] = { 0, 0, 0, 0, 0, 0, 0 };
  uint8_t uidLength;

  bool success = nfc.readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, &uidLength);

  if (success) {
    String currentUID = getUIDString(uid, uidLength);

    if (!tagPresent || currentUID != lastUID) {
      tagPresent = true;
      lastUID = currentUID;
      sendNFCRead(currentUID);
    }
  } else {
    if (tagPresent) {
      sendNFCRemoved(lastUID);
      tagPresent = false;
      lastUID = "";
    }
  }
}

String getUIDString(uint8_t uid[], uint8_t uidLength) {
  String uidString = "";
  for (uint8_t i = 0; i < uidLength; i++) {
    if (uid[i] < 0x10) uidString += "0";
    uidString += String(uid[i], HEX);
  }
  uidString.toUpperCase();
  return uidString;
}

void sendNFCRead(String uid) {
  StaticJsonDocument<200> doc;
  doc["type"] = "nfc_read";
  doc["data"]["uid"] = uid;
  doc["data"]["timestamp"] = millis();

  String output;
  serializeJson(doc, output);
  webSocket.broadcastTXT(output);
}

void sendNFCRemoved(String uid) {
  StaticJsonDocument<200> doc;
  doc["type"] = "nfc_removed";
  doc["data"]["uid"] = uid;
  doc["data"]["timestamp"] = millis();

  String output;
  serializeJson(doc, output);
  webSocket.broadcastTXT(output);
}

void webSocketEvent(uint8_t num, WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_CONNECTED:
      Serial.println("Client connected");
      break;

    case WStype_DISCONNECTED:
      Serial.println("Client disconnected");
      break;

    case WStype_TEXT:
      handleWebSocketMessage(payload, length);
      break;
  }
}

void handleWebSocketMessage(uint8_t * payload, size_t length) {
  StaticJsonDocument<200> doc;
  DeserializationError error = deserializeJson(doc, payload);

  if (error) {
    Serial.println("JSON parse error");
    return;
  }

  String type = doc["type"];

  if (type == "heartbeat") {
    StaticJsonDocument<100> response;
    response["type"] = "heartbeat";
    response["data"]["timestamp"] = millis();

    String output;
    serializeJson(response, output);
    webSocket.broadcastTXT(output);
  }
  else if (type == "nfc_write") {
    String content = doc["data"]["content"];
    writeNFC(content);
  }
}

void writeNFC(String content) {
  StaticJsonDocument<200> doc;
  doc["type"] = "nfc_write_success";
  doc["data"]["content"] = content;

  String output;
  serializeJson(doc, output);
  webSocket.broadcastTXT(output);
}
```

**注意事項**：
- WPA2-Enterprise 在 ESP8266 上的支援有限
- 有些學校的認證方式可能不相容
- 建議先測試基本的連接

---

### 3. 開放式 WiFi（無密碼）

**特徵**：
- 不需要密碼
- 可能有 Captive Portal（網頁登入）

**Arduino 代碼範例**：

```cpp
void setup() {
  Serial.begin(115200);
  delay(100);

  // ===== 連接到開放式 WiFi =====
  Serial.println();
  Serial.print("Connecting to open WiFi: ");
  Serial.println(ssid);

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid);  // 不需要密碼參數

  // 等待連接
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.println("WiFi connected!");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
  }

  // ... 其餘代碼
}
```

**Captive Portal 問題**：
如果學校 WiFi 需要網頁登入（Captive Portal），ESP8266 無法自動處理。解決方案：
1. 手動用手機或電腦先登入一次
2. 使用 MAC 位址綁定（如果學校支援）
3. 考慮使用 AP 模式作為替代方案

---

## 混合模式（推薦用於展覽）

如果擔心學校 WiFi 不穩定，可以使用 AP+STA 混合模式：

```cpp
void setup() {
  Serial.begin(115200);
  delay(100);

  // 設定為混合模式
  WiFi.mode(WIFI_AP_STA);

  // 1. 啟動 AP 模式（備用）
  WiFi.softAP("ChickenSoup", "12345678");
  IPAddress apIP = WiFi.softAPIP();
  Serial.print("AP IP: ");
  Serial.println(apIP);

  // 2. 同時連接到學校 WiFi
  Serial.print("Connecting to school WiFi: ");
  Serial.println(ssid);
  WiFi.begin(ssid, password);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.println("School WiFi connected!");
    Serial.print("Station IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println();
    Serial.println("School WiFi failed, using AP mode only");
  }

  // 啟動 WebSocket 伺服器
  webSocket.begin();
  webSocket.onEvent(webSocketEvent);

  // 初始化 NFC
  nfc.begin();
  nfc.SAMConfig();
}
```

**優點**：
- 即使學校 WiFi 連接失敗，仍可使用 AP 模式
- 提供雙重連接選項

---

## 前端配置修改

連接到學校 WiFi 後，需要修改前端的 WebSocket URL。

編輯 `js/config.js`：

```javascript
const CONFIG = {
    websocket: {
        // 方法 1: 使用 ESP8266 的 IP（需要先從序列埠查看）
        url: 'ws://192.168.1.123:81',  // 替換成實際 IP

        // 方法 2: 使用 hostname（如果支援 mDNS）
        // url: 'ws://chickensoup.local:81',

        reconnectInterval: 3000,
        heartbeatInterval: 30000
    },
    // ... 其他配置
};
```

**如何找到 ESP8266 的 IP**：
1. 上傳程式後，打開 Arduino IDE 的序列埠監控視窗
2. 查看 "IP address: xxx.xxx.xxx.xxx" 的訊息
3. 將這個 IP 填入 `js/config.js`

---

## 故障排除

### WiFi 無法連接

1. **檢查 SSID 和密碼**：
   ```cpp
   Serial.println(ssid);
   Serial.println(password);
   ```

2. **檢查連接狀態**：
   ```cpp
   Serial.print("WiFi status: ");
   Serial.println(WiFi.status());
   // 3 = WL_CONNECTED
   // 其他值代表未連接
   ```

3. **增加等待時間**：
   將 `attempts < 30` 改為 `attempts < 60`

### WebSocket 無法連接

1. **確認同一網路**：
   - 電腦/手機需要連接到相同的學校 WiFi
   - 不能一個在 AP 模式，一個在學校 WiFi

2. **檢查 IP 位址**：
   - 確認前端配置的 IP 與 ESP8266 實際 IP 相同

3. **防火牆問題**：
   - 學校網路可能阻擋 WebSocket（port 81）
   - 嘗試使用其他 port（如 80、8080）

### MAC 位址過濾

有些學校 WiFi 需要註冊 MAC 位址。

**獲取 ESP8266 的 MAC 位址**：
```cpp
void setup() {
  Serial.begin(115200);
  Serial.println();
  Serial.print("MAC Address: ");
  Serial.println(WiFi.macAddress());

  // ... 其他代碼
}
```

將這個 MAC 位址提供給學校 IT 部門註冊。

---

## 完整測試流程

1. **上傳代碼到 ESP8266**
2. **打開序列埠監控視窗**（115200 baud）
3. **查看連接狀態和 IP 位址**
4. **修改前端 `js/config.js` 的 WebSocket URL**
5. **連接到相同的學校 WiFi**（電腦/手機）
6. **打開網頁測試連接**

---

## 建議

對於展覽使用：
- **推薦使用混合模式（AP+STA）**，這樣即使學校 WiFi 不穩定也能正常運作
- 提前測試學校 WiFi 的相容性
- 準備備用方案（純 AP 模式）
- 如果學校 WiFi 有 Captive Portal，考慮使用自己的行動熱點

希望這個指南對你有幫助！
