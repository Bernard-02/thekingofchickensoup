import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const jsonPath = resolve(__dirname, '..', 'data', 'quotes-selected.json');

const names = {
  1: '喝了會轉換心情的雞湯',
  2: '以前喝過的雞湯',
  3: '一路往前的雞湯',
  8: '有點平淡的雞湯',
  10: '看得到自己的雞湯',
  11: '換了配方的雞湯',
  12: '少了點鹽的雞湯',
  13: '可能會難喝的雞湯',
  17: '附上湯匙的雞湯',
  18: '不是你的雞湯',
  19: '趁熱喝的雞湯',
  22: '媽媽煮的雞湯',
  28: '有點渾濁的雞湯',
  29: '變涼的雞湯',
  30: '天枰上的雞湯',
  32: '善良的雞湯',
  33: '盛在杯子裡的雞湯',
  37: '不同風味的雞湯',
  39: '沒盛滿的雞湯',
  40: '會講話的雞湯',
  42: '加了幸運餅乾的雞湯',
  43: '用心做的雞湯',
  45: '改變自己的雞湯',
  48: '飲水思源的雞湯',
  49: '低調的雞湯',
  50: '樂於分享的雞湯',
  51: '熬很久的雞湯',
  52: '每次都不一樣的雞湯',
  54: '在發光的雞湯',
  58: '需要攪拌一下的雞湯',
  60: '米其林雞湯',
  62: '有點溫溫的雞湯',
  63: '很柔軟的雞湯',
  64: '剛剛好的雞湯',
  66: '大碗雞湯',
  71: '表面普通但很好喝的雞湯',
  74: '漏了點湯的雞湯',
  80: '點滴雞湯',
  83: '加了核桃的雞湯',
  87: '沉默的雞湯',
  88: '小碗雞湯',
  90: '透明的雞湯',
  91: '料很多的雞湯',
  94: '透徹的雞湯',
  95: '糾結在一起的雞湯',
  100: '心平氣和的雞湯',
  104: '有標籤的雞湯',
  109: '便宜大碗又好喝的雞湯',
  112: '中規中矩的雞湯',
  115: '有點東西的雞湯',
  122: '第N次熬煮的雞湯',
  123: '煮給某個人的雞湯',
  125: '難以理解的雞湯',
  126: '剛煮好的雞湯',
  128: '穩扎穩打的雞湯',
  130: '喝了會變聰明的雞湯',
  132: '充滿課題的雞湯',
  133: '很會讀書的雞湯',
  141: '牛頓的雞湯',
  142: '路邊攤的雞湯',
  145: '新手小白的雞湯',
  146: '富有想像的雞湯',
  150: '冷靜之後的雞湯',
  151: '整齊擺盤的雞湯',
  152: '適合今天喝的雞湯',
  153: '好幾碗雞湯',
  156: '沒人教就做出來的雞湯',
  158: '煮到一半的雞湯',
  162: '幸運的雞湯',
  163: '閃亮亮的雞湯',
  164: '放了比較多薑的雞湯',
  165: '有點粗糙的雞湯',
  166: '很順利的雞湯',
  170: 'Nike贊助的雞湯',
  171: '加了紅牛的雞湯',
  174: '獨自享用的雞湯',
  175: '有點辣的雞湯',
  180: '養生雞湯',
  182: '有朵花的雞湯',
  183: '一目了然的雞湯',
  188: '隨手煮的雞湯',
  189: '兩碗好喝的雞湯',
  194: '加了花生的雞湯',
  195: '標榜雞湯',
  196: '3G網路的雞湯',
  199: '沒那麽八卦的雞湯',
  // 還沒命名的，先寫 #編號 占位
  4: '#4',
  5: '#5',
  7: '#7',
  21: '#21',
  25: '#25',
  26: '#26',
  47: '#47',
  57: '#57',
  93: '#93',
  103: '#103',
  176: '#176',
  185: '#185',
  191: '#191',
  198: '#198',
};

const raw = readFileSync(jsonPath, 'utf8');
const data = JSON.parse(raw);

let updated = 0;
const missing = [];

for (const item of data) {
  const name = names[item.number];
  if (!name) continue;

  const ordered = {};
  for (const key of Object.keys(item)) {
    ordered[key] = item[key];
    if (key === 'translation') {
      ordered.soupName = name;
    }
  }
  if (!('soupName' in ordered)) {
    ordered.soupName = name;
  }
  Object.keys(item).forEach((k) => delete item[k]);
  Object.assign(item, ordered);
  updated++;
}

for (const num of Object.keys(names)) {
  if (!data.find((d) => d.number === Number(num))) missing.push(num);
}

writeFileSync(jsonPath, JSON.stringify(data, null, 2) + '\n', 'utf8');

console.log(`Updated ${updated} entries.`);
if (missing.length) console.log('Missing numbers in data:', missing.join(', '));
