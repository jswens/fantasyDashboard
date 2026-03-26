import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDW6KFJ_XH6dv_QeovsnN_NO2lTxAZdVvM",
  authDomain: "boom-tho-league-manager.firebaseapp.com",
  projectId: "boom-tho-league-manager",
  storageBucket: "boom-tho-league-manager.firebasestorage.app",
  messagingSenderId: "468955751100",
  appId: "1:468955751100:web:687c38c00c65808903e6b9"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
