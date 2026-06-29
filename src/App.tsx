/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { DutyState, NewPatient, GeneralOrder, HandoverPatient, SyncStatus, Shift } from './types';
import { getInitialState, saveState, formatTime } from './utils';
import { db, auth } from './firebase';
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import LoginScreen from './components/LoginScreen';

// Import UI components
import Header from './components/Header';
import StatsBanner from './components/StatsBanner';

// Icons for clinical cockpit
import {
  Users,
  ListTodo,
  Clipboard,
  Search,
  HeartPulse,
  Plus,
  X,
  Trash2,
  Check,
  Clock,
  PhoneCall,
  Sliders,
  ShieldAlert,
  AlertCircle,
  Sparkles,
  User as UserIcon,
  HeartCrack,
  Activity,
  FileText,
  ChevronDown,
  ChevronUp,
  Sun,
  Moon,
  MoreVertical,
  Pencil,
  Hash,
  GripVertical,
  Eye,
  EyeOff,
  RotateCw
} from 'lucide-react';

export default function App() {
  // Dark mode state with automatic persistent storage
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('duty_dark_mode') === 'true';
  });

  // Active board section selector (New Patients / Orders / Handovers)
  const [mobileTab, setMobileTab] = useState<'new' | 'orders' | 'handovers'>('new');

  // Side-effect to apply the dark theme class to the document node
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('duty_dark_mode', String(isDarkMode));
  }, [isDarkMode]);

  // Density layout switch: true for high-density one-screen overview, false for full expanded card details
  const [isCompact, setIsCompact] = useState<boolean>(true);

  // System console sidebar drawer visibility state
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);

  // Search filter query across all columns in real-time
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);
  const dateDropdownRef = useRef<HTMLDivElement>(null);

  // Core application lists
  const [newPatients, setNewPatients] = useState<NewPatient[]>([]);
  const [generalOrders, setGeneralOrders] = useState<GeneralOrder[]>([]);
  const [handoverPatients, setHandoverPatients] = useState<HandoverPatient[]>([]);

  // Toggles for inline quick-add forms in each column - now placed at the bottom!
  const [showAddPatient, setShowAddPatient] = useState(false);
  const [showAddOrder, setShowAddOrder] = useState(false);
  const [showAddHandover, setShowAddHandover] = useState(false);

  // Quick Phone Call Universal Registration form states
  const [showQuickPhoneAdd, setShowQuickPhoneAdd] = useState(false);
  const [qpBed, setQpBed] = useState('');
  const [qpDiagnosis, setQpDiagnosis] = useState('');
  const [qpContent, setQpContent] = useState('');
  const [qpPriority, setQpPriority] = useState<GeneralOrder['priority']>('normal');
  const [qpError, setQpError] = useState('');

  // Toggle for the main search & switcher dashboard panel, default collapsed!
  const [isDashboardExpanded, setIsDashboardExpanded] = useState(false);

  // Expanded control row state for compact patient cards
  const [expandedControlPatientId, setExpandedControlPatientId] = useState<string | null>(null);
  const [inlineOrderText, setInlineOrderText] = useState('');

  // Edit states to allow clicking on items to edit them, inline!
  const [editingPatientId, setEditingPatientId] = useState<string | null>(null);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editingHandoverId, setEditingHandoverId] = useState<string | null>(null);

  // Filter flags for general completed entries
  const [hideCompletedOrders, setHideCompletedOrders] = useState(false);
  const [hideHandledHandovers, setHideHandledHandovers] = useState(false);
  const [hideCompletedPatients, setHideCompletedPatients] = useState(false);
  const [sortNewPatients, setSortNewPatients] = useState<'bed' | 'user' | 'time'>('time');
  const [userPatientOrder, setUserPatientOrder] = useState<string[]>([]);
  const [isPatientEditMode, setIsPatientEditMode] = useState(false);
  const [dragPatientId, setDragPatientId] = useState<string | null>(null);
  const [dragOverPatientId, setDragOverPatientId] = useState<string | null>(null);

  const [sortOrders, setSortOrders] = useState<'bed' | 'user' | 'time'>('time');
  const [userOrdersOrder, setUserOrdersOrder] = useState<string[]>([]);
  const [isOrderEditMode, setIsOrderEditMode] = useState(false);
  const [dragOrderId, setDragOrderId] = useState<string | null>(null);
  const [dragOverOrderId, setDragOverOrderId] = useState<string | null>(null);

  const [sortHandovers, setSortHandovers] = useState<'bed' | 'user' | 'time'>('time');
  const [userHandoversOrder, setUserHandoversOrder] = useState<string[]>([]);
  const [isHandoverEditMode, setIsHandoverEditMode] = useState(false);
  const [dragHandoverId, setDragHandoverId] = useState<string | null>(null);
  const [dragOverHandoverId, setDragOverHandoverId] = useState<string | null>(null);

  // --- Offline High-Security Storage state variables ---

  const getTodayDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [selectedShiftId, setSelectedShiftId] = useState<string>(() => {
    return localStorage.getItem('duty_selected_shift_id') || localStorage.getItem('duty_selected_date') || '';
  });
  const [availableShifts, setAvailableShifts] = useState<Shift[]>([]);
  const [showAddShiftForm, setShowAddShiftForm] = useState(false);
  const [addShiftStart, setAddShiftStart] = useState(getTodayDateString());
  const [addShiftEnd, setAddShiftEnd] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  });
  const [editingDropdownShiftId, setEditingDropdownShiftId] = useState<string | null>(null);
  const [dropdownEditEnd, setDropdownEditEnd] = useState('');

  // Synchronization status for header
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    lastSynced: new Date().toLocaleTimeString(),
    isSyncing: false,
    statusText: '正在連線至 Firebase...',
    error: false,
  });

  // Firebase auth state
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const isLoadingFromFirestore = useRef(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelNewRef = useRef<HTMLDivElement>(null);
  const panelOrdersRef = useRef<HTMLDivElement>(null);
  const panelHandoversRef = useRef<HTMLDivElement>(null);

  // --- Inline Patient Form Fields ---
  const [pBed, setPBed] = useState('');
  const [pDiagnosis, setPDiagnosis] = useState('');
  const [pNote, setPNote] = useState('');
  const [pError, setPError] = useState('');

  // --- Inline Order Form Fields ---
  const [oBed, setOBed] = useState('');
  const [oName, setOName] = useState('');
  const [oDiagnosis, setODiagnosis] = useState('');
  const [oTask, setOTask] = useState('');
  const [oNote, setONote] = useState('');
  const [oPriority, setOPriority] = useState<GeneralOrder['priority']>('normal');
  const [oError, setOError] = useState('');

  // --- Inline Handover Form Fields ---
  const [hBed, setHBed] = useState('');
  const [hName, setHName] = useState('');
  const [hDiagnosis, setHDiagnosis] = useState('');
  const [hAttn, setHAttn] = useState('');
  const [hNote, setHNote] = useState('');
  const [hStatus, setHStatus] = useState<HandoverPatient['status']>('unstable');
  const [hError, setHError] = useState('');
  
  // --- Refs & Keyboard Navigation for Forms ---
  const pBedRef = useRef<HTMLInputElement>(null);
  const pDiagnosisRef = useRef<HTMLInputElement>(null);
  const editFocusFieldRef = useRef<'bed' | 'diagnosis' | null>('bed');
  const pNoteRef = useRef<HTMLTextAreaElement>(null);

  const oBedRef = useRef<HTMLInputElement>(null);
  const oDiagnosisRef = useRef<HTMLInputElement>(null);
  const oTaskRef = useRef<HTMLTextAreaElement>(null);
  const oEditFocusFieldRef = useRef<'bed' | 'task' | null>('bed');

  const hBedRef = useRef<HTMLInputElement>(null);
  const hEditFocusFieldRef = useRef<'bed' | 'attn' | null>('bed');
  const hDiagnosisRef = useRef<HTMLInputElement>(null);
  const hAttnRef = useRef<HTMLTextAreaElement>(null);

  const qpBedRef = useRef<HTMLInputElement>(null);
  const qpDiagnosisRef = useRef<HTMLInputElement>(null);
  const qpContentRef = useRef<HTMLTextAreaElement>(null);

  const lastEnterRef = useRef<number>(0);

  useEffect(() => {
    if (!isDateDropdownOpen && !showAddShiftForm) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dateDropdownRef.current && !dateDropdownRef.current.contains(e.target as Node)) {
        setIsDateDropdownOpen(false);
        setShowAddShiftForm(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDateDropdownOpen, showAddShiftForm]);

  useEffect(() => {
    if (!isPatientEditMode && !isOrderEditMode && !isHandoverEditMode) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (isPatientEditMode && panelNewRef.current && !panelNewRef.current.contains(target)) {
        setIsPatientEditMode(false);
      }
      if (isOrderEditMode && panelOrdersRef.current && !panelOrdersRef.current.contains(target)) {
        setIsOrderEditMode(false);
      }
      if (isHandoverEditMode && panelHandoversRef.current && !panelHandoversRef.current.contains(target)) {
        setIsHandoverEditMode(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isPatientEditMode, isOrderEditMode, isHandoverEditMode]);

  // Firebase auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Focus the right input when patient form opens
  useEffect(() => {
    if (showAddPatient) {
      const timer = setTimeout(() => {
        if (editFocusFieldRef.current === 'diagnosis') {
          pDiagnosisRef.current?.focus();
        } else if (editFocusFieldRef.current === 'bed') {
          pBedRef.current?.focus();
        }
        // null = open without focusing any field
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [showAddPatient, editingPatientId]);

  // Focus the right input when order form opens
  useEffect(() => {
    if (showAddOrder) {
      const timer = setTimeout(() => {
        if (oEditFocusFieldRef.current === 'task') {
          oTaskRef.current?.focus();
        } else if (oEditFocusFieldRef.current === 'bed') {
          oBedRef.current?.focus();
        }
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [showAddOrder, editingOrderId]);

  // Focus the right input when handover form opens
  useEffect(() => {
    if (showAddHandover) {
      const timer = setTimeout(() => {
        if (hEditFocusFieldRef.current === 'attn') {
          hAttnRef.current?.focus();
        } else if (hEditFocusFieldRef.current === 'bed') {
          hBedRef.current?.focus();
        }
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [showAddHandover, editingHandoverId]);

  // Focus Bed input when quick phone form is toggled active
  useEffect(() => {
    if (showQuickPhoneAdd) {
      const timer = setTimeout(() => {
        qpBedRef.current?.focus();
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [showQuickPhoneAdd]);

  // Jump to the next field when pressing Space or Enter in a Bed field
  const handleKeyJump = (
    e: React.KeyboardEvent<HTMLInputElement>,
    nextRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>
  ) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      nextRef.current?.focus();
    }
  };

  // Handler for textareas: single Enter creates a newline, double Enter triggers submitFn
  const handleTextAreaKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    submitFn: () => void
  ) => {
    if (e.key === 'Enter') {
      const now = Date.now();
      if (now - lastEnterRef.current < 450) {
        e.preventDefault();
        submitFn();
      } else {
        lastEnterRef.current = now;
      }
    }
  };

  // 1. Load available shifts from Firebase when user logs in (with migration from old dates format)
  useEffect(() => {
    if (!user) return;
    const loadShifts = async () => {
      try {
        const metaRef = doc(db, 'users', user.uid, 'metadata', 'summary');
        const metaSnap = await getDoc(metaRef);
        let shiftsList: Shift[] = metaSnap.exists() ? (metaSnap.data().shifts || []) : [];

        // Migrate old single-date format to shift format (one-time)
        if (shiftsList.length === 0 && metaSnap.exists()) {
          const oldDates: string[] = metaSnap.data().dates || [];
          if (oldDates.length > 0) {
            shiftsList = oldDates.map(d => ({ id: d, startDate: d, endDate: d }));
            await setDoc(metaRef, { shifts: shiftsList }, { merge: true });
          }
        }

        setAvailableShifts(shiftsList);
        if (shiftsList.length > 0 && !shiftsList.find(s => s.id === selectedShiftId)) {
          setSelectedShiftId(shiftsList[0].id);
          localStorage.setItem('duty_selected_shift_id', shiftsList[0].id);
        }
      } catch (e) {
        console.error('Error loading shifts', e);
        setAvailableShifts([]);
      }
    };
    loadShifts();
  }, [user]);

  const handleAddShift = async (startDate: string, endDate: string) => {
    const id = startDate; // use startDate as ID — backward-compatible with dates/ Firebase path
    if (availableShifts.find(s => s.id === id)) return; // already exists
    const newShift: Shift = { id, startDate, endDate };
    const newList = [newShift, ...availableShifts].sort((a, b) => b.startDate.localeCompare(a.startDate));
    setAvailableShifts(newList);
    setSelectedShiftId(id);
    localStorage.setItem('duty_selected_shift_id', id);
    setShowAddShiftForm(false);
    if (user) {
      try {
        const metaRef = doc(db, 'users', user.uid, 'metadata', 'summary');
        await setDoc(metaRef, { shifts: newList }, { merge: true });
      } catch (e) {
        console.error('Error adding shift', e);
      }
    }
  };

  const handleEditShift = async (id: string, startDate: string, endDate: string) => {
    const updated = availableShifts.map(s => s.id === id ? { ...s, startDate, endDate } : s);
    setAvailableShifts(updated);
    if (user) {
      try {
        const metaRef = doc(db, 'users', user.uid, 'metadata', 'summary');
        await setDoc(metaRef, { shifts: updated }, { merge: true });
      } catch (e) {
        console.error('Error editing shift', e);
      }
    }
  };

  const handleDeleteShift = async (id: string) => {
    const updated = availableShifts.filter(s => s.id !== id);
    setAvailableShifts(updated);
    if (selectedShiftId === id && updated.length > 0) {
      setSelectedShiftId(updated[0].id);
      localStorage.setItem('duty_selected_shift_id', updated[0].id);
    }
    if (user) {
      try {
        const metaRef = doc(db, 'users', user.uid, 'metadata', 'summary');
        await setDoc(metaRef, { shifts: updated }, { merge: true });
      } catch (e) {
        console.error('Error deleting shift', e);
      }
    }
  };

  // 2. Real-time listener for selectedShiftId — auto-syncs across devices
  useEffect(() => {
    if (!user || !selectedShiftId) return;
    isLoadingFromFirestore.current = true;
    setSyncStatus({ lastSynced: null, isSyncing: true, statusText: '從 Firebase 載入中...', error: false });

    const dateRef = doc(db, 'users', user.uid, 'dates', selectedShiftId);
    const unsub = onSnapshot(dateRef, (snap) => {
      // Skip snapshots caused by our own pending writes to avoid save loops
      if (snap.metadata.hasPendingWrites) return;

      isLoadingFromFirestore.current = true;
      if (snap.exists()) {
        const data = snap.data();
        setNewPatients(data.patients || []);
        setGeneralOrders(data.orders || []);
        setHandoverPatients(data.handovers || []);
      } else {
        setNewPatients([]);
        setGeneralOrders([]);
        setHandoverPatients([]);
      }
      const t = new Date().toLocaleTimeString('zh-TW', { hour12: false, hour: '2-digit', minute: '2-digit' });
      setSyncStatus({ lastSynced: new Date().toLocaleTimeString(), isSyncing: false, statusText: `☁️ Firebase 雲端同步 · ${t} 已載入`, error: false });
      setTimeout(() => { isLoadingFromFirestore.current = false; }, 200);
    }, (_err) => {
      setSyncStatus({ lastSynced: null, isSyncing: false, statusText: '⚠️ Firebase 載入失敗，請確認網路', error: true });
      isLoadingFromFirestore.current = false;
    });

    return () => unsub();
  }, [user, selectedShiftId]);

  // 3. Index bed→diagnosis mapping for autofill suggestions (diagnosis only, no cross-shift patient data)
  useEffect(() => {
    try {
      const profiles = getValidBedProfiles();

      const updateDiagnosis = (bed: string, diagnosis: string, skip: string[]) => {
        if (!bed || !diagnosis || skip.includes(diagnosis)) return;
        const key = bed.trim().toUpperCase();
        if (!key) return;
        profiles[key] = { ...(profiles[key] || {}), bed: key, diagnosis };
      };

      newPatients.forEach(p => updateDiagnosis(p.bed, p.diagnosis, ['無']));
      generalOrders.forEach(o => updateDiagnosis(o.bed, o.diagnosis, ['無', '無確切診斷']));
      handoverPatients.forEach(h => updateDiagnosis(h.bed, h.diagnosis, ['無', '無確切診斷']));

      localStorage.setItem(BED_PROFILES_KEY, JSON.stringify(profiles));
      if (!localStorage.getItem(BED_PROFILES_DATE_KEY)) {
        localStorage.setItem(BED_PROFILES_DATE_KEY, new Date().toISOString());
      }
    } catch (e) {
      console.error('Error syncing bed profiles', e);
    }
  }, [newPatients, generalOrders, handoverPatients]);

  // 4. Debounced auto-save to Firebase on any state change
  useEffect(() => {
    if (!user || !selectedShiftId || isLoadingFromFirestore.current) return;

    setSyncStatus(prev => ({ ...prev, isSyncing: true, statusText: '同步中...' }));

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const dateRef = doc(db, 'users', user.uid, 'dates', selectedShiftId);
        await setDoc(dateRef, {
          patients: newPatients,
          orders: generalOrders,
          handovers: handoverPatients,
          updatedAt: serverTimestamp(),
        });

        const t = new Date().toLocaleTimeString('zh-TW', { hour12: false, hour: '2-digit', minute: '2-digit' });
        setSyncStatus({ lastSynced: new Date().toLocaleTimeString(), isSyncing: false, statusText: `☁️ 已同步 · ${t}`, error: false });
      } catch (e) {
        setSyncStatus({ lastSynced: null, isSyncing: false, statusText: '⚠️ Firebase 同步失敗，請確認網路', error: true });
      }
    }, 300);

    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [user, selectedShiftId, newPatients, generalOrders, handoverPatients]);

  // --- Secure DUAL-MODE Mutators for Database Operations ---
  // Helper to remove any undefined properties recursively to prevent Firestore crashes
  const cleanUndefined = (obj: any): any => {
    if (obj === null || obj === undefined) return null;
    if (Array.isArray(obj)) {
      return obj.map(cleanUndefined);
    }
    if (typeof obj === 'object') {
      const clean: any = {};
      for (const key of Object.keys(obj)) {
        const val = obj[key];
        if (val !== undefined) {
          clean[key] = cleanUndefined(val);
        }
      }
      return clean;
    }
    return obj;
  };

  const addPatient = (p: NewPatient) => {
    setNewPatients((prev) => [p, ...prev]);
  };

  const updatePatient = (pId: string, updates: Partial<NewPatient>) => {
    setNewPatients((prev) => prev.map((item) => (item.id === pId ? { ...item, ...updates } : item)));
  };

  const deletePatient = (pId: string) => {
    setNewPatients((prev) => prev.filter((item) => item.id !== pId));
  };

  const addOrder = (o: GeneralOrder) => {
    setGeneralOrders((prev) => [o, ...prev]);
  };

  const updateOrder = (oId: string, updates: Partial<GeneralOrder>) => {
    setGeneralOrders((prev) => prev.map((item) => (item.id === oId ? { ...item, ...updates } : item)));
  };

  const deleteOrder = (oId: string) => {
    setGeneralOrders((prev) => prev.filter((item) => item.id !== oId));
  };

  const addHandover = (h: HandoverPatient) => {
    setHandoverPatients((prev) => [h, ...prev]);
  };

  const updateHandover = (hId: string, updates: Partial<HandoverPatient>) => {
    setHandoverPatients((prev) => prev.map((item) => (item.id === hId ? { ...item, ...updates } : item)));
  };

  const deleteHandover = (hId: string) => {
    setHandoverPatients((prev) => prev.filter((item) => item.id !== hId));
  };

  const BED_PROFILES_KEY = `bed_profiles_${selectedShiftId || 'global'}`;
  const BED_PROFILES_DATE_KEY = `bed_profiles_${selectedShiftId || 'global'}_date`;

  const getValidBedProfiles = (): Record<string, any> => {
    try {
      const dateStr = localStorage.getItem(BED_PROFILES_DATE_KEY);
      if (dateStr) {
        const diffMs = Date.now() - new Date(dateStr).getTime();
        if (diffMs >= 2 * 24 * 60 * 60 * 1000) {
          localStorage.removeItem(BED_PROFILES_KEY);
          localStorage.removeItem(BED_PROFILES_DATE_KEY);
          return {};
        }
      }
      const savedStr = localStorage.getItem(BED_PROFILES_KEY);
      return savedStr ? JSON.parse(savedStr) : {};
    } catch (e) {
      return {};
    }
  };

  const checkAndAutofillBed = (inputBed: string, type: 'patient' | 'order' | 'handover') => {
    const norm = inputBed.trim().toUpperCase();
    if (!norm) return;
    try {
      const profile = getValidBedProfiles()[norm];
      if (profile?.diagnosis) {
        if (type === 'patient') setPDiagnosis(profile.diagnosis);
        else if (type === 'order') setODiagnosis(profile.diagnosis);
        else if (type === 'handover') setHDiagnosis(profile.diagnosis);
      }
    } catch (e) {
      console.error('Error in checkAndAutofillBed', e);
    }
  };

  const checkAndAutofillQpBed = (inputBed: string) => {
    const norm = inputBed.trim().toUpperCase();
    if (!norm) return;
    try {
      const profiles = getValidBedProfiles();
      const profile = profiles[norm];
      if (profile && profile.diagnosis) {
        setQpDiagnosis(profile.diagnosis);
      }
    } catch (e) {
      console.error('Error in checkAndAutofillQpBed', e);
    }
  };


  const dispatchToPatient = () => {
    if (!qpBed.trim()) {
      setQpError('請輸入床號！');
      return;
    }
    const newP: NewPatient = {
      id: `new-${Date.now()}`,
      bed: qpBed.trim().toUpperCase(),
      name: '',
      diagnosis: qpDiagnosis.trim(),
      note: qpContent.trim(),
      orderDone: false,
      visited: false,
      chartDone: false,
      createdAt: new Date().toISOString()
    };
    addPatient(newP);
    setShowQuickPhoneAdd(false);
    setMobileTab('new');
    clearQp();
  };

  const dispatchToOrder = () => {
    if (!qpBed.trim()) {
      setQpError('請輸入床號！');
      return;
    }
    const newO: GeneralOrder = {
      id: `order-${Date.now()}`,
      bed: qpBed.trim().toUpperCase(),
      name: '',
      diagnosis: qpDiagnosis.trim(),
      orderTask: qpContent.trim(),
      note: '',
      isCompleted: false,
      priority: qpPriority,
      createdAt: new Date().toISOString()
    };
    addOrder(newO);
    setShowQuickPhoneAdd(false);
    setMobileTab('orders');
    clearQp();
  };

  const dispatchToHandover = () => {
    if (!qpBed.trim()) {
      setQpError('請輸入床號！');
      return;
    }
    const newH: HandoverPatient = {
      id: `handover-${Date.now()}`,
      bed: qpBed.trim().toUpperCase(),
      name: '',
      diagnosis: qpDiagnosis.trim(),
      note: '',
      attentionPoints: qpContent.trim(),
      status: 'unstable',
      isHandedOver: false,
      createdAt: new Date().toISOString()
    };
    addHandover(newH);
    setShowQuickPhoneAdd(false);
    setMobileTab('handovers');
    clearQp();
  };

  const clearQp = () => {
    setQpBed('');
    setQpDiagnosis('');
    setQpContent('');
    setQpPriority('normal');
    setQpError('');
  };

  // --- Handlers for high-level operations ---
  const handleImport = (newState: DutyState) => {
    setNewPatients(newState.newPatients || []);
    setGeneralOrders(newState.generalOrders || []);
    setHandoverPatients(newState.handoverPatients || []);
    // Debounced save effect will sync to Firebase automatically
  };

  const handleClear = () => {
    setNewPatients([]);
    setGeneralOrders([]);
    setHandoverPatients([]);
    // Debounced save effect will sync empty state to Firebase
  };

  // --- List Mutation Handlers ---
  const handleAddPatientSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pBed.trim()) {
      setPError('請輸入床號！');
      return;
    }

    if (editingPatientId) {
      // Edit Mode
      updatePatient(editingPatientId, {
        bed: pBed.trim().toUpperCase(),
        name: '',
        diagnosis: pDiagnosis.trim(),
        note: pNote.trim()
      });
      setEditingPatientId(null);
    } else {
      // Add Mode
      const newP: NewPatient = {
        id: `new-${Date.now()}`,
        bed: pBed.trim().toUpperCase(),
        name: '',
        diagnosis: pDiagnosis.trim(),
        note: pNote.trim(),
        orderDone: false,
        visited: false,
        chartDone: false,
        createdAt: new Date().toISOString()
      };
      addPatient(newP);
    }
    
    // Reset fields
    setPBed('');
    setPDiagnosis('');
    setPNote('');
    setPError('');
    setShowAddPatient(false);
  };

  const handleAddOrderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!oBed.trim()) {
      setOError('請輸入床號！');
      return;
    }
    if (!oTask.trim()) {
      setOError('請輸入需補開的任務/醫囑！');
      return;
    }

    const orderName = oName.trim();

    if (editingOrderId) {
      // Edit Mode
      updateOrder(editingOrderId, {
        bed: oBed.trim().toUpperCase(),
        name: orderName,
        orderTask: oTask.trim(),
        diagnosis: oDiagnosis.trim(),
        note: oNote.trim(),
        priority: oPriority
      });
      setEditingOrderId(null);
    } else {
      // Add Mode
      const newO: GeneralOrder = {
        id: `order-${Date.now()}`,
        bed: oBed.trim().toUpperCase(),
        name: orderName,
        diagnosis: oDiagnosis.trim(),
        orderTask: oTask.trim(),
        note: oNote.trim(),
        isCompleted: false,
        priority: oPriority,
        createdAt: new Date().toISOString()
      };
      addOrder(newO);
    }

    // Reset fields
    setOBed('');
    setOName('');
    setODiagnosis('');
    setOTask('');
    setONote('');
    setOPriority('normal');
    setOError('');
    setShowAddOrder(false);
  };

  const handleAddHandoverSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hBed.trim()) {
      setHError('請輸入床號！');
      return;
    }
    if (!hAttn.trim()) {
      setHError('請輸入特別關注指引！');
      return;
    }

    const handoverName = hName.trim();

    if (editingHandoverId) {
      // Edit Mode
      updateHandover(editingHandoverId, {
        bed: hBed.trim().toUpperCase(),
        name: handoverName,
        diagnosis: hDiagnosis.trim(),
        attentionPoints: hAttn.trim(),
        status: hStatus,
        note: hNote.trim()
      });
      setEditingHandoverId(null);
    } else {
      // Add Mode
      const newH: HandoverPatient = {
        id: `handover-${Date.now()}`,
        bed: hBed.trim().toUpperCase(),
        name: handoverName,
        diagnosis: hDiagnosis.trim(),
        note: hNote.trim(),
        attentionPoints: hAttn.trim(),
        status: hStatus,
        isHandedOver: false,
        createdAt: new Date().toISOString()
      };
      addHandover(newH);
    }

    // Reset fields
    setHBed('');
    setHName('');
    setHDiagnosis('');
    setHAttn('');
    setHNote('');
    setHStatus('unstable');
    setHError('');
    setShowAddHandover(false);
  };

  // --- Filtering & Searching logic across columns with premium deep-matching ---

  // ponytail: floor(8-21) + room(01-21=A, 50-72=B) + optional bed digit(1-3)
  const parseBed = (bed: string): number => {
    const m = bed.trim().match(/^(8|9|1[0-9]|2[01])(\d{2})(\d?)$/);
    if (!m) return 999999;
    return parseInt(m[1]) * 1000 + parseInt(m[2]) * 10 + (m[3] ? parseInt(m[3]) : 0);
  };

  const renderBed = (bed: string) => {
    const m = bed.trim().match(/^(8|9|1[0-9]|2[01])(\d{2})(\d?)$/);
    if (!m) return <>{bed}</>;
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center' }}>
        <span>{m[1]}</span>
        <span>{m[2]}</span>
        {m[3] && <span style={{ fontWeight: 400 }}>-{m[3]}</span>}
      </span>
    );
  };

  const qStr = searchQuery.toLowerCase().trim();

  const filteredNew = newPatients.filter(p => {
    if (hideCompletedPatients && p.orderDone && p.visited && p.chartDone) return false;
    if (!qStr) return true;
    return p.bed.toLowerCase().includes(qStr) ||
           (p.name && p.name.toLowerCase().includes(qStr)) ||
           (p.diagnosis && p.diagnosis.toLowerCase().includes(qStr)) ||
           (p.note && p.note.toLowerCase().includes(qStr));
  }).sort((a, b) => {
    const aDone = a.orderDone && a.visited && a.chartDone;
    const bDone = b.orderDone && b.visited && b.chartDone;
    if (aDone !== bDone) return aDone ? 1 : -1;
    if (sortNewPatients === 'bed') return parseBed(a.bed) - parseBed(b.bed);
    if (sortNewPatients === 'user') {
      const ai = userPatientOrder.indexOf(a.id);
      const bi = userPatientOrder.indexOf(b.id);
      if (ai === -1 && bi === -1) return a.createdAt.localeCompare(b.createdAt);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    }
    return b.createdAt.localeCompare(a.createdAt);
  });

  const filteredOrders = generalOrders.filter(o => {
    if (hideCompletedOrders && o.isCompleted) return false;
    if (!qStr) return true;
    return o.bed.toLowerCase().includes(qStr) ||
           (o.name && o.name !== '不具名' && o.name && o.name !== '不具名'.toLowerCase().includes(qStr)) ||
           (o.diagnosis && o.diagnosis.toLowerCase().includes(qStr)) ||
           o.orderTask.toLowerCase().includes(qStr) ||
           (o.note && o.note.toLowerCase().includes(qStr));
  }).sort((a, b) => {
    if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
    if (sortOrders === 'bed') return parseBed(a.bed) - parseBed(b.bed);
    if (sortOrders === 'user') {
      const ai = userOrdersOrder.indexOf(a.id);
      const bi = userOrdersOrder.indexOf(b.id);
      if (ai === -1 && bi === -1) return (b.createdAt || '').localeCompare(a.createdAt || '');
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    }
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });

  const filteredHandovers = handoverPatients.filter(h => {
    if (hideHandledHandovers && h.isHandedOver) return false;
    if (!qStr) return true;
    return h.bed.toLowerCase().includes(qStr) ||
           (h.name && h.name !== '不具名' && h.name && h.name !== '不具名'.toLowerCase().includes(qStr)) ||
           (h.diagnosis && h.diagnosis.toLowerCase().includes(qStr)) ||
           h.attentionPoints.toLowerCase().includes(qStr) ||
           (h.note && h.note.toLowerCase().includes(qStr));
  }).sort((a, b) => {
    if (sortHandovers === 'bed') return parseBed(a.bed) - parseBed(b.bed);
    if (sortHandovers === 'user') {
      const ai = userHandoversOrder.indexOf(a.id);
      const bi = userHandoversOrder.indexOf(b.id);
      if (ai === -1 && bi === -1) return (a.createdAt || '').localeCompare(b.createdAt || '');
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    }
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });

  const currentDutyState: DutyState = {
    newPatients,
    generalOrders,
    handoverPatients,
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-400 text-sm">連線中...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  const handleSignOut = () => signOut(auth);

  return (
    <div className="flex flex-col min-h-screen bg-slate-50/50 selection:bg-indigo-100" id="main-layout-root">
      {/* Universal Sync banner or static top-bar */}
      <Header
        state={currentDutyState}
        syncStatus={syncStatus}
        onImport={handleImport}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        user={user}
        onSignOut={handleSignOut}
        availableShifts={availableShifts}
        selectedShiftId={selectedShiftId}
        onSelectShift={(id) => {
          setSelectedShiftId(id);
          localStorage.setItem('duty_selected_shift_id', id);
        }}
        onEditShift={handleEditShift}
        onDeleteShift={handleDeleteShift}
      />

      {/* Main Container */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-2 py-2.5 md:px-3 md:py-3.5" id="dashboard-content-main">
        {/* Compact, tightly-spaced control ribbon replacing bulky header */}
        <div className="flex flex-col gap-2.5 pb-2.5 mb-3 px-0.5 text-xs border-b border-slate-200/40" id="inline-sys-controls">
          {/* Row 1: single top bar (mobile + desktop) */}
          <div className="flex flex-row items-center gap-2 bg-white border border-slate-200/50 py-2 px-3 md:px-4 rounded-xl shadow-sm w-full select-none">

            {/* LEFT: wordmark + date — hidden on mobile when search is expanded */}
            <div className={`items-center gap-3 shrink-0 ${isMobileSearchOpen ? 'hidden md:flex' : 'flex'}`}>
              <span className="text-sm font-bold tracking-tight text-slate-800 font-sans">Duty List</span>
              <div className="h-4 w-px bg-slate-200 shrink-0"></div>

              {/* Shift selector + add button (shared ref for click-outside) */}
              <div ref={dateDropdownRef} className="relative flex items-center gap-1">
                {/* Dropdown toggle */}
                <button
                  type="button"
                  onClick={() => { setIsDateDropdownOpen(o => !o); setShowAddShiftForm(false); }}
                  className={`flex items-center gap-1 text-sm font-semibold px-2 py-1 rounded-lg transition-all cursor-pointer ${
                    isDateDropdownOpen ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                  title="選擇值班區間"
                >
                  {(() => {
                    const shift = availableShifts.find(s => s.id === selectedShiftId);
                    const today = getTodayDateString();
                    if (!shift) return <span className="text-slate-400">無值班</span>;
                    const isActive = today >= shift.startDate && today <= shift.endDate;
                    const label = shift.startDate === shift.endDate
                      ? shift.startDate.slice(5).replace('-', '/')
                      : `${shift.startDate.slice(5).replace('-', '/')}–${shift.endDate.slice(5).replace('-', '/')}`;
                    return (
                      <>
                        {isActive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />}
                        <span>{label}</span>
                      </>
                    );
                  })()}
                  <ChevronDown size={11} className={`text-slate-400 transition-transform duration-200 ${isDateDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Shift list dropdown */}
                {isDateDropdownOpen && (
                  <div className="absolute left-0 top-full mt-1.5 bg-white border border-slate-200/80 rounded-xl z-50 py-1.5 min-w-[180px] shadow-lg">
                    {availableShifts.length === 0 && (
                      <div className="px-3 py-2 text-xs text-slate-400">尚無值班記錄</div>
                    )}
                    {availableShifts.map(s => {
                      const today = getTodayDateString();
                      const isActive = today >= s.startDate && today <= s.endDate;
                      const isSelected = s.id === selectedShiftId;
                      const isEditingThis = editingDropdownShiftId === s.id;
                      const label = s.startDate === s.endDate
                        ? s.startDate.slice(5).replace('-', '/')
                        : `${s.startDate.slice(5).replace('-', '/')}–${s.endDate.slice(5).replace('-', '/')}`;

                      if (isEditingThis) {
                        return (
                          <div key={s.id} className="px-2.5 py-2 space-y-1.5 border-b border-slate-100 last:border-0">
                            <p className="text-[10px] text-slate-400 font-semibold">{s.startDate.slice(5).replace('-','/')} 開始 → 結束日</p>
                            <input
                              type="date"
                              value={dropdownEditEnd}
                              min={s.startDate}
                              onChange={e => setDropdownEditEnd(e.target.value)}
                              autoFocus
                              className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                            />
                            <div className="flex gap-1.5">
                              <button
                                type="button"
                                onClick={() => setEditingDropdownShiftId(null)}
                                className="flex-1 py-1 text-[10px] text-slate-400 hover:bg-slate-100 rounded-lg cursor-pointer"
                              >取消</button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (dropdownEditEnd) {
                                    handleEditShift(s.id, s.startDate, dropdownEditEnd);
                                    setEditingDropdownShiftId(null);
                                  }
                                }}
                                className="flex-1 py-1 text-[10px] bg-indigo-600 text-white font-bold rounded-lg cursor-pointer hover:bg-indigo-700"
                              >儲存</button>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={s.id}
                          className={`flex items-center gap-1 px-2 py-1.5 transition-colors ${
                            isSelected ? 'bg-slate-50' : 'hover:bg-slate-50'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedShiftId(s.id);
                              localStorage.setItem('duty_selected_shift_id', s.id);
                              setIsDateDropdownOpen(false);
                              setEditingDropdownShiftId(null);
                            }}
                            className="flex-1 flex items-center gap-2 text-left cursor-pointer"
                          >
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-200'}`} />
                            <span className={`text-sm font-${isSelected ? 'semibold text-slate-900' : 'medium text-slate-600'}`}>{label}</span>
                            {isSelected && <Check size={10} className="text-slate-400 shrink-0" />}
                          </button>
                          <button
                            type="button"
                            title="修改結束日期"
                            onClick={e => {
                              e.stopPropagation();
                              setEditingDropdownShiftId(s.id);
                              setDropdownEditEnd(s.endDate);
                            }}
                            className="w-6 h-6 flex items-center justify-center text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer shrink-0"
                          >
                            <Pencil size={10} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add shift button — amber pulse when today not covered by any shift */}
                {(() => {
                  const today = getTodayDateString();
                  const todayCovered = availableShifts.some(s => today >= s.startDate && today <= s.endDate);
                  return todayCovered ? (
                    <button
                      type="button"
                      onClick={() => { setShowAddShiftForm(o => !o); setIsDateDropdownOpen(false); }}
                      title="新增值班區間"
                      className="flex items-center justify-center w-5 h-5 rounded-full text-slate-300 hover:text-slate-500 hover:bg-slate-100 transition-all cursor-pointer"
                    >
                      <Plus size={11} strokeWidth={2.5} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setShowAddShiftForm(o => !o); setIsDateDropdownOpen(false); }}
                      title="新增今日值班"
                      className="relative flex items-center justify-center w-5 h-5 rounded-full bg-amber-400 hover:bg-amber-500 text-white shadow-sm transition-all cursor-pointer hover:scale-110 active:scale-95"
                    >
                      <span className="absolute inset-0 rounded-full bg-amber-400 animate-ping opacity-60" />
                      <Plus size={11} className="stroke-[3] relative z-10" />
                    </button>
                  );
                })()}

                {/* Add shift popover form */}
                {showAddShiftForm && (
                  <div className="absolute left-0 top-full mt-1.5 bg-white border border-slate-200/80 rounded-xl z-50 p-3 shadow-lg min-w-[200px]">
                    <p className="text-[11px] font-semibold text-slate-500 mb-2">新增值班區間</p>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-slate-400 w-8 shrink-0">開始</span>
                        <input
                          type="date"
                          value={addShiftStart}
                          onChange={e => setAddShiftStart(e.target.value)}
                          className="flex-1 text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-slate-400 w-8 shrink-0">結束</span>
                        <input
                          type="date"
                          value={addShiftEnd}
                          min={addShiftStart}
                          onChange={e => setAddShiftEnd(e.target.value)}
                          className="flex-1 text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        />
                      </div>
                      {availableShifts.find(s => s.id === addShiftStart) && (
                        <p className="text-[10px] text-amber-600">此開始日期已存在</p>
                      )}
                      <button
                        type="button"
                        disabled={!addShiftStart || !addShiftEnd || !!availableShifts.find(s => s.id === addShiftStart)}
                        onClick={() => handleAddShift(addShiftStart, addShiftEnd)}
                        className="w-full py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-lg transition-all cursor-pointer"
                      >
                        建立值班
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* DESKTOP: phone button inline in Row 1 */}
            {!isMobileSearchOpen && (
              <div className="hidden md:flex flex-1 items-center justify-center px-1">
                <button
                  type="button"
                  id="quick-phone-add-trigger-desktop"
                  onClick={() => { setShowQuickPhoneAdd(!showQuickPhoneAdd); clearQp(); }}
                  className={`flex items-stretch rounded-full overflow-hidden border transition-all cursor-pointer duration-200 shadow-xs ${
                    showQuickPhoneAdd ? 'border-rose-300/60' : 'border-emerald-400/50'
                  }`}
                >
                  <span className={`flex items-center justify-center px-3 py-1.5 shrink-0 ${showQuickPhoneAdd ? 'bg-rose-600' : 'bg-emerald-600'}`}>
                    <PhoneCall size={13} className="text-white" />
                  </span>
                  <span className={`w-px shrink-0 ${showQuickPhoneAdd ? 'bg-rose-300/50' : 'bg-emerald-400/40'}`} />
                  <span className={`flex items-center justify-center px-5 py-1.5 text-sm font-medium ${showQuickPhoneAdd ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-800'}`}>
                    {showQuickPhoneAdd ? '關閉速記' : '電話速記'}
                  </span>
                </button>
              </div>
            )}

            {/* MOBILE: expanded search input */}
            {isMobileSearchOpen && (
              <div className="flex md:hidden flex-1 items-center gap-1.5">
                <Search size={13} className="text-slate-400 shrink-0" />
                <input
                  type="text"
                  autoComplete="off"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜尋"
                  className="flex-1 text-sm bg-transparent focus:outline-hidden text-slate-800 min-w-0"
                  autoFocus
                />
              </div>
            )}

            {/* RIGHT */}
            <div className="flex items-center gap-1 shrink-0 ml-auto md:ml-0">
              {/* Desktop search */}
              <div className="hidden md:relative md:flex md:items-center md:mr-1">
                <Search size={13} className="absolute left-2.5 text-slate-400 pointer-events-none" />
                <input
                  id="search-input-box"
                  type="text"
                  autoComplete="off"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜尋"
                  className="w-28 text-sm pl-8 pr-6 py-1.5 border border-slate-200 focus:border-indigo-400 rounded-lg bg-slate-50 focus:bg-white focus:outline-hidden transition-all"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-2 text-[10px] text-slate-400 hover:text-slate-600 top-1/2 -translate-y-1/2 cursor-pointer">✕</button>
                )}
              </div>

              {/* Mobile: search icon (collapsed) / X (expanded) */}
              {isMobileSearchOpen ? (
                <button
                  type="button"
                  onClick={() => { setIsMobileSearchOpen(false); setSearchQuery(''); }}
                  className="flex md:hidden w-8 h-8 items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
                >
                  <X size={15} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsMobileSearchOpen(true)}
                  className="flex md:hidden w-8 h-8 items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
                >
                  <Search size={15} />
                </button>
              )}

              {/* Settings — hidden on mobile when search expanded */}
              <button
                type="button"
                onClick={() => setIsSidebarOpen(true)}
                className={`w-8 h-8 items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all cursor-pointer shrink-0 ${isMobileSearchOpen ? 'hidden md:flex' : 'flex'}`}
                title="主控台"
              >
                <Sliders size={14} />
              </button>

              {/* Refresh */}
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all cursor-pointer shrink-0"
                title="重新整理"
              >
                <RotateCw size={14} />
              </button>

            </div>
          </div>

          {/* Row 2: MOBILE ONLY — 電話速記 full-width button */}
          <div className="flex md:hidden">
            <button
              type="button"
              id="quick-phone-add-trigger-mobile"
              onClick={() => { setShowQuickPhoneAdd(!showQuickPhoneAdd); clearQp(); }}
              className={`flex items-stretch rounded-full overflow-hidden border transition-all cursor-pointer duration-200 w-full shadow-xs ${
                showQuickPhoneAdd ? 'border-rose-300/60' : 'border-emerald-400/50'
              }`}
            >
              <span className={`flex items-center justify-center px-3 py-2 shrink-0 ${showQuickPhoneAdd ? 'bg-rose-600' : 'bg-emerald-600'}`}>
                <PhoneCall size={13} className="text-white" />
              </span>
              <span className={`w-px shrink-0 ${showQuickPhoneAdd ? 'bg-rose-300/50' : 'bg-emerald-400/40'}`} />
              <span className={`flex items-center justify-center flex-1 py-2 text-sm font-medium ${showQuickPhoneAdd ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-800'}`}>
                {showQuickPhoneAdd ? '關閉速記' : '電話速記'}
              </span>
            </button>
          </div>
        </div>      {/* 📞護理師來電：萬用快速登記面板 (全螢幕加大版) */}
        {showQuickPhoneAdd && (
          <div 
            id="panel-quick-phone-add"
            className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-start justify-center pt-4 px-3 md:pt-8 md:px-6"
          >
            <div className="w-full max-w-4xl bg-gradient-to-b from-emerald-50 to-white dark:to-slate-100 rounded-2xl shadow-2xl border border-emerald-100 dark:border-slate-200/40 flex flex-col max-h-[92vh] animate-scale-up duration-200">
              {/* Header: dispatch buttons left, continue+close right */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-emerald-100/50 shrink-0">
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={dispatchToPatient} className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-all active:scale-95 cursor-pointer">
                    <Plus size={11} className="stroke-[3]" /><span>新病人</span>
                  </button>
                  <button type="button" onClick={dispatchToOrder} className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg transition-all active:scale-95 cursor-pointer">
                    <Plus size={11} className="stroke-[3]" /><span>醫囑</span>
                  </button>
                  <button type="button" onClick={dispatchToHandover} className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold rounded-lg transition-all active:scale-95 cursor-pointer">
                    <Plus size={11} className="stroke-[3]" /><span>交班</span>
                  </button>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => { setShowQuickPhoneAdd(false); clearQp(); }}
                    className="text-slate-400 hover:text-slate-650 hover:bg-slate-100 w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer text-lg font-bold"
                    title="關閉"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Form Content Area */}
              <div className="p-6 md:p-8 flex flex-col gap-5 overflow-y-auto flex-grow">
                {/* Row 1: Bed Input, Diagnosis Input in the same line */}
                <div className="flex items-center gap-3 w-full">
                  <div className="flex-1 max-w-[80px] flex items-center bg-emerald-50/50 px-2.5 py-1.5 rounded-xl border border-emerald-150">
                    <input
                      ref={qpBedRef}
                      required
                      type="text"
                      pattern="\d*"
                      inputMode="numeric"
                      value={qpBed}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        setQpBed(val);
                        setQpError('');
                        checkAndAutofillQpBed(val);
                      }}
                      onKeyDown={(e) => handleKeyJump(e, qpDiagnosisRef)}
                      placeholder="床號 *"
                      className="w-full text-center font-mono text-sm font-bold bg-transparent text-emerald-850 focus:outline-hidden"
                      title="床號 (必填)"
                    />
                  </div>

                  <div className="flex-2 flex-grow flex items-center bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                    <input
                      ref={qpDiagnosisRef}
                      type="text"
                      value={qpDiagnosis}
                      onChange={(e) => setQpDiagnosis(e.target.value)}
                      onKeyDown={(e) => handleKeyJump(e, qpContentRef)}
                      placeholder="診斷 (主要診斷/病因)"
                      autoComplete="off"
                      className="w-full text-sm bg-transparent text-slate-800 focus:outline-hidden"
                      title="主要診斷/病因"
                    />
                  </div>
                </div>

                {/* Row 2: Detail Content Input (交代之細節/項目) */}
                <div className="flex flex-col gap-1.5 w-full">
                  <textarea
                    ref={qpContentRef}
                    required
                    rows={2}
                    value={qpContent}
                    onChange={(e) => {
                      setQpContent(e.target.value);
                      setQpError('');
                    }}
                    onKeyDown={(e) => handleTextAreaKeyDown(e, () => {
                      if (mobileTab === 'new') {
                        dispatchToPatient();
                      } else if (mobileTab === 'handovers') {
                        dispatchToHandover();
                      } else {
                        dispatchToOrder();
                      }
                    })}
                    placeholder="內容"
                    className="w-full text-sm text-slate-800 p-4 bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-4 focus:ring-emerald-100 placeholder-slate-400 font-bold resize-none"
                    title="交代細節/項目 (必填)"
                  />
                </div>

                {/* Merged: patient note (left) + orders at bed (right, with add) */}
                {qpBed.trim() && (() => {
                  const bed = qpBed.trim().toUpperCase();
                  const patientForBed = newPatients.find(p => p.bed.trim().toUpperCase() === bed);
                  const bedOrders = generalOrders.filter(o => o.bed.trim().toUpperCase() === bed);
                  return (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-slate-400 font-medium">備註</span>
                        {patientForBed ? (
                          <textarea
                            value={patientForBed.note}
                            onChange={e => updatePatient(patientForBed.id, { note: e.target.value })}
                            rows={3}
                            placeholder="備註..."
                            className="w-full text-xs text-slate-600 p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-200 font-medium resize-none"
                          />
                        ) : (
                          <p className="text-xs text-slate-300 italic px-1">—</p>
                        )}
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-slate-400 font-medium">醫囑</span>
                        <div className="flex flex-col gap-1">
                          {bedOrders.map(o => (
                            <div key={o.id} className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border ${o.isCompleted ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-amber-50/50 border-amber-100'}`}>
                              <button type="button" onClick={() => updateOrder(o.id, { isCompleted: !o.isCompleted })} className={`flex items-center justify-center rounded border shrink-0 w-[14px] h-[14px] ${o.isCompleted ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 bg-white'}`}>
                                {o.isCompleted && <Check size={8} className="stroke-[3]" />}
                              </button>
                              <span className={`flex-1 leading-snug ${o.isCompleted ? 'line-through text-slate-400' : 'text-amber-900'}`}>{o.orderTask}</span>
                            </div>
                          ))}
                          <div className="flex gap-1 mt-0.5">
                            <input
                              type="text"
                              value={inlineOrderText}
                              onChange={e => setInlineOrderText(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter' && inlineOrderText.trim()) { e.preventDefault(); addOrder({ id: `order-${Date.now()}`, bed, name: '', diagnosis: qpDiagnosis.trim(), orderTask: inlineOrderText.trim(), note: '', isCompleted: false, priority: 'normal', createdAt: new Date().toISOString() }); setInlineOrderText(''); }}}
                              placeholder="新增醫囑..."
                              className="flex-1 min-w-0 text-xs px-2 py-1 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-300"
                            />
                            <button
                              type="button"
                              disabled={!inlineOrderText.trim()}
                              onClick={() => { if (!inlineOrderText.trim()) return; addOrder({ id: `order-${Date.now()}`, bed, name: '', diagnosis: qpDiagnosis.trim(), orderTask: inlineOrderText.trim(), note: '', isCompleted: false, priority: 'normal', createdAt: new Date().toISOString() }); setInlineOrderText(''); }}
                              className="flex items-center justify-center w-6 h-6 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white rounded-lg transition-colors shrink-0"
                            >
                              <Plus size={11} className="stroke-[3]" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {qpError && (
                  <p className="text-xs text-rose-600 bg-rose-50 dark:bg-rose-200/60 px-3 py-2 rounded-lg flex items-center gap-1.5 border border-rose-100">
                    <AlertCircle size={14} />
                    {qpError}
                  </p>
                )}
              </div>

            </div>
          </div>
        )}


        {/* Fused Clinically Essential Metrics & Navigation Tab Switcher */}
        <StatsBanner 
          state={currentDutyState} 
          activeTab={mobileTab} 
          onTabChange={setMobileTab} 
        />

        {/* 3. One-Page Responsive Full-Screen Cockpit Panel */}
        <div 
          id="dashboard-columns-grid"
          className="w-full flex flex-col gap-3.5 items-stretch"
        >
          
          {/* ================= COLUMN 1: 新病人 Checklist ================= */}
          <div
            ref={panelNewRef}
            id="panel-new-patients"
            className={`relative flex flex-col gap-2.5 bg-white rounded-xl p-3 border border-slate-150/80 shadow-xs transition-colors duration-200 ${
              mobileTab !== 'new' ? 'hidden' : 'flex'
            }`}
          >
            {/* Top compact button row — pr-12 keeps items clear of the floating + button */}
            <div className="flex items-center gap-2 pr-12" id="panel-new-patients-top-action">
              {/* Group 1: sort */}
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => setSortNewPatients('bed')}
                  className={`flex items-center justify-center w-6 h-6 rounded transition-all shrink-0 ${sortNewPatients === 'bed' ? 'text-indigo-500 bg-indigo-50 dark:bg-indigo-200/60' : 'text-slate-400 hover:text-slate-600'}`}
                  title="依床號排序"
                >
                  <Hash size={12} strokeWidth={2.5} />
                </button>
                <button
                  type="button"
                  onClick={() => setSortNewPatients('user')}
                  className={`flex items-center justify-center w-6 h-6 rounded transition-all shrink-0 ${sortNewPatients === 'user' ? 'text-indigo-500 bg-indigo-50 dark:bg-indigo-200/60' : 'text-slate-400 hover:text-slate-600'}`}
                  title="依自訂順序排序"
                >
                  <UserIcon size={12} strokeWidth={2.5} />
                </button>
                <button
                  type="button"
                  onClick={() => setSortNewPatients('time')}
                  className={`flex items-center justify-center w-6 h-6 rounded transition-all shrink-0 ${sortNewPatients === 'time' ? 'text-indigo-500 bg-indigo-50 dark:bg-indigo-200/60' : 'text-slate-400 hover:text-slate-600'}`}
                  title="依時間排序"
                >
                  <Clock size={12} strokeWidth={2.5} />
                </button>
              </div>
              {/* Divider */}
              <div className="w-px h-3.5 bg-slate-200 shrink-0" />
              {/* Group 2: hide completed */}
              <button
                type="button"
                onClick={() => setHideCompletedPatients(h => !h)}
                className={`flex items-center gap-1 h-6 px-1 rounded transition-all shrink-0 ${hideCompletedPatients ? 'text-indigo-500 bg-indigo-50 dark:bg-indigo-200/60' : 'text-slate-400 hover:text-slate-600'}`}
                title={hideCompletedPatients ? '顯示所有病患' : '隱藏已完成病患'}
              >
                {hideCompletedPatients
                  ? <EyeOff size={12} strokeWidth={2.5} />
                  : <Eye size={12} strokeWidth={2.5} />
                }
                <span className="text-[11px] font-semibold tabular-nums leading-none">
                  {newPatients.filter(p => p.orderDone && p.visited && p.chartDone).length}
                </span>
              </button>
              {/* Divider */}
              <div className="w-px h-3.5 bg-slate-200 shrink-0" />
              {/* Group 3: edit mode */}
              <button
                type="button"
                onClick={() => setIsPatientEditMode(m => !m)}
                className={`flex items-center justify-center w-6 h-6 rounded transition-all shrink-0 ${isPatientEditMode ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-200/60' : 'text-slate-400 hover:text-slate-600'}`}
                title={isPatientEditMode ? '結束編輯' : '編輯排序與刪除'}
              >
                <Pencil size={12} strokeWidth={2.5} />
              </button>
            </div>
            {/* Floating Overflow Add Button with dynamic hover scaling and layered drop-shadow */}
            <button
              type="button"
              id="btn-add-patient-top"
              onClick={() => {
                setShowAddPatient(!showAddPatient);
              }}
              className="absolute -top-4 right-4 z-20 w-10 h-10 rounded-full flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white shadow-[0_4px_14px_rgba(79,70,229,0.35)] hover:shadow-[0_6px_20px_rgba(79,70,229,0.5)] transition-all cursor-pointer border-2 border-white hover:scale-110 active:scale-95 duration-200"
              title="新增新病人"
            >
              <Plus size={18} className="stroke-[3.5]" />
            </button>

            {/* Inline Add Patient Form at the top (全螢幕加大版) */}
            {showAddPatient && (
              <div 
                id="inline-add-patient-form-modal"
                className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-start justify-center pt-4 px-3 md:pt-8 md:px-6"
              >
                <div className="w-full max-w-2xl bg-gradient-to-b from-indigo-50 to-white dark:to-slate-100 rounded-2xl shadow-2xl border border-indigo-150 dark:border-slate-200/40 flex flex-col max-h-[90vh] animate-scale-up duration-200">
                  <form onSubmit={handleAddPatientSubmit} autoComplete="off" className="flex flex-col flex-grow overflow-hidden">
                    <div className="flex items-center justify-end gap-1.5 px-4 py-2 border-b border-indigo-100/50 shrink-0">
                      <button type="submit" className="w-8 h-8 rounded-full flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white transition-colors cursor-pointer" title="確認">
                        <Check size={15} className="stroke-[3]" />
                      </button>
                      <button type="button" onClick={() => { setShowAddPatient(false); setEditingPatientId(null); setPBed(''); setPDiagnosis(''); setPNote(''); setPError(''); }} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer text-lg font-bold" title="關閉">✕</button>
                    </div>
                    <div className="p-6 md:p-8 flex flex-col gap-5 overflow-y-auto flex-grow">
                      {/* Main elements fields: Bed and Diagnosis on the same row */}
                      <div className="flex items-center gap-3 w-full">
                        <div className="flex-1 max-w-[80px] flex items-center bg-indigo-50/50 px-2.5 py-1.5 rounded-xl border border-indigo-150">
                          <input
                            ref={pBedRef}
                            required
                            type="text"
                            pattern="\d*"
                            inputMode="numeric"
                            value={pBed}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, '');
                              setPBed(val);
                              setPError('');
                              checkAndAutofillBed(val, 'patient');
                            }}
                            onKeyDown={(e) => handleKeyJump(e, pDiagnosisRef)}
                            placeholder="床號 *"
                            className="w-full text-center font-mono text-sm font-bold bg-transparent text-indigo-850 focus:outline-hidden"
                            autoComplete="off"
                            title="床號 (必填)"
                          />
                        </div>

                        <div className="flex-2 flex-grow flex items-center bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                          <input
                            ref={pDiagnosisRef}
                            type="text"
                            value={pDiagnosis}
                            onChange={(e) => setPDiagnosis(e.target.value)}
                            onKeyDown={(e) => handleKeyJump(e, pNoteRef)}
                            placeholder="主要診斷 / 病因"
                            className="w-full text-sm bg-transparent text-slate-800 focus:outline-hidden"
                            autoComplete="off"
                            title="主要診斷"
                          />
                        </div>
                      </div>

                      {/* Merged: note (left, always editable) + orders (right, with add) */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-slate-400 font-medium">備註</span>
                          <textarea
                            ref={pNoteRef}
                            rows={4}
                            value={pNote}
                            onChange={(e) => setPNote(e.target.value)}
                            onKeyDown={(e) => handleTextAreaKeyDown(e, () => {
                              handleAddPatientSubmit({ preventDefault: () => {} } as React.FormEvent);
                            })}
                            placeholder="備註..."
                            className="w-full text-xs text-slate-600 p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-200 font-medium resize-none"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-slate-400 font-medium">醫囑</span>
                          <div className="flex flex-col gap-1">
                            {pBed.trim() && generalOrders.filter(o => o.bed.trim().toUpperCase() === pBed.trim().toUpperCase()).map(o => (
                              <div key={o.id} className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border ${o.isCompleted ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-amber-50/50 border-amber-100'}`}>
                                <button type="button" onClick={() => updateOrder(o.id, { isCompleted: !o.isCompleted })} className={`flex items-center justify-center rounded border shrink-0 w-[14px] h-[14px] ${o.isCompleted ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 bg-white'}`}>
                                  {o.isCompleted && <Check size={8} className="stroke-[3]" />}
                                </button>
                                <span className={`flex-1 leading-snug ${o.isCompleted ? 'line-through text-slate-400' : 'text-amber-900'}`}>{o.orderTask}</span>
                              </div>
                            ))}
                            <div className="flex gap-1 mt-0.5">
                              <input
                                type="text"
                                value={inlineOrderText}
                                onChange={e => setInlineOrderText(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter' && inlineOrderText.trim() && pBed.trim()) { e.preventDefault(); addOrder({ id: `order-${Date.now()}`, bed: pBed.trim().toUpperCase(), name: '', diagnosis: pDiagnosis.trim(), orderTask: inlineOrderText.trim(), note: '', isCompleted: false, priority: 'normal', createdAt: new Date().toISOString() }); setInlineOrderText(''); }}}
                                placeholder="新增醫囑..."
                                className="flex-1 min-w-0 text-xs px-2 py-1 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-300"
                              />
                              <button
                                type="button"
                                disabled={!pBed.trim() || !inlineOrderText.trim()}
                                onClick={() => { if (!inlineOrderText.trim() || !pBed.trim()) return; addOrder({ id: `order-${Date.now()}`, bed: pBed.trim().toUpperCase(), name: '', diagnosis: pDiagnosis.trim(), orderTask: inlineOrderText.trim(), note: '', isCompleted: false, priority: 'normal', createdAt: new Date().toISOString() }); setInlineOrderText(''); }}
                                className="flex items-center justify-center w-6 h-6 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white rounded-lg transition-colors shrink-0"
                              >
                                <Plus size={11} className="stroke-[3]" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {pError && (
                        <p className="text-xs text-rose-600 bg-rose-50 dark:bg-rose-200/60 px-3 py-2 rounded-lg flex items-center gap-1.5 border border-rose-100 animate-pulse">
                          <AlertCircle size={14} />
                          {pError}
                        </p>
                      )}
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Patients Checklist Content */}
            <div className="flex flex-col gap-3 min-h-[300px] flex-grow" id="column-new-patients-list">
              {filteredNew.length === 0 ? (
                <div className="my-auto py-12 text-center flex flex-col items-center justify-center text-slate-400">
                  <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center mb-2.5">
                    <Users size={18} className="text-slate-300" />
                  </div>
                  <p className="text-xs font-medium">尚無今日收治之新病人</p>
                  <p className="text-[10px] text-slate-400 mt-0.5 max-w-[200px] leading-relaxed">
                    請點選右上角 [+ 新病人] 來進行追蹤。
                  </p>
                </div>
              ) : (
                filteredNew.map((p) => {
                  const tasksCompleted = [p.orderDone, p.visited, p.chartDone].filter(Boolean).length;
                  const allDone = tasksCompleted === 3;

                  if (isCompact) {
                    return (
                      <div
                        key={p.id}
                        id={`compact-new-patient-${p.id}`}
                        draggable={isPatientEditMode}
                        onDragStart={isPatientEditMode ? (e) => { e.dataTransfer.effectAllowed = 'move'; setDragPatientId(p.id); } : undefined}
                        onDragOver={isPatientEditMode ? (e) => { e.preventDefault(); setDragOverPatientId(p.id); } : undefined}
                        onDragLeave={isPatientEditMode ? () => setDragOverPatientId(null) : undefined}
                        onDrop={isPatientEditMode ? (e) => {
                          e.preventDefault();
                          if (!dragPatientId || dragPatientId === p.id) { setDragOverPatientId(null); return; }
                          const ids = filteredNew.map(x => x.id);
                          const from = ids.indexOf(dragPatientId);
                          const to = ids.indexOf(p.id);
                          if (from === -1 || to === -1) { setDragOverPatientId(null); return; }
                          const next = [...ids];
                          next.splice(from, 1);
                          next.splice(to, 0, dragPatientId);
                          setUserPatientOrder(next);
                          setSortNewPatients('user');
                          setDragPatientId(null);
                          setDragOverPatientId(null);
                        } : undefined}
                        onClick={isPatientEditMode ? undefined : () => {
                          editFocusFieldRef.current = null;
                          setEditingPatientId(p.id);
                          setPBed(p.bed);
                          setPDiagnosis(p.diagnosis);
                          setPNote(p.note || '');
                          setShowAddPatient(true);
                        }}
                        className={`border rounded-xl px-3 py-1.5 transition-colors duration-150 ${isPatientEditMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${
                          dragOverPatientId === p.id ? 'border-indigo-400 bg-indigo-50/50' :
                          allDone
                            ? 'border-emerald-100 bg-emerald-50/5 opacity-70 hover:opacity-100'
                            : 'border-slate-150/80 bg-white hover:border-slate-200 hover:shadow-3xs'
                        }`}
                      >
                        {/* Compact bed, name, diagnosis, triggers, and action buttons in one line */}
                        <div className="flex items-center justify-between gap-2.5 w-full">
                          {/* Left: Bed, name, and diagnosis — grip inside so justify-between always has 2 items */}
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            {isPatientEditMode && (
                              <GripVertical size={14} className="text-slate-300 shrink-0" />
                            )}
                            {/* Bed tag — wrapper expands hit zone to prevent accidental card-click */}
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                editFocusFieldRef.current = 'bed';
                                setEditingPatientId(p.id);
                                setPBed(p.bed);
                                setPDiagnosis(p.diagnosis);
                                setPNote(p.note || '');
                                setShowAddPatient(true);
                              }}
                              className="shrink-0 p-1.5 -m-1.5 cursor-pointer"
                            >
                              <span className="font-mono text-sm font-bold px-1.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100/30 rounded-md hover:bg-indigo-100 transition-colors dark:bg-indigo-200/70 dark:text-indigo-850 dark:border-indigo-300/40">
                                {renderBed(p.bed)}
                              </span>
                            </div>
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                editFocusFieldRef.current = 'diagnosis';
                                setEditingPatientId(p.id);
                                setPBed(p.bed);
                                setPDiagnosis(p.diagnosis);
                                setPNote(p.note || '');
                                setShowAddPatient(true);
                              }}
                              className="text-sm text-slate-600 truncate font-medium leading-tight hover:text-slate-800 transition-colors"
                            >
                              {p.diagnosis}
                            </span>
                          </div>

                          {/* Right: morphing dot→pill buttons */}
                          <div className="flex items-center shrink-0 ml-auto select-none min-w-[28px]">
                            {isPatientEditMode ? (
                              /* Edit mode: unique key prevents React from reusing circle button DOM nodes (avoids transition-all height animation jitter) */
                              <button
                                key="patient-edit-trash"
                                onClick={(e) => { e.stopPropagation(); setNewPatients((prev) => prev.filter((pItem) => pItem.id !== p.id)); }}
                                className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
                                title="刪除"
                              >
                                <Trash2 size={13} />
                              </button>
                            ) : (
                              <>
                                {/* 醫囑: circle → pill */}
                                <button
                                  key="patient-dot-order"
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setNewPatients((prev) => prev.map((item) => item.id === p.id ? { ...item, orderDone: !item.orderDone } : item)); }}
                                  title="醫囑"
                                  style={{ transition: 'width 300ms ease-in-out, background-color 300ms ease-in-out, border-color 300ms ease-in-out' }}
                                  className={`relative overflow-hidden flex items-center justify-center rounded-full cursor-pointer border shrink-0 ${
                                    expandedControlPatientId === p.id
                                      ? p.orderDone ? 'w-[38px] h-5 border-transparent' : 'w-[38px] h-5 bg-rose-50 border-rose-200'
                                      : 'w-5 h-5 border-transparent'
                                  }`}
                                >
                                  <span className={`absolute flex items-center justify-center transition-all duration-300 ${expandedControlPatientId === p.id ? 'opacity-0 scale-50' : 'opacity-100 scale-100'}`}>
                                    <span className={`block w-2.5 h-2.5 rounded-full ${p.orderDone ? 'bg-slate-200' : 'bg-rose-400'}`} />
                                  </span>
                                  <span className={`absolute text-xs font-semibold whitespace-nowrap transition-all duration-300 ${expandedControlPatientId === p.id ? 'opacity-100 scale-100' : 'opacity-0 scale-75'} ${p.orderDone ? 'text-slate-300' : 'text-rose-500'}`}>醫囑</span>
                                </button>
                                {/* 探視: circle → pill */}
                                <button
                                  key="patient-dot-visited"
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setNewPatients((prev) => prev.map((item) => item.id === p.id ? { ...item, visited: !item.visited } : item)); }}
                                  title="探視"
                                  style={{ transition: 'width 300ms ease-in-out, background-color 300ms ease-in-out, border-color 300ms ease-in-out' }}
                                  className={`relative overflow-hidden flex items-center justify-center rounded-full cursor-pointer border shrink-0 ml-1.5 ${
                                    expandedControlPatientId === p.id
                                      ? p.visited ? 'w-[38px] h-5 border-transparent' : 'w-[38px] h-5 bg-amber-50 border-amber-200'
                                      : 'w-5 h-5 border-transparent'
                                  }`}
                                >
                                  <span className={`absolute flex items-center justify-center transition-all duration-300 ${expandedControlPatientId === p.id ? 'opacity-0 scale-50' : 'opacity-100 scale-100'}`}>
                                    <span className={`block w-2.5 h-2.5 rounded-full ${p.visited ? 'bg-slate-200' : 'bg-amber-400'}`} />
                                  </span>
                                  <span className={`absolute text-xs font-semibold whitespace-nowrap transition-all duration-300 ${expandedControlPatientId === p.id ? 'opacity-100 scale-100' : 'opacity-0 scale-75'} ${p.visited ? 'text-slate-300' : 'text-amber-500'}`}>探視</span>
                                </button>
                                {/* 病歷: circle → pill */}
                                <button
                                  key="patient-dot-chart"
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setNewPatients((prev) => prev.map((item) => item.id === p.id ? { ...item, chartDone: !item.chartDone } : item)); }}
                                  title="病歷"
                                  style={{ transition: 'width 300ms ease-in-out, background-color 300ms ease-in-out, border-color 300ms ease-in-out' }}
                                  className={`relative overflow-hidden flex items-center justify-center rounded-full cursor-pointer border shrink-0 ml-1.5 ${
                                    expandedControlPatientId === p.id
                                      ? p.chartDone ? 'w-[38px] h-5 border-transparent' : 'w-[38px] h-5 bg-emerald-50 border-emerald-400'
                                      : 'w-5 h-5 border-transparent'
                                  }`}
                                >
                                  <span className={`absolute flex items-center justify-center transition-all duration-300 ${expandedControlPatientId === p.id ? 'opacity-0 scale-50' : 'opacity-100 scale-100'}`}>
                                    <span className={`block w-2.5 h-2.5 rounded-full ${p.chartDone ? 'bg-slate-200' : 'bg-emerald-400'}`} />
                                  </span>
                                  <span className={`absolute text-xs font-semibold whitespace-nowrap transition-all duration-300 ${expandedControlPatientId === p.id ? 'opacity-100 scale-100' : 'opacity-0 scale-75'} ${p.chartDone ? 'text-slate-300' : 'text-emerald-600'}`}>病歷</span>
                                </button>
                                {/* Single toggle button: extends to card's right edge, vertical hit zone via card padding */}
                                <button
                                  key="patient-dot-toggle"
                                  onClick={(e) => { e.stopPropagation(); setInlineOrderText(''); setExpandedControlPatientId(expandedControlPatientId === p.id ? null : p.id); }}
                                  className="group relative ml-1.5 -mr-3 pr-3 flex items-center justify-center rounded-r-xl transition-colors duration-150 shrink-0 self-stretch"
                                  title={expandedControlPatientId === p.id ? '收起' : '展開 Toggle'}
                                >
                                  <span className="relative w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 group-hover:text-slate-600 group-hover:bg-slate-100 transition-colors duration-150">
                                    <MoreVertical
                                      size={13}
                                      className={`absolute transition-all duration-300 ${expandedControlPatientId === p.id ? 'opacity-0 scale-50 rotate-90' : 'opacity-100 scale-100 rotate-0'}`}
                                    />
                                    <X
                                      size={12}
                                      className={`absolute transition-all duration-300 ${expandedControlPatientId === p.id ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-50 -rotate-90'}`}
                                    />
                                  </span>
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                        {expandedControlPatientId === p.id && (
                          <div onClick={e => e.stopPropagation()} className="mt-2 pt-2 border-t border-slate-100 grid grid-cols-2 gap-2">
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] text-slate-400 font-medium">備註</span>
                              <textarea
                                value={p.note || ''}
                                onChange={e => updatePatient(p.id, { note: e.target.value })}
                                rows={3}
                                placeholder="備註..."
                                className="w-full text-xs text-slate-600 p-2 bg-slate-50 border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-slate-300"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] text-slate-400 font-medium">醫囑</span>
                              <div className="flex flex-col gap-1">
                                {generalOrders.filter(o => o.bed.toUpperCase() === p.bed.toUpperCase()).map(o => (
                                  <div key={o.id} className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border ${o.isCompleted ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-amber-50/50 border-amber-100'}`}>
                                    <button type="button" onClick={e => { e.stopPropagation(); updateOrder(o.id, { isCompleted: !o.isCompleted }); }} className={`flex items-center justify-center rounded border shrink-0 w-[14px] h-[14px] ${o.isCompleted ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 bg-white'}`}>
                                      {o.isCompleted && <Check size={8} className="stroke-[3]" />}
                                    </button>
                                    <span className={`flex-1 leading-snug ${o.isCompleted ? 'line-through text-slate-400' : 'text-amber-900'}`}>{o.orderTask}</span>
                                  </div>
                                ))}
                                <div className="flex gap-1 mt-0.5">
                                  <input
                                    type="text"
                                    value={inlineOrderText}
                                    onChange={e => setInlineOrderText(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter' && inlineOrderText.trim()) { e.preventDefault(); addOrder({ id: `order-${Date.now()}`, bed: p.bed, name: '', diagnosis: p.diagnosis, orderTask: inlineOrderText.trim(), note: '', isCompleted: false, priority: 'normal', createdAt: new Date().toISOString() }); setInlineOrderText(''); }}}
                                    placeholder="新增醫囑..."
                                    className="flex-1 min-w-0 text-xs px-2 py-1 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-300"
                                  />
                                  <button
                                    type="button"
                                    onClick={e => { e.stopPropagation(); if (!inlineOrderText.trim()) return; addOrder({ id: `order-${Date.now()}`, bed: p.bed, name: '', diagnosis: p.diagnosis, orderTask: inlineOrderText.trim(), note: '', isCompleted: false, priority: 'normal', createdAt: new Date().toISOString() }); setInlineOrderText(''); }}
                                    className="flex items-center justify-center w-6 h-6 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors shrink-0"
                                  >
                                    <Plus size={11} className="stroke-[3]" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  }

                  return (
                    <div
                      key={p.id}
                      id={`compact-new-patient-${p.id}`}
                      onClick={() => {
                        editFocusFieldRef.current = null;
                        setEditingPatientId(p.id);
                        setPBed(p.bed);
                        setPDiagnosis(p.diagnosis);
                        setPNote(p.note || '');
                        setShowAddPatient(true);
                      }}
                      className={`border rounded-xl p-3.5 flex flex-col gap-3 transition-all cursor-pointer ${
                        allDone
                          ? 'border-emerald-100 bg-emerald-50/10 opacity-70 hover:opacity-100'
                          : 'border-slate-100 bg-white hover:border-slate-200 hover:shadow-xs'
                      }`}
                    >
                      {/* Top Bed, Name & Delete Row */}
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              editFocusFieldRef.current = 'bed';
                              setEditingPatientId(p.id);
                              setPBed(p.bed);
                              setPDiagnosis(p.diagnosis);
                              setPNote(p.note || '');
                              setShowAddPatient(true);
                            }}
                            className="font-mono text-sm font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100/30 rounded-md hover:bg-indigo-100 transition-colors"
                          >
                            {renderBed(p.bed)}
                          </span>
                        </div>

                        {/* Complete Status micro dot */}
                        <div className="flex items-center gap-1.5">
                          {allDone && (
                            <span className="text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-100 rounded px-1 flex items-center font-bold">
                              完
                            </span>
                          )}
                          <button
                            id={`del-p-btn-${p.id}`}
                            onClick={(e) => { e.stopPropagation(); setNewPatients((prev) => prev.filter((pItem) => pItem.id !== p.id)); }}
                            className="text-slate-300 hover:text-rose-500 p-0.5 rounded transition-colors"
                            title="刪除本床新病人記錄"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      {/* Diagnostic details */}
                      <div className="text-sm text-slate-600 pl-0.5">
                        <p
                          onClick={(e) => {
                            e.stopPropagation();
                            editFocusFieldRef.current = 'diagnosis';
                            setEditingPatientId(p.id);
                            setPBed(p.bed);
                            setPDiagnosis(p.diagnosis);
                            setPNote(p.note || '');
                            setShowAddPatient(true);
                          }}
                          className="font-medium text-slate-800 leading-snug hover:text-slate-600 transition-colors cursor-pointer"
                        >
                          <span className="text-slate-400 text-xs font-medium pr-1">Dx:</span>
                          {p.diagnosis}
                        </p>

                      </div>

                      {/* The exactly 3 toggles required by checklist */}
                      <div className="grid grid-cols-3 gap-1 pt-2 border-t border-slate-100/60 text-xs">
                        {/* 1. 開醫囑 Done Toggle */}
                        <button
                          id={`p-order-tgl-${p.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setNewPatients((prev) =>
                              prev.map((item) => item.id === p.id ? { ...item, orderDone: !item.orderDone } : item)
                            );
                          }}
                          className={`flex items-center justify-center gap-1 py-0.5 rounded-full font-semibold cursor-pointer transition-all text-xs tracking-wider border ${
                            p.orderDone
                              ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                              : 'text-slate-400 hover:text-slate-600 border-transparent'
                          }`}
                        >
                          <div className={`w-2.5 h-2.5 rounded-full flex items-center justify-center shrink-0 ${
                            p.orderDone ? 'bg-emerald-600 text-white' : 'border border-slate-300'
                          }`}>
                            {p.orderDone && <Check size={7} className="stroke-[3]" />}
                          </div>
                          <span>開立醫囑</span>
                        </button>

                        {/* 2. 看病人 Visited Toggle */}
                        <button
                          id={`p-visit-tgl-${p.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setNewPatients((prev) =>
                              prev.map((item) => item.id === p.id ? { ...item, visited: !item.visited } : item)
                            );
                          }}
                          className={`flex items-center justify-center gap-1 py-0.5 rounded-full font-semibold cursor-pointer transition-all text-xs tracking-wider border ${
                            p.visited
                              ? 'bg-amber-100 text-amber-800 border-amber-200'
                              : 'text-slate-400 hover:text-slate-600 border-transparent'
                          }`}
                        >
                          <div className={`w-2.5 h-2.5 rounded-full flex items-center justify-center shrink-0 ${
                            p.visited ? 'bg-amber-600 text-white' : 'border border-slate-300'
                          }`}>
                            {p.visited && <Check size={7} className="stroke-[3]" />}
                          </div>
                          <span>看病人</span>
                        </button>

                        {/* 3. 寫病歷 ChartDone Toggle */}
                        <button
                          id={`p-chart-tgl-${p.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setNewPatients((prev) =>
                              prev.map((item) => item.id === p.id ? { ...item, chartDone: !item.chartDone } : item)
                            );
                          }}
                          className={`flex items-center justify-center gap-1 py-0.5 rounded-full font-semibold cursor-pointer transition-all text-xs tracking-wider border ${
                            p.chartDone
                              ? 'bg-indigo-100 text-indigo-700 border-indigo-200'
                              : 'text-slate-400 hover:text-slate-600 border-transparent'
                          }`}
                        >
                          <div className={`w-2.5 h-2.5 rounded-full flex items-center justify-center shrink-0 ${
                            p.chartDone ? 'bg-indigo-600 text-white' : 'border border-slate-300'
                          }`}>
                            {p.chartDone && <Check size={7} className="stroke-[3]" />}
                          </div>
                          <span>打完病歷</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ================= COLUMN 2: 一般醫囑開立 ================= */}
          <div
            ref={panelOrdersRef}
            id="panel-general-orders"
            className={`relative flex flex-col gap-2.5 bg-white rounded-xl p-3 border border-slate-150/80 shadow-xs transition-colors duration-200 ${
              mobileTab !== 'orders' ? 'hidden' : 'flex'
            }`}
          >
            {/* Top compact button row */}
            <div className="flex items-center gap-2 pr-12" id="panel-general-orders-top-action">
              <div className="flex items-center gap-0.5">
                <button type="button" onClick={() => setSortOrders('bed')} className={`flex items-center justify-center w-6 h-6 rounded transition-all shrink-0 ${sortOrders === 'bed' ? 'text-amber-500 bg-amber-50 dark:bg-amber-200/60' : 'text-slate-400 hover:text-slate-600'}`} title="依床號排序"><Hash size={12} strokeWidth={2.5} /></button>
                <button type="button" onClick={() => setSortOrders('user')} className={`flex items-center justify-center w-6 h-6 rounded transition-all shrink-0 ${sortOrders === 'user' ? 'text-amber-500 bg-amber-50 dark:bg-amber-200/60' : 'text-slate-400 hover:text-slate-600'}`} title="依自訂順序排序"><UserIcon size={12} strokeWidth={2.5} /></button>
                <button type="button" onClick={() => setSortOrders('time')} className={`flex items-center justify-center w-6 h-6 rounded transition-all shrink-0 ${sortOrders === 'time' ? 'text-amber-500 bg-amber-50 dark:bg-amber-200/60' : 'text-slate-400 hover:text-slate-600'}`} title="依時間排序"><Clock size={12} strokeWidth={2.5} /></button>
              </div>
              <div className="w-px h-3.5 bg-slate-200 shrink-0" />
              <button type="button" onClick={() => setHideCompletedOrders(h => !h)} className={`flex items-center gap-1 h-6 px-1 rounded transition-all shrink-0 ${hideCompletedOrders ? 'text-amber-500 bg-amber-50 dark:bg-amber-200/60' : 'text-slate-400 hover:text-slate-600'}`} title={hideCompletedOrders ? '顯示所有醫囑' : '隱藏已完成醫囑'}>
                {hideCompletedOrders ? <EyeOff size={12} strokeWidth={2.5} /> : <Eye size={12} strokeWidth={2.5} />}
                <span className="text-[11px] font-semibold tabular-nums leading-none">{generalOrders.filter(o => o.isCompleted).length}</span>
              </button>
              <div className="w-px h-3.5 bg-slate-200 shrink-0" />
              <button type="button" onClick={() => setIsOrderEditMode(m => !m)} className={`flex items-center justify-center w-6 h-6 rounded transition-all shrink-0 ${isOrderEditMode ? 'text-amber-600 bg-amber-50 dark:bg-amber-200/60' : 'text-slate-400 hover:text-slate-600'}`} title={isOrderEditMode ? '結束編輯' : '編輯排序與刪除'}>
                <Pencil size={12} strokeWidth={2.5} />
              </button>
            </div>

            {/* Floating Overflow Add Button with dynamic hover scaling and layered drop-shadow */}
            <button
              type="button"
              id="btn-add-order-top"
              onClick={() => {
                setShowAddOrder(!showAddOrder);
              }}
              className="absolute -top-4 right-4 z-20 w-10 h-10 rounded-full flex items-center justify-center bg-amber-500 hover:bg-amber-600 text-white shadow-[0_4px_14px_rgba(245,158,11,0.35)] hover:shadow-[0_6px_20px_rgba(245,158,11,0.5)] transition-all cursor-pointer border-2 border-white hover:scale-110 active:scale-95 duration-200"
              title="新增醫囑"
            >
              <Plus size={18} className="stroke-[3.5]" />
            </button>

            {/* Inline Add Order Form at the top (全螢幕加大版) */}
            {showAddOrder && (
              <div 
                id="inline-add-order-form-modal"
                className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-start justify-center pt-4 px-3 md:pt-8 md:px-6"
              >
                <div className="w-full max-w-2xl bg-gradient-to-b from-amber-50 to-white dark:to-slate-100 rounded-2xl shadow-2xl border border-amber-150 dark:border-slate-200/40 flex flex-col max-h-[92vh] animate-scale-up duration-200">
                  <form onSubmit={handleAddOrderSubmit} autoComplete="off" className="flex flex-col flex-grow overflow-hidden">
                    <div className="flex items-center justify-end gap-1.5 px-4 py-2 border-b border-amber-100/50 shrink-0">
                      <button type="submit" className="w-8 h-8 rounded-full flex items-center justify-center bg-amber-500 hover:bg-amber-600 text-white transition-colors cursor-pointer" title="確認">
                        <Check size={15} className="stroke-[3]" />
                      </button>
                      <button type="button" onClick={() => { setShowAddOrder(false); setEditingOrderId(null); setOBed(''); setOTask(''); setODiagnosis(''); setONote(''); setOPriority('normal'); setOError(''); }} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer text-lg font-bold" title="關閉">✕</button>
                    </div>
                    <div className="p-6 md:p-8 flex flex-col gap-5 overflow-y-auto flex-grow">
                      {/* Bed and Diagnosis in the same row */}
                      <div className="flex items-center gap-3 w-full">
                        <div className="flex-1 max-w-[80px] flex items-center bg-amber-50/55 px-2.5 py-1.5 rounded-xl border border-amber-150">
                          <input
                            ref={oBedRef}
                            required
                            type="text"
                            pattern="\d*"
                            inputMode="numeric"
                            value={oBed}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, '');
                              setOBed(val);
                              setOError('');
                              checkAndAutofillBed(val, 'order');
                            }}
                            onKeyDown={(e) => handleKeyJump(e, oDiagnosisRef)}
                            placeholder="床號 *"
                            className="w-full text-center font-mono text-sm font-bold bg-transparent text-amber-850 focus:outline-hidden animate-pulse-once"
                            autoComplete="off"
                            title="床號 (必填)"
                          />
                        </div>

                        <div className="flex-2 flex-grow flex items-center bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                          <input
                            ref={oDiagnosisRef}
                            type="text"
                            value={oDiagnosis}
                            onChange={(e) => setODiagnosis(e.target.value)}
                            onKeyDown={(e) => handleKeyJump(e, oTaskRef)}
                            placeholder="主要診斷 / 病因"
                            className="w-full text-sm bg-transparent text-slate-800 focus:outline-hidden"
                            autoComplete="off"
                            title="主要診斷"
                          />
                        </div>
                      </div>

                      {/* Task Detail (內容) */}
                      <div className="flex flex-col gap-1.5 w-full">
                        <textarea
                          ref={oTaskRef}
                          required
                          rows={2}
                          value={oTask}
                          onChange={(e) => {
                            setOTask(e.target.value);
                            setOError('');
                          }}
                          onKeyDown={(e) => handleTextAreaKeyDown(e, () => {
                            handleAddOrderSubmit({ preventDefault: () => {} } as React.FormEvent);
                          })}
                          placeholder="內容"
                          className="w-full text-sm text-slate-800 p-4 bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-4 focus:ring-amber-100 placeholder-slate-400 font-bold resize-none"
                          title="醫囑內容 (必填)"
                        />
                      </div>

                      {/* Merged: oNote (left) + orders at bed (right, with add) */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-slate-400 font-medium">備註</span>
                          <textarea
                            rows={3}
                            value={oNote}
                            onChange={e => setONote(e.target.value)}
                            placeholder="備註..."
                            className="w-full text-xs text-slate-600 p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-200 font-medium resize-none"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-slate-400 font-medium">醫囑</span>
                          <div className="flex flex-col gap-1">
                            {oBed.trim() && generalOrders.filter(o => o.bed.trim().toUpperCase() === oBed.trim().toUpperCase()).map(o => (
                              <div key={o.id} className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border ${o.isCompleted ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-amber-50/50 border-amber-100'}`}>
                                <button type="button" onClick={() => updateOrder(o.id, { isCompleted: !o.isCompleted })} className={`flex items-center justify-center rounded border shrink-0 w-[14px] h-[14px] ${o.isCompleted ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 bg-white'}`}>
                                  {o.isCompleted && <Check size={8} className="stroke-[3]" />}
                                </button>
                                <span className={`flex-1 leading-snug ${o.isCompleted ? 'line-through text-slate-400' : 'text-amber-900'}`}>{o.orderTask}</span>
                              </div>
                            ))}
                            <div className="flex gap-1 mt-0.5">
                              <input
                                type="text"
                                value={inlineOrderText}
                                onChange={e => setInlineOrderText(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter' && inlineOrderText.trim() && oBed.trim()) { e.preventDefault(); addOrder({ id: `order-${Date.now()}`, bed: oBed.trim().toUpperCase(), name: '', diagnosis: oDiagnosis.trim(), orderTask: inlineOrderText.trim(), note: '', isCompleted: false, priority: 'normal', createdAt: new Date().toISOString() }); setInlineOrderText(''); }}}
                                placeholder="新增醫囑..."
                                className="flex-1 min-w-0 text-xs px-2 py-1 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-300"
                              />
                              <button
                                type="button"
                                disabled={!oBed.trim() || !inlineOrderText.trim()}
                                onClick={() => { if (!inlineOrderText.trim() || !oBed.trim()) return; addOrder({ id: `order-${Date.now()}`, bed: oBed.trim().toUpperCase(), name: '', diagnosis: oDiagnosis.trim(), orderTask: inlineOrderText.trim(), note: '', isCompleted: false, priority: 'normal', createdAt: new Date().toISOString() }); setInlineOrderText(''); }}
                                className="flex items-center justify-center w-6 h-6 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white rounded-lg transition-colors shrink-0"
                              >
                                <Plus size={11} className="stroke-[3]" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Priority and Nurse name fields removed by request */}

                      {oError && (
                        <p className="text-xs text-rose-600 bg-rose-50 dark:bg-rose-200/60 px-3 py-2 rounded-lg flex items-center gap-1.5 border border-rose-100 animate-pulse">
                          <AlertCircle size={14} />
                          {oError}
                        </p>
                      )}
                    </div>
                  </form>
                </div>
              </div>
            )}



            {/* Orders Checklist list */}
            <div className="flex flex-col gap-3 min-h-[300px]" id="column-general-orders-list">
              {filteredOrders.length === 0 ? (
                <div className="my-auto py-12 text-center flex flex-col items-center justify-center text-slate-400">
                  <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center mb-2.5">
                    <ListTodo size={18} className="text-slate-300" />
                  </div>
                  <p className="text-xs font-medium">尚無此分類下之醫囑</p>
                  <p className="text-[10px] text-slate-400 mt-0.5 max-w-[200px] leading-relaxed">
                    請使用右上方 [+ 加開醫囑] 按鈕。
                  </p>
                </div>
              ) : (
                filteredOrders.map((o) => {
                  if (isCompact) {
                    return (
                      <div
                        key={o.id}
                        id={`compact-order-card-${o.id}`}
                        draggable={isOrderEditMode}
                        onDragStart={isOrderEditMode ? (e) => { e.dataTransfer.effectAllowed = 'move'; setDragOrderId(o.id); } : undefined}
                        onDragOver={isOrderEditMode ? (e) => { e.preventDefault(); setDragOverOrderId(o.id); } : undefined}
                        onDragLeave={isOrderEditMode ? () => setDragOverOrderId(null) : undefined}
                        onDrop={isOrderEditMode ? (e) => {
                          e.preventDefault();
                          if (!dragOrderId || dragOrderId === o.id) { setDragOverOrderId(null); return; }
                          const ids = filteredOrders.map(x => x.id);
                          const from = ids.indexOf(dragOrderId); const to = ids.indexOf(o.id);
                          if (from === -1 || to === -1) { setDragOverOrderId(null); return; }
                          const next = [...ids]; next.splice(from, 1); next.splice(to, 0, dragOrderId);
                          setUserOrdersOrder(next); setSortOrders('user');
                          setDragOrderId(null); setDragOverOrderId(null);
                        } : undefined}
                        onClick={isOrderEditMode ? undefined : () => {
                          oEditFocusFieldRef.current = null;
                          setEditingOrderId(o.id); setOBed(o.bed); setOName(o.name && o.name !== '不具名' || '');
                          setOTask(o.orderTask); setODiagnosis(o.diagnosis || '');
                          setONote(o.note || '');
                          setOPriority(o.priority || 'normal'); setShowAddOrder(true);
                        }}
                        className={`border rounded-xl px-2.5 py-1.5 flex items-center gap-2 transition-all ${isOrderEditMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${
                          dragOverOrderId === o.id ? 'border-amber-400 bg-amber-50/50' :
                          o.isCompleted
                            ? 'border-slate-100 bg-slate-100/30 opacity-60'
                            : 'border-slate-150/80 bg-white hover:border-slate-200 shadow-3xs'
                        }`}
                      >
                        {/* Edit mode grip */}
                        {isOrderEditMode && <GripVertical size={14} className="text-slate-300 shrink-0 -ml-0.5" />}
                        {/* Interactive compact checkbox — wrapper expands hit zone to prevent accidental edit trigger */}
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="flex-shrink-0 flex items-center justify-center p-2 -m-2"
                        >
                          <button
                            type="button"
                            id={`order-checkbox-tgl-${o.id}`}
                            onClick={() => {
                              setGeneralOrders((prev) =>
                                prev.map((item) => item.id === o.id ? { ...item, isCompleted: !item.isCompleted } : item)
                              );
                            }}
                            className={`w-4 h-4 rounded flex items-center justify-center border cursor-pointer transition-all ${
                              o.isCompleted
                                ? 'bg-emerald-600 border-emerald-600 text-white shadow-3xs'
                                : 'border-slate-305 hover:border-slate-400 bg-white shadow-3xs'
                            }`}
                          >
                            {o.isCompleted && <Check size={8} className="stroke-[3]" />}
                          </button>
                        </div>

                        {/* Content flow */}
                        <div className="flex-grow min-w-0 flex flex-col gap-0.5">
                          <div className="flex items-center justify-between gap-1 flex-wrap">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span
                                onClick={(e) => {
                                  e.stopPropagation();
                                  oEditFocusFieldRef.current = 'bed';
                                  setEditingOrderId(o.id); setOBed(o.bed); setOName(o.name && o.name !== '不具名' || '');
                                  setOTask(o.orderTask); setODiagnosis(o.diagnosis || '');
                                  setONote(o.note || '');
                                  setOPriority(o.priority || 'normal'); setShowAddOrder(true);
                                }}
                                className="font-mono text-sm font-bold px-1.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-100/30 rounded-md shrink-0 hover:bg-amber-100 transition-colors dark:bg-amber-200/70 dark:text-amber-850 dark:border-amber-300/40"
                              >
                                {renderBed(o.bed)}
                              </span>
                              {o.name && o.name !== '不具名' && (
                                <span className="font-bold text-sm text-slate-850 shrink-0">{o.name && o.name !== '不具名'}</span>
                              )}
                              <span
                                onClick={(e) => {
                                  e.stopPropagation();
                                  oEditFocusFieldRef.current = 'task';
                                  setEditingOrderId(o.id); setOBed(o.bed); setOName(o.name && o.name !== '不具名' || '');
                                  setOTask(o.orderTask); setODiagnosis(o.diagnosis || '');
                                  setONote(o.note || '');
                                  setOPriority(o.priority || 'normal'); setShowAddOrder(true);
                                }}
                                className={`text-sm font-semibold leading-relaxed truncate hover:opacity-70 transition-opacity ${
                                  o.isCompleted ? 'text-slate-400 line-through font-normal' : 'text-amber-950 font-bold'
                                }`}
                              >
                                {o.orderTask}
                              </span>
                            </div>
                            {isOrderEditMode && (
                              <button
                                id={`del-o-btn-${o.id}`}
                                onClick={(e) => { e.stopPropagation(); setGeneralOrders((prev) => prev.filter((item) => item.id !== o.id)); }}
                                className="text-slate-300 hover:text-rose-500 p-0.5 rounded transition-colors shrink-0"
                                title="刪除"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={o.id}
                      id={`compact-order-card-${o.id}`}
                      onClick={() => {
                        oEditFocusFieldRef.current = null;
                        setEditingOrderId(o.id); setOBed(o.bed); setOName(o.name && o.name !== '不具名' || '');
                        setOTask(o.orderTask); setODiagnosis(o.diagnosis || '');
                        setONote(o.note || '');
                        setOPriority(o.priority || 'normal'); setShowAddOrder(true);
                      }}
                      className={`border rounded-xl p-3.5 flex items-center gap-2.5 transition-all cursor-pointer ${
                        o.isCompleted
                          ? 'border-slate-100 bg-slate-100/50 opacity-60'
                          : 'border-slate-200/80 bg-white hover:border-slate-300 shadow-xs'
                      }`}
                    >
                      {/* Interactive complete checkmark — wrapper expands hit zone */}
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="flex-shrink-0 flex items-center justify-center p-2 -m-2"
                      >
                        <button
                          id={`order-checkbox-tgl-${o.id}`}
                          onClick={() => {
                            setGeneralOrders((prev) =>
                              prev.map((item) => item.id === o.id ? { ...item, isCompleted: !item.isCompleted } : item)
                            );
                          }}
                          className={`w-4.5 h-4.5 rounded-md flex items-center justify-center border cursor-pointer transition-all ${
                            o.isCompleted
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : 'border-slate-305 hover:border-slate-400 bg-white shadow-3xs'
                          }`}
                          title={o.isCompleted ? '重設為未開立' : '標記此醫囑開立完成'}
                        >
                          {o.isCompleted && <Check size={11} className="stroke-[3]" />}
                        </button>
                      </div>

                      {/* Info block */}
                      <div className="flex-grow flex flex-col gap-1.5 min-w-0">
                        <div className="flex items-center justify-between gap-1 flex-wrap">
                          <div className="flex items-center gap-1 flex-wrap">
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                oEditFocusFieldRef.current = 'bed';
                                setEditingOrderId(o.id); setOBed(o.bed); setOName(o.name && o.name !== '不具名' || '');
                                setOTask(o.orderTask); setODiagnosis(o.diagnosis || '');
                                setONote(o.note || '');
                                setOPriority(o.priority || 'normal'); setShowAddOrder(true);
                              }}
                              className="font-mono text-sm font-bold px-1.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-100/30 rounded-md hover:bg-amber-100 transition-colors dark:bg-amber-200/70 dark:text-amber-850 dark:border-amber-300/40"
                            >
                              {renderBed(o.bed)}
                            </span>
                            {o.name && o.name !== '不具名' && (
                              <span className="font-bold text-sm text-slate-800 truncate max-w-[80px]">
                                {o.name && o.name !== '不具名'}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 ml-auto">
                            <span className="text-xs text-slate-400 font-mono flex items-center gap-0.5">
                              {formatTime(o.createdAt)}
                            </span>
                            <button
                              id={`del-o-btn-${o.id}`}
                              onClick={(e) => { e.stopPropagation(); setGeneralOrders((prev) => prev.filter((item) => item.id !== o.id)); }}
                              className="text-slate-300 hover:text-rose-500 p-0.5 rounded transition-colors"
                              title="刪除此醫囑"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>

                        {/* Order Text content */}
                        <p
                          onClick={(e) => {
                            e.stopPropagation();
                            oEditFocusFieldRef.current = 'task';
                            setEditingOrderId(o.id); setOBed(o.bed); setOName(o.name && o.name !== '不具名' || '');
                            setOTask(o.orderTask); setODiagnosis(o.diagnosis || '');
                            setONote(o.note || '');
                            setOPriority(o.priority || 'normal'); setShowAddOrder(true);
                          }}
                          className={`text-sm font-semibold leading-relaxed hover:opacity-70 transition-opacity ${
                            o.isCompleted ? 'text-slate-400 line-through font-normal' : 'text-amber-950'
                          }`}
                        >
                          {o.orderTask}
                        </p>

                        {/* Caller nurse / Remark */}
                        <div className="text-xs text-slate-500 space-y-0.5">
                          {(o.diagnosis && o.diagnosis !== '無') && (
                            <p className="truncate">Dx: {o.diagnosis}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ================= COLUMN 3: 交班病人特別關注 ================= */}
          <div
            ref={panelHandoversRef}
            id="panel-handovers"
            className={`relative flex flex-col gap-2.5 bg-white rounded-xl p-3 border border-slate-150/80 shadow-xs transition-colors duration-200 ${
              mobileTab !== 'handovers' ? 'hidden' : 'flex'
            }`}
          >
            {/* Top compact button row */}
            <div className="flex items-center gap-2 pr-12" id="panel-handovers-top-action">
              <div className="flex items-center gap-0.5">
                <button type="button" onClick={() => setSortHandovers('bed')} className={`flex items-center justify-center w-6 h-6 rounded transition-all shrink-0 ${sortHandovers === 'bed' ? 'text-rose-500 bg-rose-50 dark:bg-rose-200/60' : 'text-slate-400 hover:text-slate-600'}`} title="依床號排序"><Hash size={12} strokeWidth={2.5} /></button>
                <button type="button" onClick={() => setSortHandovers('user')} className={`flex items-center justify-center w-6 h-6 rounded transition-all shrink-0 ${sortHandovers === 'user' ? 'text-rose-500 bg-rose-50 dark:bg-rose-200/60' : 'text-slate-400 hover:text-slate-600'}`} title="依自訂順序排序"><UserIcon size={12} strokeWidth={2.5} /></button>
                <button type="button" onClick={() => setSortHandovers('time')} className={`flex items-center justify-center w-6 h-6 rounded transition-all shrink-0 ${sortHandovers === 'time' ? 'text-rose-500 bg-rose-50 dark:bg-rose-200/60' : 'text-slate-400 hover:text-slate-600'}`} title="依時間排序"><Clock size={12} strokeWidth={2.5} /></button>
              </div>
              <div className="w-px h-3.5 bg-slate-200 shrink-0" />
              <button type="button" onClick={() => setHideHandledHandovers(h => !h)} className={`flex items-center gap-1 h-6 px-1 rounded transition-all shrink-0 ${hideHandledHandovers ? 'text-rose-500 bg-rose-50 dark:bg-rose-200/60' : 'text-slate-400 hover:text-slate-600'}`} title={hideHandledHandovers ? '顯示所有交班' : '隱藏已交班'}>
                {hideHandledHandovers ? <EyeOff size={12} strokeWidth={2.5} /> : <Eye size={12} strokeWidth={2.5} />}
                <span className="text-[11px] font-semibold tabular-nums leading-none">{handoverPatients.filter(h => h.isHandedOver).length}</span>
              </button>
              <div className="w-px h-3.5 bg-slate-200 shrink-0" />
              <button type="button" onClick={() => setIsHandoverEditMode(m => !m)} className={`flex items-center justify-center w-6 h-6 rounded transition-all shrink-0 ${isHandoverEditMode ? 'text-rose-600 bg-rose-50 dark:bg-rose-200/60' : 'text-slate-400 hover:text-slate-600'}`} title={isHandoverEditMode ? '結束編輯' : '編輯排序與刪除'}>
                <Pencil size={12} strokeWidth={2.5} />
              </button>
            </div>
            {/* Floating Overflow Add Button with dynamic hover scaling and layered drop-shadow */}
            <button
              type="button"
              id="btn-add-handover-top"
              onClick={() => {
                setShowAddHandover(!showAddHandover);
              }}
              className="absolute -top-4 right-4 z-20 w-10 h-10 rounded-full flex items-center justify-center bg-rose-500 hover:bg-rose-600 text-white shadow-[0_4px_14px_rgba(244,63,94,0.35)] hover:shadow-[0_6px_20px_rgba(244,63,94,0.5)] transition-all cursor-pointer border-2 border-white hover:scale-110 active:scale-95 duration-200"
              title="新增交班"
            >
              <Plus size={18} className="stroke-[3.5]" />
            </button>

            {showAddHandover && (
              <div 
                id="inline-add-handover-form-modal"
                className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-start justify-center pt-4 px-3 md:pt-8 md:px-6"
              >
                <div className="w-full max-w-2xl bg-gradient-to-b from-rose-50 to-white dark:to-slate-100 rounded-2xl shadow-2xl border border-rose-150 dark:border-slate-200/40 flex flex-col max-h-[92vh] animate-scale-up duration-200">
                  <form onSubmit={handleAddHandoverSubmit} autoComplete="off" className="flex flex-col flex-grow overflow-hidden">
                    <div className="flex items-center justify-end gap-1.5 px-4 py-2 border-b border-rose-100/50 shrink-0">
                      <button type="submit" className="w-8 h-8 rounded-full flex items-center justify-center bg-rose-500 hover:bg-rose-600 text-white transition-colors cursor-pointer" title="確認">
                        <Check size={15} className="stroke-[3]" />
                      </button>
                      <button type="button" onClick={() => { setShowAddHandover(false); setEditingHandoverId(null); setHBed(''); setHDiagnosis(''); setHAttn(''); setHNote(''); setHStatus('unstable'); setHError(''); }} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer text-lg font-bold" title="關閉">✕</button>
                    </div>
                    <div className="p-6 md:p-8 flex flex-col gap-5 overflow-y-auto flex-grow">
                      {/* Bed and Diagnosis on the same row */}
                      <div className="flex items-center gap-3 w-full">
                        <div className="flex-1 max-w-[80px] flex items-center bg-rose-50/50 px-2.5 py-1.5 rounded-xl border border-rose-150">
                          <input
                            ref={hBedRef}
                            required
                            type="text"
                            pattern="\d*"
                            inputMode="numeric"
                            value={hBed}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, '');
                              setHBed(val);
                              setHError('');
                              checkAndAutofillBed(val, 'handover');
                            }}
                            onKeyDown={(e) => handleKeyJump(e, hDiagnosisRef)}
                            placeholder="床號 *"
                            className="w-full text-center font-mono text-sm font-bold bg-transparent text-rose-850 focus:outline-hidden"
                            autoComplete="off"
                            title="床號 (必填)"
                          />
                        </div>

                        <div className="flex-2 flex-grow flex items-center bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                          <input
                            ref={hDiagnosisRef}
                            type="text"
                            value={hDiagnosis}
                            onChange={(e) => setHDiagnosis(e.target.value)}
                            onKeyDown={(e) => handleKeyJump(e, hAttnRef)}
                            placeholder="主要診斷 / 病因"
                            className="w-full text-sm bg-transparent text-slate-800 focus:outline-hidden"
                            autoComplete="off"
                            title="主要診斷"
                          />
                        </div>
                      </div>

                      {/* Detail Content (內容 hAttn) */}
                      <div className="flex flex-col gap-1.5 w-full">
                        <textarea
                          ref={hAttnRef}
                          required
                          rows={2}
                          value={hAttn}
                          onChange={(e) => {
                            setHAttn(e.target.value);
                            setHError('');
                          }}
                          onKeyDown={(e) => handleTextAreaKeyDown(e, () => {
                            handleAddHandoverSubmit({ preventDefault: () => {} } as React.FormEvent);
                          })}
                          placeholder="內容"
                          className="w-full text-sm text-slate-800 p-4 bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-4 focus:ring-rose-100 placeholder-slate-400 font-bold resize-none"
                          title="特定關注交代重點"
                        />
                      </div>

                      {/* Merged: hNote (left) + orders at bed (right, with add) */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-slate-400 font-medium">備註</span>
                          <textarea
                            rows={3}
                            value={hNote}
                            onChange={e => setHNote(e.target.value)}
                            placeholder="備註..."
                            className="w-full text-xs text-slate-600 p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-200 font-medium resize-none"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-slate-400 font-medium">醫囑</span>
                          <div className="flex flex-col gap-1">
                            {hBed.trim() && generalOrders.filter(o => o.bed.trim().toUpperCase() === hBed.trim().toUpperCase()).map(o => (
                              <div key={o.id} className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border ${o.isCompleted ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-amber-50/50 border-amber-100'}`}>
                                <button type="button" onClick={() => updateOrder(o.id, { isCompleted: !o.isCompleted })} className={`flex items-center justify-center rounded border shrink-0 w-[14px] h-[14px] ${o.isCompleted ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 bg-white'}`}>
                                  {o.isCompleted && <Check size={8} className="stroke-[3]" />}
                                </button>
                                <span className={`flex-1 leading-snug ${o.isCompleted ? 'line-through text-slate-400' : 'text-amber-900'}`}>{o.orderTask}</span>
                              </div>
                            ))}
                            <div className="flex gap-1 mt-0.5">
                              <input
                                type="text"
                                value={inlineOrderText}
                                onChange={e => setInlineOrderText(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter' && inlineOrderText.trim() && hBed.trim()) { e.preventDefault(); addOrder({ id: `order-${Date.now()}`, bed: hBed.trim().toUpperCase(), name: '', diagnosis: hDiagnosis.trim(), orderTask: inlineOrderText.trim(), note: '', isCompleted: false, priority: 'normal', createdAt: new Date().toISOString() }); setInlineOrderText(''); }}}
                                placeholder="新增醫囑..."
                                className="flex-1 min-w-0 text-xs px-2 py-1 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-300"
                              />
                              <button
                                type="button"
                                disabled={!hBed.trim() || !inlineOrderText.trim()}
                                onClick={() => { if (!inlineOrderText.trim() || !hBed.trim()) return; addOrder({ id: `order-${Date.now()}`, bed: hBed.trim().toUpperCase(), name: '', diagnosis: hDiagnosis.trim(), orderTask: inlineOrderText.trim(), note: '', isCompleted: false, priority: 'normal', createdAt: new Date().toISOString() }); setInlineOrderText(''); }}
                                className="flex items-center justify-center w-6 h-6 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white rounded-lg transition-colors shrink-0"
                              >
                                <Plus size={11} className="stroke-[3]" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Status Pills Selector */}
                      <div className="flex flex-col gap-2 w-full">
                        <label className="text-xs font-black text-slate-700">臨床安全分級</label>
                        <div className="flex items-center gap-2 bg-slate-100/60 p-1.5 rounded-xl self-start w-full md:w-auto">
                          {(['stable', 'unstable', 'critical'] as const).map((stat) => {
                            const labels = { stable: '穩定', unstable: '變動', critical: '危急' };
                            const dotColors = { stable: 'bg-emerald-500', unstable: 'bg-amber-400', critical: 'bg-rose-500' };
                            const activeColors = {
                              stable: 'bg-emerald-600 text-white shadow-sm border-emerald-500 focus:ring-emerald-350 font-bold',
                              unstable: 'bg-amber-500 text-white shadow-sm border-amber-400 focus:ring-amber-300 font-bold',
                              critical: 'bg-rose-600 text-white shadow-sm border-rose-500 focus:ring-rose-450 font-bold'
                            };
                            return (
                              <button
                                key={stat}
                                type="button"
                                onClick={() => setHStatus(stat)}
                                className={`flex-1 md:flex-initial flex items-center justify-center gap-1.5 text-xs py-2 px-4 rounded-lg transition-all cursor-pointer border ${
                                  hStatus === stat
                                    ? activeColors[stat]
                                    : 'border-transparent bg-transparent text-slate-600 hover:text-slate-900 font-medium hover:bg-white/60'
                                }`}
                              >
                                <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${dotColors[stat]}`} />
                                {labels[stat]}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {hError && (
                        <p className="text-xs text-rose-600 bg-rose-50 dark:bg-rose-200/60 px-3 py-2 rounded-lg flex items-center gap-1.5 border border-rose-100 animate-pulse">
                          <AlertCircle size={14} />
                          {hError}
                        </p>
                      )}
                    </div>
                  </form>
                </div>
              </div>
            )}



            {/* List Handovers cards */}
            <div className="flex flex-col gap-3.5 min-h-[300px]" id="column-handovers-list">
              {filteredHandovers.length === 0 ? (
                <div className="my-auto py-12 text-center flex flex-col items-center justify-center text-slate-400">
                  <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center mb-2.5">
                    <Clipboard size={18} className="text-slate-300" />
                  </div>
                  <p className="text-xs font-medium">尚無交班之病人</p>
                  <p className="text-[10px] text-slate-400 mt-0.5 max-w-[200px] leading-relaxed">
                    請點選 [+ 加入關注] 鈕。
                  </p>
                </div>
              ) : (
                filteredHandovers.map((h) => {
                  const critical = h.status === 'critical';
                  const unstable = h.status === 'unstable';

                  if (isCompact) {
                    return (
                      <div
                        key={h.id}
                        id={`compact-handover-card-${h.id}`}
                        draggable={isHandoverEditMode}
                        onDragStart={isHandoverEditMode ? (e) => { e.dataTransfer.effectAllowed = 'move'; setDragHandoverId(h.id); } : undefined}
                        onDragOver={isHandoverEditMode ? (e) => { e.preventDefault(); setDragOverHandoverId(h.id); } : undefined}
                        onDragLeave={isHandoverEditMode ? () => setDragOverHandoverId(null) : undefined}
                        onDrop={isHandoverEditMode ? (e) => {
                          e.preventDefault();
                          if (!dragHandoverId || dragHandoverId === h.id) { setDragOverHandoverId(null); return; }
                          const ids = filteredHandovers.map(x => x.id);
                          const from = ids.indexOf(dragHandoverId); const to = ids.indexOf(h.id);
                          if (from === -1 || to === -1) { setDragOverHandoverId(null); return; }
                          const next = [...ids]; next.splice(from, 1); next.splice(to, 0, dragHandoverId);
                          setUserHandoversOrder(next); setSortHandovers('user');
                          setDragHandoverId(null); setDragOverHandoverId(null);
                        } : undefined}
                        onClick={isHandoverEditMode ? undefined : () => {
                          hEditFocusFieldRef.current = null;
                          setEditingHandoverId(h.id); setHBed(h.bed);
                          setHDiagnosis(h.diagnosis || ''); setHAttn(h.attentionPoints);
                          setHNote(h.note || ''); setHStatus(h.status); setShowAddHandover(true);
                        }}
                        className={`border rounded-xl px-2.5 py-1.5 flex items-start gap-2.5 transition-all ${isHandoverEditMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${
                          dragOverHandoverId === h.id ? 'border-rose-400 bg-rose-50/50' :
                          critical
                            ? 'border-rose-200 bg-rose-50/25 shadow-3xs'
                            : 'border-slate-150 bg-white hover:border-slate-200 shadow-3xs'
                        }`}
                      >
                        {/* Edit mode grip */}
                        {isHandoverEditMode && <GripVertical size={14} className="text-slate-300 shrink-0 mt-0.5" />}
                        {/* Content flow */}
                        <div className="flex-grow min-w-0 flex flex-col gap-0.5">
                          <div className="flex items-center justify-between gap-1 flex-wrap">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span
                                onClick={(e) => {
                                  e.stopPropagation();
                                  hEditFocusFieldRef.current = 'bed';
                                  setEditingHandoverId(h.id); setHBed(h.bed);
                                  setHDiagnosis(h.diagnosis || ''); setHAttn(h.attentionPoints);
                                  setHNote(h.note || ''); setHStatus(h.status); setShowAddHandover(true);
                                }}
                                className={`font-mono text-sm font-bold px-1.5 py-0.5 rounded-md border shrink-0 hover:opacity-80 transition-opacity ${
                                  critical ? 'bg-rose-100/80 text-rose-800 border-rose-200 dark:bg-rose-200/70 dark:text-rose-855 dark:border-rose-300/40' : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-300/70 dark:text-slate-850 dark:border-slate-400/40'
                                }`}
                              >
                                {renderBed(h.bed)}
                              </span>
                              {h.name && h.name !== '不具名' && (
                                <span className="font-bold text-sm text-slate-850 shrink-0">{h.name && h.name !== '不具名'}</span>
                              )}
                              <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${
                                critical ? 'bg-rose-500' : unstable ? 'bg-amber-400' : 'bg-emerald-500'
                              }`} />
                              {h.diagnosis && h.diagnosis !== '無' && (
                                <span
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    hEditFocusFieldRef.current = 'diagnosis';
                                    setEditingHandoverId(h.id); setHBed(h.bed);
                                    setHDiagnosis(h.diagnosis || ''); setHAttn(h.attentionPoints);
                                    setHNote(h.note || ''); setHStatus(h.status); setShowAddHandover(true);
                                  }}
                                  className="text-sm font-semibold leading-relaxed truncate text-slate-900 hover:opacity-70 transition-opacity"
                                >
                                  {h.diagnosis}
                                </span>
                              )}
                            </div>

                            {isHandoverEditMode && (
                              <button
                                id={`del-h-btn-${h.id}`}
                                onClick={(e) => { e.stopPropagation(); setHandoverPatients((prev) => prev.filter((item) => item.id !== h.id)); }}
                                className="text-slate-300 hover:text-rose-500 p-0.5 rounded transition-colors shrink-0"
                                title="刪除"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>

                          {/* Secondary details context */}
                          {(h.attentionPoints || h.note) && (
                            <div className="text-xs text-slate-500 leading-normal flex items-start gap-1.5">
                              {h.attentionPoints && (
                                <span
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    hEditFocusFieldRef.current = 'attn';
                                    setEditingHandoverId(h.id); setHBed(h.bed);
                                    setHDiagnosis(h.diagnosis || ''); setHAttn(h.attentionPoints);
                                    setHNote(h.note || ''); setHStatus(h.status); setShowAddHandover(true);
                                  }}
                                  className="truncate hover:opacity-70 transition-opacity"
                                >
                                  {h.attentionPoints}
                                </span>
                              )}
                              {h.note && (
                                <span className="truncate italic text-slate-400">註: {h.note}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }

                  let borderStyle = 'border-slate-200/80 bg-white hover:border-slate-300 shadow-xs';
                  if (h.isHandedOver) {
                    borderStyle = 'border-slate-100 bg-slate-100/40 opacity-60';
                  } else if (critical) {
                    borderStyle = 'border-rose-200 bg-rose-50/5 hover:bg-rose-50/10 shadow-rose-50/30 shadow-2xs';
                  }


                  return (
                    <div
                      key={h.id}
                      id={`compact-handover-card-${h.id}`}
                      onClick={() => {
                        hEditFocusFieldRef.current = null;
                        setEditingHandoverId(h.id); setHBed(h.bed);
                        setHDiagnosis(h.diagnosis || ''); setHAttn(h.attentionPoints);
                        setHNote(h.note || ''); setHStatus(h.status); setShowAddHandover(true);
                      }}
                      className={`border rounded-xl p-3.5 flex flex-col gap-2.5 transition-all cursor-pointer ${borderStyle}`}
                    >
                      {/* Top Bed, Status Badge & Switch Action Row */}
                      <div className="flex items-center justify-between gap-1 flex-wrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              hEditFocusFieldRef.current = 'bed';
                              setEditingHandoverId(h.id); setHBed(h.bed);
                              setHDiagnosis(h.diagnosis || ''); setHAttn(h.attentionPoints);
                              setHNote(h.note || ''); setHStatus(h.status); setShowAddHandover(true);
                            }}
                            className={`font-mono text-sm font-bold px-1.5 py-0.5 rounded-md border hover:opacity-80 transition-opacity ${
                              critical ? 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-200/70 dark:text-rose-855 dark:border-rose-300/40' : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-300/70 dark:text-slate-850 dark:border-slate-400/40'
                            }`}
                          >
                            {renderBed(h.bed)}
                          </span>
                          {h.name && h.name !== '不具名' && (
                            <span className="font-bold text-sm text-slate-850 truncate max-w-[85px]">
                              {h.name && h.name !== '不具名'}
                            </span>
                          )}
                          <span className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${
                            critical ? 'bg-rose-500 ring-2 ring-rose-200' : unstable ? 'bg-amber-400 ring-2 ring-amber-200' : 'bg-emerald-500 ring-2 ring-emerald-200'
                          }`} />
                        </div>

                        <div className="flex items-center gap-1 ml-auto">
                          <span className="text-xs text-slate-400 font-mono">
                            {formatTime(h.createdAt)}
                          </span>
                          <button
                            id={`del-h-btn-${h.id}`}
                            onClick={(e) => { e.stopPropagation(); setHandoverPatients((prev) => prev.filter((item) => item.id !== h.id)); }}
                            className="text-slate-300 hover:text-rose-500 p-0.5 rounded transition-colors"
                            title="刪除此交班病人"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      {/* Main Content */}
                      <div className="text-xs text-slate-650 space-y-1.5 leading-snug pl-0.5">
                        {/* Direct Clinical Guide (Critical call-to-action) */}
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            hEditFocusFieldRef.current = 'attn';
                            setEditingHandoverId(h.id); setHBed(h.bed);
                            setHDiagnosis(h.diagnosis || ''); setHAttn(h.attentionPoints);
                            setHNote(h.note || ''); setHStatus(h.status); setShowAddHandover(true);
                          }}
                          className={`p-2.5 rounded-lg border hover:opacity-80 transition-opacity ${
                            critical
                              ? 'bg-rose-100/30 border-rose-150 text-rose-950 font-medium'
                              : 'bg-slate-50 border-slate-100 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-1 text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                            <Sliders size={11} className={critical ? 'text-rose-600' : 'text-slate-400'} />
                            <span>觀察重點及急處置指引：</span>
                          </div>
                          <p className="text-sm leading-relaxed select-all font-semibold">
                            {h.attentionPoints}
                          </p>
                        </div>

                        {h.diagnosis && h.diagnosis !== '無' && (
                          <p className="truncate text-xs text-slate-500">
                            Dx: <span className="font-medium text-slate-700 select-all">{h.diagnosis}</span>
                          </p>
                        )}

                        {h.note && (
                          <p className="text-xs italic bg-slate-100/30 p-1.5 rounded border-l border-slate-200 text-slate-550">
                            備註：{h.note}
                          </p>
                        )}
                      </div>

                      {/* Sticky Handover done action switch */}
                      <div className="pt-2 border-t border-slate-100/60 flex justify-end">
                        <button
                          id={`handover-confirm-btn-${h.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setHandoverPatients((prev) =>
                              prev.map((item) => item.id === h.id ? { ...item, isHandedOver: !item.isHandedOver } : item)
                            );
                          }}
                          className={`flex items-center gap-1.5 py-1 px-2.5 rounded-lg text-xs font-bold cursor-pointer transition-all border ${
                            h.isHandedOver
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-100 shadow-3xs'
                              : 'bg-white hover:bg-slate-50 text-slate-500 border-slate-200'
                          }`}
                          title={h.isHandedOver ? '標記設為未交接完成' : '標記與接班醫師、護理師交代交代妥當'}
                        >
                          <div className={`w-3 h-3 rounded-full flex items-center justify-center ${
                            h.isHandedOver ? 'bg-emerald-600 text-white' : 'border border-slate-350'
                          }`}>
                            {h.isHandedOver && <Check size={7.5} className="stroke-[3.5]" />}
                          </div>
                          <span>已跟接班醫師交代完成</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
