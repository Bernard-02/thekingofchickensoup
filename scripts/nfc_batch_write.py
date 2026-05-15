#!/usr/bin/env python3
"""
NFC 批次燒錄工具
透過 USB Serial 連接 ESP8266 + PN532，自動將一批 URL 依序燒錄進空白 NFC 卡片。

使用方法：
  python nfc_batch_write.py urls.txt COM3

urls.txt 格式（每行一個 URL，# 開頭為註解）：
  https://example.com/quotes/quote1
  https://example.com/quotes/quote2
  # 這是註解，會跳過
  https://example.com/quotes/quote3

依賴：pip install pyserial
"""

import sys
import time
import os
import serial
import serial.tools.list_ports


def list_ports():
    ports = serial.tools.list_ports.comports()
    if not ports:
        print("找不到任何 Serial port")
        return
    print("可用的 Serial ports：")
    for p in ports:
        print(f"  {p.device}  —  {p.description}")


def load_urls(filepath):
    if not os.path.exists(filepath):
        print(f"找不到檔案：{filepath}")
        sys.exit(1)
    urls = []
    with open(filepath, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#"):
                urls.append(line)
    return urls


def wait_response(ser, timeout=30):
    """等待 ESP 回傳一行以 OK: / FAIL: / ERR: / READY_FOR_TAG / IDLE 開頭的訊息。"""
    deadline = time.time() + timeout
    while time.time() < deadline:
        raw = ser.readline()
        if not raw:
            continue
        line = raw.decode("utf-8", errors="replace").strip()
        if not line:
            continue
        # 把 ESP 其他 debug 訊息也印出來（方便 troubleshoot）
        print(f"  ESP> {line}")
        if (line.startswith("OK:")
                or line.startswith("FAIL:")
                or line.startswith("ERR:")
                or line == "READY_FOR_TAG"
                or line == "CANCELLED"
                or line == "IDLE"
                or line.startswith("WAITING_FOR_TAG:")):
            return line
    return None


def run(urls_file, port, baud=115200):
    urls = load_urls(urls_file)
    total = len(urls)
    if total == 0:
        print("URL 清單是空的，結束。")
        return

    print(f"\n共 {total} 個 URL，連接 {port}...")
    try:
        ser = serial.Serial(port, baud, timeout=1)
    except serial.SerialException as e:
        print(f"無法開啟 {port}：{e}")
        print("請確認 ESP 有插上，且沒有其他程式（如 PlatformIO Serial Monitor）佔用 port。")
        sys.exit(1)

    time.sleep(2)   # 等 ESP reset 穩定
    ser.reset_input_buffer()
    print("連線成功！\n")

    i = 0
    while i < total:
        url = urls[i]
        print(f"─────────────────────────────────────────")
        print(f"[{i+1}/{total}]  {url}")
        print("請放上空白 NFC 卡片（放好後自動寫入）...")

        cmd = f"WRITE:{url}\n"
        ser.write(cmd.encode("utf-8"))

        # 等 READY_FOR_TAG
        resp = wait_response(ser, timeout=5)
        if resp != "READY_FOR_TAG":
            print(f"  意外回應：{resp}，重試中...")
            ser.reset_input_buffer()
            continue

        # 等 OK / FAIL（最多 60 秒讓你慢慢放卡）
        resp = wait_response(ser, timeout=60)

        if resp and resp.startswith("OK:"):
            uid = resp[3:]
            print(f"  ✓ 寫入成功！UID: {uid}")
            i += 1
            if i < total:
                input("\n按 Enter 繼續下一張，或 Ctrl+C 中止...")
        elif resp and resp.startswith("FAIL:"):
            reason = resp[5:]
            print(f"  ✗ 寫入失敗（{reason}）")
            retry = input("  重試這張？(y/n): ").strip().lower()
            if retry != "y":
                i += 1   # 跳過，繼續下一個
        else:
            print(f"  超時或無回應（{resp}）")
            retry = input("  重試這張？(y/n): ").strip().lower()
            if retry != "y":
                i += 1
            ser.reset_input_buffer()

    print(f"\n═══════════════════════════════════════════")
    print(f"完成！共燒錄 {i} / {total} 張。")
    ser.close()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        print("\n可用 ports：")
        list_ports()
        sys.exit(0)

    if sys.argv[1] == "--list-ports":
        list_ports()
        sys.exit(0)

    if len(sys.argv) < 3:
        print("用法：python nfc_batch_write.py <urls.txt> <COM port>")
        print("      python nfc_batch_write.py --list-ports")
        sys.exit(1)

    run(sys.argv[1], sys.argv[2])
