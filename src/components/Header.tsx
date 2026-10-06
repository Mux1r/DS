/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { DutyState, SyncStatus, Shift } from '../types';
import { generateHandoverText, exportJSON } from '../utils';
import { version } from '@/package.json';
import {
  ClipboardCopy,
  Download,
  Upload,
  Check,
  AlertCircle,
  Trash2,
  X,
  Settings,
  RotateCw,
  ChevronRight,
  ClipboardCheck,
  Pencil,
  CalendarDays,
  Sun,
  Moon
} from 'lucide-react';

interface HeaderProps {
  state: DutyState;
  syncStatus: SyncStatus;
  onImport: (newState: DutyState) => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  user?: User | null;
  onSignOut?: () => void;
  availableShifts?: Shift[];
  selectedShiftId?: string;
  onSelectShift?: (id: string) => void;
  onEditShift?: (id: string, startDate: string, endDate: string) => void;
  onDeleteShift?: (id: string) => void;
}

const TILE = 'flex flex-col items-start justify-between gap-3 p-3.5 min-h-[88px] rounded-2xl bg-slate-50 border border-slate-150 hover:border-slate-300 transition-all cursor-pointer active:scale-[0.98] text-left';
const TILE_ICON = 'w-8 h-8 rounded-xl flex items-center justify-center shrink-0';

