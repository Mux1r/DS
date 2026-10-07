/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { DutyState, SyncStatus, Shift, FavoritePatient } from '../types';
import { generateHandoverText } from '../utils';
import Tour, { TourStep } from './Tour';
import Feedback from './Feedback';
import ShiftManager from './ShiftManager';
import { FavoritesManager } from './Favorites';
import { version } from '@/package.json';
import {
  ClipboardCopy,
  Check,
  X,
  RotateCw,
  CalendarDays,
  Sun,
  Moon,
  HelpCircle,
  MessageSquareWarning,
  Star,
} from 'lucide-react';

interface HeaderProps {
  state: DutyState;
  syncStatus: SyncStatus;
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
  favorites: FavoritePatient[];
  onFavoritesChange: (next: FavoritePatient[]) => boolean;
  appMode: 'duty' | 'charts';
}

// 設定頁照 HMSS 控制中心：半透明毛玻璃卡片。不用 bg-white，深色模式會被 index.css 強制改成實色
const GLASS = 'bg-white/60 dark:bg-white/5 border border-white/80 dark:border-white/10 backdrop-blur-sm';
const GLASS_HOVER = 'hover:bg-white/80 dark:hover:bg-white/10';

// 使用教學的步驟（target 對應畫面元素的 data-tour）
const TOUR_STEPS: TourStep[] = [
  { target: 'shift', title: '值班區間', body: '這裡是目前的值班。今天還沒有值班時旁邊會出現閃爍的「＋」，按下去新增。資料按值班分開存。' },
  { target: 'phone', title: '電話速記', body: '護理師來電時按這裡，打床號和內容，再選要歸到新病人、醫囑、交班或會診。' },
  { target: 'phone-panel', click: '[data-tour="phone"]', shown: '[data-tour="phone-panel"]', undo: '[data-tour="phone-close"]', title: '速記面板',
    body: '打床號、診斷和內容，再按上方的新病人、醫囑、交班或會診，就會直接存到那一區。' },
  { target: 'online', title: '上線號碼', body: '記下這班的上線號碼，只存在這台裝置上。' },
  { target: 'tabs', title: '三個功能', body: '新病人、醫囑、交班。數字是還沒完成的項目數。' },
  { target: 'patient-dots', click: '#tab-btn-new-patients', title: '新病人的三個點',
    body: '每位新病人右邊有三個點：紅＝醫囑、黃＝探視、綠＝病歷，有顏色代表還沒做。做完點一下就變灰。' },
  { target: 'patient-card', click: '[data-tour="patient-more"]', shown: '[data-tour="patient-expand"]', undo: '[data-tour="patient-more"]', title: '展開',
    body: '按最右邊的 ⋮ 展開，三個點會變成有字的按鈕，還可以直接寫備註、加醫囑，不用打開編輯視窗。' },
  { target: 'add', title: '新增', body: '在目前的分頁新增一筆。點卡片可以編輯內容。' },
  // 收藏鈕在編輯視窗裡，教學時畫面上沒有，所以這步沒有框（說明卡置中）
  { target: 'favorite', title: '⭐ 收藏病人', body: '想後續追蹤的病人，在新病人、醫囑、交班的編輯視窗上方按星星，補上病歷號就存起來了。收藏的病人在設定的「收藏病人」查看和寫追蹤筆記。' },
  { target: 'settings', title: '設定', body: '主題、交班簡報、值班管理、收藏病人、這個教學和意見回報都在這裡。' },
];

