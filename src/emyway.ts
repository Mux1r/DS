/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ChartRecord } from './types';
import { formatDate } from './utils';

// ponytail: 只產生「給 Claude 的指令包」，不內嵌腳本全文 ——
// 腳本本體維持住在 OneDrive 那一份，emyway 改版時只要改那邊。
// 路徑用 %USERPROFILE% 寫，換一台電腦（使用者名稱不同）也不用改。
const CASELOG_SCRIPT = String.raw`%USERPROFILE%\OneDrive\emyway-scripts\emyway_caselog.js`;
const EPA_SCRIPT = String.raw`%USERPROFILE%\OneDrive\emyway-scripts\emyway_fill.js`;
const DS_SCRIPT = String.raw`%USERPROFILE%\OneDrive\emyway-scripts\ds_tags.js`;
const DS_URL = 'https://mux1r.github.io/DS/';

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

// ---- Claude 回寫標籤 ----

export interface TagPatch {
  id: string;
  tags: string[];
}

export interface TagPatchReport {
  updated: number;
  changes: { id: string; mrn: string; name: string; added: string[]; removed: string[] }[];
  unknownIds: string[];
  unknownTags: string[];
}

/**
 * 套用 Claude 判斷出來的標籤。純函式，實際寫入由呼叫端的 onChange 負責。
 * 防呆：id 找不到、或帶了標籤庫裡沒有的標籤（Claude 自己發明的），該筆整筆不套用並列進回報，
 * 免得標籤庫被塞進對不到 Case Log 項目的字串。
 * 專案沒有測試框架，這裡刻意不另外拉一套 —— ds_tags.js 每次寫入後都會讀回比對（verify.ok），
 * 那份就是這段邏輯跑得動的檢查。
 */
export function applyTagPatch(
  records: ChartRecord[],
  library: string[],
  patch: TagPatch[]
): { next: ChartRecord[]; report: TagPatchReport } {
  if (!Array.isArray(patch)) throw new Error('patch 必須是 [{ id, tags: [] }] 陣列');

  const byId = new Map(records.map(r => [r.id, r]));
  const report: TagPatchReport = { updated: 0, changes: [], unknownIds: [], unknownTags: [] };
  const wanted = new Map<string, string[]>();

  for (const p of patch) {
    const r = byId.get(p?.id);
    if (!r) {
      report.unknownIds.push(String(p?.id));
      continue;
    }
    const tags = Array.from(new Set(p.tags ?? []));
    const bad = tags.filter(t => !library.includes(t));
    if (bad.length) {
      report.unknownTags.push(...bad);
      continue;
    }
    const added = tags.filter(t => !r.tags.includes(t));
    const removed = r.tags.filter(t => !tags.includes(t));
    if (!added.length && !removed.length) continue;
    wanted.set(r.id, tags);
    report.changes.push({ id: r.id, mrn: r.mrn, name: r.name, added, removed });
  }

  report.updated = wanted.size;
  report.unknownTags = Array.from(new Set(report.unknownTags));
  const next = wanted.size
    ? records.map(r => (wanted.has(r.id) ? { ...r, tags: wanted.get(r.id)! } : r))
    : records;
  return { next, report };
}

// ---- 指令包 ----

const head = (r: ChartRecord, i: number) =>
  `[${i + 1}] id=${r.id}　病歷號 ${r.mrn || '(空)'}　姓名 ${r.name || '(空)'}　建立日期 ${formatDate(r.createdAt) || '(空)'}`;

const note = (r: ChartRecord) => `病歷紀錄：\n${r.note.trim() || '(空)'}`;

// 兩種表單共用的第一步：先讓 Claude 依病歷內文重判標籤，改動寫回 DS 之後才填表。
const retagStep = (library: string[], side: 'caselog' | 'epa') => {
  const isEpa = side === 'epa';
  const mine = library.filter(t => !!epaCode(t) === isEpa);
  const other = library.filter(t => !!epaCode(t) !== isEpa);
  return `第一步 —— 重新判斷標籤（每次都要做，不要跳過）

下面每筆都附了目前標好的標籤，但那是我隨手標的，可能漏標或標錯。
請你自己讀病歷紀錄內文重判一次，跟現有標籤比對後做增減：
- 內文有做、但沒標到的 → 加上。
- 現有標籤在內文裡找不到依據的 → 拿掉。
- 內文只寫「疑似」「建議」「安排」而實際沒做的 → 不要標，列進回報讓我確認。
- 只能用下面「可用標籤」裡一字不差的字串，不要自己發明新標籤。內文明顯需要清單以外的項目時回報給我，我自己去 DS 加。
- 只動${isEpa ? ' EPA' : ' Case Log'}側的標籤，另一側原樣保留（送出的 tags 要含兩側，見下面腳本說明）。

可用標籤（${isEpa ? 'EPA' : 'Case Log'} 側）：
${mine.join('／') || '(無)'}

另一側標籤（不要動，但回寫時要原樣帶回去）：
${other.join('／') || '(無)'}

寫回 DS：
1. 瀏覽器開 ${DS_URL} ，切到「病歷紀錄」模式（橋接口只在這個模式掛著），把分頁拖進 Claude 的分頁群組。
2. 讀 ${DS_SCRIPT}，先用 read 模式跑一次確認抓得到資料。
3. 把 PATCH 換成你判斷的結果（每筆是 { id, tags }，tags 是這筆**最後應該有的完整標籤**，含沒動到的另一側），整份貼進 javascript_tool 執行。
4. 腳本會回傳實際加了／拿掉了什麼，還有一次讀回驗證。把結果回報給我，確認沒問題再做第二步。`;
};

