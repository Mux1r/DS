/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ChartRecord } from '../types';
import { Plus, Trash2, Check, X, FileText, Tag, Pencil } from 'lucide-react';

interface ChartsTabProps {
  records: ChartRecord[];
  onChange: (next: ChartRecord[]) => void;
  tags: string[];              // 標籤庫（空 = 還沒動過，用下面的預設）
  onTagsChange: (next: string[]) => void;
  search: string;
}

// ponytail: 預設標籤與分類寫死在程式碼；標籤庫本身仍存成一維陣列，
// 分類只用於顯示，改過名或自己加的標籤一律歸到「自訂」
const PRESET_GROUPS: [string, string[]][] = [
  ['檢查', ['純音聽力', '鼓室圖', 'ABR', '前庭功能', '眼振圖', '內視鏡']],
  ['處置與小手術', ['鼻填塞', '鼓膜切開', '中耳通氣管', '囊腫切除', '鼻骨復位', '氣切', '食道氣管異物', '頭頸外傷', '雷射']],
  ['耳鼻喉手術', ['鼻中隔成型', '扁桃摘除', '鼻竇手術', '鼓室成形', '乳突切除', '喉顯微']],
  ['頭頸腫瘤', ['頸部腫瘤', '顎下腺', '腮腺', '頸廓清', '鼻竇腫瘤', '喉切除', '口腔癌複合切除', '喉氣管重建']],
  ['其他', ['顏面整形重建', '語言治療']],
];
const PRESET_TAGS = PRESET_GROUPS.flatMap(([, ts]) => ts);

const EMPTY = { mrn: '', name: '', tags: [] as string[], note: '' };

export default function ChartsTab({ records, onChange, tags, onTagsChange, search }: ChartsTabProps) {
  // 'new' = 正在新增；其他字串 = 正在編輯該筆
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [manageTags, setManageTags] = useState(false);

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

  // 標籤庫全部都列出來，加上紀錄上還留著、但已從標籤庫刪掉的殘留標籤
  const allTags = Array.from(new Set([...library, ...records.flatMap(r => r.tags)]))
    .sort((a, b) => countOf(b) - countOf(a) || a.localeCompare(b));
  // 分類顯示：預設群組（只留還在標籤庫裡的）＋ 自訂（永遠顯示，尾端放 + 鈕）
  const groups: [string, string[]][] = [
    ...PRESET_GROUPS.map(([g, ts]) => [g, ts.filter(t => library.includes(t))] as [string, string[]])
      .filter(([, ts]) => ts.length > 0),
    ['自訂', library.filter(t => !PRESET_TAGS.includes(t))],
  ];

  const q = search.trim().toLowerCase();
  const visible = records
    .filter(r => {
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

  const openNew = () => { if (!confirmDiscard()) return; setForm(EMPTY); setEditingId('new'); };
  const openEdit = (r: ChartRecord) => {
    if (r.id !== editingId && !confirmDiscard()) return;
    setForm({ mrn: r.mrn, name: r.name, tags: [...r.tags], note: r.note });
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

  const renderForm = () => (
    <div className="flex flex-col gap-2 bg-slate-50 border border-slate-200 rounded-xl p-3">
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

        <div className="flex flex-col gap-2 max-h-52 overflow-y-auto p-2 bg-white border border-slate-200 rounded-lg">
          {groups.map(([g, ts]) => (
            <div key={g} className="flex flex-wrap items-center gap-1">
              <span className="w-full text-[10px] font-semibold text-slate-400">{g}</span>
              {ts.map(t => {
                const on = form.tags.includes(t);
                return (
                  <span
                    key={t}
                    className={`flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-full border transition-colors ${
                      on ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <button type="button" onClick={() => toggleTag(t)} title={`${t}：${countOf(t)} 人`} className="flex items-center gap-1 cursor-pointer">
                      {t}
                      {countOf(t) > 0 && (
                        <span className={`tabular-nums ${on ? 'text-indigo-100' : 'text-slate-400'}`}>{countOf(t)}</span>
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
              {g === '自訂' && (
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

      <textarea
        value={form.note}
        onChange={e => setForm({ ...form, note: e.target.value })}
        rows={5}
        placeholder="病歷紀錄…"
        className="w-full text-sm px-2.5 py-2 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-200 resize-y leading-relaxed"
      />

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
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-lg transition-all cursor-pointer"
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
          onClick={openNew}
          className="ml-auto flex items-center gap-1 px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-all active:scale-95 cursor-pointer"
        >
          <Plus size={11} className="stroke-[3]" /> 新增
        </button>
      </div>

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
              className={`flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-full border transition-colors cursor-pointer ${
                tagFilter === t
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : countOf(t) === 0
                    ? 'bg-white text-slate-400 border-slate-150 hover:bg-slate-50'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {t}
              <span className={`tabular-nums ${tagFilter === t ? 'text-indigo-100' : 'text-slate-400'}`}>{countOf(t)}</span>
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
              onClick={() => openEdit(r)}
              className="flex flex-col gap-1.5 p-2.5 bg-slate-50/60 border border-slate-150 rounded-xl hover:border-indigo-200 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2 flex-wrap">
                {r.mrn && (
                  <span className="font-mono text-sm font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg select-all">
                    {r.mrn}
                  </span>
                )}
                {r.name && <span className="text-sm font-semibold text-slate-800">{r.name}</span>}
                {r.tags.map(t => (
                  <span key={t} className="px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 bg-slate-150/70 rounded-full">
                    {t}
                  </span>
                ))}
                <span className="ml-auto text-[10px] text-slate-400 tabular-nums shrink-0">
                  {(r.createdAt || '').slice(0, 10)}
                </span>
              </div>
              {r.note && (
                <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed line-clamp-6">{r.note}</p>
              )}
            </div>
          )
        )
      )}
    </div>
  );
}
