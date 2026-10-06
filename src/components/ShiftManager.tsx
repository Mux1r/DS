import { useState } from 'react';
import { X, Pencil, Trash2, Check } from 'lucide-react';
import { Shift } from '../types';

interface Props {
  shifts: Shift[];
  selectedShiftId: string;
  isDarkMode: boolean;
  onSelect: (id: string) => void;
  onEdit: (id: string, startDate: string, endDate: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

const label = (s: Shift) =>
  s.startDate === s.endDate
    ? s.startDate.slice(5).replace('-', '/')
    : `${s.startDate.slice(5).replace('-', '/')} – ${s.endDate.slice(5).replace('-', '/')}`;

// 值班管理懸浮視窗：點一列切換到那班；鉛筆改起訖日期；垃圾桶要再確認一次才刪
export default function ShiftManager({ shifts, selectedShiftId, isDarkMode, onSelect, onEdit, onDelete, onClose }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const beginEdit = (s: Shift) => { setEditingId(s.id); setStart(s.startDate); setEnd(s.endDate); setDeleteId(null); };
  const valid = !!start && !!end && end >= start;
  const save = () => { if (!valid || !editingId) return; onEdit(editingId, start, end); setEditingId(null); };

  const panel = isDarkMode ? 'bg-[#2c2c27] border-white/10 text-[#eaeade]' : 'bg-[#fafaf9] border-[#e8e8e3] text-[#33332d]';
  return (
    <div className="fixed inset-0 z-[180] flex items-start justify-center px-4 pt-[calc(env(safe-area-inset-top)+8vh)]" role="dialog" aria-modal="true" aria-labelledby="shift-manager-title">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className={`relative w-full max-w-md max-h-[80vh] rounded-3xl border shadow-2xl flex flex-col overflow-hidden animate-scale-up ${panel}`}>
        <div className="p-5 border-b border-inherit flex items-center justify-between shrink-0">
          <div>
            <h3 id="shift-manager-title" className="text-sm font-bold">值班管理</h3>
            <p className="text-[11px] mt-0.5 opacity-60">點一班切換過去；鉛筆修改日期</p>
          </div>
          <button type="button" onClick={onClose} aria-label="關閉" className="p-1.5 rounded-full opacity-60 hover:opacity-100 cursor-pointer">
            <X size={16} />
          </button>
        </div>

        {/* 字級寫在外層：index.css 對 button 設了 font-size: inherit */}
        <div className="p-3 space-y-1.5 overflow-y-auto text-sm">
          {shifts.length === 0 && <p className="py-6 text-center text-xs opacity-60">還沒有值班</p>}
          {shifts.map(s => {
            const isSelected = s.id === selectedShiftId;

            if (editingId === s.id) {
              return (
                <div key={s.id} className="p-3 rounded-2xl border border-indigo-200 bg-indigo-50 space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <label className="space-y-1">
                      <span className="block text-[11px] font-semibold opacity-70">開始</span>
                      <input type="date" value={start} onChange={e => setStart(e.target.value)} className="w-full px-2.5 py-2 rounded-xl border border-slate-200 bg-white text-sm" />
                    </label>
                    <label className="space-y-1">
                      <span className="block text-[11px] font-semibold opacity-70">結束</span>
                      <input type="date" value={end} min={start} onChange={e => setEnd(e.target.value)} className="w-full px-2.5 py-2 rounded-xl border border-slate-200 bg-white text-sm" />
                    </label>
                  </div>
                  {!valid && <p role="alert" className="text-[11px] text-rose-600">結束日不能早於開始日</p>}
                  <div className="flex justify-end gap-2 text-xs font-bold">
                    <button type="button" onClick={() => setEditingId(null)} className="px-3 h-8 rounded-xl opacity-70 hover:opacity-100 cursor-pointer">取消</button>
                    <button type="button" onClick={save} disabled={!valid} className="flex items-center gap-1 px-3.5 h-8 rounded-xl bg-[#60788c] text-white disabled:opacity-40 cursor-pointer">
                      <Check size={13} className="stroke-[3]" /> 儲存
                    </button>
                  </div>
                </div>
              );
            }

            if (deleteId === s.id) {
              return (
                <div key={s.id} className="p-3 rounded-2xl border border-rose-200 bg-rose-50">
                  <p className="text-xs font-semibold text-rose-700 mb-2.5">確定刪除「{label(s)}」？會從值班清單移除。</p>
                  <div className="flex justify-end gap-2 text-xs font-bold">
                    <button type="button" onClick={() => setDeleteId(null)} className="px-3 h-8 rounded-xl opacity-70 hover:opacity-100 cursor-pointer">取消</button>
                    <button type="button" onClick={() => { onDelete(s.id); setDeleteId(null); }} className="px-3.5 h-8 rounded-xl bg-[#99696e] text-white cursor-pointer hover:brightness-110">刪除</button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={s.id}
                className={`flex items-center gap-1 pl-1 pr-1.5 rounded-2xl border ${
                  isSelected ? 'bg-indigo-50 border-indigo-200' : 'border-transparent hover:bg-slate-100'
                }`}
              >
                <button type="button" onClick={() => onSelect(s.id)} className="flex-1 flex items-center gap-2.5 px-2.5 py-3 text-left cursor-pointer" title="切換到這班">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${isSelected ? 'bg-indigo-500' : 'bg-slate-300'}`} />
                  <span className={`font-semibold ${isSelected ? 'text-indigo-700' : ''}`}>{label(s)}</span>
                  {isSelected && <span className="text-[10px] font-bold text-indigo-600">目前</span>}
                </button>
                <button type="button" onClick={() => beginEdit(s)} aria-label={`修改 ${label(s)} 的日期`} className="w-9 h-9 flex items-center justify-center rounded-xl opacity-50 hover:opacity-100 hover:bg-indigo-100 cursor-pointer">
                  <Pencil size={14} />
                </button>
                <button type="button" onClick={() => { setDeleteId(s.id); setEditingId(null); }} aria-label={`刪除 ${label(s)}`} className="w-9 h-9 flex items-center justify-center rounded-xl opacity-50 hover:opacity-100 hover:bg-rose-100 hover:text-rose-600 cursor-pointer">
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
