/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { ChartRecord } from '../types';
import { Plus, Trash2, Check, X, FileText, Tag, Pencil, Send, Eye, EyeOff, MessageSquare } from 'lucide-react';
import { applyTagPatch, buildCaselogPrompt, buildEpaPrompt, buildNewRecords, buildOpeningLine, currentRank, epaCode, hasCaselogTag, hasEpaTag, NewRecord, TagPatch } from '../emyway';
import { formatDate } from '../utils';

interface ChartsTabProps {
  records: ChartRecord[];
  onChange: (next: ChartRecord[]) => void;
  tags: string[];              // 標籤庫（空 = 還沒動過，用下面的預設）
  onTagsChange: (next: string[]) => void;
  search: string;
}

// ponytail: 預設標籤與分類寫死在程式碼；標籤庫本身仍存成一維陣列，
// 分類只用於顯示，改過名或自己加的標籤一律歸到「自訂」
// 標籤分兩種用途：前面幾組對應 emyway Case Log 項目，最後一組 EPA 對應學習評量。
// EPA 標籤的「EPA07」字首就是表單編號，改名時前面那段不要動（見 emyway.ts 的 epaCode）
const PRESET_GROUPS: [string, string[]][] = [
  ['檢查', ['純音聽力', '鼓室圖', 'ABR', '前庭功能', '眼振圖', '內視鏡']],
  ['處置與小手術', ['鼻填塞', '鼓膜切開', '中耳通氣管', '囊腫切除', '鼻骨復位', '氣切', '食道氣管異物', '頭頸外傷', '雷射']],
  ['耳鼻喉手術', ['鼻中隔成型', '扁桃摘除', '鼻竇手術', '鼓室成形', '乳突切除', '喉顯微']],
  ['頭頸腫瘤', ['頸部腫瘤', '顎下腺', '腮腺', '頸廓清', '鼻竇腫瘤', '喉切除', '口腔癌複合切除', '喉氣管重建']],
  ['其他', ['顏面整形重建', '語言治療']],
  ['EPA 學習評量', [
    'EPA01 呼吸道', 'EPA02 異物', 'EPA03 出血', 'EPA04 眩暈', 'EPA05 感染', 'EPA06 頭頸腫塊',
    'EPA07 耳與聽力', 'EPA08 鼻與鼻竇', 'EPA09 咽喉', 'EPA10 睡眠呼吸', 'EPA11 顏面整形', 'EPA12 口頭報告',
  ]],
];
const PRESET_TAGS = PRESET_GROUPS.flatMap(([, ts]) => ts);

const EMPTY = { mrn: '', name: '', tags: [] as string[], note: '' };

// Case Log 靛藍、EPA 琥珀 —— 一眼看得出現在在哪一種表單上。
// class 必須寫死字面值，Tailwind 不會生成拼接出來的名稱。
const ACCENT = {
  caselog: {
    tab: 'bg-white text-indigo-700 shadow-xs',
    chipOn: 'bg-indigo-600 text-white border-indigo-600',
    btn: 'bg-indigo-600 hover:bg-indigo-700',
    bar: 'bg-indigo-50 border-indigo-200',
    barText: 'text-indigo-900',
    card: 'bg-indigo-50/70 border-indigo-300',
    hover: 'hover:border-indigo-200',
    check: 'bg-indigo-600 border-indigo-600 text-white',
    badge: 'text-indigo-700 bg-indigo-50 border-indigo-200',
    count: 'text-indigo-500',
  },
  epa: {
    tab: 'bg-white text-amber-700 shadow-xs',
    chipOn: 'bg-amber-700 text-white border-amber-700',
    btn: 'bg-amber-700 hover:bg-amber-800',
    bar: 'bg-amber-50 border-amber-200',
    barText: 'text-amber-900',
    card: 'bg-amber-50/70 border-amber-300',
    hover: 'hover:border-amber-200',
    check: 'bg-amber-700 border-amber-700 text-white',
    badge: 'text-amber-800 bg-amber-50 border-amber-200',
    count: 'text-amber-600',
  },
} as const;

