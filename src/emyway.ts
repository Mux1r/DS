/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ChartRecord } from './types';
import { formatDate } from './utils';

// ponytail: 只產生「給 Claude 的指令包」，不內嵌腳本全文 ——
// 腳本本體維持住在 OneDrive 那一份，emyway 改版時只要改那邊。
const CASELOG_SCRIPT = String.raw`C:\Users\Muxir\OneDrive\emyway-scripts\emyway_caselog.js`;
const EPA_SCRIPT = String.raw`C:\Users\Muxir\OneDrive\emyway-scripts\emyway_fill.js`;

// Case Log 下拉清單（必須完全相符），與 emyway_caselog.js 檔尾那份同步
const CASELOG_ITEMS = [
  '純音聽力檢查', '鼓室圖檢查', '各式內視鏡檢查', '鼻填塞', '聽力腦幹檢查', '一般前庭功能試驗檢查',
  '眼振圖檢查', '耳廓或其他囊腫切除', '鼓膜切開', '鼻中隔鼻道成型術', '扁桃摘除術', '氣管切開術',
  '中耳通氣管留置術', '鼻骨復位術', '副鼻竇手術', '鼓室成形術', '乳突切除術', '喉顯微手術或喉內視鏡手術',
  '雷射手術', '食道氣管檢查及異物摘除', '耳鼻喉頭頸顏面外傷處理', '簡單頸部腫瘤切除術',
  '顎下腺腫瘤切除術', '腮腺切除術', '頸廓清術', '各種鼻或副鼻竇腫瘤切除術',
  '專科醫師考試指定教科書中有關耳鼻喉頭頸顏面微整及整形重建之相關處置及手術',
  '喉部分或全切除術', '口腔癌複合切除術', '喉氣管重建手術', '語言檢查及治療',
];

const EPA_PLACES = ['門診', '病房（含加護病房）', '急診', '手術室', '會診時', '會議室'];
const TEACHERS = ['江榮山', '蔡青劭', '朱繡棟', '陳世偉', '張紘民頁', '陳忠雄', '黎瓊柱', '柯敏正'];

// EPA 標籤長成 'EPA07 耳與聽力'，字首就是表單編號。
// 口頭報告畫面上顯示 EPA12，但腳本裡的值是 97。
export const epaCode = (tag: string): string | null => {
  const n = Number(/^EPA(\d{1,2})\b/.exec(tag)?.[1]);
  return !n ? null : n === 12 ? '97' : String(n);
};

// 沒有 EPA 字首的標籤才是 Case Log 項目
const caselogTags = (r: ChartRecord) => r.tags.filter(t => !epaCode(t));

export const hasCaselogTag = (r: ChartRecord) => caselogTags(r).length > 0;

export const hasEpaTag = (r: ChartRecord) => r.tags.some(t => epaCode(t));

const head = (r: ChartRecord, i: number) =>
  `[${i + 1}] 病歷號 ${r.mrn || '(空)'}　姓名 ${r.name || '(空)'}　建立日期 ${formatDate(r.createdAt) || '(空)'}`;

const note = (r: ChartRecord) => `病歷紀錄：\n${r.note.trim() || '(空)'}`;

export function buildCaselogPrompt(records: ChartRecord[]): string {
  const body = records
    .map((r, i) => [head(r, i), `標籤：${caselogTags(r).join('、')}`, note(r)].join('\n'))
    .join('\n\n');

  return `以下 ${records.length} 筆病歷要登錄到 emyway Case Log。

做法：讀 ${CASELOG_SCRIPT}，逐筆把頂端的 D 物件換成下面整理出的資料，整份貼進 javascript_tool 執行。
頁面 https://emyway.jct.org.tw/edurd/caselog/#/add，一筆確認存檔成功（回傳的 saved 不是 false）再回到 #/add 做下一筆。
save 維持 true —— Case Log 可以直接按「儲存紀錄」。

判斷規則：
- item 必須是下列清單裡完全相同的字串，用標籤對照（例：標籤「扁桃摘除」→「扁桃摘除術」）。對不到的標籤跳過並在最後回報。
- 一筆病歷有多個標籤時，每個標籤各登一筆。
- date：病歷紀錄內文若寫明手術或檢查日期，以內文為準；沒寫才用建立日期。
- note：依病歷內容寫約 50 字中文摘要（適應症、術式或檢查重點、結果），不要寫入病人姓名。
- 腳本回報 exts.A 非空代表該項目有進階選項；無法從病歷判斷時不要存檔，先回報問我。

可選項目清單：
${CASELOG_ITEMS.join('／')}

${body}

全部做完請回報：每筆登了哪個項目、存檔結果，以及跳過或需要我補資料的那些。`;
}

export function buildEpaPrompt(records: ChartRecord[], rank: string): string {
  const body = records
    .map((r, i) => {
      const tagged = r.tags.filter(t => epaCode(t));
      const epa = tagged.length
        ? tagged.map(t => `${t} → epa='${epaCode(t)}'`).join('、')
        : '(未標，請依病歷內容判斷並回報理由)';
      return [head(r, i), `EPA 項目：${epa}`, `其他標籤：${caselogTags(r).join('、') || '(無)'}`, note(r)].join('\n');
    })
    .join('\n\n');

  return `以下 ${records.length} 筆病歷要填 emyway EPA 學習評量，年資一律 ${rank}。

做法：讀 ${EPA_SCRIPT}，把頂端的 D 物件換成下面整理出的資料，整份貼進 javascript_tool 執行。
頁面 https://emyway.jct.org.tw/edurd/webform/#/fbedit/846858a6fb8060b13ef0192af584760d
⚠ 「完成表單」絕對不要按 —— 送出給指導教師後收不回，填完停在畫面上由我自己按。
所以一次只填一筆，填完回報你選的 epa／teacher／place 和理由，等我確認並按完成表單後再填下一筆。

欄位規則：
- rank：${rank}
- epa：用下面每筆已經標好的值，不要自己改。一筆有多個 EPA 項目就分開填多次表單。
  口頭報告在畫面上顯示 EPA12 但腳本填的是 97 —— 填完請回報表單實際吃到的值，對不上告訴我。
- teacher：從病歷紀錄內文找主治醫師姓名，比對下列名單取完全相同的字串；找不到就填空字串，並在回報時說明要我補。
  名單：${TEACHERS.join('／')}
- place：手術類標籤填「手術室」、檢查類填「門診」，內文另有說明以內文為準。可選：${EPA_PLACES.join('／')}
- chartNo／patName：照下面各筆的病歷號與姓名。
- topic：診斷或報告主題，一句話。
- comment：依病歷內容寫這次的學習心得，150~300 字中文。
- score：留 null，讓腳本依難度隨機給 6~9。
- date：內文若寫明日期以內文為準，否則用建立日期。

${body}`;
}
