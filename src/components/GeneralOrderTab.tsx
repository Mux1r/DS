/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { GeneralOrder } from '../types';
import { 
  Plus, 
  Trash2, 
  Check, 
  AlertCircle, 
  Clock, 
  ListTodo, 
  PhoneCall,
  Flame,
  CheckCircle2,
  Hourglass
} from 'lucide-react';
import { formatTime } from '../utils';

interface GeneralOrderTabProps {
  orders: GeneralOrder[];
  onAddOrder: (order: Omit<GeneralOrder, 'id' | 'createdAt'>) => void;
  onUpdateOrder: (id: string, updates: Partial<GeneralOrder>) => void;
  onDeleteOrder: (id: string) => void;
}

export default function GeneralOrderTab({
  orders,
  onAddOrder,
  onUpdateOrder,
  onDeleteOrder,
}: GeneralOrderTabProps) {
  // Form fields
  const [bed, setBed] = useState('');
  const [name, setName] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [orderTask, setOrderTask] = useState('');
  const [note, setNote] = useState('');
  const [nurseName, setNurseName] = useState('');
  const [priority, setPriority] = useState<GeneralOrder['priority']>('normal');
  const [errorMsg, setErrorMsg] = useState('');
  
  // Filter state
  const [filterMode, setFilterMode] = useState<'all' | 'pending' | 'completed'>('pending');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bed.trim()) {
      setErrorMsg('請輸入床號！');
      return;
    }
    if (!orderTask.trim()) {
      setErrorMsg('請輸入醫囑開立任務內容！');
      return;
    }

    onAddOrder({
      bed: bed.trim(),
      name: name.trim() || '不具名',
      diagnosis: diagnosis.trim() || '無確切診斷',
      orderTask: orderTask.trim(),
      note: note.trim(),
      isCompleted: false,
      nurseName: nurseName.trim() || undefined,
      priority,
    });

    // Reset inputs
    setBed('');
    setName('');
    setDiagnosis('');
    setOrderTask('');
    setNote('');
    setNurseName('');
    setPriority('normal');
    setErrorMsg('');
  };

  const filteredOrders = orders.filter(o => {
    if (filterMode === 'pending') return !o.isCompleted;
    if (filterMode === 'completed') return o.isCompleted;
    return true;
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="general-order-tab-root">
      {/* 1. Add Order Request Form (Left Column) */}
      <div className="lg:col-span-4" id="order-form-container">
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm sticky top-28">
          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            {/* Bed Number */}
            <div className="flex flex-col gap-1">
              <label htmlFor="order-bed-input" className="text-xs font-medium text-slate-500">
                床號 <span className="text-rose-500 font-sans">*</span>
              </label>
              <input
                id="order-bed-input"
                type="text"
                value={bed}
                onChange={(e) => {
                  setBed(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder="請輸入床號"
                className="w-full text-sm px-3 py-2 border border-slate-200 focus:border-amber-400 focus:outline-hidden rounded-lg transition-colors font-mono uppercase"
              />
            </div>

            {/* Patient Name */}
            <div className="flex flex-col gap-1">
              <label htmlFor="order-name-input" className="text-xs font-medium text-slate-500">
                姓名 / 識別代稱
              </label>
              <input
                id="order-name-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="選填姓名，避免開錯人"
                className="w-full text-sm px-3 py-2 border border-slate-200 focus:border-amber-400 focus:outline-hidden rounded-lg transition-colors"
              />
            </div>

            {/* Diagnosis */}
            <div className="flex flex-col gap-1">
              <label htmlFor="order-diagnosis-input" className="text-xs font-medium text-slate-500">
                主診斷
              </label>
              <input
                id="order-diagnosis-input"
                type="text"
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                placeholder="如: Colon Cancer, Bleeding"
                className="w-full text-sm px-3 py-2 border border-slate-200 focus:border-amber-400 focus:outline-hidden rounded-lg transition-colors"
              />
            </div>

            {/* Order Content / Task */}
            <div className="flex flex-col gap-1">
              <label htmlFor="order-task-input" className="text-xs font-medium text-slate-500">
                欲補開醫囑內容 <span className="text-rose-500 font-sans">*</span>
              </label>
              <textarea
                id="order-task-input"
                value={orderTask}
                onChange={(e) => {
                  setOrderTask(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder="e.g. 加開 Lasix 1 amp IV st 或 Acetaminophen Q6H PRN"
                className="w-full h-20 text-sm px-3 py-2 border border-slate-200 focus:border-amber-400 focus:outline-hidden rounded-lg transition-colors resize-none mb-1"
              />
            </div>



            {errorMsg && (
              <div className="text-xs text-rose-500 flex items-center gap-1 bg-rose-50/50 p-2 rounded-md" id="order-form-error">
                <AlertCircle size={13} />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              id="add-order-submit-btn"
              type="submit"
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1 shadow-xs"
            >
              <Plus size={14} className="stroke-[2.5]" />
              送出並列管
            </button>
          </form>
        </div>
      </div>

      {/* 2. Order List Tracking Section (Right Columns) */}
      <div className="lg:col-span-8" id="order-list-container">
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col gap-4">
          
          {/* List Headers & Sorting Tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-50 gap-3">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-amber-400 rounded-full"></span>
              <h3 className="font-semibold text-slate-800 text-sm">
                護理站來電追蹤醫囑
              </h3>
            </div>

            {/* Filter Toggle Buttons */}
            <div className="flex bg-slate-50 p-1 rounded-lg border border-slate-100/50 text-slate-500 self-start" id="order-filter-buttons">
              {(['pending', 'completed', 'all'] as const).map((mode) => {
                const labels = { pending: '待開醫囑', completed: '已開醫囑', all: '全部顯示' };
                const countMap = {
                  pending: orders.filter(o => !o.isCompleted).length,
                  completed: orders.filter(o => o.isCompleted).length,
                  all: orders.length
                };
                return (
                  <button
                    key={mode}
                    id={`filter-mode-btn-${mode}`}
                    onClick={() => setFilterMode(mode)}
                    className={`px-3 py-1 text-xs rounded-md transition-all font-medium ${
                      filterMode === mode 
                        ? 'bg-white text-slate-800 shadow-xs border border-slate-100' 
                        : 'hover:text-slate-700 text-slate-400'
                    }`}
                  >
                    {labels[mode]} ({countMap[mode]})
                  </button>
                );
              })}
            </div>
          </div>

          {filteredOrders.length === 0 ? (
            <div className="py-20 text-center flex flex-col items-center justify-center text-slate-400" id="orders-empty-state">
              <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mb-3">
                <ListTodo size={22} className="text-slate-300" />
              </div>
              <p className="text-xs font-medium">尚無此分類下的醫囑紀錄</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3" id="general-order-checklist-items">
              {filteredOrders.map((o) => {
                return (
                  <div
                    key={o.id}
                    id={`order-card-${o.id}`}
                    className={`border rounded-xl p-4 transition-all hover:bg-slate-50 flex items-center gap-3.5 ${
                      o.isCompleted 
                        ? 'border-slate-100 bg-slate-50/50 opacity-60' 
                        : 'border-slate-100 bg-white shadow-xs'
                    }`}
                  >
                    {/* Tick Checkbox for completed/pending order */}
                    <button
                      id={`toggle-order-complete-btn-${o.id}`}
                      onClick={() => onUpdateOrder(o.id, { isCompleted: !o.isCompleted })}
                      className={`flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                        o.isCompleted 
                          ? 'bg-emerald-600 border-emerald-600 text-white' 
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 bg-white'
                      }`}
                      title={o.isCompleted ? '設為未開立' : '設為已開立成功'}
                    >
                      {o.isCompleted && <Check size={14} className="stroke-[3]" />}
                    </button>

                    {/* Content Section */}
                    <div className="flex-grow flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-bold px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-100/30 rounded-md">
                            {o.bed}
                          </span>
                          <span className="font-bold text-sm text-slate-700">
                            {o.name}
                          </span>
                          <span className="text-xs text-slate-400 font-mono flex items-center gap-0.5">
                            <Clock size={11} />
                            {formatTime(o.createdAt)}
                          </span>
                        </div>

                        {/* Delete single request */}
                        <button
                          id={`delete-order-btn-${o.id}`}
                          onClick={() => onDeleteOrder(o.id)}
                          className="text-slate-300 hover:text-rose-500 p-0.5 rounded hover:bg-rose-50 transition-all self-start"
                          title="刪除此筆記錄"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>

                      {/* Main Order Task details */}
                      <p className={`text-sm font-semibold leading-relaxed ${
                        o.isCompleted ? 'text-slate-400 line-through' : 'text-amber-900 bg-amber-50/20 p-2 rounded-lg border border-amber-500/5'
                      }`}>
                        {o.orderTask}
                      </p>

                      {/* Diagnosis & Notes */}
                      <div className="text-slate-500 text-xs space-y-1">
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="text-slate-400">病患診斷:</span>
                          <span className="font-medium text-slate-600">{o.diagnosis}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
