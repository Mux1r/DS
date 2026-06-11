/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { DutyState } from '../types';
import { Clipboard, Users, ListTodo } from 'lucide-react';

interface StatsBannerProps {
  state: DutyState;
  activeTab: 'new' | 'orders' | 'handovers';
  onTabChange: (tab: 'new' | 'orders' | 'handovers') => void;
}

export default function StatsBanner({ state, activeTab, onTabChange }: StatsBannerProps) {
  // Calculated stats
  const pendingWorkNew = state.newPatients.filter(p => !p.orderDone || !p.visited || !p.chartDone).length;
  const pendingOrdersCount = state.generalOrders.filter(o => !o.isCompleted).length;
  const pendingHandoversCount = state.handoverPatients.filter(h => !h.isHandedOver).length;

  return (
    <div 
      className="bg-slate-100/80 border border-slate-200/50 p-1 rounded-xl w-full flex flex-row gap-1 mb-3.5 shadow-3xs" 
      id="stats-tab-banner-container"
    >
      {/* Tab 1: New Patients */}
      <button
        type="button"
        id="tab-btn-new-patients"
        onClick={() => onTabChange('new')}
        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-1 md:px-3 rounded-lg border border-transparent transition-all text-xs md:text-[13px] font-bold cursor-pointer select-none ${
          activeTab === 'new'
            ? 'bg-indigo-600 text-white shadow-xs'
            : 'text-slate-600 hover:text-indigo-600 hover:bg-white/60'
        }`}
      >
        <Users size={13} className="stroke-[2.5] shrink-0" />
        <span className="hidden sm:inline">新病人</span>
        <span className="sm:hidden">新病人</span>
        <span className={`px-1 py-0.5 rounded-md font-extrabold text-[10px] font-mono leading-none shrink-0 ${
          activeTab === 'new' 
            ? 'bg-white/20 text-white' 
            : 'bg-indigo-50 text-indigo-700 border border-indigo-100/30'
        }`}>
          {pendingWorkNew}
        </span>
      </button>

      {/* Tab 2: General Orders */}
      <button
        type="button"
        id="tab-btn-general-orders"
        onClick={() => onTabChange('orders')}
        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-1 md:px-3 rounded-lg border border-transparent transition-all text-xs md:text-[13px] font-bold cursor-pointer select-none ${
          activeTab === 'orders'
            ? 'bg-amber-500 text-white shadow-xs'
            : 'text-slate-600 hover:text-amber-600 hover:bg-white/60'
        }`}
      >
        <ListTodo size={13} className="stroke-[2.5] shrink-0" />
        <span className="hidden sm:inline">醫囑</span>
        <span className="sm:hidden">醫囑</span>
        <span className={`px-1 py-0.5 rounded-md font-extrabold text-[10px] font-mono leading-none shrink-0 ${
          activeTab === 'orders' 
            ? 'bg-white/25 text-white' 
            : 'bg-amber-50 text-amber-700 border border-amber-100/30'
        }`}>
          {pendingOrdersCount}
        </span>
      </button>

      {/* Tab 3: Handover Patients */}
      <button
        type="button"
        id="tab-btn-handovers"
        onClick={() => onTabChange('handovers')}
        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-1 md:px-3 rounded-lg border border-transparent transition-all text-xs md:text-[13px] font-bold cursor-pointer select-none ${
          activeTab === 'handovers'
            ? 'bg-rose-600 text-white shadow-xs'
            : 'text-slate-600 hover:text-rose-600 hover:bg-white/60'
        }`}
      >
        <Clipboard size={13} className="stroke-[2.5] shrink-0" />
        <span className="hidden sm:inline">交班</span>
        <span className="sm:hidden">交班</span>
        <span className={`px-1 py-0.5 rounded-md font-extrabold text-[10px] font-mono leading-none shrink-0 ${
          activeTab === 'handovers' 
            ? 'bg-white/20 text-white' 
            : 'bg-rose-50 text-rose-700 border border-rose-100/30'
        }`}>
          {pendingHandoversCount}
        </span>
      </button>
    </div>
  );
}
