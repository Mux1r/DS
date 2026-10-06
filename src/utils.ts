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
// 交班簡報（貼 LINE 用）：一床一行，只印有填的欄位
const pad2 = (n: number) => String(n).padStart(2, '0');
const hasDx = (dx: string) => !!dx && dx !== '無' && dx !== '無確切診斷';

export const generateHandoverText = (state: DutyState, now = new Date()): string => {
  // 半形空白分隔；全形括號、｜ 前後不留空白（「CAP（未寫病歷）血培養已送」）
  const join = (...parts: (string | false | undefined)[]) =>
    (parts.filter(Boolean) as string[]).reduce((acc, p) => (!acc ? p : /^[（｜【]/.test(p) || /[）】]$/.test(acc) ? acc + p : `${acc} ${p}`), '');
  const lines = [`📋 交班 ${pad2(now.getMonth() + 1)}/${pad2(now.getDate())} ${pad2(now.getHours())}:${pad2(now.getMinutes())}`];

  if (state.newPatients.length) {
    lines.push('', `【新病人 ${state.newPatients.length}】`);
    state.newPatients.forEach(p => {
      const todo = [!p.orderDone && '未開醫囑', !p.visited && '未看', !p.chartDone && '未寫病歷'].filter(Boolean);
      lines.push('• ' + join(p.bed, hasDx(p.diagnosis) && p.diagnosis, todo.length > 0 && `（${todo.join('、')}）`, p.note.trim()));
    });
  }

  const pending = state.generalOrders.filter(o => !o.isCompleted);
  if (pending.length) {
    lines.push('', `【待開醫囑 ${pending.length}】`);
    pending.forEach(o => lines.push('• ' + join(o.bed, o.orderTask.trim(), o.note.trim() && `｜${o.note.trim()}`)));
  }

  if (state.handoverPatients.length) {
    lines.push('', `【交班 ${state.handoverPatients.length}】`);
    state.handoverPatients.forEach(h => {
      const mark = h.status === 'critical' ? '🚨' : h.status === 'unstable' ? '⚠️' : '';
      // 舊資料的「內容」欄（attentionPoints）跟備註併在一起印
      const note = [h.attentionPoints, h.note].map(t => (t || '').trim()).filter(Boolean).join('；');
      lines.push('• ' + join(mark, h.bed, hasDx(h.diagnosis) && h.diagnosis, h.isConsult && '【會診】', note && `｜${note}`, h.isHandedOver && '✓已交班'));
    });
  }

  if (lines.length === 1) lines.push('', '（目前沒有資料）');
  return lines.join('\n');
};

// 最小自我檢查（只在開發伺服器跑）：格式改壞時 console 會跳 Assertion failed
if (import.meta.env?.DEV) {
  const t = generateHandoverText({
    newPatients: [{ id: '1', bed: '1205-1', name: '', diagnosis: 'CAP', note: '血培養已送', orderDone: true, visited: true, chartDone: false, createdAt: '' }],
    generalOrders: [
      { id: '2', bed: '1101', name: '', diagnosis: '', orderTask: 'K 3.1 補鉀', note: '', isCompleted: false, priority: 'normal', createdAt: '' },
      { id: '3', bed: '1102', name: '', diagnosis: '', orderTask: '已開的', note: '', isCompleted: true, priority: 'normal', createdAt: '' },
    ],
    handoverPatients: [
      { id: '4', bed: '1703', name: '', diagnosis: 'GI bleeding', note: '追 Hb', attentionPoints: '', status: 'critical', isHandedOver: false, createdAt: '' },
      { id: '5', bed: '1416', name: '', diagnosis: '無', note: '', attentionPoints: '', status: 'stable', isHandedOver: true, isConsult: true, createdAt: '' },
    ],
  }, new Date(2026, 9, 6, 23, 5));
  console.assert(t === [
    '📋 交班 10/06 23:05', '',
    '【新病人 1】', '• 1205-1 CAP（未寫病歷）血培養已送', '',
    '【待開醫囑 1】', '• 1101 K 3.1 補鉀', '',
    '【交班 2】', '• 🚨 1703 GI bleeding｜追 Hb', '• 1416【會診】✓已交班',
  ].join('\n'), 'generateHandoverText 格式跑掉了', t);
}

const FLOOR = '(9|1\\d|2[01])';                       // 9～21 樓
const ROOM = '(0[1-9]|1\\d|2[0-2]|5[1-9]|6\\d|7[0-2])'; // A 側 01～22、B 側 51～72
const BED_DIGITS = new RegExp(`^${FLOOR}${ROOM}(\\d)$`);
const noBWing = (floor: string, room: string) => floor === '21' && room >= '51'; // 21 樓只有 A 側

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
  // 樓層 9～21、房號 A 側 01～22 / B 側 51～72、床 1 碼；湊成完整床號才加 '-'，
  // 其他（26 開頭、多打一碼…）一律當病歷號原樣保留（急診會診沒有床號）
  const m = digits.match(BED_DIGITS);
  return m && !noBWing(m[1], m[2]) ? `${m[1]}${m[2]}-${m[3]}` : digits;
};

// 兩種寫法：純數字 912-3（9樓12房3床）、含棟別 9I1-5 / 9A11-2（9樓 I 棟 ICU、A 棟）
// 含棟別的一律要有 '-'，否則 9I212 無從判斷是 2-12 還是 21-2
export const parseBed = (bed: string) => {
  const m = bed.trim().toUpperCase().match(new RegExp(`^${FLOOR}(?:([A-Z])(\\d{1,2})-(\\d{1,2})|${ROOM}-?(\\d?))$`));
  if (!m || (m[5] && noBWing(m[1], m[5]))) return null;
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
