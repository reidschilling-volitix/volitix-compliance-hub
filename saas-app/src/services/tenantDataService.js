import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { appId } from '../utils/config';
import { db } from '../firebase.js';

const DATA_ROOT = ['artifacts', appId, 'public', 'data'];

const collectionRef = (name) => collection(db, ...DATA_ROOT, name);
const docRef = (name, id) => doc(db, ...DATA_ROOT, name, String(id));

const stripUndefined = (obj) =>
  Object.fromEntries(Object.entries(obj || {}).filter(([, value]) => value !== undefined));

export const listByTenant = async (collectionName, tenantId) => {
  const q = query(collectionRef(collectionName), where('tenantId', '==', tenantId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const upsertTenantRecord = async (collectionName, record) => {
  if (!record?.id || (typeof record.id === 'string' && !record.id.trim())) {
    console.error(`[upsert] Missing id for ${collectionName}:`, JSON.stringify(record, null, 2));
    throw new Error('Record id is required for upsert.');
  }
  const safe = stripUndefined(record);
  await setDoc(docRef(collectionName, safe.id), safe, { merge: true });
  return safe;
};

export const deleteTenantRecord = async (collectionName, id) => {
  if (!id) return;
  await deleteDoc(docRef(collectionName, id));
};

export const loadTenantDataset = async (tenantId) => {
  const collections = [
    'flight_logs',
    'notam_logs',
    'customers',
    'products',
    'certifications',
    'work_orders',
    'maintenance_records',
    'equipment',
    'faa_reports',
    'activity_log'
  ];

  const results = await Promise.all(collections.map((name) => listByTenant(name, tenantId)));

  return {
    flight_logs: results[0],
    notam_logs: results[1],
    customers: results[2],
    products: results[3],
    certifications: results[4],
    work_orders: results[5],
    maintenance_records: results[6],
    equipment: results[7],
    faa_reports: results[8],
    activity_log: results[9]
  };
};
