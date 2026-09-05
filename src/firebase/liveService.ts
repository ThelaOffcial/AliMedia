import { ref, get, set, update, remove, push, onValue } from 'firebase/database';
import { db } from './config';
import { LiveBroadcast } from '../types/elephant';
import { sanitizeForFirestore } from './elephantService';

const LIVE_PATH = 'live_broadcasts';

function mapLive(id: string, data: any): LiveBroadcast {
  return {
    id,
    title: data.title || 'Live',
    sinhalaTitle: data.sinhalaTitle || '',
    description: data.description || '',
    streamUrl: data.streamUrl || '',
    coverImage: data.coverImage || '',
    type: data.type || 'general',
    location: data.location || '',
    isLive: data.isLive !== undefined ? !!data.isLive : true,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export async function getLiveBroadcasts(): Promise<LiveBroadcast[]> {
  try {
    const snap = await get(ref(db, LIVE_PATH));
    if (!snap.exists()) return [];
    const val = snap.val() || {};
    return Object.entries(val).map(([id, data]) => mapLive(id, data as any));
  } catch (e) {
    console.warn('Error fetching live broadcasts:', e);
    return [];
  }
}

export function subscribeLiveBroadcasts(onUpdate: (list: LiveBroadcast[]) => void): () => void {
  return onValue(
    ref(db, LIVE_PATH),
    (snap) => {
      if (!snap.exists()) {
        onUpdate([]);
        return;
      }
      const val = snap.val() || {};
      const list = Object.entries(val).map(([id, data]) => mapLive(id, data as any));
      // Active lives first
      list.sort((a, b) => {
        if (!!a.isLive !== !!b.isLive) return a.isLive ? -1 : 1;
        const ta = typeof a.updatedAt === 'number' ? a.updatedAt : 0;
        const tb = typeof b.updatedAt === 'number' ? b.updatedAt : 0;
        return tb - ta;
      });
      onUpdate(list);
    },
    (err) => {
      console.warn('Live broadcasts subscription error:', err);
      onUpdate([]);
    }
  );
}

export async function addLiveBroadcast(
  data: Omit<LiveBroadcast, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const newRef = push(ref(db, LIVE_PATH));
  const id = newRef.key!;
  const payload = sanitizeForFirestore({
    ...data,
    isLive: data.isLive !== false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  await set(newRef, payload);
  return id;
}

export async function updateLiveBroadcast(
  id: string,
  data: Partial<LiveBroadcast>
): Promise<void> {
  const { id: _, ...rest } = data;
  await update(ref(db, `${LIVE_PATH}/${id}`), sanitizeForFirestore({
    ...rest,
    updatedAt: Date.now(),
  }));
}

export async function deleteLiveBroadcast(id: string): Promise<void> {
  await remove(ref(db, `${LIVE_PATH}/${id}`));
}

export async function setLiveBroadcastActive(id: string, isLive: boolean): Promise<void> {
  await update(ref(db, `${LIVE_PATH}/${id}`), {
    isLive: !!isLive,
    updatedAt: Date.now(),
  });
}
