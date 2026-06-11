/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { HandoverPatient } from '../types';
import { 
  Plus, 
  Trash2, 
  Check, 
  AlertCircle, 
  Clock, 
  Bookmark,
  ShieldAlert,
  Sliders,
  CheckCircle2,
  HeartCrack
} from 'lucide-react';
import { formatTime } from '../utils';

interface HandoverTabProps {
  handovers: HandoverPatient[];
  onAddHandover: (patient: Omit<HandoverPatient, 'id' | 'createdAt'>) => void;
  onUpdateHandover: (id: string, updates: Partial<HandoverPatient>) => void;
  onDeleteHandover: (id: string) => void;
}

export default function HandoverTab({
  handovers,
  onAddHandover,
  onUpdateHandover,
  onDeleteHandover,
}: HandoverTabProps) {
  // Input states
  const [bed, setBed] = useState('');
  const [name, setName] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [note, setNote] = useState('');
  const [attentionPoints, setAttentionPoints] = useState('');
  const [status, setStatus] = useState<HandoverPatient['status']>('unstable');
  const [errorMsg, setErrorMsg] = useState('');

  // Local filter
  const [onlyShowPending, setOnlyShowPending] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bed.trim()) {
      setErrorMsg('請輸入床號！');
      return;
    }
    if (!attentionPoints.trim()) {
      setErrorMsg('請輸入特別關注指示或處置指引！');
      return;
    }

    onAddHandover({
      bed: bed.trim(),
      name: name.trim() || '不具名',
      diagnosis: diagnosis.trim() || '無確切診斷',
      note: note.trim(),
      attentionPoints: attentionPoints.trim(),
      status,
      isHandedOver: false,
    });

    // Reset fields
    setBed('');
    setName('');
    setDiagnosis('');
    setNote('');
    setAttentionPoints('');
    setStatus('unstable');
    setErrorMsg('');
  };

  const filteredHandovers = handovers.filter((h) => {
    if (onlyShowPending) return !h.isHandedOver;
    return true;
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="handover-tab-root">
      {/* 1. Add Handover Patient Form Panel */}
      <div className="lg:col-span-4" id="handover-form-container">
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm sticky top-28">
          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            {/* Bed Number */}
            <div className="flex flex-col gap-1">
              <label htmlFor="handover-bed-input" className="text-xs font-medium text-slate-500">
                床號 <span className="text-rose-500 font-sans">*</span>
              </label>
              <input
                id="handover-bed-input"
                type="text"
                value={bed}
                onChange={(e) => {
                  setBed(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder="請輸入床號"
                className="w-full text-sm px-3 py-2 border border-slate-200 focus:border-rose-400 focus:outline-hidden rounded-lg transition-colors font-mono uppercase"
              />
            </div>

            {/* Patient Name */}
            <div className="flex flex-col gap-1">
              <label htmlFor="handover-name-input" className="text-xs font-medium text-slate-500">
                姓名 / 識別代稱
              </label>
              <input
                id="handover-name-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="王伯伯、林女士 (建議填寫)"
                className="w-full text-sm px-3 py-2 border border-slate-200 focus:border-rose-400 focus:outline-hidden rounded-lg transition-colors"
              />
            </div>

            {/* Diagnosis */}
            <div className="flex flex-col gap-1">
              <label htmlFor="handover-diagnosis-input" className="text-xs font-medium text-slate-500">
                主診斷
              </label>
              <input
                id="handover-diagnosis-input"
                type="text"
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                placeholder="如: Bleeding Duodenal Ulcer s/p clip"
                className="w-full text-sm px-3 py-2 border border-slate-200 focus:border-rose-400 focus:outline-hidden rounded-lg transition-colors"
              />
            </div>

            {/* Attention Points */}
            <div className="flex flex-col gap-1">
              <label htmlFor="handover-attn-input" className="text-xs font-medium text-slate-500">
                特別觀察重點及處置指引 <span className="text-rose-500 font-sans">*</span>
              </label>
              <textarea
                id="handover-attn-input"
                value={attentionPoints}
                onChange={(e) => {
                  setAttentionPoints(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder="e.g. 若發燒 > 38.5C，請 st 驗血、留血液培養、加開抗生素。若 SpO2 小於 90% 轉 10L Mask..."
                className="w-full h-24 text-sm px-3 py-2 border border-slate-200 focus:border-rose-400 focus:outline-hidden rounded-lg transition-colors resize-none mb-1"
              />
            </div>

            {/* Status Selection / Severity categorization */}
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-500 mb-1">狀況評估分類</span>
              <div className="grid grid-cols-3 gap-2">
                {(['stable', 'unstable', 'critical'] as const).map((lvl) => {
                  const labels = { stable: '🟢 穩定', unstable: '⚠️ 變動中', critical: '🚨 危急' };
                  const activeColors = {
                    stable: 'border-emerald-200 bg-emerald-50 text-emerald-700',
                    unstable: 'border-amber-200 bg-amber-50 text-amber-700',
                    critical: 'border-red-200 bg-red-50 text-red-700 font-semibold shadow-xs',
                  };
                  return (
                    <button
                      key={lvl}
                      id={`status-lvl-btn-${lvl}`}
                      type="button"
                      onClick={() => setStatus(lvl)}
                      className={`py-1 rounded-lg text-xs border text-center transition-all ${
                        status === lvl 
                          ? activeColors[lvl]
                          : 'border-slate-100 hover:border-slate-200 text-slate-400 bg-slate-50/50'
                      }`}
                    >
                      {labels[lvl]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* General Note */}
            <div className="flex flex-col gap-1">
              <label htmlFor="handover-note-input" className="text-xs font-medium text-slate-500">
                備註說明 (背景史、家屬屬性等)
              </label>
              <input
                id="handover-note-input"
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="如: DNR已簽、主要與兒子溝通、明天排內視鏡 NPO"
                className="w-full text-sm px-3 py-2 border border-slate-200 focus:border-rose-400 focus:outline-hidden rounded-lg transition-colors"
              />
            </div>

            {errorMsg && (
              <div className="text-xs text-rose-500 flex items-center gap-1 bg-rose-50/50 p-2 rounded-md" id="handover-form-error">
                <AlertCircle size={13} />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              id="add-handover-submit-btn"
              type="submit"
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1 shadow-xs"
            >
              <Plus size={14} className="stroke-[2.5]" />
              送出並新增
            </button>
          </form>
        </div>
      </div>

      {/* 2. Handover Patients Tracking panel (Right Columns) */}
      <div className="lg:col-span-8" id="handover-list-container">
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col gap-4">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-50 gap-3">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-rose-400 rounded-full"></span>
              <h3 className="font-semibold text-slate-800 text-sm">
                值班交班與續追蹤病患清單
              </h3>
            </div>

            {/* Local Filter: Only Show Pending Handovers */}
            <label className="inline-flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer hover:text-slate-700 transition-colors">
              <input
                id="toggle-pending-handovers-checkbox"
                type="checkbox"
                checked={onlyShowPending}
                onChange={(e) => setOnlyShowPending(e.target.checked)}
                className="rounded-sm border-slate-300 text-rose-600 focus:ring-rose-400 w-3.5 h-3.5 cursor-pointer"
              />
              <span>只顯示尚未接班 (待交接) 的病患</span>
            </label>
          </div>

          {filteredHandovers.length === 0 ? (
            <div className="py-20 text-center flex flex-col items-center justify-center text-slate-400" id="handovers-empty-state">
              <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mb-3">
                <Bookmark size={22} className="text-slate-300" />
              </div>
              <p className="text-xs font-medium">尚無特別關注的病患</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4" id="handover-patient-checklist-items">
              {filteredHandovers.map((h) => {
                const isCritical = h.status === 'critical';
                const isUnstable = h.status === 'unstable';
                
                // Color mapping for cards background
                let cardBorderBgStyle = 'border-slate-100 bg-white shadow-xs';
                if (h.isHandedOver) {
                  cardBorderBgStyle = 'border-slate-100 bg-slate-50/50 opacity-60';
                } else if (isCritical) {
                  cardBorderBgStyle = 'border-rose-100 bg-rose-50/10 hover:bg-rose-50/20';
                }

                const statusLabels = { critical: '🚨 危急特別不穩定', unstable: '⚠️ 狀態變動觀察中', stable: '🟢 穩定，基本觀測' };
                const badgeColors = {
                  critical: 'bg-rose-50 text-rose-700 border-rose-100',
                  unstable: 'bg-amber-50 text-amber-700 border-amber-100',
                  stable: 'bg-emerald-50 text-emerald-700 border-emerald-100',
                };

                return (
                  <div
                    key={h.id}
                    id={`handover-card-${h.id}`}
                    className={`border rounded-xl p-4 transition-all flex flex-col gap-3 ${cardBorderBgStyle}`}
                  >
                    {/* Top Row: Bed, Status, Delete, Checked toggle */}
                    <div className="flex items-start justify-between gap-2 flex-wrap sm:flex-nowrap">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`font-mono text-sm font-bold px-2 py-0.5 rounded-md border ${
                          isCritical ? 'bg-rose-50 text-rose-800 border-rose-100' : 'bg-slate-50 text-slate-700 border-slate-150'
                        }`}>
                          {h.bed}
                        </span>
                        <span className="font-bold text-sm text-slate-700">
                          {h.name}
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-md border font-medium ${badgeColors[h.status]}`}>
                          {statusLabels[h.status]}
                        </span>
                        <span className="text-xs text-slate-400 font-mono flex items-center gap-0.5">
                          <Clock size={11} />
                          {formatTime(h.createdAt)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 ml-auto">
                        {/* Handover Check Switch */}
                        <button
                          id={`toggle-handover-handed-btn-${h.id}`}
                          onClick={() => onUpdateHandover(h.id, { isHandedOver: !h.isHandedOver })}
                          className={`flex items-center gap-1 py-1 px-2.5 rounded-lg text-xs font-medium transition-all border ${
                            h.isHandedOver
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                              : 'bg-slate-50 hover:bg-slate-100 text-slate-500 border-slate-150'
                          }`}
                          title="已交給下一個班別的醫師"
                        >
                          <div className={`w-3 h-3 rounded-full flex items-center justify-center transition-all ${
                            h.isHandedOver ? 'bg-emerald-600' : 'border border-slate-350'
                          }`}>
                            {h.isHandedOver && <Check size={8} className="text-white stroke-[3.5]" />}
                          </div>
                          <span>已跟接班醫師交代</span>
                        </button>

                        <button
                          id={`delete-handover-btn-${h.id}`}
                          onClick={() => onDeleteHandover(h.id)}
                          className="text-slate-300 hover:text-rose-500 p-1 rounded hover:bg-rose-50 transition-all"
                          title="刪除此項特別關注"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Middle Section: Principal Diagnosis */}
                    <div className="text-sm space-y-1.5 text-slate-650">
                      <div>
                        <span className="text-slate-400 text-xs font-serif mr-1">Dx:</span>
                        <span className="font-medium text-slate-850">{h.diagnosis}</span>
                      </div>

                      {/* Clinical Attention Guideliness (Critical Block) */}
                      <div className={`p-3 rounded-xl border ${
                        isCritical
                          ? 'bg-rose-50/40 border-rose-100 text-rose-950 font-medium'
                          : 'bg-slate-50/50 border-slate-100 text-slate-700'
                      }`}>
                        <div className="flex items-center gap-1.5 text-xs font-semibold mb-1 text-slate-500">
                          <Sliders size={12} className={isCritical ? 'text-rose-600' : 'text-slate-400'} />
                          <span>🚨 特別觀察與處置指引：</span>
                        </div>
                        <p className="text-sm leading-relaxed font-sans select-all" id={`attn-point-text-${h.id}`}>
                          {h.attentionPoints}
                        </p>
                      </div>

                      {/* General Remarks, family discussion details, etc */}
                      {h.note && (
                        <div className="text-xs text-slate-500 bg-slate-100/30 p-2 rounded-lg italic leading-relaxed border-l-2 border-slate-200">
                          備註：{h.note}
                        </div>
                      )}
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
