import { useEffect, useMemo, useRef, useState } from 'react';
import { ShieldCheck, CalendarDays, Send, Cloud, Users, FlaskConical, Plane, Award, Wrench, FileText, Navigation, FileBarChart, Settings2, User, X, LogOut, AlertTriangle, Activity, Search, Sun, Moon, Menu, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import Dashboard from './components/Dashboard.jsx';
import CustomersTab from './components/CustomersTab.jsx';
import ProductsTab from './components/ProductsTab.jsx';
import CertificationsTab from './components/CertificationsTab.jsx';
import MissionLogTab from './components/MissionLogTab.jsx';
import NotamTab from './components/NotamTab.jsx';
import MaintenanceTab from './components/MaintenanceTab.jsx';
import ScheduleTab from './components/ScheduleTab.jsx';
import DispatchTab from './components/DispatchTab.jsx';
import SmartWeatherTab from './components/SmartWeatherTab.jsx';
import FleetTab from './components/FleetTab.jsx';
import FaaReportTab from './components/FaaReportTab.jsx';
import SettingsTab from './components/SettingsTab.jsx';
import ActivityLogTab from './components/ActivityLogTab.jsx';
import NotificationCenter from './components/NotificationCenter.jsx';
import GlobalSearch from './components/GlobalSearch.jsx';
import AuthPortal from './components/AuthPortal.jsx';
import { findUserForPasswordReset, loginUser, registerUser, registerManager, resetPassword } from './services/authService.js';
import { getOrCreateSubscription } from './services/subscriptionService.js';
import { deleteTenantRecord, loadTenantDataset, upsertTenantRecord } from './services/tenantDataService.js';
import { appId } from './utils/config';
import { auth, db } from './firebase.js';
import ErrorBoundary from './components/ErrorBoundary.jsx';

const defaultLogState = {
  isEditing: false,
  date: new Date().toLocaleDateString('en-CA'),
  startTime: '08:00',
  endTime: '10:00',
  selectedAircraft: [],
  customer: '',
  locationName: '',
  totalAcreage: '',
  treatedAcreage: '',
  whatWasTreated: 'Corn',
  customCrop: '',
  targetPest: '',
  nozzleDesc: 'Atomizer Sprinklers',
  targetDistance: '',
  pumpPressure: '',
  travelSpeed: '',
  speedUnit: 'mph',
  driftPractices: '',
  coordType: 'Decimal',
  latDec: '',
  lonDec: '',
  latDecDir: 'N',
  lonDecDir: 'W',
  latDMS: { d: '', m: '', s: '', dir: 'N' },
  lonDMS: { d: '', m: '', s: '', dir: 'W' },
  coordinates: '',
  chemical: '',
  appRate: '',
  windSpeed: '',
  windDirection: 'N',
  temp: '',
  tempUnit: 'F',
  humidity: '',
  incidents: 'None',
  damageDescription: '',
  flightTimeValue: '',
  flightTimeUnit: 'Hours',
  flightTimeMinutes: '',
  kmlData: null,
  kmlFileName: '',
  attachedNotam: ''
};

const normalizeCompanyKey = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '-');

const defaultNotamState = {
  isEditing: false,
  date: new Date().toLocaleDateString('en-CA'),
  notamNumber: '',
  script: '',
  localStartTime: '08:00',
  duration: '4',
  radius: '0.5',
  coordType: 'Decimal',
  latDec: '',
  lonDec: '',
  latDecDir: 'N',
  lonDecDir: 'W',
  latDMS: { d: '', m: '', s: '', dir: 'N' },
  lonDMS: { d: '', m: '', s: '', dir: 'W' }
};

const defaultCustomerState = {
  id: '',
  isEditing: false,
  name: '',
  contactName: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  zip: '',
  notes: '',
  assignedTo: []
};

const defaultProductState = {
  id: '',
  isEditing: false,
  name: '',
  defaultRate: '',
  inventory: '',
  description: ''
};

const defaultCertState = {
  id: '',
  isEditing: false,
  name: 'FAA Part 137',
  customName: '',
  licenseNumber: '',
  state: 'FEDERAL',
  expirationDate: ''
};

const formatToNotamDMS = (input, isLon = false) => {
  if (!input) return '000000';
  const parts = input.toString().trim().split(/\s+/);
  const decimal = parts.length >= 2
    ? Math.abs(parseFloat(parts[0]) || 0) + ((parseFloat(parts[1]) || 0) / 60) + ((parseFloat(parts[2]) || 0) / 3600)
    : Math.abs(parseFloat(input));
  if (isNaN(decimal)) return '000000';
  const degrees = Math.floor(decimal);
  const minutes = Math.floor((decimal - degrees) * 60);
  const seconds = Math.round((decimal - degrees - (minutes / 60)) * 3600);
  return `${degrees.toString().padStart(isLon ? 3 : 2, '0')}${minutes.toString().padStart(2, '0')}${seconds.toString().padStart(2, '0')}`;
};

const normalizeTenantId = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '-');

