/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface NewPatient {
  id: string;
  bed: string;
  name: string;
  diagnosis: string;
  note: string;
  orderDone: boolean; // 是否開立醫囑
  visited: boolean;   // 是否看病人
  chartDone: boolean; // 是否打完病歷
  createdAt: string;
}

export interface GeneralOrder {
  id: string;
  bed: string;
  name: string;
  diagnosis: string;
  orderTask: string;  // 醫囑開立內容 (nurse request)
  note: string;       // 備註 / 對應狀況
  isCompleted: boolean;
  nurseName?: string; // 通知本床的護理師
  priority: 'low' | 'normal' | 'high';
  createdAt: string;
}

export interface HandoverPatient {
  id: string;
  bed: string;
  name: string;
  diagnosis: string;
  note: string;       // 備註
  attentionPoints: string; // 關注點 / 注意事項 (e.g. 監測 BP, 觀察發燒..)
  status: 'stable' | 'unstable' | 'critical'; // 狀況
  isHandedOver: boolean; // 是否已確實交班
  createdAt: string;
}

export interface DutyState {
  newPatients: NewPatient[];
  generalOrders: GeneralOrder[];
  handoverPatients: HandoverPatient[];
}

export interface SyncStatus {
  lastSynced: string | null;
  isSyncing: boolean;
  statusText: string;
  error: boolean;
}
