// ============================================================
// 純呼吸燈測試 sketch（無 WiFi / WebSocket / NFC）
// 用來 A/B 對照主程式：如果這版順、主程式卡，就是 NFC 輪詢的問題
//                      如果這版也卡，就是 LED / 電源 / 焊接的問題
//
// 使用方式：
//  A) Arduino IDE：開啟此 .ino → 選 NodeMCU 1.0 (ESP-12E Module)
//     → 裝 Adafruit NeoPixel library → 上傳
//  B) PlatformIO：暫時把這個檔案的內容複製到 src/main.cpp（先備份原本的），
//     或另外開一個 env 指到這個資料夾
// ============================================================
#include <Adafruit_NeoPixel.h>

// ===== 接線：跟主專案一致 =====
#define LED_PIN_L    D1   // GPIO5
#define LED_PIN_R    D4   // GPIO2
#define LED_COUNT_L  8
#define LED_COUNT_R  8

Adafruit_NeoPixel stripL(LED_COUNT_L, LED_PIN_L, NEO_GRB + NEO_KHZ800);
Adafruit_NeoPixel stripR(LED_COUNT_R, LED_PIN_R, NEO_GRB + NEO_KHZ800);

// ===== 呼吸參數 =====
#define LED_PEAK       0.40f   // 整體亮度上限 0~1
#define BREATH_CYCLE   4000    // 呼吸週期（毫秒），越大越慢
#define FLOOR_LIGHT    0.05f   // 最暗時保留多少亮度（0=完全熄滅）

// ===== 顏色（白光測試，可改）=====
const uint8_t COLOR_R = 255, COLOR_G = 255, COLOR_B = 255;

// gamma 2.2 校正：把 0~1 的感知亮度 → 實際 PWM 0~255
static inline uint8_t gammaByte(float v) {
  if (v <= 0.0f) return 0;
  if (v >= 1.0f) return 255;
  return (uint8_t)(powf(v, 2.2f) * 255.0f + 0.5f);
}

void setup() {
  Serial.begin(115200);
  Serial.println("\nBreathing LED Test — isolated");

  stripL.begin();
  stripR.begin();
  stripL.setBrightness(255);    // 不用 library 的 brightness 壓縮
  stripR.setBrightness(255);
  stripL.clear(); stripL.show();
  stripR.clear(); stripR.show();
}

void loop() {
  static unsigned long lastFrame = 0;
  static unsigned long lastLog = 0;
  static uint16_t frames = 0;

  unsigned long now = millis();

  // 50 fps 節流
  if (now - lastFrame < 20) return;
  lastFrame = now;
  frames++;

  // Sebastian Sonntag 的自然呼吸曲線：exp(sin(t))
  // 輸出範圍 1/e ~ e，先減 1/e 再除以 (e - 1/e) 正規化到 0~1
  float phase = (now % BREATH_CYCLE) / (float)BREATH_CYCLE * 2.0f * (float)PI;
  float raw   = expf(sinf(phase)) - 0.36787944f;   // 0 ~ ~2.35
  float amp   = raw / 2.35040239f;                  // 0 ~ 1
  amp = FLOOR_LIGHT + (1.0f - FLOOR_LIGHT) * amp;

  // 線性亮度 × peak → gamma → PWM
  float linR = (COLOR_R / 255.0f) * amp * LED_PEAK;
  float linG = (COLOR_G / 255.0f) * amp * LED_PEAK;
  float linB = (COLOR_B / 255.0f) * amp * LED_PEAK;

  uint8_t r = gammaByte(linR);
  uint8_t g = gammaByte(linG);
  uint8_t b = gammaByte(linB);

  for (int i = 0; i < LED_COUNT_L; i++) stripL.setPixelColor(i, r, g, b);
  for (int i = 0; i < LED_COUNT_R; i++) stripR.setPixelColor(i, r, g, b);
  stripL.show();
  stripR.show();

  // 每秒印 fps + 當下亮度，方便看是不是真的跑 50fps
  if (now - lastLog >= 1000) {
    Serial.printf("fps=%u amp=%.3f rgb=(%u,%u,%u)\n", frames, amp, r, g, b);
    frames = 0;
    lastLog = now;
  }
}