export default function ChartsTab({ records, onChange, tags, onTagsChange, search }: ChartsTabProps) {
  // 'new' = 正在新增；其他字串 = 正在編輯該筆
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  // 卡片右半邊 = 只看不編輯：展開完整病歷內容（左半邊仍然是進編輯表單）
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [manageTags, setManageTags] = useState(false);
  // 開場白複製後短暫換字，比跳 alert 不擾人
  const [copied, setCopied] = useState(false);
  // null = 一般模式；Set = 匯出勾選模式，內含被勾起來的紀錄 id
  const [picking, setPicking] = useState<Set<string> | null>(null);
  // 兩個工作視角，各自對應一種 emyway 表單
  const [kind, setKind] = useState<'caselog' | 'epa'>(
    () => (localStorage.getItem('charts_kind') === 'epa' ? 'epa' : 'caselog')
  );
  const isEpaTab = kind === 'epa';
  const accent = ACCENT[kind];
  // 編輯表單裡的標籤區也分兩邊，開表單時預設停在外層 tab 那一側
  const [formTagKind, setFormTagKind] = useState<'caselog' | 'epa'>(kind);
  const isEpaForm = formTagKind === 'epa';
  const formAccent = ACCENT[formTagKind];

  const library = tags.length ? tags : PRESET_TAGS;
  // 每個標籤的人數：同一個病人（病歷號優先，沒有就用姓名）在同一標籤下只算一次
  const tagPeople = new Map<string, Set<string>>();
  records.forEach(r => {
    const person = (r.mrn || r.name).trim();
    if (!person) return;
    r.tags.forEach(t => {
      if (!tagPeople.has(t)) tagPeople.set(t, new Set());
      tagPeople.get(t)!.add(person);
    });
  });
  const countOf = (t: string) => tagPeople.get(t)?.size ?? 0;

  // ponytail: 給 Claude 用 javascript_tool 讀寫的橋接口，搭配 OneDrive/emyway-scripts/ds_tags.js。
  // 改標籤一律走 onChange，所以照原本的路徑同步到 Firebase，不必另外處理儲存。
  // 只在病歷模式（本元件掛著時）存在，離開就拆掉。
  useEffect(() => {
    (window as any).__ds = {
      library: () => [...library],
      mode: () => kind,
      // 沒進勾選模式時回空陣列，腳本那邊會退回「這個 tab 還沒匯出過的全部」
      selected: () => (picking ? [...picking] : []),
      records: () => records.map(r => ({
        id: r.id, mrn: r.mrn, name: r.name, tags: [...r.tags], note: r.note, createdAt: r.createdAt,
        caselogDone: !!r.caselogDone, epaDone: !!r.epaDone,
      })),
      setTags: (patch: TagPatch[]) => {
        const { next, report } = applyTagPatch(records, library, patch);
        if (report.updated) onChange(next);
        return report;
      },
      // 把 emyway 上已經填過的紀錄補進來（只新增不覆蓋）
      addRecords: (list: NewRecord[]) => {
        const { next, report } = buildNewRecords(records, library, list);
        if (report.added.length) onChange(next);
        return report;
      },
      // 填完 emyway 之後補上已匯出徽章 —— 不走複製按鈕的話沒別人會標
      markDone: (ids: string[], which: 'caselog' | 'epa', done = true) => {
        if (which !== 'caselog' && which !== 'epa') throw new Error("which 必須是 'caselog' 或 'epa'");
        const flag = which === 'epa' ? 'epaDone' : 'caselogDone';
        const want = new Set(ids ?? []);
        const known = new Set(records.map(r => r.id));
        const unknownIds = [...want].filter(id => !known.has(id));
        const updated = records.filter(r => want.has(r.id)).length;
        if (updated) onChange(records.map(r => (want.has(r.id) ? { ...r, [flag]: done } : r)));
        return { updated, unknownIds };
      },
    };
    return () => { delete (window as any).__ds; };
  }, [records, library, kind, picking, onChange]);

  // 標籤庫全部都列出來，加上紀錄上還留著、但已從標籤庫刪掉的殘留標籤
  const allTags = Array.from(new Set([...library, ...records.flatMap(r => r.tags)]))
    .filter(t => !!epaCode(t) === isEpaTab)
    .sort((a, b) => countOf(b) - countOf(a) || a.localeCompare(b));
  // 分類顯示：預設群組（只留還在標籤庫裡、且屬於表單目前這一側的）＋ 自訂
  // 自訂標籤沒有 EPA 字首就一律算 Case Log，所以「+」只放在 Case Log 側，免得新增完看不到
  const inFormSide = (t: string) => !!epaCode(t) === isEpaForm;
  const groups: [string, string[]][] = [
    ...PRESET_GROUPS.map(([g, ts]) => [g, ts.filter(t => library.includes(t) && inFormSide(t))] as [string, string[]]),
    ['自訂', library.filter(t => !PRESET_TAGS.includes(t) && inFormSide(t))] as [string, string[]],
  ].filter(([g, ts]) => ts.length > 0 || (g === '自訂' && !isEpaForm));

  // 還沒上任何標籤的紀錄兩個 tab 都看得到，免得剛記完的病人找不到
  const inKind = (r: ChartRecord) => (!r.tags.length ? true : isEpaTab ? hasEpaTag(r) : hasCaselogTag(r));

  const q = search.trim().toLowerCase();
  const visible = records
    .filter(r => {
      if (!inKind(r)) return false;
      if (tagFilter && !r.tags.includes(tagFilter)) return false;
      if (!q) return true;
      return [r.mrn, r.name, r.note, ...r.tags].join(' ').toLowerCase().includes(q);
    })
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  // 表單裡有沒有還沒存的東西：新增時看有沒有填過字，編輯時跟原紀錄比對
  const formDirty = () => {
    if (editingId === null) return false;
    const mrn = form.mrn.trim(), name = form.name.trim(), note = form.note.trim();
    if (editingId === 'new') return !!(mrn || name || note || form.tags.length);
    const r = records.find(x => x.id === editingId);
    if (!r) return false;
    return mrn !== r.mrn.trim() || name !== r.name.trim() || note !== r.note.trim()
      || form.tags.length !== r.tags.length || form.tags.some(t => !r.tags.includes(t));
  };
  // 誤觸「新增」或點到別筆紀錄時，先確認要不要丟掉編輯中的內容
  const confirmDiscard = () =>
    !formDirty() || window.confirm('目前編輯中的內容還沒儲存，離開就會不見。確定要放棄嗎？');

  const openNew = () => {
    if (!confirmDiscard()) return;
    setForm(EMPTY);
    setFormTagKind(kind);
    setEditingId('new');
  };
  const openEdit = (r: ChartRecord) => {
    if (r.id !== editingId && !confirmDiscard()) return;
    setForm({ mrn: r.mrn, name: r.name, tags: [...r.tags], note: r.note });
    setFormTagKind(kind);
    setEditingId(r.id);
  };

  const toggleTag = (t: string) =>
    setForm(f => ({ ...f, tags: f.tags.includes(t) ? f.tags.filter(x => x !== t) : [...f.tags, t] }));

  const addTag = () => {
    const t = window.prompt('新增標籤名稱')?.trim();
    if (!t) return;
    if (!library.includes(t)) onTagsChange([...library, t]);
    setForm(f => (f.tags.includes(t) ? f : { ...f, tags: [...f.tags, t] }));
  };

  const renameTag = (old: string) => {
    const next = window.prompt('修改標籤名稱', old)?.trim();
    if (!next || next === old) return;
    onTagsChange(library.map(t => (t === old ? next : t)));
    onChange(records.map(r => ({ ...r, tags: r.tags.map(t => (t === old ? next : t)) })));
    setForm(f => ({ ...f, tags: f.tags.map(t => (t === old ? next : t)) }));
  };

  const deleteTag = (t: string) => {
    if (!window.confirm(`刪除標籤「${t}」？已使用的紀錄也會一併移除這個標籤。`)) return;
    onTagsChange(library.filter(x => x !== t));
    onChange(records.map(r => ({ ...r, tags: r.tags.filter(x => x !== t) })));
    setForm(f => ({ ...f, tags: f.tags.filter(x => x !== t) }));
    if (tagFilter === t) setTagFilter(null);
  };

  const save = () => {
    const base = { mrn: form.mrn.trim(), name: form.name.trim(), tags: form.tags, note: form.note };
    if (!base.mrn && !base.name) return;
    if (editingId === 'new') {
      // 病歷不綁值班，建立當下直接寫入日期
      onChange([{ id: `chart-${Date.now()}`, ...base, createdAt: new Date().toISOString() }, ...records]);
    } else {
      onChange(records.map(r => (r.id === editingId ? { ...r, ...base } : r)));
    }
    setEditingId(null);
  };

  const remove = (id: string) => {
    if (!window.confirm('確定刪除這筆病歷紀錄？')) return;
    onChange(records.filter(r => r.id !== id));
    setEditingId(null);
  };

  const startPicking = () => {
    if (!confirmDiscard()) return;
    setEditingId(null);
    // 預設幫忙勾好目前看得到、這個 tab 還沒匯出過的
    setPicking(new Set(visible.filter(r => !(isEpaTab ? r.epaDone : r.caselogDone)).map(r => r.id)));
  };

  const switchKind = (k: 'caselog' | 'epa') => {
    if (k === kind || !confirmDiscard()) return;
    setEditingId(null);
    setPicking(null);
    setTagFilter(null);
    setKind(k);
    localStorage.setItem('charts_kind', k);
  };

  const togglePick = (id: string) =>
    setPicking(p => {
      const next = new Set(p);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const unmark = (id: string, flag: 'caselogDone' | 'epaDone') =>
    onChange(records.map(r => (r.id === id ? { ...r, [flag]: false } : r)));

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      window.alert('複製失敗，請確認瀏覽器允許存取剪貼簿。');
      return false;
    }
  };

  // 每次要跟 Claude 說的開場白 —— 資料他自己從 DS 讀，這裡只交代做哪一種、哪些筆
  const copyOpening = async () => {
    const text = buildOpeningLine(kind, isEpaTab ? currentRank() : null, picking?.size ?? 0);
    if (!(await copy(text))) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  // 實際填表在 Claude 那邊，這裡無從得知成敗 → 複製成功就先標記，標記可點掉重來
  const exportTo = async () => {
    const selected = records
      .filter(r => picking?.has(r.id))
      .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
    // 沒標籤的也照送 —— 指令包第一步會讓 Claude 依病歷內文重判標籤並寫回 DS
    const picked = selected;
    if (!picked.length) {
      window.alert('沒有勾選任何紀錄。');
      return;
    }
    const untagged = selected.filter(r => !(isEpaTab ? hasEpaTag(r) : hasCaselogTag(r))).length;

    let text: string;
    if (isEpaTab) {
      text = buildEpaPrompt(picked, currentRank(), library);
    } else {
      text = buildCaselogPrompt(picked, library);
    }

    if (!(await copy(text))) return;

    const flag = isEpaTab ? 'epaDone' : 'caselogDone';
    const done = new Set(picked.map(r => r.id));
    onChange(records.map(r => (done.has(r.id) ? { ...r, [flag]: true } : r)));
    setPicking(null);
    window.alert(
      `已複製 ${picked.length} 筆的 ${isEpaTab ? 'EPA' : 'Case Log'} 指令包，貼給 Claude 即可。` +
        (untagged ? `\n（其中 ${untagged} 筆還沒標籤，Claude 會依病歷內容判斷後寫回）` : '')
    );
  };

  const renderForm = () => (
    <div className="flex flex-col gap-2 bg-slate-50 border border-slate-200 rounded-xl p-3">
      <div className="flex flex-wrap gap-2">
        {/* 左欄：病歷號、姓名、標籤 */}
        <div className="flex flex-col gap-2 min-w-0 flex-1 basis-64">
          <div className="flex gap-2">
            <input
              type="text"
              value={form.mrn}
              onChange={e => setForm({ ...form, mrn: e.target.value })}
              placeholder="病歷號"
              autoComplete="off"
              autoFocus
              className="w-32 text-sm font-mono font-bold px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-200"
            />
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="姓名"
              autoComplete="off"
              className="flex-1 min-w-0 text-sm px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-200"
            />
          </div>

          {/* 標籤多選 */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <Tag size={11} className="text-slate-400" />
              <span className="text-[11px] font-semibold text-slate-500">標籤</span>
              <span className="text-[11px] text-slate-400 tabular-nums">已選 {form.tags.length}</span>
              <button
                type="button"
                onClick={() => setManageTags(v => !v)}
                className={`ml-auto flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer ${
                  manageTags ? 'bg-slate-200 text-slate-700' : 'text-slate-400 hover:bg-slate-100'
                }`}
              >
                <Pencil size={9} /> {manageTags ? '完成' : '管理'}
              </button>
            </div>

            <div className="flex gap-1 p-0.5 bg-slate-100 rounded-lg">
              {([['caselog', 'Case Log'], ['epa', 'EPA']] as const).map(([k, label]) => {
                const n = form.tags.filter(t => !!epaCode(t) === (k === 'epa')).length;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setFormTagKind(k)}
                    className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 text-[11px] font-bold rounded-md transition-colors cursor-pointer ${
                      formTagKind === k ? ACCENT[k].tab : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {label}
                    {n > 0 && <span className={`tabular-nums ${ACCENT[k].count}`}>{n}</span>}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-2 max-h-52 overflow-y-auto p-2 bg-white border border-slate-200 rounded-lg">
              {groups.map(([g, ts]) => (
                <div key={g} className="flex flex-wrap items-center gap-1">
                  <span className="w-full text-[10px] font-semibold text-slate-400">{g}</span>
                  {ts.map(t => {
                    const on = form.tags.includes(t);
                    return (
                      <span
                        key={t}
                        className={`flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full border transition-colors ${
                          on ? formAccent.chipOn : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <button type="button" onClick={() => toggleTag(t)} title={`${t}：${countOf(t)} 人`} className="flex items-center gap-1 cursor-pointer">
                          {t}
                          {countOf(t) > 0 && (
                            <span className={`tabular-nums ${on ? 'text-white/70' : 'text-slate-400'}`}>{countOf(t)}</span>
                          )}
                        </button>
                        {manageTags && (
                          <>
                            <button type="button" title="改名" onClick={() => renameTag(t)} className="opacity-60 hover:opacity-100 cursor-pointer">
                              <Pencil size={9} />
                            </button>
                            <button type="button" title="刪除標籤" onClick={() => deleteTag(t)} className="opacity-60 hover:opacity-100 cursor-pointer">
                              <X size={10} />
                            </button>
                          </>
                        )}
                      </span>
                    );
                  })}
                  {/* 新增標籤：接在最後一組標籤後面的 + */}
                  {g === '自訂' && !isEpaForm && (
                    <button
                      type="button"
                      onClick={addTag}
                      title="新增標籤"
                      className="flex items-center justify-center w-5 h-5 rounded-full border border-dashed border-slate-300 text-slate-400 hover:border-indigo-400 hover:text-indigo-500 transition-colors cursor-pointer"
                    >
                      <Plus size={11} className="stroke-[3]" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

        </div>
        {/* 右欄：病歷內容，撐到跟左欄一樣高 */}
        <div className="flex flex-col min-w-0 flex-1 basis-64">
          <textarea
            value={form.note}
            onChange={e => setForm({ ...form, note: e.target.value })}
            rows={5}
            placeholder="病歷紀錄…"
            className="w-full flex-1 min-h-40 text-sm px-2.5 py-2 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-200 resize-none leading-relaxed"
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        {editingId && editingId !== 'new' ? (
          <button
            type="button"
            onClick={() => remove(editingId)}
            className="flex items-center gap-1 px-2 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
          >
            <Trash2 size={12} /> 刪除
          </button>
        ) : <span />}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => { if (confirmDiscard()) setEditingId(null); }}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X size={12} /> 取消
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!form.mrn.trim() && !form.name.trim()}
            className={`flex items-center gap-1 px-3 py-1.5 text-xs font-bold ${accent.btn} disabled:opacity-40 text-white rounded-lg transition-all cursor-pointer`}
          >
            <Check size={12} className="stroke-[3]" /> 儲存
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div id="panel-charts" className="flex flex-col gap-2.5 bg-white rounded-xl p-3 border border-slate-150/80 shadow-xs">
      {/* 標題列：筆數 + 新增 */}
      <div className="flex items-center gap-2">
        <FileText size={13} className="text-indigo-500" />
        <span className="text-sm font-bold text-slate-800">病歷紀錄</span>
        <span className="text-xs text-slate-400 tabular-nums">{visible.length} / {records.length}</span>
        <button
          type="button"
          onClick={copyOpening}
          title={`複製要跟 Claude 說的那句話（${isEpaTab ? 'EPA' : 'Case Log'}）`}
          className="ml-auto flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition-all active:scale-95 cursor-pointer"
        >
          {copied ? <><Check size={11} className="stroke-[3]" /> 已複製</> : <><MessageSquare size={11} /> 開場白</>}
        </button>
        <button
          type="button"
          onClick={() => (picking ? setPicking(null) : startPicking())}
          className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all active:scale-95 cursor-pointer ${
            picking ? 'bg-slate-200 text-slate-700 hover:bg-slate-300' : 'text-slate-500 hover:bg-slate-100'
          }`}
        >
          {picking ? <><X size={11} className="stroke-[3]" /> 取消</> : <><Send size={11} /> 匯出</>}
        </button>
        {!picking && (
          <button
            type="button"
            onClick={openNew}
            className={`flex items-center gap-1 px-2.5 py-1.5 ${accent.btn} text-white text-xs font-bold rounded-lg transition-all active:scale-95 cursor-pointer`}
          >
            <Plus size={11} className="stroke-[3]" /> 新增
          </button>
        )}
      </div>

      {/* 兩個工作視角：清單與標籤篩選列只留該類，還沒上標籤的兩邊都看得到 */}
      <div className="flex gap-1 p-0.5 bg-slate-100 rounded-lg">
        {([['caselog', 'Case Log'], ['epa', 'EPA']] as const).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => switchKind(k)}
            className={`flex-1 px-3 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer ${
              kind === k ? ACCENT[k].tab : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 匯出模式：把勾選的病歷整理成給 Claude 的指令包，複製到剪貼簿 */}
      {picking && (
        <div className={`flex items-center gap-1.5 border rounded-xl px-3 py-2 ${accent.bar}`}>
          <span className={`text-xs font-semibold tabular-nums ${accent.barText}`}>已選 {picking.size} 筆</span>
          {isEpaTab && (
            <span className="text-xs text-amber-700/70 tabular-nums">年資 {currentRank()}</span>
          )}
          <button
            type="button"
            onClick={exportTo}
            disabled={picking.size === 0}
            className={`ml-auto px-2.5 py-1.5 text-xs font-bold ${accent.btn} disabled:opacity-40 text-white rounded-lg transition-all active:scale-95 cursor-pointer`}
          >
            複製 {isEpaTab ? 'EPA' : 'Case Log'} 指令包
          </button>
        </div>
      )}

      {/* 標籤篩選（全部標籤都列，附各標籤人數，多的排前面，沒人的淡化）*/}
      {allTags.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          <Tag size={11} className="text-slate-400 shrink-0" />
          {allTags.map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTagFilter(tagFilter === t ? null : t)}
              title={`${t}：${countOf(t)} 人`}
              className={`flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full border transition-colors cursor-pointer ${
                tagFilter === t
                  ? accent.chipOn
                  : countOf(t) === 0
                    ? 'bg-white text-slate-400 border-slate-150 hover:bg-slate-50'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {t}
              <span className={`tabular-nums ${tagFilter === t ? 'text-white/70' : 'text-slate-400'}`}>{countOf(t)}</span>
            </button>
          ))}
        </div>
      )}

      {editingId === 'new' && renderForm()}

      {visible.length === 0 && editingId !== 'new' ? (
        <p className="text-xs text-slate-400 italic py-6 text-center">
          {records.length === 0 ? '尚無病歷紀錄，按「新增」開始。' : '沒有符合的紀錄。'}
        </p>
      ) : (
        visible.map(r =>
          editingId === r.id ? (
            <div key={r.id}>{renderForm()}</div>
          ) : (
            <div
              key={r.id}
              onClick={e => {
                // 正在選取文字（想複製病歷內容）時放開滑鼠也會觸發 click，這裡不當成點擊
                if (window.getSelection()?.toString()) return;
                if (picking) { togglePick(r.id); return; }
                const box = e.currentTarget.getBoundingClientRect();
                // 沒有內容可看的（note 是空的）整張卡都當左半邊處理，免得點了沒反應
                if (r.note && e.clientX - box.left > box.width / 2) setPreviewId(previewId === r.id ? null : r.id);
                else openEdit(r);
              }}
              className={`flex flex-wrap gap-2 p-2.5 border rounded-xl transition-colors cursor-pointer ${
                picking?.has(r.id)
                  ? accent.card
                  : `bg-slate-50/60 border-slate-150 ${accent.hover}`
              }`}
            >
              {picking && (
                <span
                  className={`mt-0.5 flex items-center justify-center w-4 h-4 shrink-0 rounded border ${
                    picking.has(r.id) ? accent.check : 'bg-white border-slate-300'
                  }`}
                >
                  {picking.has(r.id) && <Check size={11} className="stroke-[3]" />}
                </span>
              )}
              <div className="flex flex-col gap-1.5 min-w-0 flex-1 basis-64">
                <div className="flex items-center gap-2 flex-wrap">
                  {r.mrn && (
                    <span className="font-mono text-sm font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg select-all">
                      {r.mrn}
                    </span>
                  )}
                  {r.name && <span className="text-sm font-semibold text-slate-800">{r.name}</span>}
                  {r.tags.map(t => (
                    <span
                      key={t}
                      className={`px-1.5 py-0.5 text-[10px] font-semibold rounded-full ${
                        epaCode(t) ? 'text-amber-800 bg-amber-100/70' : 'text-slate-600 bg-slate-150/70'
                      }`}
                    >
                      {t}
                    </span>
                  ))}
                  {/* 已匯出徽章：點一下可取消標記 */}
                  <span className="ml-auto flex items-center gap-1 shrink-0">
                    {(
                      [
                        ['caselog', 'caselogDone', 'CL', 'Case Log'],
                        ['epa', 'epaDone', 'EPA', 'EPA 學習評量'],
                      ] as const
                    ).map(
                      ([k, f, label, full]) =>
                        r[f] && (
                          <button
                            key={f}
                            type="button"
                            title={`已匯出到 ${full}，點一下取消標記`}
                            onClick={e => { e.stopPropagation(); unmark(r.id, f); }}
                            className={`px-1.5 py-0.5 text-[10px] font-bold border rounded-full cursor-pointer ${ACCENT[k].badge}`}
                          >
                            {label}
                          </button>
                        )
                    )}
                    {/* 預覽開關：右半邊點擊之外的另一個入口，鍵盤也按得到 */}
                    {r.note && (
                      <button
                        type="button"
                        title={previewId === r.id ? '收合病歷內容' : '預覽病歷內容'}
                        onClick={e => { e.stopPropagation(); setPreviewId(previewId === r.id ? null : r.id); }}
                        className="flex items-center text-slate-300 hover:text-slate-500 transition-colors cursor-pointer"
                      >
                        {previewId === r.id ? <EyeOff size={12} /> : <Eye size={12} />}
                      </button>
                    )}
                    <span className="text-[10px] text-slate-400 tabular-nums">
                      {formatDate(r.createdAt)}
                    </span>
                  </span>
                </div>
              </div>
              {/* 病歷內容：預設完全不顯示，點開才在右邊攤開；太長的用捲軸，免得把卡片撐爆 */}
              {previewId === r.id && r.note && (
                <div className="min-w-0 flex-1 basis-64 max-h-56 overflow-y-auto border-l border-slate-200 pl-2.5">
                  <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">{r.note}</p>
                </div>
              )}
            </div>
          )
        )
      )}
    </div>
  );
}
