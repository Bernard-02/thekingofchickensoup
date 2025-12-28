import os
import json

# 設定路徑
contexts_dir = r"c:\Users\Bernard Liew\Documents\實踐大學\作業\畢製\Chicken Soup Quote\contexts"
output_file = r"c:\Users\Bernard Liew\Documents\實踐大學\作業\畢製\Chicken Soup Quote\data\contexts.json"

# 支援的檔案格式
image_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
video_extensions = ['.mp4', '.webm', '.mov']

contexts = {}

# 掃描 1-50 的資料夾
for i in range(1, 51):
    folder_path = os.path.join(contexts_dir, str(i))

    if not os.path.exists(folder_path):
        print(f"資料夾 {i} 不存在")
        continue

    # 獲取資料夾中的所有檔案
    files = []
    try:
        files = os.listdir(folder_path)
    except Exception as e:
        print(f"無法讀取資料夾 {i}: {e}")
        continue

    # 過濾出圖片和影片
    media_list = []
    for filename in files:
        file_lower = filename.lower()
        file_ext = os.path.splitext(file_lower)[1]

        if file_ext in image_extensions:
            media_list.append({
                "type": "image",
                "src": f"contexts/{i}/{filename}"
            })
        elif file_ext in video_extensions:
            media_list.append({
                "type": "video",
                "src": f"contexts/{i}/{filename}"
            })

    # 加入配置
    contexts[str(i)] = {
        "media": media_list
    }

    if len(media_list) > 0:
        print(f"✓ 雞湯 #{i}: {len(media_list)} 個媒體檔案")
    else:
        print(f"  雞湯 #{i}: 空白")

# 寫入 JSON 檔案
with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(contexts, f, ensure_ascii=False, indent=2)

print(f"\n已生成 {output_file}")
print(f"共處理了 {len(contexts)} 個雞湯編號")
