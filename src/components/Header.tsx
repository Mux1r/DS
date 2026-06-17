/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { DutyState, SyncStatus, Shift } from '../types';
import { generateHandoverText, exportJSON } from '../utils';
import {
  ClipboardCopy,
  Download,
  Upload,
  Check,
  AlertCircle,
  Trash2,
  X,
  Settings,
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

export default function Header({ state, syncStatus, onImport, isSidebarOpen, setIsSidebarOpen, isDarkMode, onToggleDarkMode, user, onSignOut, availableShifts = [], selectedShiftId = '', onSelectShift, onEditShift, onDeleteShift }: HeaderProps) {
  const [copiedHandover, setCopiedHandover] = useState(false);
  const [copiedRaw, setCopiedRaw] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Live digital clock
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300"
            onClick={() => setIsSidebarOpen(false)}
          />

          {/* Sliding Panel */}
          <div 
            id="sidebar-drawer-container"
            className="relative w-full max-w-sm bg-white border-l border-slate-200 h-full flex flex-col shadow-2xl z-10 animate-slide-in-right overflow-hidden"
          >
            {/* Header / Brand details */}
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Settings size={15} className="text-indigo-600 animate-spin-slow" />
                <h3 className="font-bold text-slate-800 text-sm font-sans tracking-tight">系統工作控制台</h3>
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

              {/* SECTION: SHIFT MANAGEMENT */}
              {availableShifts.length > 0 && (
                <div className="space-y-1 pt-2 pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 mb-2">
                    <CalendarDays size={12} className="text-indigo-500" />
                    <span>值班管理</span>
                  </div>
                  {availableShifts.map(shift => {
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

              {/* SECTION A: CLINICAL HANDOVER TEXT GENERATOR */}
              <button
                id="copy-handover-text-btn"
                onClick={handleCopyHandover}
                className={`w-full flex items-center justify-center gap-1.5 text-xs py-2.5 px-3 rounded-xl font-bold transition-all cursor-pointer ${
                  copiedHandover 
                    ? 'bg-emerald-650 bg-emerald-600 text-white shadow-sm border border-emerald-600' 
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                }`}
              >
                {copiedHandover ? (
                  <>
                    <Check size={13} className="stroke-[3]" />
                    已複製交班簡報
                  </>
                ) : (
                  <>
                    <ClipboardCopy size={13} />
                    複製交班簡報 (LINE格式)
                  </>
                )}
              </button>

              {/* SECTION B: CLINICAL DATABASE BACKUP & RESTORE */}
              <div className="space-y-2.5 pt-2 border-t border-slate-100" id="backup-action-group">
                {/* Download Backup */}
                <button
                  type="button"
                  id="download-backup-btn"
                  onClick={triggerDownload}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs bg-slate-50 text-slate-700 hover:text-indigo-600 border border-slate-150 rounded-xl transition-all cursor-pointer group font-semibold"
                >
                  <span className="flex items-center gap-1.5">
                    <Download size={13} className="text-slate-400 group-hover:text-indigo-500" />
                    下載 JSON 備份檔
                  </span>
                  <ChevronRight size={11} className="text-slate-300 group-hover:text-indigo-400" />
                </button>

                {/* Upload Import */}
                <button
                  type="button"
                  id="upload-backup-btn"
                  onClick={() => {
                    setImportError('');
                    setShowImportModal(true);
                  }}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs bg-slate-50 text-slate-700 hover:text-indigo-600 border border-slate-150 rounded-xl transition-all cursor-pointer group font-semibold"
                >
                  <span className="flex items-center gap-1.5">
                    <Upload size={13} className="text-slate-400 group-hover:text-indigo-500" />
                    歷史資料庫匯入
                  </span>
                  <ChevronRight size={11} className="text-slate-300 group-hover:text-indigo-400" />
                </button>

                {/* Copy JSON Raw Text */}
                <button
                  type="button"
                  id="copy-raw-json-btn"
                  onClick={handleCopyRaw}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs bg-slate-50 text-slate-700 hover:text-indigo-600 border border-slate-150 rounded-xl transition-all cursor-pointer group font-semibold"
                >
                  <span className="flex items-center gap-1.5">
                    <ClipboardCheck size={13} className="text-slate-400 group-hover:text-indigo-500" />
                    複製原始 JSON 字串
                  </span>
                  {copiedRaw ? (
                    <span className="text-[10.5px] text-emerald-600 font-bold">已複製!</span>
                  ) : (
                    <ChevronRight size={11} className="text-slate-300 group-hover:text-indigo-400" />
                  )}
                </button>

              </div>

              {/* SECTION C: DISPLAY SETTINGS */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 mb-2">
                  {isDarkMode ? <Moon size={12} className="text-slate-400" /> : <Sun size={12} className="text-slate-400" />}
                  <span>顯示設定</span>
                </div>
                <button
                  type="button"
                  onClick={onToggleDarkMode}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs bg-slate-50 text-slate-700 hover:text-indigo-600 border border-slate-150 rounded-xl transition-all cursor-pointer group font-semibold"
                >
                  <span className="flex items-center gap-1.5">
                    {isDarkMode
                      ? <Sun size={13} className="text-amber-500" />
                      : <Moon size={13} className="text-slate-400 group-hover:text-indigo-500" />
                    }
                    {isDarkMode ? '切換淺色主題' : '切換深色主題'}
                  </span>
                  <ChevronRight size={11} className="text-slate-300 group-hover:text-indigo-400" />
                </button>
              </div>

            </div>

            {/* Sidebar Footer */}
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 text-center text-[10px] text-slate-400 font-mono shrink-0">
              Clinical Shift v3.0.0
            </div>
          </div>
        </div>
      )}

      {/* Backup Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-55 animate-fade-in" id="import-modal-overlay">
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
