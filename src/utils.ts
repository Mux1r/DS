/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DutyState, NewPatient, GeneralOrder, HandoverPatient } from './types';

const STORAGE_KEY = 'duty_patient_list_state';

// Generate safe initial mock data representing Taiwan clinical environment
export const getInitialState = (): DutyState => {
  const defaultState: DutyState = {
    newPatients: [
      {
        id: 'new-1',
        bed: '12B-01',
        name: '王小明',
        diagnosis: 'Pneumonia with acute respiratory distress',
        note: '注意痰多與發燒，抗生素 Levofloxacin 已調好。家屬較焦慮需多安撫。',
        orderDone: true,
        visited: true,
        chartDone: false,
        createdAt: new Date(Date.now() - 3 * 3600000).toISOString(),
      },
      {
        id: 'new-2',
        bed: '12B-05',
        name: '陳麗華',
        diagnosis: 'Acute cholecystitis, s/p PTCD',
        note: 'PTCD 引流袋量與顏色需班班確認，禁食 NPO 中。',
        orderDone: true,
        visited: false,
        chartDone: false,
        createdAt: new Date(Date.now() - 1 * 3600000).toISOString(),
      }
    ],
    generalOrders: [
      {
        id: 'order-1',
        bed: '12B-01',
        name: '王小明',
        diagnosis: 'Pneumonia',
        orderTask: '加開 Acetaminophen 1# PO Q6H PRN >= 38.5C',
        note: '王護理師通知：病人體溫現在 38.3C 開始有點發冷。',
        isCompleted: true,
        priority: 'high',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'order-2',
        bed: '12B-12',
        name: '張國榮',
        diagnosis: 'Cerebral Infarction',
        orderTask: '開立復健會診與 F/U Lipid Profile',
        note: '白天主治醫師交待忘記放，今晚補開。',
        isCompleted: false,
        priority: 'normal',
        createdAt: new Date().toISOString(),
      }
    ],
    handoverPatients: [
      {
        id: 'handover-1',
        bed: '12B-08',
        name: '劉大同',
        diagnosis: 'Congestive Heart Failure, unstable',
        note: '水分限制 1000ml/day，密切追蹤 I/O。',
        attentionPoints: '若尿量 2 小時 < 50ml 或 SpO2 < 93% 請通知值班，考慮加開 Furosemide (Lasix) 1 Amp IV st.',
        status: 'unstable',
        isHandedOver: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'handover-2',
        bed: '12B-23',
        name: '林阿美',
        diagnosis: 'Peptic ulcer bleeding s/p EVL',
        note: '禁食 NPO + PPI infusion pump check.',
        attentionPoints: '若有解黑便、吐血、或 HR > 110 bpm / BP < 90/60 mmHg 務必立即通知，可能需緊急驗 Hb 或安排急做鏡檢。',
        status: 'critical',
        isHandedOver: false,
        createdAt: new Date().toISOString(),
      }
    ]
  };

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Ensure structure matches in case of changes
      return {
        newPatients: parsed.newPatients || [],
        generalOrders: parsed.generalOrders || [],
        handoverPatients: parsed.handoverPatients || [],
      };
    }
  } catch (e) {
    console.error('Error reading localStorage state', e);
  }
  return defaultState;
};

export const saveState = (state: DutyState): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Error writing to localStorage', e);
  }
};

// Generate comprehensive text for shift handover (clinical clipboard tool)
export const generateHandoverText = (state: DutyState): string => {
  let text = `📋 === 值班病患狀態交班清單 ===\n`;
  text += `產生時間：${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}\n`;
  text += `==================================\n\n`;

  // Section 1: New Patients
  text += `【 1. 今日新病人 (${state.newPatients.length} 床) 】\n`;
  if (state.newPatients.length === 0) {
    text += `  無新病人紀錄。\n`;
  } else {
    state.newPatients.forEach((p, idx) => {
      const order = p.orderDone ? '✅ 醫囑已開' : '❌ 醫囑未完成';
      const visit = p.visited ? '✅ 已看病人' : '❌ 未看病人';
      const chart = p.chartDone ? '✅ 寫完病歷' : '❌ 未寫病歷';
      text += `${idx + 1}. 床號：[${p.bed}] 姓名：${p.name || '未輸入'}\n`;
      text += `   診斷：${p.diagnosis || '無'}\n`;
      text += `   工作進度：${order} | ${visit} | ${chart}\n`;
      text += `   備註：${p.note || '無'}\n\n`;
    });
  }

  // Section 2: General Orders
  text += `【 2. 護理一般醫囑開立追蹤 (${state.generalOrders.filter(o => !o.isCompleted).length} 筆待開) 】\n`;
  const pendingOrders = state.generalOrders.filter(o => !o.isCompleted);
  if (pendingOrders.length === 0) {
    text += `  無未完成醫囑，太棒了！\n`;
  } else {
    pendingOrders.forEach((o, idx) => {
      const prioMap = { high: '🔴 緊急', normal: '🟡 一般', low: '🔵 稍晚' };
      text += `${idx + 1}. 床號：[${o.bed}] 姓名：${o.name || '無'} (${prioMap[o.priority]})\n`;
      text += `   醫囑內容：${o.orderTask}\n`;
      text += `   備註：${o.note || '無'}\n\n`;
    });
  }

  // Section 3: Handover Patients
  text += `【 3. 值班特別關注與交班對象 (${state.handoverPatients.filter(h => !h.isHandedOver).length} 床未完全交接) 】\n`;
  const activeHandovers = state.handoverPatients;
  if (activeHandovers.length === 0) {
    text += `  無特別交班病人。\n`;
  } else {
    activeHandovers.forEach((h, idx) => {
      const statusMap = { critical: '🚨 命危/特別不穩定', unstable: '⚠️ 狀態變動中', stable: '🟢 穩定，常規觀測' };
      const handed = h.isHandedOver ? '✅ 已交班' : '❌ 待交接';
      text += `${idx + 1}. 床號：[${h.bed}] 姓名：${h.name || '無'} [狀態: ${statusMap[h.status]}] [${handed}]\n`;
      text += `   診斷：${h.diagnosis || '無'}\n`;
      text += `   特別關切與處理指引：\n   👉 ${h.attentionPoints || '標準值班監控'}\n`;
      text += `   備註：${h.note || '無'}\n\n`;
    });
  }

  text += `==================================\n`;
  text += `💡 護理師回報電話請對床頭呼叫系統，值班加油！`;
  return text;
};

// Simple helper to export full JSON
export const exportJSON = (state: DutyState): string => {
  return JSON.stringify(state, null, 2);
};

// ponytail: live-formats bed number as "floor+room-bed" (e.g. 15511 -> 1551-1) while typing
export const formatBedInput = (raw: string): string => {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  const floorWidth = /^[89]/.test(digits) ? 1 : 2;
  const splitAt = floorWidth + 2;
  const d = digits.slice(0, splitAt + 1);
  return d.length <= splitAt ? d : `${d.slice(0, splitAt)}-${d.slice(splitAt)}`;
};

// Format dates
export const formatTime = (isoString: string): string => {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '--:--';
  }
};
