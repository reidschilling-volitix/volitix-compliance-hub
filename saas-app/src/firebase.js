import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyBiW4z1vIMlznLsHs-Xhz44chOYkiYVBKI",
  authDomain: "spray-drone-compliance-hub.firebaseapp.com",
  projectId: "spray-drone-compliance-hub",
  storageBucket: "spray-drone-compliance-hub.firebasestorage.app",
  messagingSenderId: "565689528030",
  appId: "1:565689528030:web:3e405f9d0ff30b02061c4f",
  measurementId: "G-J3QZKLGNX1"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const appId = 'aviation-compliance-hub';