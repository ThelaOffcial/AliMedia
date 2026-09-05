import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  updateDoc, 
  onSnapshot, 
  writeBatch,
  query,
  getDocs,
  enableIndexedDbPersistence
} from 'firebase/firestore';
import { 
  getDatabase, 
  ref as rtdbRef, 
  set as rtdbSet, 
  remove as rtdbRemove, 
  onValue as rtdbOnValue 
} from 'firebase/database';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut, 
  onAuthStateChanged,
  User 
} from 'firebase/auth';
import { Elephant, PeraheraEvent, GalleryPost, Comment } from '../types';

export const firebaseConfig = {
  apiKey: "AIzaSyB4yIRYiqFCcJSZCw8yK3DXY3flLyTqP9k",
  authDomain: "aliapp-e5196.firebaseapp.com",
  projectId: "aliapp-e5196",
  storageBucket: "aliapp-e5196.firebasestorage.app",
  messagingSenderId: "879533198243",
  appId: "1:879533198243:web:4aeee96c749639626e6816",
  measurementId: "G-RGB0KVXJXE"
};

// Initialize Firebase App
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);
export const rtdb = getDatabase(app);
export const auth = getAuth(app);

// Enable offline persistence for Firestore where supported
try {
  if (typeof window !== 'undefined') {
    enableIndexedDbPersistence(db).catch(() => {
      // Multiple tabs or unsupported browser, silent fallback
    });
  }
} catch {
  // Silent fallback
}

/**
 * Cloud Firestore Security Rules List
 */
export const FIRESTORE_SECURITY_RULES = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Elephant Registry Profiles
    match /elephants/{elephantId} {
      allow read: if true; // Publicly readable for cultural archival
      allow write: if true; // In production: request.auth != null
    }

    // Sacred Perahera Pageants
    match /peraheras/{peraheraId} {
      allow read: if true;
      allow write: if true;
    }

    // Community Gallery Submissions
    match /posts/{postId} {
      allow read: if true;
      allow create: if true;
      allow update: if true; // Likes count increment
      allow delete: if true;
    }

    // Community Comments & Reverence Notes
    match /comments/{commentId} {
      allow read: if true;
      allow create: if true;
      allow update, delete: if true;
    }

    // Default fallback
    match /{document=**} {
      allow read, write: if true;
    }
  }
}`;

/**
 * Firebase Realtime Database Security Rules List
 */
export const RTDB_SECURITY_RULES = `{
  "rules": {
    ".read": true,
    ".write": true,
    "elephants": {
      ".indexOn": ["name", "status", "type", "organization"]
    },
    "peraheras": {
      ".indexOn": ["date", "title"]
    },
    "posts": {
      ".indexOn": ["createdAt", "likesCount"]
    },
    "comments": {
      ".indexOn": ["postId", "createdAt"]
    }
  }
}`;

// Service methods for Firestore operations
export async function saveElephantToFirestore(elephant: Elephant): Promise<void> {
  const docRef = doc(db, 'elephants', elephant.id);
  await setDoc(docRef, elephant, { merge: true });
}

export async function deleteElephantFromFirestore(elephantId: string): Promise<void> {
  const docRef = doc(db, 'elephants', elephantId);
  await deleteDoc(docRef);
}

export async function savePeraheraToFirestore(perahera: PeraheraEvent): Promise<void> {
  const docRef = doc(db, 'peraheras', perahera.id);
  await setDoc(docRef, perahera, { merge: true });
}

export async function deletePeraheraFromFirestore(peraheraId: string): Promise<void> {
  const docRef = doc(db, 'peraheras', peraheraId);
  await deleteDoc(docRef);
}

export async function savePostToFirestore(post: GalleryPost): Promise<void> {
  const docRef = doc(db, 'posts', post.id);
  await setDoc(docRef, post, { merge: true });
}

export async function deletePostFromFirestore(postId: string): Promise<void> {
  const docRef = doc(db, 'posts', postId);
  await deleteDoc(docRef);
}

export async function saveCommentToFirestore(comment: Comment): Promise<void> {
  const docRef = doc(db, 'comments', comment.id);
  await setDoc(docRef, comment, { merge: true });
}

/**
 * Seed/Sync all data to Firestore in batch
 */
export async function seedAllToFirestore(
  elephants: Elephant[],
  peraheras: PeraheraEvent[],
  posts: GalleryPost[]
): Promise<number> {
  let count = 0;
  
  // Elephants batch
  for (const el of elephants) {
    const docRef = doc(db, 'elephants', el.id);
    await setDoc(docRef, el, { merge: true });
    count++;
  }

  // Peraheras batch
  for (const p of peraheras) {
    const docRef = doc(db, 'peraheras', p.id);
    await setDoc(docRef, p, { merge: true });
    count++;
  }

  // Posts batch
  for (const post of posts) {
    const docRef = doc(db, 'posts', post.id);
    await setDoc(docRef, post, { merge: true });
    count++;
  }

  return count;
}
