// Import Firebase modules
import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging, isSupported } from 'firebase/messaging';

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Initialize Firebase Cloud Messaging and get a reference to the service
// Only initialize messaging if browser supports it
let messaging: any = null;
const initMessaging = async () => {
  try {
    if (await isSupported()) {
      messaging = getMessaging(app);
      return messaging;
    }
    return null;
  } catch (error) {
    console.error('Firebase messaging error:', error);
    return null;
  }
};

export { app, auth, db, storage, messaging, initMessaging };

// For simulating end-to-end encryption
export const encryptMessage = (text: string): string => {
  // This is just a simulation of encryption
  // In a real app, you would use a proper encryption library
  return text; // Pretend this is encrypted now
};

export const decryptMessage = (encryptedText: string): string => {
  // This is just a simulation of decryption
  // In a real app, you would use a proper decryption method
  return encryptedText; // Pretend this is decrypted now
};