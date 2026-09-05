import {
  ref,
  get,
  set,
  update,
  onValue,
} from 'firebase/database';
import { db, auth } from './config';
import { handleFirestoreError, OperationType } from './firestoreErrorHelper';

const VISITORS_PATH = 'visitors';

export interface VisitorInfo {
  id: string;
  displayName: string;
  email: string;
  sessionStart: any;
  lastActive: any;
}

/**
 * Visitor id used to be a client-generated random string with no ownership
 * check, which combined with an open `.write: true` RTDB rule let anyone
 * overwrite or spoof any other visitor's presence entry. It's now the
 * signed-in Firebase Auth uid (the app signs in guests anonymously too),
 * which the security rule can verify with `auth.uid === $id`.
 */
export function getVisitorId(): string | null {
  return auth.currentUser?.uid || null;
}

/**
 * Tracks the visitor's presence in Realtime Database.
 */
export async function trackVisitorPresence(displayName?: string, email?: string): Promise<void> {
  const visitorId = getVisitorId();
  if (!visitorId) {
    // No signed-in (even anonymous) auth user yet — nothing we can write
    // that would satisfy the ownership rule, so skip silently.
    return;
  }
  const visitorRef = ref(db, `${VISITORS_PATH}/${visitorId}`);

  try {
    const snap = await get(visitorRef);
    const resolvedName = displayName || 'Guest Visitor';
    const resolvedEmail = email || 'Guest';

    if (!snap.exists()) {
      await set(visitorRef, {
        id: visitorId,
        displayName: resolvedName,
        email: resolvedEmail,
        sessionStart: Date.now(),
        lastActive: Date.now(),
      });
    } else {
      await update(visitorRef, {
        displayName: resolvedName,
        email: resolvedEmail,
        lastActive: Date.now(),
      });
    }
  } catch (error) {
    console.warn('Presence tracking error:', error);
  }
}

/**
 * Periodically updates the active presence of the visitor
 */
export function startPresenceHeartbeat(displayName?: string, email?: string): () => void {
  trackVisitorPresence(displayName, email);

  const intervalId = setInterval(() => {
    if (document.visibilityState === 'visible') {
      trackVisitorPresence(displayName, email);
    }
  }, 30000);

  return () => {
    clearInterval(intervalId);
  };
}

/**
 * Real-time subscription to ALL visitors
 */
export function subscribeToVisitors(onUpdate: (visitors: VisitorInfo[]) => void): () => void {
  const visitorsRef = ref(db, VISITORS_PATH);

  return onValue(
    visitorsRef,
    (snapshot) => {
      const list: VisitorInfo[] = [];
      if (snapshot.exists()) {
        const val = snapshot.val() || {};
        for (const [id, data] of Object.entries(val) as [string, any][]) {
          list.push({
            id,
            displayName: data.displayName || 'Guest Visitor',
            email: data.email || 'Guest',
            sessionStart: data.sessionStart,
            lastActive: data.lastActive,
          });
        }
      }
      onUpdate(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, VISITORS_PATH);
    }
  );
}
