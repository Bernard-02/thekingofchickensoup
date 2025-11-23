# ESP8266 WebSocket API 規格

## 概述

這份文件定義了瀏覽器與 ESP8266 之間透過 WebSocket 通訊的 API 規格。

## WebSocket 連線資訊

- **預設 URL**: `ws://192.168.4.1:81`
- **協定**: WebSocket (ws://)
- **訊息格式**: JSON

## 訊息結構

所有訊息都使用以下 JSON 格式：

```json
{
  "type": "訊息類型",
  "data": {
    // 訊息資料
  }
}
```

## 訊息類型

### 1. 心跳 (Heartbeat)

**方向**: 瀏覽器 → ESP8266

**用途**: 保持連線活躍

**瀏覽器發送**:
```json
{
  "type": "heartbeat"
}
```

**ESP8266 回應**:
```json
{
  "type": "heartbeat",
  "data": {
    "timestamp": 1234567890
  }
}
```

---

### 2. NFC 讀取請求 (NFC Read Request)

**方向**: 瀏覽器 → ESP8266

**用途**: 主動請求讀取 NFC 標籤（可選，也可以由 ESP8266 自動發送）

**瀏覽器發送**:
```json
{
  "type": "nfc_read_request"
}
```

---

### 3. NFC 讀取結果 (NFC Read)

**方向**: ESP8266 → 瀏覽器

**用途**: 當偵測到 NFC 標籤時，ESP8266 自動發送

**ESP8266 發送**:
```json
{
  "type": "nfc_read",
  "data": {
    "uid": "A1B2C3D4",           // NFC 標籤的 UID (十六進位字串)
    "content": "optional text",   // NFC 標籤內容（如果有的話）
    "timestamp": 1234567890       // 讀取時間戳
  }
}
```

**重要說明**:
- `uid`: 必填，為 NFC 標籤的唯一識別碼，以十六進位字串表示
- `content`: 可選，如果 NFC 標籤內有資料則包含此欄位
- `timestamp`: 可選，讀取的時間戳

---

### 4. NFC 寫入請求 (NFC Write)

**方向**: 瀏覽器 → ESP8266

**用途**: 將資料寫入 NFC 標籤

**瀏覽器發送**:
```json
{
  "type": "nfc_write",
  "data": {
    "content": "要寫入的文字內容"
  }
}
```

---

### 5. NFC 寫入成功 (NFC Write Success)

**方向**: ESP8266 → 瀏覽器

**用途**: 通知瀏覽器 NFC 寫入成功

**ESP8266 發送**:
```json
{
  "type": "nfc_write_success",
  "data": {
    "uid": "A1B2C3D4",
    "content": "已寫入的內容",
    "timestamp": 1234567890
  }
}
```

---

### 6. NFC 寫入失敗 (NFC Write Error)

**方向**: ESP8266 → 瀏覽器

**用途**: 通知瀏覽器 NFC 寫入失敗

**ESP8266 發送**:
```json
{
  "type": "nfc_write_error",
  "data": {
    "error": "錯誤訊息描述",
    "code": "ERROR_CODE"
  }
}
```

**常見錯誤代碼**:
- `NO_TAG`: 未偵測到 NFC 標籤
- `WRITE_FAILED`: 寫入失敗
- `TAG_READONLY`: 標籤為唯讀
- `INVALID_DATA`: 無效的資料格式

---

### 7. NFC 移除 (NFC Removed)

**方向**: ESP8266 → 瀏覽器

**用途**: 當 NFC 標籤離開感應範圍時通知瀏覽器

**ESP8266 發送**:
```json
{
  "type": "nfc_removed",
  "data": {
    "uid": "A1B2C3D4",
    "timestamp": 1234567890
  }
}
```

**用途說明**:
- 用於實作「拿走 NFC 標籤時關閉覆蓋層」的功能
- `uid` 可以用來確認是哪個標籤被移除

---

## ESP8266 Arduino 程式碼範例

以下是 ESP8266 端的參考實作：

```cpp
#include <ESP8266WiFi.h>
#include <WebSocketsServer.h>
#include <Wire.h>
#include <PN532_I2C.h>
#include <PN532.h>
#include <ArduinoJson.h>

// WiFi 設定（AP 模式）
const char* ssid = "ChickenSoup";
const char* password = "12345678";

// WebSocket 伺服器
WebSocketsServer webSocket = WebSocketsServer(81);

// NFC 讀取器
PN532_I2C pn532i2c(Wire);
PN532 nfc(pn532i2c);

String lastUID = "";
bool tagPresent = false;

void setup() {
  Serial.begin(115200);

  // 啟動 AP 模式
  WiFi.softAP(ssid, password);
  IPAddress IP = WiFi.softAPIP();
  Serial.print("AP IP: ");
  Serial.println(IP);

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
      // 新標籤或不同的標籤
      tagPresent = true;
      lastUID = currentUID;
      sendNFCRead(currentUID);
    }
  } else {
    if (tagPresent) {
      // 標籤已移除
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
    // 回應心跳
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
  // NFC 寫入邏輯
  // 這裡需要根據實際 NFC 標籤類型實作

  // 成功範例
  StaticJsonDocument<200> doc;
  doc["type"] = "nfc_write_success";
  doc["data"]["content"] = content;

  String output;
  serializeJson(doc, output);
  webSocket.broadcastTXT(output);
}
```

## 連線流程

1. ESP8266 啟動 AP 模式（SSID: ChickenSoup）
2. 瀏覽器連接到 ESP8266 的 WiFi
3. 瀏覽器建立 WebSocket 連線到 `ws://192.168.4.1:81`
4. 連線成功後，每 30 秒發送心跳訊息
5. ESP8266 持續偵測 NFC 標籤，當偵測到時自動發送 `nfc_read` 訊息
6. 當標籤移除時，發送 `nfc_removed` 訊息
7. 瀏覽器可以發送 `nfc_write` 請求來寫入 NFC 標籤

## 注意事項

1. **UID 格式**: 建議使用大寫十六進位字串，不含分隔符（例如：`A1B2C3D4`）
2. **自動偵測**: ESP8266 應該持續輪詢 NFC 標籤，無需瀏覽器主動請求
3. **標籤移除偵測**: 對於覆蓋層的互動非常重要
4. **錯誤處理**: 所有寫入操作都應該有明確的成功/失敗回應
5. **連線穩定性**: 實作心跳機制和自動重連

## 測試建議

1. 使用瀏覽器的開發者工具監控 WebSocket 通訊
2. 先測試基本的連線和心跳
3. 測試 NFC 讀取和 UID 解析
4. 測試標籤移除偵測
5. 最後測試 NFC 寫入功能
