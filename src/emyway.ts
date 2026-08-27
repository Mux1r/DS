/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ChartRecord } from './types';
import { formatDate } from './utils';

// ponytail: 規則與腳本全文都住在 OneDrive 那份 README，這裡只產生「哪幾筆 + 標籤庫」——
// 同一套規則兩邊各存一份會慢慢對不上，emyway 或規則改版只要改 OneDrive。
// 路徑用 %USERPROFILE% 寫，換一台電腦（使用者名稱不同）也不用改。
const README = String.raw`%USERPROFILE%\OneDrive\emyway-scripts\README.md`;

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
// 備援用：DS 分頁不方便給 Claude 時，用這個把資料貼過去。規則一律指回 README。

const head = (r: ChartRecord, i: number) =>
  `[${i + 1}] id=${r.id}　病歷號 ${r.mrn || '(空)'}　姓名 ${r.name || '(空)'}　建立日期 ${formatDate(r.createdAt) || '(空)'}`;

const body = (records: ChartRecord[], isEpa: boolean) =>
  records
    .map((r, i) => {
      const mine = r.tags.filter(t => !!epaCode(t) === isEpa);
      const other = r.tags.filter(t => !!epaCode(t) !== isEpa);
      return [
        head(r, i),
        `目前標籤：${mine.join('、') || '(無)'}`,
        `另一側標籤（不要動，回寫時原樣帶回）：${other.join('、') || '(無)'}`,
        `病歷紀錄：\n${r.note.trim() || '(空)'}`,
      ].join('\n');
    })
    .join('\n\n');

// 標籤庫是使用者自己維護的、會變，所以只有這份要隨指令包帶出去
const libraryBlock = (library: string[], isEpa: boolean) =>
  [
    `可用標籤（${isEpa ? 'EPA' : 'Case Log'} 側，只能用這裡面一字不差的字串）：`,
    library.filter(t => !!epaCode(t) === isEpa).join('／') || '(無)',
    '',
    '另一側標籤（這次不要動）：',
    library.filter(t => !!epaCode(t) !== isEpa).join('／') || '(無)',
  ].join('\n');

const intro = (n: number, what: string) =>
  `以下 ${n} 筆病歷要${what}。

規則整份看 ${README}，照它的〈標準流程〉做，只有第 0 步「拿資料」改成用下面這份 ——
資料已經幫你撈好了，不用再跑 ds_tags.js 的讀模式。

DS 分頁如果有拖進你的分頁群組，第 1 步的標籤改動和第 3 步的已匯出徽章照 README 寫回去；
沒有的話就把該改的標籤、該標記的筆數列出來，我自己在 DS 上點。`;

const pack = (parts: string[]) => parts.join('\n\n');

export function buildCaselogPrompt(records: ChartRecord[], library: string[]): string {
  return pack([
    intro(records.length, '登錄到 emyway Case Log'),
    libraryBlock(library, false),
    '病歷資料：',
    body(records, false),
  ]);
}

export function buildEpaPrompt(records: ChartRecord[], rank: string, library: string[]): string {
  return pack([
    intro(records.length, `填 emyway EPA 學習評量，年資一律 ${rank}`),
    libraryBlock(library, true),
    '病歷資料：',
    body(records, true),
  ]);
}

// 每次要跟 Claude 說的那句話。規則在 README，這裡只交代「哪一種表單、哪些筆、年資」。
export function buildOpeningLine(
  kind: 'caselog' | 'epa',
  rank: string | null,
  pickedCount: number
): string {
  const what = kind === 'epa' ? 'EPA 學習評量' : 'Case Log';
  const tab = kind === 'epa' ? 'EPA' : 'Case Log';   // DS 上分頁鈕的字
  return [
    `照 ${README} 跑一輪 ${what}。`,
    `DS 已經開在「病歷紀錄」的 ${tab} 分頁，${
      pickedCount ? `我勾好了 ${pickedCount} 筆` : '我沒有勾選，請取這個分頁底下還沒匯出過的全部'
    }，資料你自己用 ds_tags.js 的讀模式撈。`,
    kind === 'epa' ? `年資 ${rank}。EPA 的「完成表單」不要按，填完停著等我確認。` : '',
    '開工前先把筆數和病歷號念一遍給我確認。',
  ]
    .filter(Boolean)
    .join('\n');
}

// 年資自動算：2026 年 8 月起 R1，之後每年 8 月升一階（住院醫師年度 8/1 換）。
// 上限 R5 —— emyway 表單只到 R5，真的升上去就不會再用這個工具了。
// 邊界：2026-07 → R1（還沒開始也先當 R1）、2026-08 → R1、2027-07 → R1、2027-08 → R2。
export const currentRank = (now = new Date()): string => {
  const year = now.getFullYear() - (now.getMonth() < 7 ? 1 : 0);   // getMonth() 從 0 起算，7 = 八月
  return 'R' + Math.min(5, Math.max(1, year - 2026 + 1));
};

// ---- 從 emyway 匯回 DS ----

export interface NewRecord {
  mrn?: string;
  name?: string;
  tags?: string[];
  note?: string;
  createdAt?: string;
  caselogDone?: boolean;
  epaDone?: boolean;
}

export interface AddReport {
  added: { mrn: string; name: string; tags: string[] }[];
  skipped: { mrn: string; why: string }[];
  unknownTags: string[];
}

/**
 * 把 emyway 上已經填過的紀錄補進 DS。只新增、不覆蓋 ——
 * 病歷號已經存在的一律跳過並回報，免得蓋掉手打的病歷內文。
 * 同一個病人有多筆 emyway 紀錄時，呼叫端要自己先合併成一筆再送進來。
 */
export function buildNewRecords(
  records: ChartRecord[],
  library: string[],
  list: NewRecord[]
): { next: ChartRecord[]; report: AddReport } {
  if (!Array.isArray(list)) throw new Error('list 必須是陣列');

  const seen = new Set(records.map(r => r.mrn.trim()).filter(Boolean));
  const report: AddReport = { added: [], skipped: [], unknownTags: [] };
  const fresh: ChartRecord[] = [];

  list.forEach((x, i) => {
    const mrn = String(x?.mrn ?? '').trim();
    const name = String(x?.name ?? '').trim();
    const tags = Array.from(new Set(x?.tags ?? []));
    const bad = tags.filter(t => !library.includes(t));

    if (!mrn && !name) {
      report.skipped.push({ mrn: `(第 ${i + 1} 筆)`, why: '沒有病歷號也沒有姓名' });
      return;
    }
    if (mrn && seen.has(mrn)) {
      report.skipped.push({ mrn, why: 'DS 已經有這個病歷號，沒有覆蓋' });
      return;
    }
    if (bad.length) {
      report.unknownTags.push(...bad);
      report.skipped.push({ mrn: mrn || name, why: `標籤不在標籤庫：${bad.join('、')}` });
      return;
    }

    if (mrn) seen.add(mrn);
    fresh.push({
      id: `chart-${Date.now()}-${i}`,
      mrn,
      name,
      tags,
      note: String(x?.note ?? ''),
      createdAt: x?.createdAt ? new Date(x.createdAt).toISOString() : new Date().toISOString(),
      caselogDone: !!x?.caselogDone,
      epaDone: !!x?.epaDone,
    });
    report.added.push({ mrn, name, tags });
  });

  report.unknownTags = Array.from(new Set(report.unknownTags));
  return { next: fresh.length ? [...fresh, ...records] : records, report };
}