export function buildCaselogPrompt(records: ChartRecord[], library: string[]): string {
  const body = records
    .map((r, i) => [head(r, i), `目前標籤：${caselogTags(r).join('、') || '(無)'}`, note(r)].join('\n'))
    .join('\n\n');

  return `以下 ${records.length} 筆病歷要登錄到 emyway Case Log。分兩步：先重判標籤寫回 DS，再照更新後的標籤填表。

${retagStep(library, 'caselog')}

第二步 —— 填 Case Log

做法：讀 ${CASELOG_SCRIPT}，逐筆把頂端的 D 物件換成資料，整份貼進 javascript_tool 執行。
頁面 https://emyway.jct.org.tw/edurd/caselog/#/add，一筆確認存檔成功（回傳的 saved 不是 false）再回到 #/add 做下一筆。
save 維持 true —— Case Log 可以直接按「儲存紀錄」。

判斷規則：
- 用第一步更新後的標籤，不是下面附的原始標籤。
- item 必須是下列清單裡完全相同的字串，用標籤對照（例：標籤「扁桃摘除」→「扁桃摘除術」）。對不到的標籤跳過並在最後回報。
- 一筆病歷有多個標籤時，每個標籤各登一筆。
- 重判後一個 Case Log 標籤都不剩的病歷就不用登，列進回報。
- date：病歷紀錄內文若寫明手術或檢查日期，以內文為準；沒寫才用建立日期。
- note：依病歷內容寫約 50 字中文摘要（適應症、術式或檢查重點、結果），不要寫入病人姓名。
- 腳本回報 exts.A 非空代表該項目有進階選項；無法從病歷判斷時不要存檔，先回報問我。

可選項目清單：
${CASELOG_ITEMS.join('／')}

病歷資料：

${body}

全部做完請回報：標籤改了哪些、每筆登了哪個項目、存檔結果，以及跳過或需要我補資料的那些。`;
}

export function buildEpaPrompt(records: ChartRecord[], rank: string, library: string[]): string {
  const body = records
    .map((r, i) => {
      const tagged = r.tags.filter(t => epaCode(t));
      return [
        head(r, i),
        `目前 EPA 標籤：${tagged.map(t => `${t} → epa='${epaCode(t)}'`).join('、') || '(未標)'}`,
        `其他標籤：${caselogTags(r).join('、') || '(無)'}`,
        note(r),
      ].join('\n');
    })
    .join('\n\n');

  return `以下 ${records.length} 筆病歷要填 emyway EPA 學習評量，年資一律 ${rank}。分兩步：先重判標籤寫回 DS，再照更新後的標籤填表。

${retagStep(library, 'epa')}

第二步 —— 填 EPA 學習評量

做法：讀 ${EPA_SCRIPT}，把頂端的 D 物件換成資料，整份貼進 javascript_tool 執行。
頁面 https://emyway.jct.org.tw/edurd/webform/#/fbedit/846858a6fb8060b13ef0192af584760d
⚠ 「完成表單」絕對不要按 —— 送出給指導教師後收不回，填完停在畫面上由我自己按。
所以一次只填一筆，填完回報你選的 epa／teacher／place 和理由，等我確認並按完成表單後再填下一筆。

欄位規則：
- rank：${rank}
- epa：用第一步更新後的 EPA 標籤，標籤字首的數字就是表單編號。一筆有多個 EPA 標籤就分開填多次表單。
  口頭報告在畫面上顯示 EPA12 但腳本填的是 97 —— 填完請回報表單實際吃到的值，對不上告訴我。
  重判後一個 EPA 標籤都不剩的病歷就不用填，列進回報。
- teacher：從病歷紀錄內文找主治醫師姓名，比對下列名單取完全相同的字串；找不到就填空字串，並在回報時說明要我補。
  名單：${TEACHERS.join('／')}
- place：手術類標籤填「手術室」、檢查類填「門診」，內文另有說明以內文為準。可選：${EPA_PLACES.join('／')}
- chartNo／patName：照下面各筆的病歷號與姓名。
- topic：診斷或報告主題，一句話。
- comment：依病歷內容寫這次的學習心得，150~300 字中文。
- score：留 null，讓腳本依難度隨機給 6~9。
- date：內文若寫明日期以內文為準，否則用建立日期。

病歷資料：

${body}`;
}
