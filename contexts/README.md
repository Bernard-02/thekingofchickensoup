# 脈絡媒體資料夾

這個資料夾用於存放每句雞湯的脈絡媒體（圖片和影片）。

## ✨ 使用方式

### 1. 創建資料夾並放入檔案

按編號創建資料夾，檔案可以使用**任意名稱**：

```
contexts/
├── 1/
│   ├── 照片1.jpg          ← 任意檔名都可以
│   ├── 背景圖.png
│   └── 影片.mp4
├── 2/
│   └── my-photo.jpg
├── 3/
│   ├── context_a.jpg
│   ├── context_b.png
│   └── explanation.mp4
├── 6/                     ← 空資料夾
└── 50/
    └── background.jpg
```

### 2. 編輯 `data/contexts.json`

告訴系統每個雞湯有哪些媒體檔案：

```json
{
  "1": {
    "media": [
      { "type": "image", "src": "contexts/1/照片1.jpg" },
      { "type": "image", "src": "contexts/1/背景圖.png" },
      { "type": "video", "src": "contexts/1/影片.mp4" }
    ]
  },
  "2": {
    "media": [
      { "type": "image", "src": "contexts/2/my-photo.jpg" }
    ]
  },
  "3": {
    "media": [
      { "type": "image", "src": "contexts/3/context_a.jpg" },
      { "type": "image", "src": "contexts/3/context_b.png" },
      { "type": "video", "src": "contexts/3/explanation.mp4" }
    ]
  }
}
```

### 支援的檔案格式

- **圖片**：.jpg, .jpeg, .png, .gif, .webp
- **影片**：.mp4, .webm, .mov

### 完整範例

**雞湯 #1** - 混合圖片和影片：
```json
{
  "1": {
    "media": [
      { "type": "image", "src": "contexts/1/intro.jpg" },
      { "type": "video", "src": "contexts/1/explanation.mp4" },
      { "type": "image", "src": "contexts/1/conclusion.png" }
    ]
  }
}
```

**雞湯 #5** - 只有1張圖片（不顯示控制按鈕）：
```json
{
  "5": {
    "media": [
      { "type": "image", "src": "contexts/5/background.jpg" }
    ]
  }
}
```

**雞湯 #6** - 空資料夾（顯示空白畫面）：
```json
{
  "6": {
    "media": []
  }
}
```

**雞湯 #10** - 多張圖片（顯示控制按鈕）：
```json
{
  "10": {
    "media": [
      { "type": "image", "src": "contexts/10/step1.jpg" },
      { "type": "image", "src": "contexts/10/step2.jpg" },
      { "type": "image", "src": "contexts/10/step3.jpg" }
    ]
  }
}
```

## 🎬 顯示效果

### 空資料夾（media: []）
- 顯示**透明空白畫面**
- **不顯示**控制按鈕和指示器
- 代表脈絡尚未轉換

### 只有1個媒體
- 顯示該圖片或影片
- **不顯示**控制按鈕和指示器
- 靜態展示

### 多個媒體
- **自動播放**：每 5 秒切換下一個媒體
- **手動控制**：`<` `>` 按鈕切換
- **指示器**：點擊跳轉到指定媒體
- **影片**：自動靜音循環播放

### 覆蓋效果
- 透明背景，直接覆蓋在雞湯文上
- 移除 NFC 卡片，媒體消失

## 📝 注意事項

1. 檔案名稱可以是**任意名稱**（中文、英文都可以）
2. 記得在 `data/contexts.json` 中設定路徑
3. 影片建議使用 .mp4 格式以獲得最佳相容性
4. 圖片建議大小不超過 2MB
5. 影片建議不超過 10MB
6. 媒體會按照 `contexts.json` 中的順序顯示
7. **空資料夾**：`"media": []` 會顯示空白畫面
8. **只有1個媒體**：不會顯示控制按鈕
9. **多個媒體**：會顯示 `<` `>` 按鈕和指示器