export default function Header({ state, syncStatus, isSidebarOpen, setIsSidebarOpen, isDarkMode, onToggleDarkMode, user, onSignOut, availableShifts = [], selectedShiftId = '', onSelectShift, onEditShift, onDeleteShift, favorites, onFavoritesChange, appMode }: HeaderProps) {
  const [copiedHandover, setCopiedHandover] = useState(false);
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isFavoritesOpen, setIsFavoritesOpen] = useState(false);
  const [isShiftSectionOpen, setIsShiftSectionOpen] = useState(false);

  // Live digital clock
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Esc 關掉最上層：先回報視窗，再設定頁（教學自己處理 Esc）
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (isFeedbackOpen) setIsFeedbackOpen(false);
      else if (isFavoritesOpen) setIsFavoritesOpen(false);
      else if (isShiftSectionOpen) setIsShiftSectionOpen(false);
      else if (isSidebarOpen && !isTourOpen) setIsSidebarOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isFeedbackOpen, isFavoritesOpen, isShiftSectionOpen, isSidebarOpen, isTourOpen, setIsSidebarOpen]);

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

  return (
    <>
      {isSidebarOpen && (
        <div
          id="sidebar-drawer-portal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-title"
          className="fixed inset-0 z-50 flex flex-col bg-[#f5f5f2]/30 dark:bg-[#232320]/30 backdrop-blur-md pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] animate-fade-in"
        >
          <div className="shrink-0 border-b border-slate-200/70 dark:border-white/10">
            <div className="max-w-md mx-auto px-4 py-4 flex items-center justify-between">
              <h2 id="settings-title" className="text-base font-bold text-slate-800">設定</h2>
              <button
                type="button"
                id="close-sidebar-btn"
                onClick={() => setIsSidebarOpen(false)}
                aria-label="關閉設定"
                className="p-2 rounded-full text-slate-500 hover:bg-slate-200/60 dark:hover:bg-white/10 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {/* 字級寫在 span 上：index.css 對 button 設了 font-size: inherit */}
            <div className="max-w-md mx-auto px-4 py-6 space-y-5">
              {/* 帳號：一條橫的 */}
              {user && (
                <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl ${GLASS}`}>
                  {user.photoURL ? (
                    <img src={user.photoURL} referrerPolicy="no-referrer" alt="" className="w-10 h-10 rounded-full shrink-0" />
                  ) : (
                    <span className="w-10 h-10 rounded-full bg-indigo-150 flex items-center justify-center shrink-0 text-sm font-bold text-indigo-700">
                      {(user.displayName || user.email || 'U')[0].toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-800 truncate">{user.displayName || user.email}</p>
                    <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${syncStatus.error ? 'bg-rose-500' : syncStatus.isSyncing ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
                      {syncStatus.error ? '同步失敗，請檢查網路' : syncStatus.isSyncing ? '同步中…' : '值班資料已存到雲端'}
                    </p>
                  </div>
                  <button type="button" onClick={onSignOut} className="shrink-0 cursor-pointer">
                    <span className="text-xs font-bold text-rose-500 hover:underline">登出</span>
                  </button>
                </div>
              )}

              {/* 值班管理、收藏病人並排；交班簡報一張寬的 */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setIsShiftSectionOpen(true)}
                  aria-haspopup="dialog"
                  className={`p-4 rounded-2xl text-left cursor-pointer active:scale-[0.98] ${GLASS} ${GLASS_HOVER}`}
                >
                  <CalendarDays size={16} className="text-indigo-600" />
                  <span className="block text-sm font-bold mt-3 text-slate-800">值班管理</span>
                  <span className="block text-[11px] mt-1 text-slate-500">切換、修改、刪除</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsFavoritesOpen(true)}
                  aria-haspopup="dialog"
                  className={`p-4 rounded-2xl text-left cursor-pointer active:scale-[0.98] ${GLASS} ${GLASS_HOVER}`}
                >
                  <Star size={16} className={`text-amber-600 ${favorites.length ? 'fill-current' : ''}`} />
                  <span className="block text-sm font-bold mt-3 text-slate-800">收藏病人</span>
                  <span className="block text-[11px] mt-1 text-slate-500">{favorites.length ? `${favorites.length} 位追蹤中` : '後續追蹤用'}</span>
                </button>
                <button
                  type="button"
                  id="copy-handover-text-btn"
                  onClick={handleCopyHandover}
                  className={`col-span-2 flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left cursor-pointer active:scale-[0.98] ${GLASS} ${GLASS_HOVER}`}
                >
                  {copiedHandover ? <Check size={16} className="text-emerald-600 stroke-[3] shrink-0" /> : <ClipboardCopy size={16} className="text-rose-600 shrink-0" />}
                  <span className="text-sm font-bold text-slate-800">{copiedHandover ? '已複製交班簡報' : '複製交班簡報'}</span>
                  <span className="ml-auto text-[11px] text-slate-500">LINE 格式</span>
                </button>
              </div>

              {/* 外觀、重新整理：一組分隔列表 */}
              <div className={`rounded-2xl divide-y divide-slate-200/70 dark:divide-white/10 ${GLASS}`}>
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="text-sm font-bold text-slate-800">外觀</span>
                  {/* 滑動式主題切換（同 HMSS） */}
                  <div className="relative w-28 h-10 p-1 rounded-xl flex items-center gap-1 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                    <span
                      aria-hidden
                      className="absolute top-1 bottom-1 left-1 w-[calc(50%-6px)] rounded-lg bg-[#fafaf9] dark:bg-[#3a3a34] border border-slate-200 dark:border-white/10 shadow-sm transition-transform duration-[260ms] ease-[cubic-bezier(0.3,0.9,0.3,1)]"
                      style={{ transform: isDarkMode ? 'translateX(calc(100% + 4px))' : 'none' }}
                    />
                    <button
                      type="button"
                      onClick={() => isDarkMode && onToggleDarkMode()}
                      aria-label="淺色"
                      aria-pressed={!isDarkMode}
                      className={`relative flex-1 h-full flex items-center justify-center cursor-pointer ${!isDarkMode ? 'text-amber-500' : 'text-slate-400'}`}
                    >
                      <Sun size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => !isDarkMode && onToggleDarkMode()}
                      aria-label="深色"
                      aria-pressed={isDarkMode}
                      className={`relative flex-1 h-full flex items-center justify-center cursor-pointer ${isDarkMode ? 'text-indigo-500' : 'text-slate-400'}`}
                    >
                      <Moon size={16} />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800">重新整理</p>
                    <p className="text-[11px] text-slate-500 truncate">畫面怪怪的或想抓最新版本時用</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="flex items-center gap-1.5 px-3 h-8 rounded-full shrink-0 bg-emerald-500/10 text-emerald-700 cursor-pointer hover:bg-emerald-500/20"
                  >
                    <RotateCw size={14} />
                    <span className="text-xs font-bold">重新整理</span>
                  </button>
                </div>
              </div>

              {/* 教學、回報：兩顆膠囊按鈕；病歷紀錄模式只留回報（教學講的是值班列表的畫面） */}
              <div className="flex gap-2">
                {appMode === 'duty' && <button
                  type="button"
                  onClick={() => { setIsSidebarOpen(false); setIsTourOpen(true); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 h-10 rounded-full cursor-pointer ${GLASS} ${GLASS_HOVER}`}
                >
                  <HelpCircle size={16} className="text-indigo-600" />
                  <span className="text-xs font-bold text-slate-700">使用教學</span>
                </button>}
                <button
                  type="button"
                  onClick={() => setIsFeedbackOpen(true)}
                  className={`flex-1 flex items-center justify-center gap-1.5 h-10 rounded-full cursor-pointer ${GLASS} ${GLASS_HOVER}`}
                >
                  <MessageSquareWarning size={16} className="text-rose-600" />
                  <span className="text-xs font-bold text-slate-700">意見回報</span>
                </button>
              </div>

              <p className="text-center text-[10px] pt-1 text-slate-500 font-mono">Clinical Shift v{version} · 僅供個人值班紀錄使用</p>
            </div>
          </div>
        </div>
      )}

      {isShiftSectionOpen && (
        <ShiftManager
          shifts={availableShifts}
          selectedShiftId={selectedShiftId}
          isDarkMode={isDarkMode}
          onSelect={id => { onSelectShift?.(id); setIsShiftSectionOpen(false); setIsSidebarOpen(false); }}
          onEdit={(id, start, end) => onEditShift?.(id, start, end)}
          onDelete={id => onDeleteShift?.(id)}
          onClose={() => setIsShiftSectionOpen(false)}
        />
      )}
      {isFavoritesOpen && (
        <FavoritesManager isDarkMode={isDarkMode} favorites={favorites} onChange={onFavoritesChange} onClose={() => setIsFavoritesOpen(false)} />
      )}
      {isFeedbackOpen && <Feedback user={user} isDarkMode={isDarkMode} onClose={() => setIsFeedbackOpen(false)} />}
      {isTourOpen && <Tour steps={TOUR_STEPS} isDarkMode={isDarkMode} onClose={() => setIsTourOpen(false)} />}
    </>
  );
}
