/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { NewPatient } from '../types';
import BedBadge from './BedBadge';
import {
  Plus,
  Trash2,
  Check,
  FileText,
  Eye,
  ClipboardCheck,
  AlertCircle,
  Clock,
  ArrowUpDown
} from 'lucide-react';
import { formatTime } from '../utils';

interface NewPatientTabProps {
  patients: NewPatient[];
  onAddPatient: (patient: Omit<NewPatient, 'id' | 'createdAt'>) => void;
  onUpdatePatient: (id: string, updates: Partial<NewPatient>) => void;
  onDeletePatient: (id: string) => void;
}

export default function NewPatientTab({
  patients,
  onAddPatient,
  onUpdatePatient,
  onDeletePatient,
}: NewPatientTabProps) {
  // Input fields state
  const [bed, setBed] = useState('');
  const [name, setName] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [note, setNote] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [sortMode, setSortMode] = useState<'time' | 'bed'>('time');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bed.trim()) {
      setErrorMsg('請輸入床號！');
      return;
    }
    
    onAddPatient({
      bed: bed.trim(),
      name: name.trim() || '不具名',
      diagnosis: diagnosis.trim(),
      note: note.trim() || '',
      orderDone: false,
      visited: false,
      chartDone: false,
    });

    // Reset inputs
    setBed('');
    setName('');
    setDiagnosis('');
    setNote('');
    setErrorMsg('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="new-patient-tab-root">
      {/* 1. Add Patient Form Panel (left columns) */}
      <div className="lg:col-span-4" id="new-patient-form-container">
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm sticky top-28">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Bed Number */}
            <div className="flex flex-col gap-1">
              <label htmlFor="bed-num-input" className="text-xs font-medium text-slate-500 flex justify-between">
                <span>床號 <span className="text-rose-500 font-sans">*</span></span>
                <span className="text-xs text-slate-400 font-mono">e.g., 12B-01</span>
              </label>
              <input
                id="bed-num-input"
                type="text"
                value={bed}
                onChange={(e) => {
                  setBed(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder="請輸入床號"
                className="w-full text-sm px-3 py-2 border border-slate-200 focus:border-indigo-400 focus:outline-hidden rounded-lg transition-colors font-mono uppercase"
              />
            </div>

            {/* Patient Identifier (highly useful clinical context) */}
            <div className="flex flex-col gap-1">
              <label htmlFor="name-input" className="text-xs font-medium text-slate-500">
                姓名 / 識別代稱
              </label>
              <input
                id="name-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="如: 王先生、無名氏 (選填)"
                className="w-full text-sm px-3 py-2 border border-slate-200 focus:border-indigo-400 focus:outline-hidden rounded-lg transition-colors"
              />
            </div>

            {/* Diagnosis */}
            <div className="flex flex-col gap-1">
              <label htmlFor="diagnosis-input" className="text-xs font-medium text-slate-500">
                主診斷
              </label>
              <input
                id="diagnosis-input"
                type="text"
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                placeholder="如: Pneumonia, s/p Appendectomy"
                className="w-full text-sm px-3 py-2 border border-slate-200 focus:border-indigo-400 focus:outline-hidden rounded-lg transition-colors"
              />
            </div>

            {/* Note */}
            <div className="flex flex-col gap-1">
              <label htmlFor="note-input" className="text-xs font-medium text-slate-500">
                備註說明
              </label>
              <textarea
                id="note-input"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="輸入特殊注意事項、管路引流、班班追蹤指引..."
                className="w-full h-24 text-sm px-3 py-2 border border-slate-200 focus:border-indigo-400 focus:outline-hidden rounded-lg transition-colors resize-none"
              />
            </div>

            {errorMsg && (
              <div className="text-xs text-rose-500 flex items-center gap-1 bg-rose-50/50 p-2 rounded-md" id="new-patient-form-error">
                <AlertCircle size={13} />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              id="add-new-patient-submit-btn"
              type="submit"
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1 shadow-xs"
            >
              <Plus size={14} className="stroke-[2.5]" />
              送出並新增
            </button>
          </form>
        </div>
      </div>

      {/* 2. Patient Action Checklist (right columns) */}
      <div className="lg:col-span-8" id="new-patient-list-container">
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-50">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
              <h3 className="font-semibold text-slate-800 text-sm">
                新收病人 Checklist 追蹤
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">共計：{patients.length} 床</span>
              <button
                onClick={() => setSortMode(m => m === 'time' ? 'bed' : 'time')}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 px-2 py-0.5 rounded-md hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all"
                title="切換排序方式"
              >
                <ArrowUpDown size={11} />
                {sortMode === 'time' ? '依時間' : '依床號'}
              </button>
            </div>
          </div>

          {patients.length === 0 ? (
            <div className="py-16 text-center flex flex-col items-center justify-center text-slate-400" id="new-patients-empty">
              <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mb-3">
                <ClipboardCheck size={22} className="text-slate-300" />
              </div>
              <p className="text-xs font-medium">尚無今日新病人紀錄</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3.5" id="new-patient-checklist-items">
              {[...patients].sort((a, b) =>
                sortMode === 'bed'
                  ? a.bed.localeCompare(b.bed, 'zh-TW', { numeric: true })
                  : a.createdAt.localeCompare(b.createdAt)
              ).map((p) => {
                const totalChecks = [p.orderDone, p.visited, p.chartDone].filter(Boolean).length;
                const isFullyComplete = totalChecks === 3;

                return (
                  <div
                    key={p.id}
                    id={`patient-checklist-card-${p.id}`}
                    className={`border rounded-xl p-4 transition-all hover:bg-slate-50 flex flex-col gap-3.5 ${
                      isFullyComplete 
                        ? 'border-slate-100 bg-slate-50/50 opacity-75' 
                        : 'border-slate-100 bg-white'
                    }`}
                  >
                    {/* Top Row: Bed, Name, Time, Delete */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <BedBadge bed={p.bed} className="font-mono text-sm font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100/30 rounded-md" />
                        <span className="font-bold text-sm text-slate-700">
                          {p.name}
                        </span>
                      </div>
                      
                      <button
                        id={`delete-patient-btn-${p.id}`}
                        onClick={() => onDeletePatient(p.id)}
                        className="text-slate-300 hover:text-rose-500 p-1 rounded-md hover:bg-rose-50 transition-all"
                        title="刪除本床記錄"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    {/* Middle Row: Diagnosis */}
                    <div className="text-sm text-slate-600 space-y-1 pl-1">
                      <p className="font-medium text-slate-800 leading-relaxed">
                        <span className="text-slate-400 text-xs font-sans pr-1">Dx:</span>
                        {p.diagnosis}
                      </p>
                    </div>

                    {/* Bottom Row: Exactly 3 Requested Checklist Toggles */}
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100/60" id={`checklist-toggles-${p.id}`}>
                      {/* Check 1: 是否開立醫囑 */}
                      <button
                        id={`toggle-order-btn-${p.id}`}
                        onClick={() => onUpdatePatient(p.id, { orderDone: !p.orderDone })}
                        className={`flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs font-medium rounded-full transition-all border ${
                          p.orderDone
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-50/50 hover:bg-slate-50 text-slate-500 border-slate-100 hover:border-slate-200'
                        }`}
                      >
                        <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center transition-all ${
                          p.orderDone ? 'bg-emerald-600 text-white' : 'border border-slate-350'
                        }`}>
                          {p.orderDone && <Check size={10} className="stroke-[3]" />}
                        </div>
                        <span>開立醫囑</span>
                      </button>

                      {/* Check 2: 是否看病人 */}
                      <button
                        id={`toggle-visited-btn-${p.id}`}
                        onClick={() => onUpdatePatient(p.id, { visited: !p.visited })}
                        className={`flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs font-medium rounded-full transition-all border ${
                          p.visited
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-slate-50/50 hover:bg-slate-50 text-slate-500 border-slate-100 hover:border-slate-200'
                        }`}
                      >
                        <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center transition-all ${
                          p.visited ? 'bg-amber-600 text-white' : 'border border-slate-350'
                        }`}>
                          {p.visited && <Check size={10} className="stroke-[3]" />}
                        </div>
                        <span>看病人</span>
                      </button>

                      {/* Check 3: 是否打完病歷 */}
                      <button
                        id={`toggle-chart-btn-${p.id}`}
                        onClick={() => onUpdatePatient(p.id, { chartDone: !p.chartDone })}
                        className={`flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs font-medium rounded-full transition-all border ${
                          p.chartDone
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                            : 'bg-slate-50/50 hover:bg-slate-50 text-slate-500 border-slate-100 hover:border-slate-200'
                        }`}
                      >
                        <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center transition-all ${
                          p.chartDone ? 'bg-indigo-600 text-white' : 'border border-slate-350'
                        }`}>
                          {p.chartDone && <Check size={10} className="stroke-[3]" />}
                        </div>
                        <span>打完病歷</span>
                      </button>
                    </div>

                    {/* Progress indicator micro elements */}
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>當前完成進度</span>
                      <span className="font-mono">{totalChecks} / 3 完成</span>
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