export default function Header({ state, syncStatus, onImport, isSidebarOpen, setIsSidebarOpen, isDarkMode, onToggleDarkMode, user, onSignOut, availableShifts = [], selectedShiftId = '', onSelectShift, onEditShift, onDeleteShift }: HeaderProps) {
  const [copiedHandover, setCopiedHandover] = useState(false);
  const [copiedRaw, setCopiedRaw] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isShiftSectionOpen, setIsShiftSectionOpen] = useState(false);

  // Live digital clock
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Esc closes the import modal, or the sidebar drawer itself
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (showImportModal) setShowImportModal(false);
      else if (isSidebarOpen) setIsSidebarOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [showImportModal, isSidebarOpen, setIsSidebarOpen]);

  const formatLocalDate = (d: Date) => {
    const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric', 
      weekday: 'short' 
    };
    return d.toLocaleDateString('zh-TW', options);
  };

  const formatLocalTime = (d: Date) => {
    return d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  };

  const handleCopyHandover = () => {
    const text = generateHandoverText(state);
    navigator.clipboard.writeText(text);
    setCopiedHandover(true);
    setTimeout(() => setCopiedHandover(false), 2000);
  };

  const handleCopyRaw = () => {
    const jsonStr = exportJSON(state);
    navigator.clipboard.writeText(jsonStr);
    setCopiedRaw(true);
    setTimeout(() => setCopiedRaw(false), 2000);
  };

  const triggerDownload = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(exportJSON(state));
    const downloadAnchor = document.createElement('a');
    const dateStr = new Date().toISOString().substring(0, 10);
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `DutyShift_Backup_${dateStr}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportSubmit = () => {
    try {
      const parsed = JSON.parse(importText);
      if (typeof parsed === 'object' && parsed !== null) {
        if ('newPatients' in parsed || 'generalOrders' in parsed || 'handoverPatients' in parsed) {
          onImport({
            newPatients: parsed.newPatients || [],
            generalOrders: parsed.generalOrders || [],
            handoverPatients: parsed.handoverPatients || [],
          });
          setShowImportModal(false);
          setImportText('');
          setImportError('');
          setIsSidebarOpen(false); // Clean drawer on success
        } else {
          setImportError('格式不正確：缺少關鍵病人清單欄位。');
        }
      } else {
        setImportError('格式不正確：請輸入有效的 JSON 對象。');
      }
    } catch (e) {
      setImportError('JSON 語法解析失敗，請確認貼上內容是否完整。');
    }
  };

  return (
    <>
      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 flex justify-end" id="sidebar-drawer-portal">
          {/* Backdrop Overlay */}
          <div 
            id="sidebar-overlay-bg"
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-300"
            onClick={() => setIsSidebarOpen(false)}
          />

          {/* Sliding Panel */}
          <div 
            id="sidebar-drawer-container"
            className="relative w-full max-w-sm bg-white border-l border-slate-200 h-full flex flex-col shadow-2xl z-10 animate-slide-in-right overflow-hidden"
          >
            {/* Header / Brand details */}
            <div className="px-5 py-4 pt-[calc(env(safe-area-inset-top)+1rem)] border-b border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Settings size={15} className="text-indigo-600 animate-spin-slow" />
                <h3 className="font-bold text-slate-800 text-sm font-sans tracking-tight">設定</h3>
              </div>
              <button
                type="button"
                id="close-sidebar-btn"
                onClick={() => setIsSidebarOpen(false)}
                className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-1.5 rounded-lg transition-all cursor-pointer"
                title="關閉選單"
              >
                <X size={15} />
              </button>
            </div>

            {/* Sidebar Body */}
            <div className="flex-grow overflow-y-auto px-5 py-6 space-y-4 scrollbar-thin">

              {/* USER INFO SECTION */}
              {user && (
                <div className="flex items-center justify-between gap-2 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2 min-w-0">
                    {user.photoURL ? (
                      <img src={user.photoURL} referrerPolicy="no-referrer" alt="" className="w-7 h-7 rounded-full shrink-0 border border-slate-200" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-indigo-600">{(user.displayName || user.email || 'U')[0].toUpperCase()}</span>
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">{user.displayName || '使用者'}</p>
                      <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={onSignOut}
                    className="text-[10px] font-semibold text-slate-400 hover:text-rose-500 hover:bg-rose-50 px-2 py-1 rounded-lg transition-all cursor-pointer shrink-0 border border-transparent hover:border-rose-100"
                  >
                    登出
                  </button>
                </div>
              )}

              {/* 功能磚：兩格小、一格寬交錯排列。字級寫在 span 上（index.css 對 button 設了 font-size: inherit） */}
              <div className="grid grid-cols-2 gap-2.5">
                <button type="button" onClick={onToggleDarkMode} className={TILE}>
                  <span className={`${TILE_ICON} bg-amber-150 text-amber-700`}>
                    {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
                  </span>
                  <span className="text-xs font-semibold text-slate-700">{isDarkMode ? '淺色主題' : '深色主題'}</span>
                </button>
                <button type="button" onClick={() => window.location.reload()} className={TILE}>
                  <span className={`${TILE_ICON} bg-slate-150 text-slate-600`}>
                    <RotateCw size={16} />
                  </span>
                  <span className="text-xs font-semibold text-slate-700">重新整理</span>
                </button>

                <button
                  type="button"
                  id="copy-handover-text-btn"
                  onClick={handleCopyHandover}
                  className={`col-span-2 flex items-center gap-3 p-3.5 rounded-2xl text-white transition-all cursor-pointer active:scale-[0.98] ${
                    copiedHandover ? 'bg-[#5f7f6d]' : 'bg-[#60788c] dark:bg-[#526677] hover:brightness-110'
                  }`}
                >
                  <span className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/20 shrink-0">
                    {copiedHandover ? <Check size={17} className="stroke-[3]" /> : <ClipboardCopy size={17} />}
                  </span>
                  <span className="flex flex-col items-start text-left">
                    <span className="text-sm font-bold">{copiedHandover ? '已複製交班簡報' : '複製交班簡報'}</span>
                    <span className="text-[10px] opacity-75">LINE 格式</span>
                  </span>
                </button>

                <button type="button" id="download-backup-btn" onClick={triggerDownload} className={TILE}>
                  <span className={`${TILE_ICON} bg-emerald-150 text-emerald-700`}>
                    <Download size={16} />
                  </span>
                  <span className="text-xs font-semibold text-slate-700">下載備份</span>
                </button>
                <button
                  type="button"
                  id="upload-backup-btn"
                  onClick={() => { setImportError(''); setShowImportModal(true); }}
                  className={TILE}
                >
                  <span className={`${TILE_ICON} bg-rose-150 text-rose-700`}>
                    <Upload size={16} />
                  </span>
                  <span className="text-xs font-semibold text-slate-700">匯入資料</span>
                </button>

                <button
                  type="button"
                  id="copy-raw-json-btn"
                  onClick={handleCopyRaw}
                  className="col-span-2 flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-150 hover:border-slate-300 transition-all cursor-pointer active:scale-[0.98]"
                >
                  <span className={`${TILE_ICON} bg-violet-100 text-violet-700`}>
                    <ClipboardCheck size={16} />
                  </span>
                  <span className="text-xs font-semibold text-slate-700">複製原始 JSON</span>
                  {copiedRaw && <span className="ml-auto text-[10.5px] text-emerald-600 font-bold">已複製!</span>}
                </button>
              </div>

              {/* SECTION: SHIFT MANAGEMENT */}
              {availableShifts.length > 0 && (
                <div className="space-y-1 pt-3 border-t border-slate-100 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setIsShiftSectionOpen(v => !v)}
                    className="w-full flex items-center gap-1.5 text-[11px] font-bold text-slate-500 mb-2 cursor-pointer"
                  >
                    <CalendarDays size={12} className="text-indigo-500" />
                    <span>值班管理</span>
                    <ChevronRight size={11} className={`ml-auto text-slate-300 transition-transform ${isShiftSectionOpen ? 'rotate-90' : ''}`} />
                  </button>
                  {isShiftSectionOpen && availableShifts.map(shift => {
                    const label = shift.startDate === shift.endDate
                      ? shift.startDate.slice(5).replace('-', '/')
                      : `${shift.startDate.slice(5).replace('-', '/')} – ${shift.endDate.slice(5).replace('-', '/')}`;
                    const isSelected = shift.id === selectedShiftId;

                    if (deleteConfirmId === shift.id) {
                      return (
                        <div key={shift.id} className="bg-rose-50 rounded-xl p-2.5 border border-rose-100">
                          <p className="text-[11px] text-rose-700 font-semibold mb-2">確認刪除「{label}」？</p>
                          <div className="flex gap-1.5 justify-end">
                            <button type="button" onClick={() => setDeleteConfirmId(null)} className="px-2.5 py-1 text-[10px] text-slate-400 hover:bg-slate-100 rounded-lg cursor-pointer">取消</button>
                            <button
                              type="button"
                              onClick={() => { onDeleteShift?.(shift.id); setDeleteConfirmId(null); }}
                              className="px-2.5 py-1 text-[10px] bg-rose-600 text-white font-bold rounded-lg cursor-pointer hover:bg-rose-700"
                            >刪除</button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={shift.id}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl transition-all ${
                          isSelected ? 'bg-indigo-50 border border-indigo-100' : 'hover:bg-slate-50 border border-transparent'
                        }`}
                      >
                        {/* Label — click to switch shift & edit patients in main view */}
                        <button
                          type="button"
                          onClick={() => { onSelectShift?.(shift.id); setIsSidebarOpen(false); }}
                          className="flex-1 flex items-center gap-2 text-left cursor-pointer"
                          title="切換至此班，在主畫面編輯病人"
                        >
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isSelected ? 'bg-indigo-500' : 'bg-slate-300'}`} />
                          <span className={`text-xs font-semibold ${isSelected ? 'text-indigo-700' : 'text-slate-600'}`}>{label}</span>
                        </button>
                        {/* Pencil = navigate to shift for patient editing */}
                        <button
                          type="button"
                          onClick={() => { onSelectShift?.(shift.id); setIsSidebarOpen(false); }}
                          className="w-6 h-6 flex items-center justify-center text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer shrink-0"
                          title="切換至此班，編輯病人"
                        >
                          <Pencil size={11} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(shift.id)}
                          className="w-6 h-6 flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all cursor-pointer shrink-0"
                          title="刪除值班"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}


            </div>

            {/* Sidebar Footer */}
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 text-center text-[10px] text-slate-400 font-mono shrink-0">
              Clinical Shift v{version}
            </div>
          </div>
        </div>
      )}

      {/* Backup Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-55 animate-fade-in" id="import-modal-overlay">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-100" id="import-modal-container">
            <div className="bg-slate-50 px-5 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                <Upload size={16} className="text-indigo-600" />
                匯入值班清單資料
              </h3>
              <button 
                id="close-import-modal-btn"
                onClick={() => setShowImportModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-medium"
              >
                ✕
              </button>
            </div>
            <div className="p-5 flex flex-col gap-3">
              <textarea
                id="import-json-textarea"
                value={importText}
                onChange={(e) => {
                  setImportText(e.target.value);
                  setImportError('');
                }}
                placeholder='在此貼上 {"newPatients": [...], ...}'
                className="w-full h-48 border border-slate-200 rounded-xl p-3 text-xs font-mono focus:outline-hidden focus:ring-1 focus:ring-indigo-500 lightbox-textarea resize-none bg-slate-50"
              />
              {importError && (
                <p className="text-[11px] text-rose-500 flex items-center gap-1 bg-rose-50 p-2 rounded-lg" id="import-error-message">
                  <AlertCircle size={12} />
                  {importError}
                </p>
              )}
              <div className="flex justify-end gap-2 mt-2">
                <button
                  id="cancel-import-btn"
                  onClick={() => setShowImportModal(false)}
                  className="px-3.5 py-1.5 text-xs text-slate-500 hover:bg-slate-100 rounded-lg transition-all"
                >
                  取消
                </button>
                <button
                  id="confirm-import-btn"
                  onClick={handleImportSubmit}
                  disabled={!importText.trim()}
                  className="px-4 py-1.5 text-xs bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-40 rounded-lg transition-all cursor-pointer"
                >
                  確認載入
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </>
  );
}
