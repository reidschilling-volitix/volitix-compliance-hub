import {
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  deleteUser,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  updatePassword as firebaseUpdatePassword,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { appId } from '../utils/config';
import { auth, db } from '../firebase.js';

const normalizeTenantId = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '-');
const ALLOWED_ROLES = ['Pilot', 'Dispatcher'];

const PASSWORD_RULES = [
  { test: (p) => p.length >= 8, msg: 'at least 8 characters' },
  { test: (p) => /[A-Z]/.test(p), msg: 'an uppercase letter' },
  { test: (p) => /[a-z]/.test(p), msg: 'a lowercase letter' },
  { test: (p) => /[0-9]/.test(p), msg: 'a number' },
];

export const validatePasswordStrength = (password) => {
  const failed = PASSWORD_RULES.filter((r) => !r.test(password));
  if (failed.length === 0) return null;
  return `Password must contain ${failed.map((r) => r.msg).join(', ')}.`;
};

export const loginUser = async ({ email, password }) => {
  const em = email?.trim();
  if (!em || !password) return null;

  const authResult = await signInWithEmailAndPassword(auth, em, password);
  const uid = authResult.user.uid;
  const profileRef = doc(db, 'artifacts', appId, 'public', 'data', 'saas_users', uid);
  const profileSnap = await getDoc(profileRef);

  if (!profileSnap.exists()) {
    return {
      id: uid,
      uid,
      email: em,
      username: em.split('@')[0],
      role: 'Pilot',
      companyName: '',
      tenantId: '',
    };
  }

  const profile = profileSnap.data();
  return {
    ...profile,
    id: uid,
    tenantId: profile.tenantId || normalizeTenantId(profile.companyName),
  };
};

export const registerUser = async ({ companyName, username, email, password, role, inviteCode }) => {
  const cN = companyName?.trim();
  const em = email?.trim();
  const normalizedRole = String(role || '').trim();
  const enteredInviteCode = String(inviteCode || '').trim();
  if (!em) return { error: 'Email is required.' };
  if (!cN) return { error: 'Company Code is required.' };
  if (!enteredInviteCode) return { error: 'Join Code is required.' };
  if (!ALLOWED_ROLES.includes(normalizedRole)) return { error: 'Invalid role selected.' };

  const pwError = validatePasswordStrength(password);
  if (pwError) return { error: pwError };

  const tenantId = normalizeTenantId(cN);
  const companyRef = doc(db, 'artifacts', appId, 'public', 'data', 'saas_companies', tenantId);
  const derivedUsername = username?.trim() || em.split('@')[0] || 'user';

  const authResult = await createUserWithEmailAndPassword(auth, em, password);
  const uid = authResult.user.uid;

  try {
    const companySnap = await getDoc(companyRef);
    if (!companySnap.exists()) {
      await deleteUser(authResult.user);
      return { error: 'Company Code not found. Ask your manager for the correct Company Code.' };
    }

    const companyData = companySnap.data() || {};
    const expectedInviteCode = String(
      normalizedRole === 'Pilot' ? companyData.pilotJoinCode : companyData.dispatcherJoinCode
    ).trim();

    if (!expectedInviteCode || enteredInviteCode !== expectedInviteCode) {
      await deleteUser(authResult.user);
      return { error: `Invalid ${normalizedRole} Join Code.` };
    }

    const canonicalCompanyName = companyData.name || cN;
    const newUser = {
      companyName: canonicalCompanyName,
      tenantId,
      username: derivedUsername,
      email: em,
      role: normalizedRole,
      uid,
    };

    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'saas_users', uid), newUser, { merge: true });
    return { user: { id: uid, ...newUser } };
  } catch (err) {
    try {
      await deleteUser(authResult.user);
    } catch (_) {
      // Best effort cleanup of just-created auth user.
    }
    throw err;
  }
};

const makeJoinCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();

export const registerManager = async ({ companyName, email, password }) => {
  const cN = companyName?.trim();
  const em = email?.trim();
  if (!em) return { error: 'Email is required.' };
  if (!cN) return { error: 'Company Name is required.' };

  const pwError = validatePasswordStrength(password);
  if (pwError) return { error: pwError };

  const tenantId = normalizeTenantId(cN);
  const companyRef = doc(db, 'artifacts', appId, 'public', 'data', 'saas_companies', tenantId);

  // Create auth user first so we are signed in for Firestore reads
  const authResult = await createUserWithEmailAndPassword(auth, em, password);
  const uid = authResult.user.uid;
  const derivedUsername = em.split('@')[0] || 'manager';

  try {
    // Now we're signed in — check if company already exists
    const existingSnap = await getDoc(companyRef);
    if (existingSnap.exists()) {
      await deleteUser(authResult.user);
      return { error: 'A company with this name already exists. Choose a different name.' };
    }

    const newUser = {
      companyName: cN,
      tenantId,
      username: derivedUsername,
      email: em,
      role: 'Manager',
      uid,
    };

    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'saas_users', uid), newUser, { merge: true });

    await setDoc(companyRef, {
      name: cN,
      tenantId,
      supervisor: derivedUsername,
      email: em,
      phone: '',
      address: '',
      certNo: '',
      exemption: '',
      timezone: -6,
      fleet: [],
      pilotJoinCode: makeJoinCode(),
      dispatcherJoinCode: makeJoinCode(),
      createdAt: new Date().toISOString(),
    });

    return { user: { id: uid, ...newUser } };
  } catch (err) {
    try { await deleteUser(authResult.user); } catch (_) {}
    throw err;
  }
};

export const findUserForPasswordReset = async ({ email }) => {
  const em = email?.trim().toLowerCase();
  if (!em) return null;
  await sendPasswordResetEmail(auth, em);
  return { email: em };
};

export const resetPassword = async () => {
  throw new Error('Use password reset email flow.');
};

export const updateUserPassword = async ({ email, currentPassword, password }) => {
  if (!auth.currentUser) throw new Error('No active auth session.');
  const credential = EmailAuthProvider.credential(email, currentPassword);
  await reauthenticateWithCredential(auth.currentUser, credential);
  await firebaseUpdatePassword(auth.currentUser, password);
};

export const updateProfileName = async ({ name }) => {
  if (!auth.currentUser) throw new Error('No active auth session.');
  const trimmed = String(name || '').trim();
  if (!trimmed) throw new Error('Name is required.');

  const uid = auth.currentUser.uid;
  await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'saas_users', uid), {
    username: trimmed,
  }, { merge: true });

  return trimmed;
};
