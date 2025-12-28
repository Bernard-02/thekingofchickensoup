const fs = require('fs');
const path = require('path');

// 設定路徑
const contextsDir = path.join(__dirname, 'contexts');
const outputFile = path.join(__dirname, 'data', 'contexts.json');

// 支援的檔案格式
const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
const videoExtensions = ['.mp4', '.webm', '.mov'];

const contexts = {};

// 掃描 1-50 的資料夾
for (let i = 1; i <= 50; i++) {
    const folderPath = path.join(contextsDir, i.toString());

    if (!fs.existsSync(folderPath)) {
        console.log(`資料夾 ${i} 不存在`);
        continue;
    }

    // 獲取資料夾中的所有檔案
    let files = [];
    try {
        files = fs.readdirSync(folderPath);
    } catch (e) {
        console.log(`無法讀取資料夾 ${i}: ${e.message}`);
        continue;
    }

    // 過濾出圖片和影片
    const mediaList = [];
    for (const filename of files) {
        const fileLower = filename.toLowerCase();
        const fileExt = path.extname(fileLower);

        if (imageExtensions.includes(fileExt)) {
            mediaList.push({
                type: "image",
                src: `contexts/${i}/${filename}`
            });
        } else if (videoExtensions.includes(fileExt)) {
            mediaList.push({
                type: "video",
                src: `contexts/${i}/${filename}`
            });
        }
    }

    // 加入配置
    contexts[i.toString()] = {
        media: mediaList
    };

    if (mediaList.length > 0) {
        console.log(`✓ 雞湯 #${i}: ${mediaList.length} 個媒體檔案`);
    } else {
        console.log(`  雞湯 #${i}: 空白`);
    }
}

// 寫入 JSON 檔案
fs.writeFileSync(outputFile, JSON.stringify(contexts, null, 2), 'utf-8');

console.log(`\n已生成 ${outputFile}`);
console.log(`共處理了 ${Object.keys(contexts).length} 個雞湯編號`);
