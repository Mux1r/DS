import { useState, type ReactNode } from 'react';
import { X, Star, Pencil, Trash2, Check, Plus } from 'lucide-react';
import { FavoritePatient } from '../types';
import { formatDate } from '../utils';

const MAX_NOTE = 2000;
const panelClass = (dark: boolean) =>
  dark ? 'bg-[#2c2c27] border-white/10 text-[#eaeade]' : 'bg-[#fafaf9] border-[#e8e8e3] text-[#33332d]';
const fieldClass = 'w-full px-3 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-white text-sm outline-none focus:ring-2 focus:ring-[#60788c]/40';

type Draft = Pick<FavoritePatient, 'mrn' | 'bed' | 'diagnosis' | 'note'>;

// 收藏表單：病歷號必填，其他選填。編輯視窗的「收藏」和設定頁的「新增」共用
function DraftForm({ initial, submitLabel, onSubmit, onCancel }: {
  initial: Draft; submitLabel: string; onSubmit: (d: Draft) => void; onCancel: () => void;
}) {
  const [d, setD] = useState(initial);
  const [error, setError] = useState('');
  const set = (k: keyof Draft) => (e: { target: { value: string } }) => { setD({ ...d, [k]: e.target.value }); setError(''); };
  const submit = () => {
    const mrn = d.mrn.trim();
    if (!mrn) return setError('要填病歷號才能收藏');
    if (mrn.length > 20) return setError('病歷號太長了');
    onSubmit({ mrn, bed: d.bed.trim(), diagnosis: d.diagnosis.trim(), note: d.note.slice(0, MAX_NOTE) });
  };
  return (
    <div className="space-y-2.5 text-xs">
      <label className="block space-y-1">
        <span className="font-bold">病歷號 <span className="text-rose-500">*</span></span>
        <input autoFocus inputMode="numeric" value={d.mrn} onChange={set('mrn')} onKeyDown={e => e.key === 'Enter' && submit()} className={`${fieldClass} font-mono`} placeholder="必填" />
      </label>
      <div className="grid grid-cols-[96px_1fr] gap-2">
        <label className="block space-y-1">
          <span className="font-bold opacity-70">床號</span>
          <input value={d.bed} onChange={set('bed')} className={`${fieldClass} font-mono`} />
        </label>
        <label className="block space-y-1">
          <span className="font-bold opacity-70">診斷</span>
          <input value={d.diagnosis} onChange={set('diagnosis')} className={fieldClass} />
        </label>
      </div>
      <label className="block space-y-1">
        <span className="font-bold opacity-70">追蹤筆記</span>
        <textarea value={d.note} onChange={set('note')} rows={3} className={`${fieldClass} resize-none`} placeholder="想追蹤什麼，例如：出院後回診看病理" />
      </label>
      {error && <p role="alert" className="text-rose-600 font-medium">{error}</p>}
      <div className="flex justify-end gap-2 font-bold">
        <button type="button" onClick={onCancel} className="px-3 h-8 rounded-xl opacity-70 hover:opacity-100 cursor-pointer">取消</button>
        <button type="button" onClick={submit} className="flex items-center gap-1 px-3.5 h-8 rounded-xl bg-[#60788c] text-white cursor-pointer hover:brightness-110">
          <Check size={13} className="stroke-[3]" /> {submitLabel}
        </button>
      </div>
    </div>
  );
}

