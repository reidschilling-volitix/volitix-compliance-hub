import { doc, getDoc, setDoc } from 'firebase/firestore';
import { appId, db } from '../firebase.js';

const subscriptionDocRef = (tenantId) => doc(db, 'artifacts', appId, 'public', 'data', 'saas_subscriptions', String(tenantId));

const nowIso = () => new Date().toISOString();

const defaultSubscription = (tenantId) => {
  const trialEnds = new Date();
  trialEnds.setDate(trialEnds.getDate() + 14);
  return {
    id: tenantId,
    tenantId,
    plan: 'starter',
    status: 'trialing',
    trialEndsAt: trialEnds.toISOString(),
    billingEmail: '',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
};

export const getOrCreateSubscription = async (tenantId) => {
  if (!tenantId) throw new Error('tenantId is required');
  const ref = subscriptionDocRef(tenantId);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() };
    }
  } catch (err) {
    const code = err?.code || '';
    if (!String(code).includes('permission-denied')) {
      throw err;
    }
  }

  // If document is not readable/created yet, return a local default until manager saves billing settings.
  return defaultSubscription(tenantId);
};

export const updateSubscription = async (tenantId, updates) => {
  if (!tenantId) throw new Error('tenantId is required');
  const ref = subscriptionDocRef(tenantId);
  const payload = {
    ...updates,
    tenantId,
    updatedAt: nowIso(),
  };
  await setDoc(ref, payload, { merge: true });
  const snap = await getDoc(ref);
  return { id: snap.id, ...snap.data() };
};