const getAllowedFleetCount = (subscriptionData) => {
  const included = Math.max(0, Number(subscriptionData?.includedDrones ?? 2) || 2);
  const extra = Math.max(0, Number(subscriptionData?.extraDrones ?? 0) || 0);
  return included + extra;
};

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [logs, setLogs] = useState([]);
  const [notams, setNotams] = useState([]);
  const [customers, setCustomers] = useState([
    {
      id: 'c1',
      tenantId: 'sprayops',
      name: 'Blue Harvest Farms',
      contactName: 'Jen Farmer',
      email: 'jen@blueharvest.com',
      phone: '(555) 123-4567',
      address: '1207 Farmstead Lane',
      city: 'Aurora',
      state: 'TX',
      zip: '75801',
      notes: 'Repeat customer with spring wheat rotation.',
      assignedTo: ['Pilot01']
    }
  ]);
  const [products, setProducts] = useState([
    {
      id: 'p1',
      tenantId: 'sprayops',
      name: 'AeroGuard',
      defaultRate: '3.50',
      inventory: '128',
      description: 'Premium aerial spray formulation for field crop applications.'
    }
  ]);
  const [certifications, setCertifications] = useState([]);
  const [missionState, setMissionState] = useState(defaultLogState);
  const [notamState, setNotamState] = useState(defaultNotamState);
  const [customerState, setCustomerState] = useState(defaultCustomerState);
  const [productState, setProductState] = useState(defaultProductState);
  const [certState, setCertState] = useState(defaultCertState);
  const [toast, setToast] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const kmlRef = useRef(null);
  const overCapToastShownRef = useRef(false);

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('sprayops-theme') || 'dark';
  });
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('sprayops-theme', theme);
  }, [theme]);
  const toggleTheme = () => setTheme((t) => t === 'dark' ? 'light' : 'dark');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('sprayops-sidebar') === 'collapsed');
  const toggleSidebar = () => setSidebarCollapsed((p) => { const next = !p; localStorage.setItem('sprayops-sidebar', next ? 'collapsed' : 'expanded'); return next; });

  const companyPilots = [
    { id: 'p1', username: 'Pilot01' },
    { id: 'p2', username: 'Pilot02' }
  ];

  // Auth state
  const [customUser, setCustomUser] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({ companyName: '', email: '', password: '', role: 'Pilot', inviteCode: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [resetUserDoc, setResetUserDoc] = useState(null);

  const [company, setCompany] = useState({
    name: 'SprayOps',
    supervisor: 'Lead Pilot',
    email: 'pilot01@sprayops.com',
    phone: '(555) 321-9876',
    address: '1207 Farmstead Lane, TX 75801',
    certNo: '137-192-84',
    exemption: 'US137-209',
    timezone: -6,
    fleet: [
      { id: 'N-1234', model: 'DJI Agras T40', sprayRate: 40, sn: 'AG-401' },
      { id: 'N-5678', model: 'DJI Agras T30', sprayRate: 32, sn: 'AG-302' }
    ]
  });
  const isOnline = true;

  const [workOrders, setWorkOrders] = useState([
    {
      id: 'w1',
      tenantId: 'sprayops',
      title: 'North Field Application',
      customer: 'Blue Harvest Farms',
      acres: '45',
      chemical: 'AeroGuard',
      appRate: '2.5',
      date: new Date().toISOString().slice(0, 10),
      status: 'Scheduled',
      isScheduled: true,
      selectedAircraft: ['N-1234'],
      estHoursMin: '1.5',
      estHoursMax: '2.0'
    }
  ]);

  const [maintenanceRecords, setMaintenanceRecords] = useState([
    {
      id: 'm1',
      tenantId: 'sprayops',
      date: new Date().toISOString().slice(0, 10),
      assetId: 'N-1234',
      workPerformed: 'Routine airframe inspection and rotor calibration',
      notes: 'Verified payload mount and flight controls.'
    }
  ]);

  const [equipmentList, setEquipmentList] = useState([
    { id: 'e1', tenantId: 'sprayops', name: 'DJI Agras T40', type: 'Drone', serialNumber: 'AG-401' },
    { id: 'e2', tenantId: 'sprayops', name: 'Field Support Trailer', type: 'Trailer', serialNumber: 'TR-902' }
  ]);

  const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7));
  const [showFormalReport, setShowFormalReport] = useState(false);
  const [faaReports, setFaaReports] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [activityLog, setActivityLog] = useState([]);

  const includedFleetSeats = Math.max(0, Number(subscription?.includedDrones ?? 2) || 2);
  const addonFleetSeats = Math.max(0, Number(subscription?.extraDrones ?? 0) || 0);
  const allowedFleetSeats = includedFleetSeats + addonFleetSeats;
  const currentFleetCount = Array.isArray(company?.fleet) ? company.fleet.length : 0;
  const isFleetOverCapacity = currentFleetCount > allowedFleetSeats;

  const currentTenantId = useMemo(
    () => normalizeTenantId(customUser?.tenantId || customUser?.companyName || company.name),
    [customUser?.tenantId, customUser?.companyName, company.name]
  );

  const stampTenant = (item) => ({
    ...item,
    tenantId: normalizeTenantId(item?.tenantId || item?.companyName || currentTenantId),
    companyName: item?.companyName || customUser?.companyName || item?.companyName || ''
  });

  const isTenantRecord = (item) => normalizeTenantId(item?.tenantId || item?.companyName) === currentTenantId;

  const tenantLogs = useMemo(() => logs.filter(isTenantRecord), [logs, currentTenantId]);
  // Pilots only see their own mission logs; Dispatchers/Managers see all
  const userLogs = useMemo(() => {
    if (customUser?.role !== 'Pilot') return tenantLogs;
    const uname = customUser?.username || '';
    return tenantLogs.filter((log) => log.picUsername === uname || !log.picUsername);
  }, [tenantLogs, customUser?.role, customUser?.username]);
  const tenantNotams = useMemo(() => notams.filter(isTenantRecord), [notams, currentTenantId]);
  // Restrict dispatchers to only see their own customers/products
  const tenantCustomers = useMemo(() => {
    if (customUser?.role !== 'Dispatcher') return customers.filter(isTenantRecord);
    const uname = customUser?.username || '';
    return customers.filter((c) => isTenantRecord(c) && (c.createdBy === uname));
  }, [customers, currentTenantId, customUser?.role, customUser?.username]);

  const tenantProducts = useMemo(() => {
    if (customUser?.role !== 'Dispatcher') return products.filter(isTenantRecord);
    const uname = customUser?.username || '';
    return products.filter((p) => isTenantRecord(p) && (p.createdBy === uname));
  }, [products, currentTenantId, customUser?.role, customUser?.username]);
  const tenantCertifications = useMemo(() => certifications.filter(isTenantRecord), [certifications, currentTenantId]);
  const tenantWorkOrders = useMemo(() => workOrders.filter(isTenantRecord), [workOrders, currentTenantId]);
  // Dispatchers only see work orders they created (+ legacy orders without createdBy)
  const dispatcherWorkOrders = useMemo(() => {
    if (customUser?.role !== 'Dispatcher') return tenantWorkOrders;
    const uname = customUser?.username || '';
    return tenantWorkOrders.filter((wo) => wo.createdBy === uname);
  }, [tenantWorkOrders, customUser?.role, customUser?.username]);
  const tenantMaintenanceRecords = useMemo(() => maintenanceRecords.filter(isTenantRecord), [maintenanceRecords, currentTenantId]);
  const tenantEquipmentList = useMemo(() => equipmentList.filter(isTenantRecord), [equipmentList, currentTenantId]);
  const tenantFaaReports = useMemo(() => faaReports.filter(isTenantRecord), [faaReports, currentTenantId]);

  const setTenantWorkOrders = (updater) => {
    setWorkOrders((prev) => {
      const tenantPrev = prev.filter((item) => isTenantRecord(item));
      const otherTenants = prev.filter((item) => !isTenantRecord(item));
      const next = typeof updater === 'function' ? updater(tenantPrev) : updater;
      if (!Array.isArray(next)) return prev;
      // Defensive pass: ensure every work order has a unique, non-empty id
      const stamped = next.map((item, idx) => {
        let id = item.id;
        if (!id || typeof id !== 'string' || !id.trim()) {
          id = `w-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${idx}`;
        }
        return stampTenant({ ...item, id });
      });
      const prevIds = new Set(tenantPrev.map((item) => item.id));
      const nextIds = new Set(stamped.map((item) => item.id));
      stamped.forEach((item) => persistRecord('work_orders', item));
      [...prevIds].filter((id) => !nextIds.has(id)).forEach((id) => {
        deleteTenantRecord('work_orders', id).catch((err) => notify(`Delete sync failed for work_orders: ${err.message}`, 'error'));
      });
      return [...otherTenants, ...stamped];
    });
  };

  const setTenantMaintenanceRecords = (updater) => {
    setMaintenanceRecords((prev) => {
      const tenantPrev = prev.filter((item) => isTenantRecord(item));
      const otherTenants = prev.filter((item) => !isTenantRecord(item));
      const next = typeof updater === 'function' ? updater(tenantPrev) : updater;
      if (!Array.isArray(next)) return prev;
      const stamped = next.map((item) => stampTenant(item));
      const prevIds = new Set(tenantPrev.map((item) => item.id));
      const nextIds = new Set(stamped.map((item) => item.id));
      stamped.forEach((item) => persistRecord('maintenance_records', item));
      [...prevIds].filter((id) => !nextIds.has(id)).forEach((id) => {
        deleteTenantRecord('maintenance_records', id).catch((err) => notify(`Delete sync failed for maintenance_records: ${err.message}`, 'error'));
      });
      return [...otherTenants, ...stamped];
    });
  };

  const setTenantEquipmentList = (updater) => {
    setEquipmentList((prev) => {
      const tenantPrev = prev.filter((item) => isTenantRecord(item));
      const otherTenants = prev.filter((item) => !isTenantRecord(item));
      const next = typeof updater === 'function' ? updater(tenantPrev) : updater;
      if (!Array.isArray(next)) return prev;
      const stamped = next.map((item) => stampTenant(item));
      const prevIds = new Set(tenantPrev.map((item) => item.id));
      const nextIds = new Set(stamped.map((item) => item.id));
      stamped.forEach((item) => persistRecord('equipment', item));
      [...prevIds].filter((id) => !nextIds.has(id)).forEach((id) => {
        deleteTenantRecord('equipment', id).catch((err) => notify(`Delete sync failed for equipment: ${err.message}`, 'error'));
      });
      return [...otherTenants, ...stamped];
    });
  };

  const setTenantFaaReports = (updater) => {
    setFaaReports((prev) => {
      const tenantPrev = prev.filter((item) => isTenantRecord(item));
      const otherTenants = prev.filter((item) => !isTenantRecord(item));
      const next = typeof updater === 'function' ? updater(tenantPrev) : updater;
      if (!Array.isArray(next)) return prev;
      const stamped = next.map((item) => stampTenant(item));
      const prevIds = new Set(tenantPrev.map((item) => item.id));
      const nextIds = new Set(stamped.map((item) => item.id));
      stamped.forEach((item) => persistRecord('faa_reports', item));
      [...prevIds].filter((id) => !nextIds.has(id)).forEach((id) => {
        deleteTenantRecord('faa_reports', id).catch((err) => notify(`Delete sync failed for faa_reports: ${err.message}`, 'error'));
      });
      return [...otherTenants, ...stamped];
    });
  };

  const persistRecord = (collectionName, record) => {
    if (!record?.id || (typeof record.id === 'string' && !record.id.trim())) {
      console.error(`[persistRecord] Missing id for ${collectionName}:`, record);
    }
    upsertTenantRecord(collectionName, record).catch((err) => {
      console.error(`[persistRecord] Sync failed for ${collectionName}:`, record, err);
      notify(`Sync failed for ${collectionName}: ${err.message}`, 'error');
    });
  };

  const logActivity = (action, detail) => {
    const entry = {
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      tenantId: currentTenantId,
      action,
      detail: String(detail || ''),
      username: customUser?.username || customUser?.email || '',
      uid: customUser?.uid || customUser?.id || '',
      timestamp: new Date().toISOString(),
    };
    setActivityLog((prev) => [entry, ...prev]);
    upsertTenantRecord('activity_log', entry).catch(() => {});
  };

  useEffect(() => {
    if (!customUser || !currentTenantId) return;
    let cancelled = false;

    const load = async () => {
      try {
        const subscriptionData = await getOrCreateSubscription(currentTenantId);
        if (!cancelled) setSubscription(subscriptionData);

        const companyRef = doc(db, 'artifacts', appId, 'public', 'data', 'saas_companies', currentTenantId);
        const companySnap = await getDoc(companyRef);
        if (!cancelled && companySnap.exists()) {
          const companyData = companySnap.data() || {};
          setCompany((prev) => ({ ...prev, ...companyData }));
        }

        const data = await loadTenantDataset(currentTenantId);
        if (cancelled) return;

        setLogs(data.flight_logs);
        setNotams(data.notam_logs);
        setCustomers(data.customers.length ? data.customers : customers);
        setProducts(data.products.length ? data.products : products);
        setCertifications(data.certifications);
        setWorkOrders(data.work_orders.length ? data.work_orders : workOrders);
        setMaintenanceRecords(data.maintenance_records.length ? data.maintenance_records : maintenanceRecords);
        setEquipmentList(data.equipment.length ? data.equipment : equipmentList);
        setFaaReports(data.faa_reports);
        setActivityLog(data.activity_log || []);
      } catch (err) {
        if (!cancelled) notify(`Tenant data load failed: ${err.message}`, 'error');
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  // Intentionally load per tenant session; default seeds are used only when Firestore has no data yet.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customUser?.id, currentTenantId]);

  const notify = (message, type = 'success', options = {}) => {
    const { actionLabel = '', onAction = null, durationMs = 2600 } = options || {};
    setToast({ message, type, show: true, actionLabel, onAction });
    if (durationMs > 0) {
      window.setTimeout(() => setToast(null), durationMs);
    }
  };

  useEffect(() => {
    const isManager = customUser?.role === 'Manager';
    if (!isManager) {
      overCapToastShownRef.current = false;
      return;
    }

    if (isFleetOverCapacity && !overCapToastShownRef.current) {
      const overBy = currentFleetCount - allowedFleetSeats;
      notify(
        `Fleet exceeds seats by ${overBy}. Open billing to increase add-on seats.`,
        'error',
        {
          actionLabel: 'Open Billing',
          onAction: () => {
            setActiveTab('settings');
            setToast(null);
          },
          durationMs: 8000,
        }
      );
      overCapToastShownRef.current = true;
      return;
    }

    if (!isFleetOverCapacity) {
      overCapToastShownRef.current = false;
    }
  }, [customUser?.role, isFleetOverCapacity, currentFleetCount, allowedFleetSeats]);

  // --- Session idle lock: lock screen after 15 minutes, full logout after 30 ---
  const [isLocked, setIsLocked] = useState(false);
  const [lockPassword, setLockPassword] = useState('');
  useEffect(() => {
    if (!customUser) return;
    const LOCK_MS = 15 * 60 * 1000;
    const LOGOUT_MS = 30 * 60 * 1000;
    let lockTimer, logoutTimer;
    const resetTimer = () => {
      clearTimeout(lockTimer);
      clearTimeout(logoutTimer);
      lockTimer = setTimeout(() => {
        setIsLocked(true);
      }, LOCK_MS);
      logoutTimer = setTimeout(() => {
        setCustomUser(null);
        setIsLocked(false);
        setAuthForm({ companyName: '', email: '', password: '', role: 'Pilot', inviteCode: '' });
        setAuthMode('login');
        signOut(auth).catch(() => {});
        notify('Session expired due to inactivity.', 'error');
      }, LOGOUT_MS);
    };
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();
    return () => {
      clearTimeout(lockTimer);
      clearTimeout(logoutTimer);
      events.forEach((e) => window.removeEventListener(e, resetTimer));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customUser?.id]);

  // --- Trial expiration enforcement ---
  const trialExpired = useMemo(() => {
    if (!subscription) return false;
    if (subscription.status === 'active') return false;
    if (subscription.status === 'trialing') {
      const ends = subscription.trialEndsAt || subscription.currentPeriodEnd;
      if (ends && new Date(ends) < new Date()) return true;
    }
    if (subscription.status === 'canceled' || subscription.status === 'unpaid') return true;
    return false;
  }, [subscription]);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const found = await loginUser(authForm);
      if (found) {
        const enteredCompany = normalizeCompanyKey(authForm.companyName);
        const profileCompany = normalizeCompanyKey(found.companyName);
        if (enteredCompany && profileCompany && enteredCompany !== profileCompany) {
          await signOut(auth);
          notify('Company Code does not match this account.', 'error');
          return;
        }
        setCustomUser(found);
        setActiveTab(found.role === 'Dispatcher' ? 'dispatch' : 'dashboard');
        notify('Welcome back', 'success');
        logActivity('login', `${found.username || found.email} signed in`);
      } else {
        notify('Invalid credentials.', 'error');
      }
    } catch (err) {
      notify(`Database Error: ${err.message}`, 'error');
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const result = await registerUser(authForm);
      if (result.error) return notify(result.error, 'error');
      setCustomUser(result.user);
      setActiveTab(result.user.role === 'Dispatcher' ? 'dispatch' : 'dashboard');
      notify('User created.', 'success');
      logActivity('register', `${result.user.username || result.user.email} joined as ${result.user.role}`);
    } catch (err) {
      notify(`Database Error: ${err.message}`, 'error');
    }
  };

  const handleRegisterManager = async (e) => {
    e.preventDefault();
    try {
      const result = await registerManager({ companyName: authForm.companyName, email: authForm.email, password: authForm.password });
      if (result.error) return notify(result.error, 'error');
      setCustomUser(result.user);
      setActiveTab('dashboard');
      notify('Company created! Configure join codes in Settings.', 'success');
      logActivity('create', `Company "${authForm.companyName}" created by ${result.user.email}`);
    } catch (err) {
      notify(`Database Error: ${err.message}`, 'error');
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    try {
      const userDoc = await findUserForPasswordReset(authForm);

      if (userDoc) {
        setResetUserDoc(null);
        setAuthMode('login');
        notify('Password reset email sent. Check your inbox.', 'success');
      } else {
        notify('Please enter a valid email address.', 'error');
      }
    } catch (err) {
      notify(`Error: ${err.message}`, 'error');
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!resetUserDoc || !authForm.password) return;
    try {
      await resetPassword({ userId: resetUserDoc.id, password: authForm.password });
      notify('Password updated successfully! You can now log in.', 'success');
      setAuthMode('login');
      setAuthForm({ ...authForm, password: '' });
      setResetUserDoc(null);
    } catch (err) {
      notify(`Error updating password: ${err.message}`, 'error');
    }
  };

  const handleLogout = () => {
    setCustomUser(null);
    setAuthForm({ companyName: '', email: '', password: '', role: 'Pilot', inviteCode: '' });
    setAuthMode('login');
    setResetUserDoc(null);
    notify('Logged out successfully.', 'info');
  };

  const handleAddCustomer = (customerData) => {
    const newCustomer = stampTenant({ ...customerData, id: `c-${Date.now()}` });
    setCustomers((prev) => [...prev, newCustomer]);
    persistRecord('customers', newCustomer);
    return newCustomer;
  };

  const handleAddProduct = (productData) => {
    const newProduct = stampTenant({ ...productData, id: `p-${Date.now()}` });
    setProducts((prev) => [...prev, newProduct]);
    persistRecord('products', newProduct);
    return newProduct;
  };

  const handleLogMission = (job) => {
    setActiveTab('log');
    setMissionState({
      ...defaultLogState,
      isEditing: true,
      date: job.date || new Date().toISOString().slice(0, 10),
      customer: job.customer || '',
      locationName: job.title || job.customer || '',
      totalAcreage: job.acres || '',
      treatedAcreage: job.acres || '',
      chemical: job.chemical || '',
      appRate: job.appRate || '',
      selectedAircraft: job.selectedAircraft || [],
      kmlData: job.kmlData || null,
      kmlFileName: job.kmlFileName || '',
      coordType: job.coordType || 'Decimal',
      latDec: job.latDec || job.finalLat || '',
      lonDec: job.lonDec || job.finalLon || '',
      latDecDir: job.latDecDir || 'N',
      lonDecDir: job.lonDecDir || 'W',
      latDMS: job.latDMS || { d: '', m: '', s: '', dir: 'N' },
      lonDMS: job.lonDMS || { d: '', m: '', s: '', dir: 'W' },
      flightTimeValue: job.estHoursMin || '',
      flightTimeUnit: 'Hours',
    });
  };

  const handleKmlUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const kmlData = event.target?.result || null;
      if (kmlData) {
        setMissionState((prev) => ({ ...prev, kmlData, kmlFileName: file.name }));
        notify('Boundary file attached to mission log.', 'success');
      }
    };
    reader.readAsText(file);
  };

  const derived = useMemo(() => {
    const [hours, minutes] = (notamState.localStartTime || '00:00').split(':');
    const utcHourNum = ((parseInt(hours, 10) || 0) - (company.timezone || -6) + 24) % 24;
    const utcHour = String(utcHourNum).padStart(2, '0');
    return { utcStart: `${utcHour}${minutes || '00'}` };
  }, [notamState.localStartTime, company.timezone]);

  const generateNotamScript = () => {
    const exemptionCert = certifications.find((c) => c.name === 'FAA 44807');
    const exemptionNo = exemptionCert ? exemptionCert.licenseNumber : (company.exemption || 'N/A');

    const latDir = notamState.coordType === 'DMS' ? (notamState.latDMS?.dir || 'N') : (notamState.latDecDir || 'N');
    const lonDir = notamState.coordType === 'DMS' ? (notamState.lonDMS?.dir || 'W') : (notamState.lonDecDir || 'W');

    const latInput = notamState.coordType === 'DMS'
      ? `${notamState.latDMS?.d || 0} ${notamState.latDMS?.m || 0} ${notamState.latDMS?.s || 0}`
      : notamState.latDec;
    const lonInput = notamState.coordType === 'DMS'
      ? `${notamState.lonDMS?.d || 0} ${notamState.lonDMS?.m || 0} ${notamState.lonDMS?.s || 0}`
      : notamState.lonDec;

    const fLat = formatToNotamDMS(latInput, false);
    const fLon = formatToNotamDMS(lonInput, true);

    return `!FDC UAS ${notamState.notamNumber || 'XXXX'} AIRSPACE UAS OPS ${company.name || 'SPRAY OPS'} PART 137 ARIAL APPLICATION 0.5NM RADIUS OF ${fLat}${latDir}${fLon}${lonDir} SFC-200FT AGL. PURSUANT TO EXEMPTION ${exemptionNo}. ${notamState.date || 'YYYY-MM-DD'} ${derived.utcStart} UTC-${notamState.duration || '4'} HRS.`;
  };

  const handleDelete = (collection, id) => {
    const collectionMap = {
      flight_logs: 'flight_logs',
      notam_logs: 'notam_logs',
      customers: 'customers',
      products: 'products',
      certifications: 'certifications',
      maintenance_records: 'maintenance_records',
      equipment: 'equipment',
      faa_reports: 'faa_reports',
    };

    if (collectionMap[collection]) {
      deleteTenantRecord(collectionMap[collection], id).catch((err) => {
        notify(`Delete sync failed for ${collection}: ${err.message}`, 'error');
      });
      logActivity('delete', `Deleted ${collection.replace(/_/g, ' ')} record ${id}`);
    }

    if (collection === 'flight_logs') {
      setLogs((prev) => prev.filter((item) => item.id !== id || !isTenantRecord(item)));
    }
    if (collection === 'notam_logs') {
      setNotams((prev) => prev.filter((item) => item.id !== id || !isTenantRecord(item)));
    }
    if (collection === 'customers') {
      setCustomers((prev) => prev.filter((item) => item.id !== id || !isTenantRecord(item)));
    }
    if (collection === 'products') {
      setProducts((prev) => prev.filter((item) => item.id !== id || !isTenantRecord(item)));
    }
    if (collection === 'certifications') {
      setCertifications((prev) => prev.filter((item) => item.id !== id || !isTenantRecord(item)));
    }
    if (collection === 'maintenance_records') {
      setMaintenanceRecords((prev) => prev.filter((item) => item.id !== id || !isTenantRecord(item)));
    }
    if (collection === 'equipment') {
      setEquipmentList((prev) => prev.filter((item) => item.id !== id || !isTenantRecord(item)));
    }
    if (collection === 'faa_reports') {
      setFaaReports((prev) => prev.filter((item) => item.id !== id || !isTenantRecord(item)));
    }
  };

  const handleMissionSubmit = (e, newCustData, newProdData) => {
    if (e && e.preventDefault) e.preventDefault();

    let c = missionState.customer;
    if (newCustData && newCustData.name) {
      c = newCustData.name;
      setCustomers((prev) => [...prev, stampTenant({ ...newCustData, id: `c-${Date.now()}`, timestamp: new Date().toISOString() })]);
    }

    let p = missionState.chemical;
    if (newProdData && newProdData.name) {
      p = newProdData.name;
      setProducts((prev) => [...prev, stampTenant({ ...newProdData, id: `p-${Date.now()}`, timestamp: new Date().toISOString() })]);
    }

    let finalCrop = missionState.whatWasTreated;
    if (missionState.whatWasTreated === 'ADD_NEW') {
      finalCrop = missionState.customCrop;
    }

    // Deduct product inventory by chemical rate only: oz/ac * acres (independent of GPA).
    const treatedAcres = parseFloat(missionState.treatedAcreage) || parseFloat(missionState.totalAcreage) || 0;
    if (p && treatedAcres > 0) {
      const prodDoc = tenantProducts.find((prod) => prod.name === p);
      if (prodDoc && prodDoc.id) {
        const rateOzPerAc = parseFloat(prodDoc.defaultRate) || 0;
        if (rateOzPerAc > 0) {
          const usedGallons = (rateOzPerAc * treatedAcres) / 128;
          const currentInv = parseFloat(prodDoc.inventory) || 0;
          const newInv = Math.max(0, currentInv - usedGallons);
          setProducts((prev) => prev.map((prod) => (prod.id === prodDoc.id ? { ...prod, inventory: newInv.toFixed(2) } : prod)));
        }
      }
    }

    // Compute flight time in minutes
    let mins = parseFloat(missionState.flightTimeValue) || 0;
    if (missionState.flightTimeUnit === 'Hours') mins = mins * 60;

    // Compute coordinates
    let lat = 0, lon = 0;
    if (missionState.coordType === 'Decimal') {
      lat = Math.abs(parseFloat(missionState.latDec || 0)) * (missionState.latDecDir === 'S' ? -1 : 1);
      lon = Math.abs(parseFloat(missionState.lonDec || 0)) * (missionState.lonDecDir === 'E' ? 1 : -1);
    } else if (missionState.coordType === 'DMS') {
      lat = (parseFloat(missionState.latDMS.d || 0) + parseFloat(missionState.latDMS.m || 0) / 60 + parseFloat(missionState.latDMS.s || 0) / 3600) * (missionState.latDMS.dir === 'S' ? -1 : 1);
      lon = (parseFloat(missionState.lonDMS.d || 0) + parseFloat(missionState.lonDMS.m || 0) / 60 + parseFloat(missionState.lonDMS.s || 0) / 3600) * (missionState.lonDMS.dir === 'W' ? -1 : 1);
    }

    const finalState = {
      ...stampTenant(missionState),
      picUsername: customUser.username,
      flightTimeMinutes: mins,
      coordinates: missionState.coordType === 'Decimal' ? `${lat}, ${lon}` : `${lat.toFixed(6)}, ${lon.toFixed(6)}`,
      finalLat: lat,
      finalLon: lon,
      whatWasTreated: finalCrop,
      customer: c,
      chemical: p
    };

    if (!finalState.date || !finalState.startTime) {
      notify('Date and start time are required.', 'error');
      return;
    }

    if (missionState.id) {
      // Update existing log
      const updated = { ...finalState, id: missionState.id };
      setLogs((prev) => prev.map((l) => l.id === missionState.id ? updated : l));
      persistRecord('flight_logs', updated);
      setMissionState(defaultLogState);
      notify('Flight log updated.', 'success');
      logActivity('update', `Flight updated: ${c || 'Unknown'} at ${finalState.locationName || 'Unknown'} (${finalState.treatedAcreage || 0} ac)`);
    } else {
      // Create new log
      const newLog = { ...finalState, id: `log-${Date.now()}` };
      setLogs((prev) => [newLog, ...prev]);
      persistRecord('flight_logs', newLog);
      setMissionState(defaultLogState);
      notify('Flight logged successfully.', 'success');
      logActivity('create', `Flight logged: ${c || 'Unknown'} at ${finalState.locationName || 'Unknown'} (${finalState.treatedAcreage || 0} ac)`);
    }
  };

  const handleNotamSubmit = () => {
    if (!notamState.date || !notamState.notamNumber) {
      notify('NOTAM date and number are required.', 'error');
      return;
    }
    const newNotam = { ...stampTenant(notamState), id: `notam-${Date.now()}` };
    setNotams((prev) => [newNotam, ...prev]);
    persistRecord('notam_logs', newNotam);
    setNotamState(defaultNotamState);
    notify('NOTAM archived successfully.', 'success');
    logActivity('create', `NOTAM ${notamState.notamNumber} archived`);
  };

  const handleCustomerSubmit = () => {
    if (!customerState.name) {
      notify('Customer name is required.', 'error');
      return;
    }
    const uname = customUser?.username || '';
    if (customerState.id) {
      setCustomers((prev) => prev.map((item) => (item.id === customerState.id && isTenantRecord(item) ? stampTenant({ ...customerState, createdBy: item.createdBy }) : item)));
      persistRecord('customers', stampTenant({ ...customerState, createdBy: customerState.createdBy }));
    } else {
      const newCustomer = stampTenant({ ...customerState, id: `c-${Date.now()}`, createdBy: uname });
      setCustomers((prev) => [...prev, newCustomer]);
      persistRecord('customers', newCustomer);
    }
    setCustomerState(defaultCustomerState);
    notify('Customer saved.', 'success');
    logActivity(customerState.id ? 'update' : 'create', `Customer ${customerState.name} ${customerState.id ? 'updated' : 'added'}`);
  };

  const handleProductSubmit = () => {
    if (!productState.name) {
      notify('Product name is required.', 'error');
      return;
    }
    const uname = customUser?.username || '';
    if (productState.id) {
      setProducts((prev) => prev.map((item) => (item.id === productState.id && isTenantRecord(item) ? stampTenant({ ...productState, createdBy: item.createdBy }) : item)));
      persistRecord('products', stampTenant({ ...productState, createdBy: productState.createdBy }));
    } else {
      const newProduct = stampTenant({ ...productState, id: `p-${Date.now()}`, createdBy: uname });
      setProducts((prev) => [...prev, newProduct]);
      persistRecord('products', newProduct);
    }
    setProductState(defaultProductState);
    notify('Product saved.', 'success');
    logActivity(productState.id ? 'update' : 'create', `Product ${productState.name} ${productState.id ? 'updated' : 'added'}`);
  };

  const handleCertSubmit = () => {
    if (!certState.name) {
      notify('Certification type is required.', 'error');
      return;
    }
    if (certState.id) {
      setCertifications((prev) => prev.map((item) => (item.id === certState.id && isTenantRecord(item) ? stampTenant(certState) : item)));
      persistRecord('certifications', stampTenant(certState));
    } else {
      const newCert = stampTenant({ ...certState, id: `cert-${Date.now()}` });
      setCertifications((prev) => [...prev, newCert]);
      persistRecord('certifications', newCert);
    }
    setCertState(defaultCertState);
    notify('Certification saved.', 'success');
    logActivity(certState.id ? 'update' : 'create', `Certification ${certState.name} ${certState.id ? 'updated' : 'added'}`);
  };

  const handleExportInvoices = () => {
    if (tenantCustomers.length === 0) return notify('No customers to export.', 'error');
    if (!tenantLogs || tenantLogs.length === 0) return notify('No flight logs available to bill.', 'error');

    const headers = ['InvoiceNo', 'Customer', 'InvoiceDate', 'DueDate', 'ServiceDate', 'Item(Product/Service)', 'ItemDescription', 'ItemQuantity'];
    const csvRows = [headers.join(',')];
    const today = new Date();
    const invDate = today.toLocaleDateString('en-US');
    today.setDate(today.getDate() + 30);
    const dueDate = today.toLocaleDateString('en-US');

    let billedItemsCount = 0;
    tenantCustomers.forEach((customer) => {
      const customerLogs = tenantLogs.filter((log) => log.customer === customer.name);
      if (customerLogs.length > 0) {
        const invoiceNo = `INV-${customer.name.substring(0, 3).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
        customerLogs.forEach((log) => {
          const escapeCSV = (str) => `"${String(str || '').replace(/"/g, '""')}"`;
          const acres = parseFloat(log.treatedAcreage) || parseFloat(log.totalAcreage) || 0;
          const crop = log.whatWasTreated === 'ADD_NEW' ? log.customCrop : log.whatWasTreated;
          const desc = `Flight on ${log.date} at ${log.locationName || 'N/A'} - Crop: ${crop || 'N/A'} - Chemical: ${log.chemical || 'N/A'}`;

          csvRows.push([
            escapeCSV(invoiceNo),
            escapeCSV(customer.name),
            escapeCSV(invDate),
            escapeCSV(dueDate),
            escapeCSV(log.date),
            escapeCSV('Aerial Application'),
            escapeCSV(desc),
            escapeCSV(acres),
          ].join(','));
          billedItemsCount += 1;
        });
      }
    });

    if (billedItemsCount === 0) {
      return notify('None of your customers have completed flight logs to bill.', 'error');
    }

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `QuickBooks_Invoices_${new Date().toISOString().slice(0, 10)}.csv`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    notify(`Exported ${billedItemsCount} billable flights!`, 'success');
  };

  const saveFleetToFirestore = async (fleetData) => {
    if (customUser?.role !== 'Manager' || !currentTenantId) return;
    try {
      const fleet = Array.isArray(fleetData) ? fleetData : [];
      const companyRef = doc(db, 'artifacts', appId, 'public', 'data', 'saas_companies', currentTenantId);
      await setDoc(companyRef, { fleet }, { merge: true });
      notify('Fleet saved.', 'success');
    } catch (err) {
      notify(`Fleet save failed: ${err.message}`, 'error');
    }
  };

  const handleCompanySettingsSave = async (event) => {
    event?.preventDefault();

    if (customUser?.role !== 'Manager') {
      notify('Only managers can update company settings.', 'error');
      return;
    }

    if (!currentTenantId) {
      notify('Unable to resolve tenant for settings save.', 'error');
      return;
    }

    try {
      const latestSubscription = await getOrCreateSubscription(currentTenantId);
      setSubscription(latestSubscription);

      const fleet = Array.isArray(company?.fleet) ? company.fleet : [];
      const allowed = getAllowedFleetCount(latestSubscription);
      if (fleet.length > allowed) {
        notify(`Cannot save company settings: fleet has ${fleet.length} aircraft but plan allows ${allowed}.`, 'error');
        return;
      }

      const payload = {
        ...company,
        fleet,
        tenantId: currentTenantId,
      };

      const companyRef = doc(db, 'artifacts', appId, 'public', 'data', 'saas_companies', currentTenantId);
      await setDoc(companyRef, payload, { merge: true });
      notify('Command settings saved.', 'success');
      logActivity('settings', 'Company settings updated');
    } catch (err) {
      notify(`Command settings save failed: ${err.message}`, 'error');
    }
  };

  const handlePasswordChanged = () => {
    setCustomUser((prev) => (prev ? { ...prev } : prev));
  };

  const handleProfileNameChanged = (nextName) => {
    const trimmed = String(nextName || '').trim();
    if (!trimmed) return;
    setCustomUser((prev) => (prev ? { ...prev, username: trimmed } : prev));
  };

  const handleSubscriptionChanged = (nextSubscription) => {
    if (!nextSubscription) return;
    setSubscription(nextSubscription);
  };

  const displayName = customUser?.username || customUser?.email?.split('@')?.[0] || 'User';

  const userRole = customUser?.role;
  const tabs = [
    ...(userRole !== 'Dispatcher' ? [{ id: 'dashboard', icon: ShieldCheck, label: 'Dashboard' }] : []),
    ...(userRole !== 'Dispatcher' ? [{ id: 'schedule', icon: CalendarDays, label: 'Schedule' }] : [{ id: 'dispatch', icon: Send, label: 'My Orders' }]),
    ...(userRole !== 'Dispatcher' ? [{ id: 'smart-weather', icon: Cloud, label: 'Smart Route' }] : []),
    { id: 'customers', icon: Users, label: 'Customers' },
    { id: 'products', icon: FlaskConical, label: 'Products' },
    ...(userRole !== 'Dispatcher' ? [
      { id: 'fleet', icon: Plane, label: 'Aircraft Fleet' },
      { id: 'certifications', icon: Award, label: 'Certifications' },
      { id: 'maintenance', icon: Wrench, label: 'Maintenance' },
      { id: 'log', icon: FileText, label: 'Mission Log' },
      { id: 'notam', icon: Navigation, label: 'NOTAM Tool' },
      { id: 'faa-report', icon: FileBarChart, label: 'FAA Report' }
    ] : []),
    ...(userRole === 'Manager' ? [{ id: 'activity', icon: Activity, label: 'Activity Log' }] : []),
    { id: 'settings', icon: Settings2, label: 'Settings' }
  ];

  if (!customUser) {
    return (
      <AuthPortal
        toast={toast}
        authMode={authMode}
        setAuthMode={setAuthMode}
        authForm={authForm}
        setAuthForm={setAuthForm}
        showPassword={showPassword}
        setShowPassword={setShowPassword}
        resetUserDoc={resetUserDoc}
        handleLogin={handleLogin}
        handleRegister={handleRegister}
        handleRegisterManager={handleRegisterManager}
        handleForgotPassword={handleForgotPassword}
        handleResetPassword={handleResetPassword}
        setResetUserDoc={setResetUserDoc}
      />
    );
  }

  if (trialExpired && customUser?.role === 'Manager') {
    return (
      <div className="flex flex-col items-center justify-center min-h-full w-full bg-[#020617] p-8">
        <div className="glass-card border border-red-500/30 p-10 rounded-3xl max-w-lg w-full text-center space-y-6 shadow-[0_0_50px_rgba(239,68,68,0.15)]">
          <AlertTriangle size={48} className="mx-auto text-red-400" />
          <h2 className="text-2xl font-black uppercase tracking-widest text-red-400">Trial Expired</h2>
          <p className="text-sm text-slate-400 leading-relaxed">Your free trial has ended. Subscribe to continue using SprayOps.</p>
          <button onClick={() => { setActiveTab('settings'); }} className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-[#9cd33b] to-[#8ac22a] text-[#020617] font-black uppercase tracking-widest text-sm" type="button">Open Billing</button>
          <button onClick={handleLogout} className="w-full py-3 px-6 rounded-2xl border border-slate-700 text-slate-400 font-black uppercase tracking-widest text-xs hover:border-red-500/50 hover:text-red-400 transition-colors" type="button">Sign Out</button>
        </div>
      </div>
    );
  }

  if (trialExpired && customUser?.role !== 'Manager') {
    return (
      <div className="flex flex-col items-center justify-center min-h-full w-full bg-[#020617] p-8">
        <div className="glass-card border border-amber-500/30 p-10 rounded-3xl max-w-lg w-full text-center space-y-6 shadow-[0_0_50px_rgba(245,158,11,0.15)]">
          <AlertTriangle size={48} className="mx-auto text-amber-400" />
          <h2 className="text-2xl font-black uppercase tracking-widest text-amber-400">Account Inactive</h2>
          <p className="text-sm text-slate-400 leading-relaxed">Your company&apos;s subscription is inactive. Contact your manager to restore access.</p>
          <button onClick={handleLogout} className="w-full py-3 px-6 rounded-2xl border border-slate-700 text-slate-400 font-black uppercase tracking-widest text-xs hover:border-red-500/50 hover:text-red-400 transition-colors" type="button">Sign Out</button>
        </div>
      </div>
    );
  }

  if (isLocked) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full w-full bg-[#020617] p-8">
        <div className="bg-lightning-container"><div className="lightning-veins"></div></div>
        <div className="glass-card border border-[#9cd33b]/30 p-10 rounded-3xl max-w-md w-full text-center space-y-6 shadow-[0_0_50px_rgba(156,211,59,0.1)] relative z-10">
          <ShieldCheck size={48} className="mx-auto text-[#9cd33b]" />
          <h2 className="text-xl font-black uppercase tracking-widest text-slate-200">Session Locked</h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Idle for 15 minutes — enter password to resume</p>
          <p className="text-sm text-[#9cd33b] font-black">{customUser?.email}</p>
          <form onSubmit={async (e) => {
            e.preventDefault();
            try {
              await loginUser(customUser.email, lockPassword);
              setIsLocked(false);
              setLockPassword('');
              notify('Session unlocked.', 'success');
            } catch {
              notify('Incorrect password.', 'error');
            }
          }}>
            <input type="password" value={lockPassword} onChange={(e) => setLockPassword(e.target.value)} placeholder="Password" className="w-full bg-slate-950/50 border border-slate-800 p-4 rounded-2xl text-sm text-slate-200 outline-none focus:border-[#9cd33b]/50 transition-colors mb-4" autoFocus required />
            <button type="submit" className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-[#9cd33b] to-[#8ac22a] text-[#020617] font-black uppercase tracking-widest text-sm">Unlock</button>
          </form>
          <button onClick={handleLogout} className="w-full py-3 px-6 rounded-2xl border border-slate-700 text-slate-400 font-black uppercase tracking-widest text-xs hover:border-red-500/50 hover:text-red-400 transition-colors" type="button">Sign Out Instead</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full bg-[#020617] overflow-hidden font-sans selection:bg-[#9cd33b] selection:text-[#020617] relative">
      <div className="bg-lightning-container"><div className="lightning-veins"></div></div>
      <div className="absolute top-0 left-0 w-full h-[30rem] bg-gradient-to-b from-[#9cd33b]/[0.02] to-transparent pointer-events-none"></div>

      {toast && (
        <>
          <div className="fixed inset-0 z-[249] bg-black/60 animate-fade-in" onClick={() => setToast(null)} />
          <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[250] px-6 py-3.5 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.7)] font-black uppercase tracking-widest text-[11px] flex items-center gap-3 animate-fade-in border ${
            toast.type === 'error'
              ? 'bg-red-950 border-red-500/70 text-red-400'
              : toast.type === 'success'
              ? 'bg-[#0a1a00] border-[#9cd33b]/70 text-[#9cd33b]'
              : 'bg-blue-950 border-blue-500/70 text-blue-400'
          }`}>
            {toast.type === 'error' ? <AlertTriangle size={16} /> : <ShieldCheck size={16} />}
            {toast.message}
            {toast.actionLabel && typeof toast.onAction === 'function' && (
              <button
                type="button"
                onClick={toast.onAction}
                className="ml-1 px-3 py-1 rounded-full border border-current/40 hover:bg-black/20 transition-colors"
              >
                {toast.actionLabel}
              </button>
            )}
          </div>
        </>
      )}

      {showProfileModal && (
        <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4 animate-fade-in">
          <div className="glass-card border border-slate-800 p-6 max-w-md w-full relative">
            <button onClick={() => setShowProfileModal(false)} className="absolute top-6 right-6 text-slate-400 hover:text-white"><X size={20} /></button>
            <div className="flex items-center gap-4 mb-8 border-b border-slate-800 pb-6">
              <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center"><User size={24} className="text-[#9cd33b]" /></div>
              <div className="min-w-0 flex-1">
                <h3 className="text-xl font-black uppercase text-white truncate">{displayName}</h3>
                <p className="text-[#9cd33b] text-xs font-bold uppercase tracking-widest">{customUser.role}</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest pl-1 truncate">Company</p>
                <p className="text-sm font-black text-slate-200 truncate">{customUser.companyName}</p>
              </div>
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest pl-1 truncate">Email</p>
                <p className="text-sm font-black text-slate-200 truncate">{customUser.email}</p>
              </div>
            </div>
            <div className="pt-6 mt-6 border-t border-slate-800">
              <button onClick={() => { setShowProfileModal(false); setActiveTab('settings'); }} className="w-full px-5 py-4 rounded-2xl bg-gradient-to-r from-[#9cd33b] to-[#7ab02b] text-[#020617] font-black uppercase tracking-widest shadow-[0_0_15px_rgba(156,211,59,0.2)]">
                Change Password
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-xl border-b border-slate-800 flex items-center justify-between px-4 py-3">
        <button onClick={() => setMobileNavOpen(true)} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/50 transition-all">
          <Menu size={20} />
        </button>
        <span className="text-[10px] font-['Orbitron'] text-[#9cd33b] font-black uppercase tracking-[0.3em]">Spray Ops</span>
        <NotificationCenter
          certifications={tenantCertifications}
          subscription={subscription}
          fleetCount={currentFleetCount}
          allowedSeats={allowedFleetSeats}
          isManager={customUser?.role === 'Manager'}
          products={tenantProducts}
          equipmentList={tenantEquipmentList}
        />
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileNavOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileNavOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-slate-900 border-r border-slate-800 overflow-y-auto animate-fade-in">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <span className="text-[10px] font-['Orbitron'] text-[#9cd33b] font-black uppercase tracking-[0.3em]">Spray Ops</span>
              <button onClick={() => setMobileNavOpen(false)} className="p-2 rounded-xl text-slate-400 hover:text-white"><X size={18} /></button>
            </div>
            <nav className="p-3 space-y-1">
              {tabs.map((t) => {
                const Icon = t.icon;
                return (
                  <button key={t.id} onClick={() => { setActiveTab(t.id); setMobileNavOpen(false); }} className={`w-full flex items-center gap-3 p-3 rounded-xl text-[11px] uppercase tracking-widest font-bold transition-all ${activeTab === t.id ? 'bg-[#9cd33b] text-[#020617] font-black' : 'text-slate-400 hover:bg-slate-800/50'}`}>
                    <Icon size={16} /> {t.label}
                  </button>
                );
              })}
            </nav>
            <div className="p-3 border-t border-slate-800 space-y-1">
              <button onClick={() => { setShowProfileModal(true); setMobileNavOpen(false); }} className="w-full flex items-center gap-3 p-3 rounded-xl text-[11px] text-slate-400 uppercase tracking-widest font-bold hover:bg-slate-800/50"><User size={16} /> Profile</button>
              <button onClick={toggleTheme} className="w-full flex items-center gap-3 p-3 rounded-xl text-[11px] text-slate-400 uppercase tracking-widest font-bold hover:bg-slate-800/50">{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />} {theme === 'dark' ? 'Light' : 'Dark'} Mode</button>
              <button onClick={handleLogout} className="w-full flex items-center gap-3 p-3 rounded-xl text-[11px] text-red-500/80 uppercase tracking-widest font-bold hover:bg-red-500/10"><LogOut size={16} /> Sign Out</button>
            </div>
          </div>
        </div>
      )}

      <aside className={`hidden md:flex ${sidebarCollapsed ? 'w-16' : 'w-20 lg:w-64'} bg-slate-900/80 backdrop-blur-2xl border-r border-slate-800 flex-col shrink-0 print:hidden z-30 shadow-[4px_0_24px_rgba(0,0,0,0.2)] relative transition-all duration-300`}>
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-[#9cd33b]/5 to-transparent pointer-events-none"></div>
        <div className={`${sidebarCollapsed ? 'p-3' : 'p-4 lg:p-6'} border-b border-slate-800/50 min-w-0 flex flex-col items-center text-center relative z-10`}>
          {!sidebarCollapsed && (
            <div className="hidden lg:flex flex-col items-center w-full">
              <h1 className={`font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 uppercase tracking-tighter break-words leading-tight w-full drop-shadow-md ${
                (company.name?.length || 0) > 25 ? 'text-xs' : (company.name?.length || 0) > 15 ? 'text-sm' : 'text-lg'
              }`}>
                {customUser?.companyName || company.name || 'Organization'}
              </h1>
              <span className="text-[10px] font-['Orbitron'] text-[#9cd33b] font-black uppercase tracking-[0.3em] mt-1.5 drop-shadow-[0_0_10px_rgba(156,211,59,0.3)]">Spray Ops</span>
              {isOnline ? (
                <span className="text-[8px] bg-[#9cd33b]/10 border border-[#9cd33b]/30 text-[#9cd33b] px-2.5 py-1 rounded-full font-black uppercase tracking-widest mt-3 flex items-center gap-1.5 shadow-[0_0_10px_rgba(156,211,59,0.1)]">Online</span>
              ) : (
                <span className="text-[8px] bg-amber-500/10 border border-amber-500/30 text-amber-500 px-2.5 py-1 rounded-full font-black uppercase tracking-widest mt-3 flex items-center gap-1.5">Caching</span>
              )}
              {customUser?.role === 'Manager' && (
                <span
                  className={`text-[8px] px-2.5 py-1 rounded-full font-black uppercase tracking-widest mt-2 border ${
                    isFleetOverCapacity
                      ? 'bg-red-500/10 border-red-500/30 text-red-400'
                      : 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                  }`}
                >
                  Seats {currentFleetCount}/{allowedFleetSeats}
                </span>
              )}
            </div>
          )}
          <div className={`${sidebarCollapsed ? 'flex' : 'lg:hidden flex'} flex-col items-center gap-2`}>
            <ShieldCheck className="mx-auto text-[#9cd33b] shrink-0" size={sidebarCollapsed ? 20 : 24} strokeWidth={2.5} />
          </div>
        </div>
        <nav className={`flex-1 ${sidebarCollapsed ? 'p-2 space-y-1' : 'p-4 space-y-1.5'} overflow-y-auto relative z-10`}>
          <button
            type="button"
            onClick={() => setShowSearch(true)}
            className={`w-full flex items-center justify-center ${!sidebarCollapsed ? 'lg:justify-start' : ''} p-3 rounded-2xl text-slate-500 hover:bg-slate-800/50 hover:text-slate-300 transition-all min-w-0 group mb-2`}
            title="Search"
          >
            <Search size={16} className="shrink-0 group-hover:scale-110 transition-transform" />
            {!sidebarCollapsed && <span className="hidden lg:inline text-[10px] uppercase tracking-widest ml-4 font-bold truncate">Search</span>}
            {!sidebarCollapsed && <kbd className="hidden lg:inline ml-auto text-[8px] text-slate-600 font-mono bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">⌘K</kbd>}
          </button>
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => { setActiveTab(t.id); setShowProfileModal(false); }}
                title={t.label}
                className={`w-full flex items-center justify-center ${!sidebarCollapsed ? 'lg:justify-start' : ''} ${sidebarCollapsed ? 'p-2.5' : 'p-3.5'} rounded-2xl transition-all duration-300 min-w-0 group ${
                  activeTab === t.id
                    ? 'bg-gradient-to-r from-[#9cd33b] to-[#8ac22a] text-[#020617] shadow-[0_0_20px_rgba(156,211,59,0.3)] font-black'
                    : 'hover:bg-slate-800/50 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon size={18} className={`shrink-0 transition-transform duration-300 ${activeTab === t.id ? 'scale-110' : 'group-hover:scale-110'}`} />
                {!sidebarCollapsed && <span className={`hidden lg:inline text-[11px] uppercase tracking-widest ml-4 truncate ${activeTab === t.id ? 'font-black' : 'font-bold'}`}>{t.label}</span>}
              </button>
            );
          })}
        </nav>
        <div className={`${sidebarCollapsed ? 'p-2' : 'p-4'} border-t border-slate-800/50 space-y-2 min-w-0 relative z-10`}>
          {!sidebarCollapsed && (
            <div className="hidden lg:flex flex-col min-w-0 mb-3 px-2">
              <span className="text-[10px] text-slate-300 font-black uppercase tracking-widest truncate">{displayName}</span>
              <span className="text-[9px] text-[#9cd33b] font-bold uppercase tracking-widest truncate mt-0.5 opacity-80">{customUser.role}</span>
            </div>
          )}
          <button onClick={() => setShowProfileModal(true)} className={`w-full p-3 flex items-center justify-center ${!sidebarCollapsed ? 'lg:justify-start' : ''} rounded-xl text-slate-400 hover:bg-slate-800/50 transition-all min-w-0 group`} title="My Profile">
            <User size={16} className="shrink-0 group-hover:text-white transition-colors" />
            {!sidebarCollapsed && <span className="hidden lg:inline text-[10px] font-black uppercase tracking-widest ml-3 truncate group-hover:text-white transition-colors">My Profile</span>}
          </button>
          <button onClick={toggleTheme} className={`w-full p-3 flex items-center justify-center ${!sidebarCollapsed ? 'lg:justify-start' : ''} rounded-xl text-slate-400 hover:bg-slate-800/50 transition-all min-w-0 group`} title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}>
            {theme === 'dark' ? <Sun size={16} className="shrink-0 group-hover:text-amber-400 transition-colors" /> : <Moon size={16} className="shrink-0 group-hover:text-blue-400 transition-colors" />}
            {!sidebarCollapsed && <span className="hidden lg:inline text-[10px] font-black uppercase tracking-widest ml-3 truncate group-hover:text-white transition-colors">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
          </button>
          <button onClick={handleLogout} className={`w-full p-3 flex items-center justify-center ${!sidebarCollapsed ? 'lg:justify-start' : ''} rounded-xl text-red-500/80 hover:text-red-400 hover:bg-red-500/10 transition-all min-w-0 group`} title="Sign Out">
            <LogOut size={16} className="shrink-0 group-hover:scale-110 transition-transform" />
            {!sidebarCollapsed && <span className="hidden lg:inline text-[10px] font-black uppercase tracking-widest ml-3 truncate">Sign Out</span>}
          </button>
          <button onClick={toggleSidebar} className="w-full p-3 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-800/50 hover:text-slate-300 transition-all min-w-0 group" title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {sidebarCollapsed ? <ChevronsRight size={16} className="shrink-0" /> : <ChevronsLeft size={16} className="shrink-0" />}
            {!sidebarCollapsed && <span className="hidden lg:inline text-[10px] font-bold uppercase tracking-widest ml-3 truncate">Collapse</span>}
          </button>
        </div>
      </aside>

      <GlobalSearch
        open={showSearch}
        onClose={setShowSearch}
        customers={tenantCustomers}
        fleet={company.fleet || []}
        logs={tenantLogs}
        workOrders={tenantWorkOrders}
        certifications={tenantCertifications}
        products={tenantProducts}
        onNavigate={setActiveTab}
      />

      <main className="flex-1 h-full overflow-y-auto relative z-20 min-w-0 pt-14 md:pt-0 pb-16 md:pb-0">
        {/* Persistent notification bar */}
        <div className="hidden md:flex items-center justify-between px-6 py-2.5 bg-slate-900/90 border-b border-slate-800/50 shrink-0 sticky top-0 z-30 backdrop-blur-md">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest truncate">{displayName} · {customUser?.role}</span>
          </div>
          <NotificationCenter
            certifications={tenantCertifications}
            subscription={subscription}
            fleetCount={currentFleetCount}
            allowedSeats={allowedFleetSeats}
            isManager={customUser?.role === 'Manager'}
            products={tenantProducts}
            equipmentList={tenantEquipmentList}
          />
        </div>
        <div className="glass-card min-h-full p-6 lg:p-10 shadow-[0_25px_80px_rgba(0,0,0,0.35)]">
          {activeTab === 'dashboard' && (
            <Dashboard
              fleet={company.fleet || []}
              company={company}
              customUser={customUser}
              logs={tenantLogs}
              maintRecords={tenantMaintenanceRecords}
              certifications={tenantCertifications}
              subscription={subscription}
              onNavigate={setActiveTab}
            />
          )}
          {activeTab === 'customers' && (
            <CustomersTab
              items={tenantCustomers}
              pilots={companyPilots}
              customUser={customUser}
              isEditing={customerState.isEditing}
              state={customerState}
              setState={setCustomerState}
              onCancel={() => setCustomerState(defaultCustomerState)}
              onSubmit={handleCustomerSubmit}
              onDelete={handleDelete}
              onExport={handleExportInvoices}
              logs={tenantLogs}
              company={company}
            />
          )}
          {activeTab === 'products' && (
            <ProductsTab
              items={tenantProducts}
              isEditing={productState.isEditing}
              state={productState}
              setState={setProductState}
              onCancel={() => setProductState(defaultProductState)}
              onSubmit={handleProductSubmit}
              onDelete={handleDelete}
            />
          )}
          {activeTab === 'certifications' && (
            <CertificationsTab
              items={tenantCertifications}
              isEditing={certState.isEditing}
              state={certState}
              setState={setCertState}
              onCancel={() => setCertState(defaultCertState)}
              onSubmit={handleCertSubmit}
              onDelete={handleDelete}
            />
          )}
          {activeTab === 'fleet' && (
            <FleetTab
              company={company}
              setCompany={setCompany}
              customUser={customUser}
              subscription={subscription}
              notify={notify}
              onManageBilling={() => setActiveTab('settings')}
              onSaveFleet={saveFleetToFirestore}
            />
          )}
          {activeTab === 'maintenance' && (
            <MaintenanceTab
              maintenanceRecords={tenantMaintenanceRecords}
              setMaintenanceRecords={setTenantMaintenanceRecords}
              equipmentList={tenantEquipmentList}
              setEquipmentList={setTenantEquipmentList}
              fleet={company.fleet}
              notify={notify}
            />
          )}
          {activeTab === 'schedule' && (
            <ScheduleTab
              workOrders={tenantWorkOrders}
              setWorkOrders={setTenantWorkOrders}
              customers={tenantCustomers}
              products={tenantProducts}
              fleet={company.fleet}
              notify={notify}
              onAddCustomer={handleAddCustomer}
              onAddProduct={handleAddProduct}
              onLogMission={handleLogMission}
            />
          )}
          {activeTab === 'dispatch' && (
            <ErrorBoundary>
              <DispatchTab
                workOrders={dispatcherWorkOrders}
                setWorkOrders={setTenantWorkOrders}
                customers={tenantCustomers}
                products={tenantProducts}
                notify={notify}
                customUser={customUser}
                onAddCustomer={handleAddCustomer}
                onAddProduct={handleAddProduct}
              />
            </ErrorBoundary>
          )}
          {activeTab === 'smart-weather' && <SmartWeatherTab workOrders={tenantWorkOrders} notify={notify} />}
          {activeTab === 'log' && (
            <MissionLogTab
              logs={userLogs}
              notams={tenantNotams}
              fleet={company.fleet || []}
              customers={tenantCustomers}
              products={tenantProducts}
              crops={[{ id: 'c1', name: 'Corn' }, { id: 'c2', name: 'Soybeans' }, { id: 'c3', name: 'Peanuts' }]}
              isEditing={missionState.isEditing}
              state={missionState}
              setState={setMissionState}
              onCancel={() => {
                const dirty = missionState.customer || missionState.totalAcreage || missionState.chemical;
                if (dirty) {
                  if (window.confirm('Save changes before closing?')) { handleMissionSubmit(); return; }
                }
                setMissionState(defaultLogState);
              }}
              onSubmit={handleMissionSubmit}
              onDelete={handleDelete}
              kmlRef={kmlRef}
              handleKml={handleKmlUpload}
              notify={notify}
            />
          )}
          {activeTab === 'notam' && (
            <NotamTab
              notams={tenantNotams}
              isEditing={notamState.isEditing}
              state={notamState}
              setState={setNotamState}
              onCancel={() => {
                const dirty = notamState.notamNumber || notamState.script;
                if (dirty) {
                  if (window.confirm('Save changes before closing?')) { handleNotamSubmit(); return; }
                }
                setNotamState(defaultNotamState);
              }}
              onSubmit={handleNotamSubmit}
              onDelete={handleDelete}
              derived={derived}
              generate={generateNotamScript}
              notify={notify}
              company={company}
            />
          )}
          {activeTab === 'faa-report' && (
            <FaaReportTab
              company={company}
              fleet={company.fleet}
              certifications={tenantCertifications}
              reportMonth={reportMonth}
              setReportMonth={setReportMonth}
              showFormalReport={showFormalReport}
              setShowFormalReport={setShowFormalReport}
              notify={notify}
              logs={tenantLogs}
              workOrders={tenantWorkOrders}
              faaReports={tenantFaaReports}
              setFaaReports={setTenantFaaReports}
              onDelete={handleDelete}
            />
          )}
          {activeTab === 'activity' && (
            <ActivityLogTab activityLog={activityLog} customUser={customUser} />
          )}
          {activeTab === 'settings' && (
            <SettingsTab
              company={company}
              setCompany={setCompany}
              handleCompanySettingsSave={handleCompanySettingsSave}
              customUser={customUser}
              tenantId={currentTenantId}
              subscription={subscription}
              notify={notify}
              onPasswordChanged={handlePasswordChanged}
              onProfileNameChanged={handleProfileNameChanged}
              onSubscriptionChanged={handleSubscriptionChanged}
              tenantData={{
                flightLogs: tenantLogs,
                workOrders: tenantWorkOrders,
                customers: tenantCustomers,
                products: tenantProducts,
                certifications: tenantCertifications,
                maintenanceRecords: tenantMaintenanceRecords,
                equipmentList: tenantEquipmentList,
              }}
            />
          )}
        </div>
      </main>

      {/* Mobile Bottom Tab Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800 flex items-center justify-around px-1 py-1.5 safe-area-inset-bottom">
        {tabs.slice(0, 5).map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex flex-col items-center gap-0.5 p-1.5 rounded-xl min-w-0 flex-1 transition-all ${activeTab === t.id ? 'text-[#9cd33b]' : 'text-slate-500'}`}>
              <Icon size={18} />
              <span className="text-[7px] font-black uppercase tracking-wider truncate w-full text-center">{t.label}</span>
            </button>
          );
        })}
        <button onClick={() => setMobileNavOpen(true)} className="flex flex-col items-center gap-0.5 p-1.5 rounded-xl min-w-0 flex-1 text-slate-500 transition-all">
          <Menu size={18} />
          <span className="text-[7px] font-black uppercase tracking-wider">More</span>
        </button>
      </div>
    </div>
  );
}

export default App;