function Modal({ isDarkMode, title, subtitle, onClose, children }: {
  isDarkMode: boolean; title: string; subtitle: string; onClose: () => void; children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[180] flex items-start justify-center px-4 pt-[calc(env(safe-area-inset-top)+8vh)]" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className={`relative w-full max-w-md max-h-[84vh] rounded-3xl border shadow-2xl flex flex-col overflow-hidden animate-scale-up ${panelClass(isDarkMode)}`}>
        <div className="p-5 border-b border-inherit flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-sm font-bold">{title}</h3>
            <p className="text-[11px] mt-0.5 opacity-60">{subtitle}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="關閉" className="p-1.5 rounded-full opacity-60 hover:opacity-100 cursor-pointer">
            <X size={16} />
          </button>
        </div>
        <div className="p-4 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

// 編輯視窗按「收藏」時跳出：帶入目前的床號、診斷、備註，補上病歷號才存
export function FavoritePrompt({ isDarkMode, initial, onSave, onClose }: {
  isDarkMode: boolean; initial: Draft; onSave: (d: Draft) => void; onClose: () => void;
}) {
  return (
    <Modal isDarkMode={isDarkMode} title="收藏病人" subtitle="補上病歷號，之後在設定的「收藏病人」追蹤" onClose={onClose}>
      <DraftForm initial={initial} submitLabel="收藏" onSubmit={d => { onSave(d); onClose(); }} onCancel={onClose} />
    </Modal>
  );
}

// 設定頁的收藏清單：新增、改筆記、刪除（刪除要再按一次確認）
export function FavoritesManager({ isDarkMode, favorites, onChange, onClose }: {
  isDarkMode: boolean; favorites: FavoritePatient[]; onChange: (next: FavoritePatient[]) => void; onClose: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const empty: Draft = { mrn: '', bed: '', diagnosis: '', note: '' };

  return (
    <Modal isDarkMode={isDarkMode} title="收藏病人" subtitle="要後續追蹤的病人，跨值班保存" onClose={onClose}>
      <div className="space-y-2 text-sm">
        {adding ? (
          <div className="p-3 rounded-2xl border border-black/10 dark:border-white/10">
            <DraftForm initial={empty} submitLabel="新增" onCancel={() => setAdding(false)}
              onSubmit={d => { onChange([addFavorite(d), ...favorites]); setAdding(false); }} />
          </div>
        ) : (
          <button type="button" onClick={() => { setAdding(true); setEditingId(null); }}
            className="w-full flex items-center justify-center gap-1.5 h-10 rounded-2xl border border-dashed border-black/20 dark:border-white/20 opacity-80 hover:opacity-100 cursor-pointer">
            <Plus size={14} className="stroke-[3]" /><span className="text-xs font-bold">新增收藏</span>
          </button>
        )}

        {favorites.length === 0 && !adding && (
          <p className="py-6 text-center text-xs opacity-60">還沒有收藏的病人。可以在新病人、醫囑、交班的編輯視窗按「收藏」加進來。</p>
        )}

        {favorites.map(f => {
          if (editingId === f.id) {
            return (
              <div key={f.id} className="p-3 rounded-2xl border border-indigo-200 bg-indigo-50">
                <DraftForm initial={f} submitLabel="儲存" onCancel={() => setEditingId(null)}
                  onSubmit={d => { onChange(favorites.map(x => (x.id === f.id ? { ...x, ...d } : x))); setEditingId(null); }} />
              </div>
            );
          }
          if (deleteId === f.id) {
            return (
              <div key={f.id} className="p-3 rounded-2xl border border-rose-200 bg-rose-50">
                <p className="text-xs font-semibold text-rose-700 mb-2.5">確定取消收藏 {f.mrn}？追蹤筆記也會一起刪掉。</p>
                <div className="flex justify-end gap-2 text-xs font-bold">
                  <button type="button" onClick={() => setDeleteId(null)} className="px-3 h-8 rounded-xl opacity-70 hover:opacity-100 cursor-pointer">取消</button>
                  <button type="button" onClick={() => { onChange(favorites.filter(x => x.id !== f.id)); setDeleteId(null); }}
                    className="px-3.5 h-8 rounded-xl bg-[#99696e] text-white cursor-pointer hover:brightness-110">刪除</button>
                </div>
              </div>
            );
          }
          return (
            <div key={f.id} className="flex gap-2 p-3 rounded-2xl border border-black/10 dark:border-white/10">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg select-all">{f.mrn}</span>
                  {f.bed && <span className="font-mono text-xs opacity-70">{f.bed}</span>}
                  {f.diagnosis && <span className="text-xs font-semibold">{f.diagnosis}</span>}
                  <span className="ml-auto text-[10px] opacity-50 tabular-nums">{formatDate(f.createdAt)}</span>
                </div>
                {f.note && <p className="text-xs leading-relaxed whitespace-pre-wrap opacity-80">{f.note}</p>}
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <button type="button" onClick={() => { setEditingId(f.id); setAdding(false); setDeleteId(null); }} aria-label={`編輯 ${f.mrn}`}
                  className="w-8 h-8 flex items-center justify-center rounded-xl opacity-50 hover:opacity-100 hover:bg-indigo-100 cursor-pointer">
                  <Pencil size={13} />
                </button>
                <button type="button" onClick={() => { setDeleteId(f.id); setEditingId(null); }} aria-label={`取消收藏 ${f.mrn}`}
                  className="w-8 h-8 flex items-center justify-center rounded-xl opacity-50 hover:opacity-100 hover:bg-rose-100 hover:text-rose-600 cursor-pointer">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

export const addFavorite = (d: Draft): FavoritePatient => ({ ...d, id: `fav-${Date.now()}`, createdAt: new Date().toISOString() });

// 編輯視窗頂端的「收藏」鈕（擺在「交班」旁邊）；存完閃一下「已收藏」
export function FavoriteButton({ onClick, justSaved }: { onClick: () => void; justSaved: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="收藏這位病人，之後追蹤"
      className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all active:scale-95 shrink-0 cursor-pointer ${
        justSaved ? 'bg-amber-150 text-amber-800' : 'bg-amber-100 text-amber-800 hover:bg-amber-150'
      }`}
    >
      <Star size={11} className={`stroke-[3] ${justSaved ? 'fill-current' : ''}`} />
      <span>{justSaved ? '已收藏' : '收藏'}</span>
    </button>
  );
}
