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
// 含棟別字母時房號位數看棟別：I 棟是 ICU 單位碼 1 碼（9I1-5、9I2-12），A 棟房號 2 碼（9A11-2）
export const formatBedInput = (raw: string): string => {
  const s = raw.toUpperCase().replace(/[^0-9A-Z-]/g, '');
  if (/[A-Z]/.test(s)) {
    const m = s.replace(/-/g, '').match(/^(\d{1,2})([A-Z])(\d*)$/);
    if (!m) return s.slice(0, 8);
    const [, floor, wing, rest] = m;
    const roomWidth = wing === 'I' ? 1 : wing === 'A' ? 2 : 0;
    if (!roomWidth) return s.slice(0, 8); // 沒見過的棟別，'-' 自己打
    const d = rest.slice(0, roomWidth + 2);
    return floor + wing + (d.length <= roomWidth ? d : `${d.slice(0, roomWidth)}-${d.slice(roomWidth)}`);
  }
  const digits = s.replace(/\D/g, '');
  if (!digits) return '';
  const floorWidth = /^[89]/.test(digits) ? 1 : 2;
  const splitAt = floorWidth + 2;
  // 床號純數字最多 4～5 碼，病歷號最短 6 碼 → 超過床號長度就當病歷號（急診會診），原樣保留不加 '-'
  if (digits.length > splitAt + 1) return digits;
  const d = digits.slice(0, splitAt + 1);
  return d.length <= splitAt ? d : `${d.slice(0, splitAt)}-${d.slice(splitAt)}`;
};

// 兩種寫法：純數字 912-3（9樓12房3床）、含棟別 9I1-5 / 9A11-2（9樓 I 棟 ICU、A 棟）
// 含棟別的一律要有 '-'，否則 9I212 無從判斷是 2-12 還是 21-2
export const parseBed = (bed: string) => {
  const m = bed.trim().toUpperCase().match(/^(8|9|1\d|2[01])(?:([A-Z])(\d{1,2})-(\d{1,2})|(\d{2})-?(\d?))$/);
  if (!m) return null;
  return m[2]
    ? { floor: m[1], wing: m[2], room: m[3], seat: m[4] }
    : { floor: m[1], wing: '', room: m[5], seat: m[6] };
};

// 棟別排序：ICU（I 棟）排在一般病房前面，純數字床號（無棟別）介於兩者之間
const wingRank = (wing: string) => (wing === 'I' ? '0' : wing || '1');

// 排序鍵：樓層(2) + 棟別(1) + 房(2) + 床(2)，認不得的排最後
const bedSortKey = (bed: string): string => {
  const p = parseBed(bed);
  if (!p) return 'ZZZZZZZ';
  return p.floor.padStart(2, '0') + wingRank(p.wing) + p.room.padStart(2, '0') + p.seat.padStart(2, '0');
};

export const compareBed = (a: string, b: string): number => {
  const ka = bedSortKey(a), kb = bedSortKey(b);
  return ka < kb ? -1 : ka > kb ? 1 : 0;
};

// createdAt 存的是 UTC ISO，直接切前 10 碼會讓半夜建立的紀錄少一天 → 取本地日期
// ('sv-SE' 的日期格式剛好就是 YYYY-MM-DD)
export const formatDate = (isoString: string): string => {
  const d = new Date(isoString);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('sv-SE');
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
