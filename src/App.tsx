/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { DutyState, NewPatient, GeneralOrder, HandoverPatient, SyncStatus } from './types';
import { getInitialState, saveState, formatTime } from './utils';
import { db, auth } from './firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
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
  MoreVertical
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

  // Edit states to allow clicking on items to edit them, inline!
  const [editingPatientId, setEditingPatientId] = useState<string | null>(null);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editingHandoverId, setEditingHandoverId] = useState<string | null>(null);

  // Filter flags for general completed entries
  const [hideCompletedOrders, setHideCompletedOrders] = useState(false);
  const [hideHandledHandovers, setHideHandledHandovers] = useState(false);
  const [hideCompletedPatients, setHideCompletedPatients] = useState(false);
  const [sortNewPatients, setSortNewPatients] = useState<'time' | 'bed'>('time');

  // --- Offline High-Security Storage state variables ---

  const getTodayDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const saved = localStorage.getItem('duty_selected_date');
    return saved || getTodayDateString();
  });
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [isAddingDate, setIsAddingDate] = useState<boolean>(false);
  const [newDateInput, setNewDateInput] = useState<string>(getTodayDateString());

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
  const [oNurse, setONurse] = useState('');
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
    if (e.key === ' ' || e.key === 'Enter') {
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

  // 1. Load available dates from Firebase when user logs in
  useEffect(() => {
    if (!user) return;
    const loadDates = async () => {
      const todayStr = getTodayDateString();
      try {
        const metaRef = doc(db, 'users', user.uid, 'metadata', 'summary');
        const metaSnap = await getDoc(metaRef);
        let datesList: string[] = metaSnap.exists() ? (metaSnap.data().dates || []) : [];
        if (!datesList.includes(todayStr)) {
          datesList = [todayStr, ...datesList].sort((a, b) => b.localeCompare(a));
          await setDoc(metaRef, { dates: datesList }, { merge: true });
        }
        setAvailableDates(datesList);
      } catch (e) {
        console.error('Error loading dates', e);
        setAvailableDates([todayStr]);
      }
    };
    loadDates();
  }, [user]);

  // 2. Load data for selectedDate from Firebase
  useEffect(() => {
    if (!user) return;
    isLoadingFromFirestore.current = true;
    setSyncStatus({ lastSynced: null, isSyncing: true, statusText: '從 Firebase 載入中...', error: false });

    const loadDate = async () => {
      try {
        const dateRef = doc(db, 'users', user.uid, 'dates', selectedDate);
        const snap = await getDoc(dateRef);
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
      } catch (e) {
        setSyncStatus({ lastSynced: null, isSyncing: false, statusText: '⚠️ Firebase 載入失敗，請確認網路', error: true });
      } finally {
        setTimeout(() => { isLoadingFromFirestore.current = false; }, 200);
      }
    };
    loadDate();
  }, [user, selectedDate]);

  // 3. Sync and index newly logged beds registry in local localStorage to support clinical diagnostic suggestions auto-fill
  useEffect(() => {
    try {
      const savedProfilesStr = localStorage.getItem('bed_profiles_v1');
      let profiles: Record<string, any> = {};
      if (savedProfilesStr) {
        profiles = JSON.parse(savedProfilesStr);
      }
      
      newPatients.forEach((p) => {
        const key = p.bed.trim().toUpperCase();
        if (!key) return;
        if (!profiles[key]) {
          profiles[key] = { bed: key, diagnosis: '', patients: [], orders: [], handovers: [] };
        }
        if (p.diagnosis && p.diagnosis !== '無明確診斷' && p.diagnosis !== '無') {
          profiles[key].diagnosis = p.diagnosis;
        }
        const patientList = profiles[key].patients || [];
        const index = patientList.findIndex((item: any) => item.id === p.id);
        if (index >= 0) {
          patientList[index] = p;
        } else {
          patientList.push(p);
        }
        profiles[key].patients = patientList;
      });

      generalOrders.forEach((o) => {
        const key = o.bed.trim().toUpperCase();
        if (!key) return;
        if (!profiles[key]) {
          profiles[key] = { bed: key, diagnosis: '', patients: [], orders: [], handovers: [] };
        }
        if (o.diagnosis && o.diagnosis !== '無' && o.diagnosis !== '無確切診斷') {
          profiles[key].diagnosis = o.diagnosis;
        }
        const ordersList = profiles[key].orders || [];
        const index = ordersList.findIndex((item: any) => item.id === o.id);
        if (index >= 0) {
          ordersList[index] = o;
        } else {
          ordersList.push(o);
        }
        profiles[key].orders = ordersList;
      });

      handoverPatients.forEach((h) => {
        const key = h.bed.trim().toUpperCase();
        if (!key) return;
        if (!profiles[key]) {
          profiles[key] = { bed: key, diagnosis: '', patients: [], orders: [], handovers: [] };
        }
        if (h.diagnosis && h.diagnosis !== '無確切診斷' && h.diagnosis !== '無') {
          profiles[key].diagnosis = h.diagnosis;
        }
        const handoversList = profiles[key].handovers || [];
        const index = handoversList.findIndex((item: any) => item.id === h.id);
        if (index >= 0) {
          handoversList[index] = h;
        } else {
          handoversList.push(h);
        }
        profiles[key].handovers = handoversList;
      });

      localStorage.setItem('bed_profiles_v1', JSON.stringify(profiles));
    } catch (e) {
      console.error('Error syncing bed profiles', e);
    }
  }, [newPatients, generalOrders, handoverPatients]);

  // 4. Debounced auto-save to Firebase on any state change
  useEffect(() => {
    if (!user || isLoadingFromFirestore.current) return;

    setSyncStatus(prev => ({ ...prev, isSyncing: true, statusText: '同步中...' }));

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const dateRef = doc(db, 'users', user.uid, 'dates', selectedDate);
        await setDoc(dateRef, {
          patients: newPatients,
          orders: generalOrders,
          handovers: handoverPatients,
          updatedAt: serverTimestamp(),
        });

        // Ensure selectedDate is in the dates list
        const metaRef = doc(db, 'users', user.uid, 'metadata', 'summary');
        const metaSnap = await getDoc(metaRef);
        let datesList: string[] = metaSnap.exists() ? (metaSnap.data().dates || []) : [];
        if (!datesList.includes(selectedDate)) {
          datesList = [selectedDate, ...datesList].sort((a, b) => b.localeCompare(a));
          await setDoc(metaRef, { dates: datesList }, { merge: true });
          setAvailableDates(datesList);
        }

        const t = new Date().toLocaleTimeString('zh-TW', { hour12: false, hour: '2-digit', minute: '2-digit' });
        setSyncStatus({ lastSynced: new Date().toLocaleTimeString(), isSyncing: false, statusText: `☁️ 已同步 · ${t}`, error: false });
      } catch (e) {
        setSyncStatus({ lastSynced: null, isSyncing: false, statusText: '⚠️ Firebase 同步失敗，請確認網路', error: true });
      }
    }, 1500);

    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [newPatients, generalOrders, handoverPatients]);

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

  const checkAndAutofillBed = (inputBed: string, type: 'patient' | 'order' | 'handover') => {
    const norm = inputBed.trim().toUpperCase();
    if (!norm) return;
    
    try {
      const profilesStr = localStorage.getItem('bed_profiles_v1');
      if (profilesStr) {
        const profiles = JSON.parse(profilesStr);
        const profile = profiles[norm];
        if (profile) {
          // 1. Auto-fill diagnosis
          if (profile.diagnosis) {
            if (type === 'patient') {
              setPDiagnosis(profile.diagnosis);
            } else if (type === 'order') {
              setODiagnosis(profile.diagnosis);
            } else if (type === 'handover') {
              setHDiagnosis(profile.diagnosis);
            }
          }
          
          // 2. Auto-load list items (bringing back previous list history for this bed)
          if (profile.patients && profile.patients.length > 0) {
            profile.patients.forEach((p: any) => {
              if (!newPatients.some(curr => curr.id === p.id)) {
                addPatient(p);
              }
            });
          }
          if (profile.orders && profile.orders.length > 0) {
            profile.orders.forEach((o: any) => {
              if (!generalOrders.some(curr => curr.id === o.id)) {
                addOrder(o);
              }
            });
          }
          if (profile.handovers && profile.handovers.length > 0) {
            profile.handovers.forEach((h: any) => {
              if (!handoverPatients.some(curr => curr.id === h.id)) {
                addHandover(h);
              }
            });
          }
        }
      }
    } catch (e) {
      console.error('Error in checkAndAutofillBed', e);
    }
  };

  const checkAndAutofillQpBed = (inputBed: string) => {
    const norm = inputBed.trim().toUpperCase();
    if (!norm) return;
    try {
      const profilesStr = localStorage.getItem('bed_profiles_v1');
      if (profilesStr) {
        const profiles = JSON.parse(profilesStr);
        const profile = profiles[norm];
        if (profile && profile.diagnosis) {
          setQpDiagnosis(profile.diagnosis);
        }
      }
    } catch (e) {
      console.error('Error in checkAndAutofillQpBed', e);
    }
  };

  const currentQpBedProfilesCount = () => {
    const norm = qpBed.trim().toUpperCase();
    if (!norm) return 0;
    try {
      const profilesStr = localStorage.getItem('bed_profiles_v1');
      if (profilesStr) {
        const profiles = JSON.parse(profilesStr);
        const profile = profiles[norm];
        if (profile) {
          let c = 0;
          if (profile.patients) c += profile.patients.length;
          if (profile.orders) c += profile.orders.length;
          if (profile.handovers) c += profile.handovers.length;
          return c;
        }
      }
    } catch (e) {}
    return 0;
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
      diagnosis: qpDiagnosis.trim() || '無明確診斷',
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
      name: '不具名',
      diagnosis: qpDiagnosis.trim() || '無',
      orderTask: qpContent.trim() || '補開醫囑項目',
      note: '',
      isCompleted: false,
      nurseName: undefined,
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
      name: '不具名',
      diagnosis: qpDiagnosis.trim() || '無確切診斷',
      note: '',
      attentionPoints: qpContent.trim() || '特別關注事項',
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
        diagnosis: pDiagnosis.trim() || '無明確診斷',
        note: pNote.trim()
      });
      setEditingPatientId(null);
    } else {
      // Add Mode
      const newP: NewPatient = {
        id: `new-${Date.now()}`,
        bed: pBed.trim().toUpperCase(),
        name: '',
        diagnosis: pDiagnosis.trim() || '無明確診斷',
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

    const orderName = oName.trim() || '不具名';

    if (editingOrderId) {
      // Edit Mode
      updateOrder(editingOrderId, {
        bed: oBed.trim().toUpperCase(),
        name: orderName,
        orderTask: oTask.trim(),
        diagnosis: oDiagnosis.trim() || '無',
        note: oNote.trim(),
        nurseName: oNurse.trim() || undefined,
        priority: oPriority
      });
      setEditingOrderId(null);
    } else {
      // Add Mode
      const newO: GeneralOrder = {
        id: `order-${Date.now()}`,
        bed: oBed.trim().toUpperCase(),
        name: orderName,
        diagnosis: oDiagnosis.trim() || '無',
        orderTask: oTask.trim(),
        note: oNote.trim(),
        isCompleted: false,
        nurseName: oNurse.trim() || undefined,
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
    setONurse('');
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

    const handoverName = hName.trim() || '不具名';

    if (editingHandoverId) {
      // Edit Mode
      updateHandover(editingHandoverId, {
        bed: hBed.trim().toUpperCase(),
        name: handoverName,
        diagnosis: hDiagnosis.trim() || '無確切診斷',
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
        diagnosis: hDiagnosis.trim() || '無確切診斷',
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
    return sortNewPatients === 'bed'
      ? a.bed.localeCompare(b.bed, 'zh-TW', { numeric: true })
      : a.createdAt.localeCompare(b.createdAt);
  });

  const filteredOrders = generalOrders.filter(o => {
    if (hideCompletedOrders && o.isCompleted) return false;
    if (!qStr) return true;
    return o.bed.toLowerCase().includes(qStr) ||
           (o.name && o.name.toLowerCase().includes(qStr)) ||
           (o.diagnosis && o.diagnosis.toLowerCase().includes(qStr)) ||
           o.orderTask.toLowerCase().includes(qStr) ||
           (o.note && o.note.toLowerCase().includes(qStr)) ||
           (o.nurseName && o.nurseName.toLowerCase().includes(qStr));
  }).sort((a, b) => {
    if (a.isCompleted !== b.isCompleted) {
      return a.isCompleted ? 1 : -1;
    }
    // Secondary sort: newly created first
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });

  const filteredHandovers = handoverPatients.filter(h => {
    if (hideHandledHandovers && h.isHandedOver) return false;
    if (!qStr) return true;
    return h.bed.toLowerCase().includes(qStr) ||
           (h.name && h.name.toLowerCase().includes(qStr)) ||
           (h.diagnosis && h.diagnosis.toLowerCase().includes(qStr)) ||
           h.attentionPoints.toLowerCase().includes(qStr) ||
           (h.note && h.note.toLowerCase().includes(qStr));
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
        onClear={handleClear}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        user={user}
        onSignOut={handleSignOut}
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
              <select
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  localStorage.setItem('duty_selected_date', e.target.value);
                }}
                className="text-sm font-semibold text-slate-500 bg-transparent focus:outline-hidden cursor-pointer"
                title="選擇值班日期"
              >
                {availableDates.map(d => {
                  const isToday = d === getTodayDateString();
                  return <option key={d} value={d}>{isToday ? '今日' : d.replace(/-/g, '.')}</option>;
                })}
              </select>
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

              {/* Dark mode — always visible */}
              <button
                type="button"
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all cursor-pointer shrink-0"
              >
                {isDarkMode ? <Sun size={14} className="text-amber-500" /> : <Moon size={14} />}
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
            className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-3 md:p-6"
          >
            <div className="w-full max-w-4xl bg-gradient-to-b from-emerald-50 to-white dark:to-slate-100 rounded-2xl shadow-2xl border border-emerald-100 dark:border-slate-200/40 flex flex-col max-h-[92vh] animate-scale-up duration-200">
              {/* Header info */}
               <div className="flex items-center justify-between px-6 py-4.5 border-b border-emerald-100/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center bg-emerald-100 text-emerald-800 shrink-0">
                    <PhoneCall size={18} className="stroke-[2.5]" />
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => {
                    setShowQuickPhoneAdd(false);
                    clearQp();
                  }}
                  className="text-slate-400 hover:text-slate-650 hover:bg-slate-100 w-9 h-9 rounded-full flex items-center justify-center transition-colors cursor-pointer text-lg font-bold"
                  title="關閉"
                >
                  ✕
                </button>
              </div>

              {/* Form Content Area */}
              <div className="p-6 md:p-8 flex flex-col gap-5 overflow-y-auto flex-grow">
                {/* Row 1: Bed Input, Diagnosis Input in the same line */}
                <div className="flex items-center gap-3 w-full">
                  <div className="flex-1 max-w-[120px] flex items-center bg-emerald-50/50 px-2.5 py-1.5 rounded-xl border border-emerald-150">
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
                    rows={4}
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
                    placeholder="護理師交代之細節/內容 * (例如: 發燒38.5、suction... 按 Ctrl+Enter 可直接指派分流)"
                    className="w-full text-sm text-slate-800 p-4 bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-4 focus:ring-emerald-100 placeholder-slate-400 font-bold resize-none min-h-[140px]"
                    title="交代細節/項目 (必填)"
                  />
                </div>

                {qpError && (
                  <p className="text-xs text-rose-600 bg-rose-50 px-3 py-2 rounded-lg flex items-center gap-1.5 border border-rose-100">
                    <AlertCircle size={14} />
                    {qpError}
                  </p>
                )}
              </div>

              {/* Row 3: Dispatch Target Selector Buttons */}
              <div className="bg-slate-50 p-6 rounded-b-2xl border-t border-slate-100 flex flex-col gap-3">
                <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between w-full">
                  <div className="flex-grow grid grid-cols-3 gap-2">
                    {/* Dispatch Buttons */}
                    <button
                      type="button"
                      onClick={dispatchToPatient}
                      className="flex items-center justify-center gap-1 py-3 px-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md cursor-pointer transition-all active:scale-95 duration-200"
                    >
                      <Plus size={14} className="stroke-[3]" />
                      <span>新病人</span>
                    </button>

                    <button
                      type="button"
                      onClick={dispatchToOrder}
                      className="flex items-center justify-center gap-1 py-3 px-2 bg-amber-500 hover:bg-amber-600 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md cursor-pointer transition-all active:scale-95 duration-200"
                    >
                      <Plus size={14} className="stroke-[3]" />
                      <span>醫囑</span>
                    </button>

                    <button
                      type="button"
                      onClick={dispatchToHandover}
                      className="flex items-center justify-center gap-1 py-3 px-2 bg-rose-500 hover:bg-rose-600 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md cursor-pointer transition-all active:scale-95 duration-200"
                    >
                      <Plus size={14} className="stroke-[3]" />
                      <span>交班</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={clearQp}
                    className="md:shrink-0 py-3 px-5 text-slate-500 hover:text-slate-800 text-sm font-bold rounded-xl border border-slate-200 hover:bg-white transition-all bg-slate-100/50 cursor-pointer text-center"
                  >
                    清除重填
                  </button>
                </div>
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
            id="panel-new-patients"
            className={`relative flex flex-col gap-2.5 bg-white rounded-xl p-3 border border-slate-150/80 shadow-xs transition-colors duration-200 ${
              mobileTab !== 'new' ? 'hidden' : 'flex'
            }`}
          >
            {/* Top compact button row */}
            <div className="flex items-center gap-2" id="panel-new-patients-top-action">
              <button
                type="button"
                onClick={() => setSortNewPatients(s => s === 'time' ? 'bed' : 'time')}
                className={`flex items-center justify-center w-6 h-6 rounded transition-all shrink-0 ${sortNewPatients === 'bed' ? 'text-indigo-500 hover:text-indigo-700' : 'text-slate-400 hover:text-slate-600'}`}
                title={sortNewPatients === 'time' ? '目前依時間排序，點擊改為依床號' : '目前依床號排序，點擊改為依時間'}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m3 16 4 4 4-4"/><path d="M7 20V4"/><path d="m21 8-4-4-4 4"/><path d="M17 4v16"/></svg>
              </button>
              <label className="inline-flex items-center gap-1 cursor-pointer text-xs font-semibold text-slate-500 hover:text-slate-700 select-none transition-colors">
                <input
                  type="checkbox"
                  checked={hideCompletedPatients}
                  onChange={(e) => setHideCompletedPatients(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3 h-3 cursor-pointer"
                />
                隱藏已完成 ({newPatients.filter(p => p.orderDone && p.visited && p.chartDone).length} 筆)
              </label>
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
                className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-3 md:p-6"
              >
                <div className="w-full max-w-2xl bg-gradient-to-b from-indigo-50 to-white dark:to-slate-100 rounded-2xl shadow-2xl border border-indigo-150 dark:border-slate-200/40 flex flex-col max-h-[90vh] animate-scale-up duration-200">
                  {/* Header */}
                  <div className="flex items-center justify-between px-6 py-4.5 border-b border-indigo-100/50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center bg-indigo-100 text-indigo-800 shrink-0">
                        <Users size={18} className="stroke-[2.5]" />
                      </div>
                    </div>
                    <button 
                      type="button"
                      onClick={() => {
                        setShowAddPatient(false);
                        setEditingPatientId(null);
                        setPBed('');
                        setPDiagnosis('');
                        setPNote('');
                        setPError('');
                      }}
                      className="text-slate-400 hover:text-slate-650 hover:bg-slate-100 w-9 h-9 rounded-full flex items-center justify-center transition-colors cursor-pointer text-lg font-bold"
                      title="關閉"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Form Scroll Container */}
                  <form 
                    onSubmit={handleAddPatientSubmit}
                    className="flex-grow flex flex-col justify-between overflow-y-auto"
                  >
                    <div className="p-6 md:p-8 flex flex-col gap-5">
                      {/* Main elements fields: Bed and Diagnosis on the same row */}
                      <div className="flex items-center gap-3 w-full">
                        <div className="flex-1 max-w-[120px] flex items-center bg-indigo-50/50 px-2.5 py-1.5 rounded-xl border border-indigo-150">
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

                      {/* Sub-row for Note Input */}
                      <div className="flex flex-col gap-1.5 w-full">
                        <textarea
                          ref={pNoteRef}
                          rows={4}
                          value={pNote}
                          onChange={(e) => setPNote(e.target.value)}
                          onKeyDown={(e) => handleTextAreaKeyDown(e, () => {
                            handleAddPatientSubmit({ preventDefault: () => {} } as React.FormEvent);
                          })}
                          placeholder="病況備註 / 交代事項 (例如: 引流、每日追蹤指標、特殊治療...)"
                          className="w-full text-sm text-slate-800 p-4 bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-4 focus:ring-indigo-100 placeholder-slate-400 font-medium resize-none min-h-[140px]"
                          title="備註"
                        />
                      </div>

                      {pError && (
                        <p className="text-xs text-rose-600 bg-rose-50 px-3 py-2 rounded-lg flex items-center gap-1.5 border border-rose-100 animate-pulse">
                          <AlertCircle size={14} />
                          {pError}
                        </p>
                      )}
                    </div>

                    {/* Submit / Cancel Footer */}
                    <div className="bg-slate-50 p-6 rounded-b-2xl border-t border-slate-100 flex items-center justify-end gap-3.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddPatient(false);
                          setEditingPatientId(null);
                          setPBed('');
                          setPDiagnosis('');
                          setPNote('');
                          setPError('');
                        }}
                        className="px-5 py-3 text-slate-500 hover:text-slate-800 text-sm font-bold rounded-xl border border-slate-200 hover:bg-white transition-all bg-slate-100/50 cursor-pointer"
                      >
                        取消變更
                      </button>
                      <button
                        type="submit"
                        className="py-3 px-8 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-base font-bold rounded-xl shadow-md cursor-pointer transition-all flex items-center gap-1.5"
                      >
                        <Check size={18} className="stroke-[3]" />
                        <span>{editingPatientId ? '確認變更' : '登記並新增新病人'}</span>
                      </button>
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
                        onClick={() => {
                          editFocusFieldRef.current = null;
                          setEditingPatientId(p.id);
                          setPBed(p.bed);
                          setPDiagnosis(p.diagnosis);
                          setPNote(p.note || '');
                          setShowAddPatient(true);
                        }}
                        className={`border rounded-xl px-3 py-1.5 transition-all cursor-pointer ${
                          allDone
                            ? 'border-emerald-100 bg-emerald-50/5 opacity-70 hover:opacity-100'
                            : 'border-slate-150/80 bg-white hover:border-slate-200 hover:shadow-3xs'
                        }`}
                      >
                        {/* Compact bed, name, diagnosis, triggers, and action buttons in one line */}
                        <div className="flex items-center justify-between gap-2.5 w-full">
                          {/* Left: Bed, name, and diagnosis */}
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
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
                              className="font-mono text-sm font-bold px-1.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100/30 rounded-md shrink-0 hover:bg-indigo-100 transition-colors"
                            >
                              {p.bed}
                            </span>
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

                          {/* Right: traffic-light dots + ⋮ / expanded controls — both always rendered, animated via max-width */}
                          <div className="flex items-center shrink-0 ml-auto select-none h-6">
                            {/* Collapsed: 3 dots + ⋮ */}
                            <div className={`flex items-center gap-1.5 overflow-hidden transition-all duration-200 ${expandedControlPatientId === p.id ? 'max-w-0 opacity-0 pointer-events-none' : 'max-w-[120px] opacity-100'}`}>
                              <button type="button" onClick={(e) => { e.stopPropagation(); setNewPatients((prev) => prev.map((item) => item.id === p.id ? { ...item, orderDone: !item.orderDone } : item)); }} className="p-0.5 rounded-full cursor-pointer shrink-0" title="醫囑">
                                <span className={`block w-2.5 h-2.5 rounded-full transition-colors ${p.orderDone ? 'bg-slate-200' : 'bg-rose-400'}`} />
                              </button>
                              <button type="button" onClick={(e) => { e.stopPropagation(); setNewPatients((prev) => prev.map((item) => item.id === p.id ? { ...item, visited: !item.visited } : item)); }} className="p-0.5 rounded-full cursor-pointer shrink-0" title="探視">
                                <span className={`block w-2.5 h-2.5 rounded-full transition-colors ${p.visited ? 'bg-slate-200' : 'bg-amber-400'}`} />
                              </button>
                              <button type="button" onClick={(e) => { e.stopPropagation(); setNewPatients((prev) => prev.map((item) => item.id === p.id ? { ...item, chartDone: !item.chartDone } : item)); }} className="p-0.5 rounded-full cursor-pointer shrink-0" title="病歷">
                                <span className={`block w-2.5 h-2.5 rounded-full transition-colors ${p.chartDone ? 'bg-slate-200' : 'bg-emerald-400'}`} />
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); setExpandedControlPatientId(p.id); }} className="text-slate-300 hover:text-slate-600 hover:bg-slate-100 p-0.5 rounded transition-colors shrink-0" title="展開操作">
                                <MoreVertical size={13} />
                              </button>
                            </div>
                            {/* Expanded: text toggles + delete + X */}
                            <div className={`flex items-center gap-1.5 overflow-hidden transition-all duration-200 ${expandedControlPatientId === p.id ? 'max-w-[240px] opacity-100' : 'max-w-0 opacity-0 pointer-events-none'}`}>
                              <button type="button" onClick={(e) => { e.stopPropagation(); setNewPatients((prev) => prev.map((item) => item.id === p.id ? { ...item, orderDone: !item.orderDone } : item)); }} className={`px-1.5 py-0.5 rounded-full text-xs font-semibold cursor-pointer transition-colors border shrink-0 ${p.orderDone ? 'text-slate-300 border-transparent' : 'bg-rose-50 text-rose-500 border-rose-200'}`}>醫囑</button>
                              <button type="button" onClick={(e) => { e.stopPropagation(); setNewPatients((prev) => prev.map((item) => item.id === p.id ? { ...item, visited: !item.visited } : item)); }} className={`px-1.5 py-0.5 rounded-full text-xs font-semibold cursor-pointer transition-colors border shrink-0 ${p.visited ? 'text-slate-300 border-transparent' : 'bg-amber-50 text-amber-500 border-amber-200'}`}>探視</button>
                              <button type="button" onClick={(e) => { e.stopPropagation(); setNewPatients((prev) => prev.map((item) => item.id === p.id ? { ...item, chartDone: !item.chartDone } : item)); }} className={`px-1.5 py-0.5 rounded-full text-xs font-semibold cursor-pointer transition-colors border shrink-0 ${p.chartDone ? 'text-slate-300 border-transparent' : 'bg-emerald-50 text-emerald-600 border-emerald-400'}`}>病歷</button>
                              <button onClick={(e) => { e.stopPropagation(); setNewPatients((prev) => prev.filter((pItem) => pItem.id !== p.id)); }} className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 p-0.5 rounded transition-colors shrink-0" title="刪除"><Trash2 size={11} /></button>
                              <button onClick={(e) => { e.stopPropagation(); setExpandedControlPatientId(null); }} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-0.5 rounded transition-colors shrink-0"><X size={11} /></button>
                            </div>
                          </div>
                        </div>
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
                            {p.bed}
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
            id="panel-general-orders"
            className={`relative flex flex-col gap-2.5 bg-white rounded-xl p-3 border border-slate-150/80 shadow-xs transition-colors duration-200 ${
              mobileTab !== 'orders' ? 'hidden' : 'flex'
            }`}
          >
            {/* Top compact button row */}
            <div className="flex items-center gap-2" id="panel-general-orders-top-action">
              <label className="inline-flex items-center gap-1 cursor-pointer text-xs font-semibold text-slate-500 hover:text-slate-700 select-none transition-colors">
                <input
                  type="checkbox"
                  checked={hideCompletedOrders}
                  onChange={(e) => setHideCompletedOrders(e.target.checked)}
                  className="rounded border-slate-300 text-amber-500 focus:ring-amber-400 w-3 h-3 cursor-pointer"
                />
                隱藏已完成 ({generalOrders.filter(o=>o.isCompleted).length} 筆)
              </label>
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
                className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-3 md:p-6"
              >
                <div className="w-full max-w-2xl bg-gradient-to-b from-amber-50 to-white dark:to-slate-100 rounded-2xl shadow-2xl border border-amber-150 dark:border-slate-200/40 flex flex-col max-h-[92vh] animate-scale-up duration-200">
                  {/* Header */}
                  <div className="flex items-center justify-between px-6 py-4.5 border-b border-amber-100/50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center bg-amber-100 text-amber-850 shrink-0">
                        <ListTodo size={18} className="stroke-[2.5]" />
                      </div>
                    </div>
                    <button 
                      type="button"
                      onClick={() => {
                        setShowAddOrder(false);
                        setEditingOrderId(null);
                        setOBed('');
                        setOTask('');
                        setODiagnosis('');
                        setONote('');
                        setONurse('');
                        setOPriority('normal');
                        setOError('');
                      }}
                      className="text-slate-400 hover:text-slate-650 hover:bg-slate-100 w-9 h-9 rounded-full flex items-center justify-center transition-colors cursor-pointer text-lg font-bold"
                      title="關閉"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Form Scroll Container */}
                  <form 
                    onSubmit={handleAddOrderSubmit}
                    className="flex-grow flex flex-col justify-between overflow-y-auto"
                  >
                    <div className="p-6 md:p-8 flex flex-col gap-5">
                      {/* Bed and Diagnosis in the same row */}
                      <div className="flex items-center gap-3 w-full">
                        <div className="flex-1 max-w-[120px] flex items-center bg-amber-50/55 px-2.5 py-1.5 rounded-xl border border-amber-150">
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
                          rows={4}
                          value={oTask}
                          onChange={(e) => {
                            setOTask(e.target.value);
                            setOError('');
                          }}
                          onKeyDown={(e) => handleTextAreaKeyDown(e, () => {
                            handleAddOrderSubmit({ preventDefault: () => {} } as React.FormEvent);
                          })}
                          placeholder="醫囑內容 * (例如: 加開 Acetaminophen 3# PO...)"
                          className="w-full text-sm text-slate-800 p-4 bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-4 focus:ring-amber-100 placeholder-slate-400 font-bold resize-none min-h-[140px]"
                          title="醫囑內容 (必填)"
                        />
                      </div>

                      {/* Priority and Nurse name fields removed by request */}

                      {oError && (
                        <p className="text-xs text-rose-600 bg-rose-50 px-3 py-2 rounded-lg flex items-center gap-1.5 border border-rose-100 animate-pulse">
                          <AlertCircle size={14} />
                          {oError}
                        </p>
                      )}
                    </div>

                    {/* Submit / Cancel Footer */}
                    <div className="bg-slate-50 p-6 rounded-b-2xl border-t border-slate-100 flex items-center justify-end gap-3.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddOrder(false);
                          setEditingOrderId(null);
                          setOBed('');
                          setOTask('');
                          setODiagnosis('');
                          setONote('');
                          setONurse('');
                          setOPriority('normal');
                          setOError('');
                        }}
                        className="px-5 py-3 text-slate-500 hover:text-slate-800 text-sm font-bold rounded-xl border border-slate-200 hover:bg-white transition-all bg-slate-100/50 cursor-pointer"
                      >
                        取消變更
                      </button>
                      <button
                        type="submit"
                        className="py-3 px-8 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white text-base font-bold rounded-xl shadow-md cursor-pointer transition-all flex items-center gap-1.5"
                      >
                        <Check size={18} className="stroke-[3]" />
                        <span>{editingOrderId ? '確認變更公文' : '登記並加開醫囑監控'}</span>
                      </button>
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
                        onClick={() => {
                          oEditFocusFieldRef.current = null;
                          setEditingOrderId(o.id); setOBed(o.bed); setOName(o.name || '');
                          setOTask(o.orderTask); setODiagnosis(o.diagnosis || '');
                          setONote(o.note || ''); setONurse(o.nurseName || '');
                          setOPriority(o.priority || 'normal'); setShowAddOrder(true);
                        }}
                        className={`border rounded-xl px-2.5 py-1.5 flex items-center gap-2 transition-all cursor-pointer ${
                          o.isCompleted
                            ? 'border-slate-100 bg-slate-100/30 opacity-60'
                            : 'border-slate-150/80 bg-white hover:border-slate-200 shadow-3xs'
                        }`}
                      >
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
                                  setEditingOrderId(o.id); setOBed(o.bed); setOName(o.name || '');
                                  setOTask(o.orderTask); setODiagnosis(o.diagnosis || '');
                                  setONote(o.note || ''); setONurse(o.nurseName || '');
                                  setOPriority(o.priority || 'normal'); setShowAddOrder(true);
                                }}
                                className="font-mono text-sm font-bold px-1.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-100/30 rounded-md shrink-0 hover:bg-amber-100 transition-colors"
                              >
                                {o.bed}
                              </span>
                              {o.name && o.name !== '未輸入姓名' && o.name !== '不具名' && (
                                <span className="font-bold text-sm text-slate-850 shrink-0">{o.name}</span>
                              )}
                              <span
                                onClick={(e) => {
                                  e.stopPropagation();
                                  oEditFocusFieldRef.current = 'task';
                                  setEditingOrderId(o.id); setOBed(o.bed); setOName(o.name || '');
                                  setOTask(o.orderTask); setODiagnosis(o.diagnosis || '');
                                  setONote(o.note || ''); setONurse(o.nurseName || '');
                                  setOPriority(o.priority || 'normal'); setShowAddOrder(true);
                                }}
                                className={`text-sm font-semibold leading-relaxed truncate hover:opacity-70 transition-opacity ${
                                  o.isCompleted ? 'text-slate-400 line-through font-normal' : 'text-amber-950 font-bold'
                                }`}
                              >
                                {o.orderTask}
                              </span>
                            </div>
                            <button
                              id={`del-o-btn-${o.id}`}
                              onClick={(e) => { e.stopPropagation(); setGeneralOrders((prev) => prev.filter((item) => item.id !== o.id)); }}
                              className="text-slate-300 hover:text-rose-500 p-0.5 rounded transition-colors shrink-0"
                              title="刪除"
                            >
                              <Trash2 size={11} />
                            </button>
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
                        setEditingOrderId(o.id); setOBed(o.bed); setOName(o.name || '');
                        setOTask(o.orderTask); setODiagnosis(o.diagnosis || '');
                        setONote(o.note || ''); setONurse(o.nurseName || '');
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
                                setEditingOrderId(o.id); setOBed(o.bed); setOName(o.name || '');
                                setOTask(o.orderTask); setODiagnosis(o.diagnosis || '');
                                setONote(o.note || ''); setONurse(o.nurseName || '');
                                setOPriority(o.priority || 'normal'); setShowAddOrder(true);
                              }}
                              className="font-mono text-sm font-bold px-1.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-100/30 rounded-md hover:bg-amber-100 transition-colors"
                            >
                              {o.bed}
                            </span>
                            {o.name && o.name !== '未輸入姓名' && o.name !== '不具名' && (
                              <span className="font-bold text-sm text-slate-800 truncate max-w-[80px]">
                                {o.name}
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
                            setEditingOrderId(o.id); setOBed(o.bed); setOName(o.name || '');
                            setOTask(o.orderTask); setODiagnosis(o.diagnosis || '');
                            setONote(o.note || ''); setONurse(o.nurseName || '');
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
            id="panel-handovers"
            className={`relative flex flex-col gap-2.5 bg-white rounded-xl p-3 border border-slate-150/80 shadow-xs transition-colors duration-200 ${
              mobileTab !== 'handovers' ? 'hidden' : 'flex'
            }`}
          >
            {/* Top compact button row */}
            <div className="flex items-center gap-2" id="panel-handovers-top-action">
              <label className="inline-flex items-center gap-1 cursor-pointer text-xs font-semibold text-slate-500 hover:text-slate-700 select-none transition-colors">
                <input
                  type="checkbox"
                  checked={hideHandledHandovers}
                  onChange={(e) => setHideHandledHandovers(e.target.checked)}
                  className="rounded border-slate-300 text-rose-500 focus:ring-rose-400 w-3 h-3 cursor-pointer"
                />
                隱藏已完成 ({handoverPatients.filter(h => h.isHandedOver).length} 筆)
              </label>
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
                className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-3 md:p-6"
              >
                <div className="w-full max-w-2xl bg-gradient-to-b from-rose-50 to-white dark:to-slate-100 rounded-2xl shadow-2xl border border-rose-150 dark:border-slate-200/40 flex flex-col max-h-[92vh] animate-scale-up duration-200">
                  {/* Header */}
                  <div className="flex items-center justify-between px-6 py-4.5 border-b border-rose-100/50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center bg-rose-100 text-rose-800 shrink-0">
                        <HeartPulse size={18} className="stroke-[2.5]" />
                      </div>
                    </div>
                    <button 
                      type="button"
                      onClick={() => {
                        setShowAddHandover(false);
                        setEditingHandoverId(null);
                        setHBed('');
                        setHDiagnosis('');
                        setHAttn('');
                        setHNote('');
                        setHStatus('unstable');
                        setHError('');
                      }}
                      className="text-slate-400 hover:text-slate-650 hover:bg-slate-100 w-9 h-9 rounded-full flex items-center justify-center transition-colors cursor-pointer text-lg font-bold"
                      title="關閉"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Form Scroll Container */}
                  <form 
                    onSubmit={handleAddHandoverSubmit}
                    className="flex-grow flex flex-col justify-between overflow-y-auto"
                  >
                    <div className="p-6 md:p-8 flex flex-col gap-5">
                      {/* Bed and Diagnosis on the same row */}
                      <div className="flex items-center gap-3 w-full">
                        <div className="flex-1 max-w-[120px] flex items-center bg-rose-50/50 px-2.5 py-1.5 rounded-xl border border-rose-150">
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
                          rows={4}
                          value={hAttn}
                          onChange={(e) => {
                            setHAttn(e.target.value);
                            setHError('');
                          }}
                          onKeyDown={(e) => handleTextAreaKeyDown(e, () => {
                            handleAddHandoverSubmit({ preventDefault: () => {} } as React.FormEvent);
                          })}
                          placeholder="特別關注 & 處理指引 * (例如: 呼吸喘喘 check ABG & CXR...)"
                          className="w-full text-sm text-slate-800 p-4 bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-4 focus:ring-rose-100 placeholder-slate-400 font-bold resize-none min-h-[120px]"
                          title="特定關注交代重點"
                        />
                      </div>

                      {/* Extra notes */}
                      <div className="flex flex-col gap-1.5 w-full">
                        <input
                          type="text"
                          value={hNote}
                          onChange={(e) => setHNote(e.target.value)}
                          placeholder="其餘備註資訊 (例如: 水分限制、歷史病歷、D.N.R. 簽章等其餘病歷備註...)"
                          className="w-full text-sm px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-4 focus:ring-rose-100 text-slate-800 placeholder-slate-400"
                          title="其餘備註資訊"
                        />
                      </div>

                      {/* Status Pills Selector */}
                      <div className="flex flex-col gap-2 w-full">
                        <label className="text-xs font-black text-slate-700">臨床安全分級</label>
                        <div className="flex items-center gap-2 bg-slate-100/60 p-1.5 rounded-xl self-start w-full md:w-auto">
                          {(['stable', 'unstable', 'critical'] as const).map((stat) => {
                            const labels = { stable: '🟢 穩定 (Stable)', unstable: '🟡 變動 (Unstable)', critical: '🔴 危急 (Critical)' };
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
                                className={`flex-1 md:flex-initial text-xs py-2 px-4 rounded-lg transition-all cursor-pointer border ${
                                  hStatus === stat 
                                    ? activeColors[stat]
                                    : 'border-transparent bg-transparent text-slate-600 hover:text-slate-900 font-medium hover:bg-white/60'
                                }`}
                              >
                                {labels[stat]}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {hError && (
                        <p className="text-xs text-rose-600 bg-rose-50 px-3 py-2 rounded-lg flex items-center gap-1.5 border border-rose-100 animate-pulse">
                          <AlertCircle size={14} />
                          {hError}
                        </p>
                      )}
                    </div>

                    {/* Submit / Cancel Footer */}
                    <div className="bg-slate-50 p-6 rounded-b-2xl border-t border-slate-100 flex items-center justify-end gap-3.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddHandover(false);
                          setEditingHandoverId(null);
                          setHBed('');
                          setHDiagnosis('');
                          setHAttn('');
                          setHNote('');
                          setHStatus('unstable');
                          setHError('');
                        }}
                        className="px-5 py-3 text-slate-500 hover:text-slate-800 text-sm font-bold rounded-xl border border-slate-200 hover:bg-white transition-all bg-slate-100/50 cursor-pointer"
                      >
                        取消交班
                      </button>
                      <button
                        type="submit"
                        className="py-3 px-8 bg-rose-550 hover:bg-rose-650 active:scale-95 text-white text-base font-bold rounded-xl shadow-md cursor-pointer transition-all flex items-center gap-1.5"
                      >
                        <Check size={18} className="stroke-[3]" />
                        <span>{editingHandoverId ? '確認交班變動' : '登錄特交安全提醒'}</span>
                      </button>
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
                        onClick={() => {
                          hEditFocusFieldRef.current = null;
                          setEditingHandoverId(h.id); setHBed(h.bed);
                          setHDiagnosis(h.diagnosis || ''); setHAttn(h.attentionPoints);
                          setHNote(h.note || ''); setHStatus(h.status); setShowAddHandover(true);
                        }}
                        className={`border rounded-xl px-2.5 py-1.5 flex items-start gap-2.5 transition-all cursor-pointer ${
                          critical
                            ? 'border-rose-200 bg-rose-50/25 shadow-3xs'
                            : 'border-slate-150 bg-white hover:border-slate-200 shadow-3xs'
                        }`}
                      >
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
                                  critical ? 'bg-rose-100/80 text-rose-800 border-rose-200' : 'bg-slate-100 text-slate-700 border-slate-200'
                                }`}
                              >
                                {h.bed}
                              </span>
                              {h.name && h.name !== '未輸入姓名' && h.name !== '不具名' && (
                                <span className="font-bold text-sm text-slate-850 shrink-0">{h.name}</span>
                              )}
                              {critical && (
                                <span className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded shrink-0">🚨 危急</span>
                              )}
                              {unstable && (
                                <span className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded shrink-0">⚠️ 變動</span>
                              )}
                              <span
                                onClick={(e) => {
                                  e.stopPropagation();
                                  hEditFocusFieldRef.current = 'attn';
                                  setEditingHandoverId(h.id); setHBed(h.bed);
                                  setHDiagnosis(h.diagnosis || ''); setHAttn(h.attentionPoints);
                                  setHNote(h.note || ''); setHStatus(h.status); setShowAddHandover(true);
                                }}
                                className="text-sm font-semibold leading-relaxed truncate text-slate-900 hover:opacity-70 transition-opacity"
                              >
                                {h.attentionPoints}
                              </span>
                            </div>

                            <button
                              id={`del-h-btn-${h.id}`}
                              onClick={(e) => { e.stopPropagation(); setHandoverPatients((prev) => prev.filter((item) => item.id !== h.id)); }}
                              className="text-slate-300 hover:text-rose-500 p-0.5 rounded transition-colors shrink-0"
                              title="刪除"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>

                          {/* Secondary details context */}
                          {(h.diagnosis || h.note) && (
                            <div className="text-xs text-slate-400 leading-normal flex items-center gap-1.5">
                              {h.diagnosis && h.diagnosis !== '無' && (
                                <span className="text-slate-500 font-medium truncate">Dx: {h.diagnosis}</span>
                              )}
                              {h.note && (
                                <span className="truncate italic">註: {h.note}</span>
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

                  const badges = {
                    critical: 'bg-rose-100 text-rose-800 border-rose-200 font-bold',
                    unstable: 'bg-amber-100 text-amber-800 border-amber-200',
                    stable: 'bg-emerald-100 text-emerald-800 border-emerald-200'
                  };
                  const statusLabels = { critical: '🚨 命危/極不穩', unstable: '⚠️ 變動中', stable: '常規' };

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
                              critical ? 'bg-rose-100 text-rose-800 border-rose-200' : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {h.bed}
                          </span>
                          {h.name && h.name !== '未輸入姓名' && h.name !== '不具名' && (
                            <span className="font-bold text-sm text-slate-850 truncate max-w-[85px]">
                              {h.name}
                            </span>
                          )}
                          <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${badges[h.status]}`}>
                            {statusLabels[h.status]}
                          </span>
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

                      {/* Main Dx */}
                      <div className="text-xs text-slate-650 space-y-1.5 leading-snug pl-0.5">
                        {h.diagnosis && h.diagnosis !== '無' && (
                          <p className="truncate text-xs text-slate-500">
                            Dx: <span className="font-medium text-slate-700 select-all">{h.diagnosis}</span>
                          </p>
                        )}

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
