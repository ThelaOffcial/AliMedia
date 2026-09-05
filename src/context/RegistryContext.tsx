import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Elephant, PeraheraEvent, GalleryPost, Comment, ViewTab } from '../types';
import { initialElephants, initialPeraheras, initialPosts } from '../data/initialData';
import { 
  db, 
  auth,
  saveElephantToFirestore, 
  deleteElephantFromFirestore, 
  savePeraheraToFirestore, 
  deletePeraheraFromFirestore, 
  savePostToFirestore, 
  deletePostFromFirestore, 
  saveCommentToFirestore,
  seedAllToFirestore,
  FIRESTORE_SECURITY_RULES,
  RTDB_SECURITY_RULES,
  firebaseConfig
} from '../services/firebase';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc,
  query,
  orderBy
} from 'firebase/firestore';
import { 
  signInAnonymously, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut, 
  onAuthStateChanged, 
  User 
} from 'firebase/auth';

interface RegistryContextType {
  elephants: Elephant[];
  peraheras: PeraheraEvent[];
  posts: GalleryPost[];
  comments: Comment[];
  bookmarks: string[]; // Elephant IDs
  compareList: string[]; // Elephant IDs (max 3)
  activeTab: ViewTab;
  setActiveTab: (tab: ViewTab) => void;
  selectedElephant: Elephant | null;
  setSelectedElephant: (elephant: Elephant | null) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filterStatus: string;
  setFilterStatus: (status: string) => void;
  filterType: string;
  setFilterType: (type: string) => void;
  
  // Real-time Database & Auth Status
  isFirebaseLive: boolean;
  firebaseStatus: 'connected' | 'connecting' | 'fallback' | 'synced';
  authUser: User | null;
  signInWithFirebase: (email?: string, password?: string) => Promise<boolean>;
  signOutFirebase: () => Promise<void>;
  syncAllToFirebaseDB: () => Promise<{ success: boolean; count: number }>;
  firestoreRules: string;
  rtdbRules: string;
  firebaseProjectId: string;

  // Actions
  toggleBookmark: (id: string) => void;
  toggleCompare: (id: string) => void;
  clearCompare: () => void;
  likePost: (postId: string) => void;
  addComment: (postId: string, text: string, authorName?: string) => void;
  addPost: (post: Omit<GalleryPost, 'id' | 'likesCount' | 'likedBy' | 'commentsCount' | 'createdAt'>) => Promise<void>;
  
  // Admin CRUD
  isAdmin: boolean;
  setIsAdmin: (val: boolean) => void;
  addElephant: (elephant: Omit<Elephant, 'id'>) => Promise<void>;
  updateElephant: (id: string, data: Partial<Elephant>) => Promise<void>;
  deleteElephant: (id: string) => Promise<void>;
  toggleVerifyElephant: (id: string) => Promise<void>;
  addPerahera: (perahera: Omit<PeraheraEvent, 'id'>) => Promise<void>;
  updatePerahera: (id: string, data: Partial<PeraheraEvent>) => Promise<void>;
  deletePerahera: (id: string) => Promise<void>;
  deletePost: (id: string) => Promise<void>;
  resetToDefaults: () => void;
  exportDatabaseJSON: () => void;
  exportElephantsCSV: () => void;
  importDatabaseJSON: (jsonData: string) => boolean;
}

const RegistryContext = createContext<RegistryContextType | undefined>(undefined);

export const RegistryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Local state with seed fallback (v4 with authentic Wikimedia Commons images)
  const [elephants, setElephants] = useState<Elephant[]>(() => {
    try {
      const saved = localStorage.getItem('alimedia_elephants_v4');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      return initialElephants;
    } catch {
      return initialElephants;
    }
  });

  const [peraheras, setPeraheras] = useState<PeraheraEvent[]>(() => {
    try {
      const saved = localStorage.getItem('alimedia_peraheras_v4');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      return initialPeraheras;
    } catch {
      return initialPeraheras;
    }
  });

  const [posts, setPosts] = useState<GalleryPost[]>(() => {
    try {
      const saved = localStorage.getItem('alimedia_posts_v4');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      return initialPosts;
    } catch {
      return initialPosts;
    }
  });

  const [comments, setComments] = useState<Comment[]>(() => {
    try {
      const saved = localStorage.getItem('alimedia_comments_v4');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [bookmarks, setBookmarks] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('alimedia_bookmarks_v4');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [compareList, setCompareList] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<ViewTab>('registry');
  const [selectedElephant, setSelectedElephant] = useState<Elephant | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    return sessionStorage.getItem('alimedia_admin_auth') === 'true';
  });

  // Firebase state
  const [isFirebaseLive, setIsFirebaseLive] = useState<boolean>(false);
  const [firebaseStatus, setFirebaseStatus] = useState<'connected' | 'connecting' | 'fallback' | 'synced'>('connecting');
  const [authUser, setAuthUser] = useState<User | null>(null);

  // Auth state listener
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      if (user) {
        setIsFirebaseLive(true);
        setFirebaseStatus('connected');
      }
    });

    // Auto sign-in anonymously if not signed in to guarantee realtime connection
    signInAnonymously(auth).catch(() => {
      // Offline or restricted rules fallback
    });

    return () => unsubscribeAuth();
  }, []);

  // Real-time Firestore Listeners
  useEffect(() => {
    let hasConnected = false;

    // 1. Elephants collection listener
    const unsubElephants = onSnapshot(collection(db, 'elephants'), (snapshot) => {
      if (!snapshot.empty) {
        const remoteElephants: Elephant[] = [];
        snapshot.forEach((docSnap) => {
          remoteElephants.push(docSnap.data() as Elephant);
        });
        setElephants(remoteElephants);
        localStorage.setItem('alimedia_elephants_v4', JSON.stringify(remoteElephants));
        hasConnected = true;
        setIsFirebaseLive(true);
        setFirebaseStatus('connected');
      } else {
        // Firestore is initialized but collection is empty -> auto seed first time
        seedAllToFirestore(initialElephants, initialPeraheras, initialPosts).then(() => {
          setIsFirebaseLive(true);
          setFirebaseStatus('synced');
        }).catch(() => {
          // Rule permission or offline
          setFirebaseStatus('fallback');
        });
      }
    }, (error) => {
      console.warn('Firestore elephants listener note:', error.message);
      if (!hasConnected) setFirebaseStatus('fallback');
    });

    // 2. Peraheras collection listener
    const unsubPeraheras = onSnapshot(collection(db, 'peraheras'), (snapshot) => {
      if (!snapshot.empty) {
        const remotePeraheras: PeraheraEvent[] = [];
        snapshot.forEach((docSnap) => {
          remotePeraheras.push(docSnap.data() as PeraheraEvent);
        });
        setPeraheras(remotePeraheras);
        localStorage.setItem('alimedia_peraheras_v4', JSON.stringify(remotePeraheras));
      }
    }, (error) => {
      console.warn('Firestore peraheras listener note:', error.message);
    });

    // 3. Posts collection listener
    const unsubPosts = onSnapshot(collection(db, 'posts'), (snapshot) => {
      if (!snapshot.empty) {
        const remotePosts: GalleryPost[] = [];
        snapshot.forEach((docSnap) => {
          remotePosts.push(docSnap.data() as GalleryPost);
        });
        // Sort descending by creation date
        remotePosts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setPosts(remotePosts);
        localStorage.setItem('alimedia_posts_v4', JSON.stringify(remotePosts));
      }
    }, (error) => {
      console.warn('Firestore posts listener note:', error.message);
    });

    // 4. Comments collection listener
    const unsubComments = onSnapshot(collection(db, 'comments'), (snapshot) => {
      if (!snapshot.empty) {
        const remoteComments: Comment[] = [];
        snapshot.forEach((docSnap) => {
          remoteComments.push(docSnap.data() as Comment);
        });
        remoteComments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setComments(remoteComments);
        localStorage.setItem('alimedia_comments_v4', JSON.stringify(remoteComments));
      }
    }, (error) => {
      console.warn('Firestore comments listener note:', error.message);
    });

    return () => {
      unsubElephants();
      unsubPeraheras();
      unsubPosts();
      unsubComments();
    };
  }, []);

  // Handle URL hash changes
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace('#', '').toLowerCase();
      if (hash === 'admin') setActiveTab('admin');
      else if (hash === 'memorials' || hash === 'memorial') setActiveTab('memorials');
      else if (hash === 'perahera' || hash === 'peraheras') setActiveTab('perahera');
      else if (hash === 'gallery') setActiveTab('gallery');
      else if (hash === 'lore' || hash === 'gaja-shastra') setActiveTab('lore');
      else if (hash === 'compare') setActiveTab('compare');
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // Sync state to LocalStorage
  useEffect(() => {
    localStorage.setItem('alimedia_elephants_v4', JSON.stringify(elephants));
  }, [elephants]);

  useEffect(() => {
    localStorage.setItem('alimedia_peraheras_v4', JSON.stringify(peraheras));
  }, [peraheras]);

  useEffect(() => {
    localStorage.setItem('alimedia_posts_v4', JSON.stringify(posts));
  }, [posts]);

  useEffect(() => {
    localStorage.setItem('alimedia_comments_v4', JSON.stringify(comments));
  }, [comments]);

  useEffect(() => {
    localStorage.setItem('alimedia_bookmarks_v4', JSON.stringify(bookmarks));
  }, [bookmarks]);

  useEffect(() => {
    if (isAdmin) {
      sessionStorage.setItem('alimedia_admin_auth', 'true');
    } else {
      sessionStorage.removeItem('alimedia_admin_auth');
    }
  }, [isAdmin]);

  const toggleBookmark = (id: string) => {
    setBookmarks(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleCompare = (id: string) => {
    setCompareList(prev => {
      if (prev.includes(id)) {
        return prev.filter(item => item !== id);
      }
      if (prev.length >= 3) {
        return [prev[1], prev[2], id];
      }
      return [...prev, id];
    });
  };

  const clearCompare = () => {
    setCompareList([]);
  };

  const likePost = async (postId: string) => {
    const userMarker = authUser ? authUser.uid : 'browser_user';
    const targetPost = posts.find(p => p.id === postId);
    if (!targetPost) return;

    const isLiked = targetPost.likedBy?.includes(userMarker);
    const newLikedBy = isLiked 
      ? (targetPost.likedBy || []).filter(u => u !== userMarker)
      : [...(targetPost.likedBy || []), userMarker];
    
    const updatedPost: GalleryPost = {
      ...targetPost,
      likesCount: isLiked ? Math.max(0, targetPost.likesCount - 1) : targetPost.likesCount + 1,
      likedBy: newLikedBy
    };

    setPosts(prev => prev.map(p => p.id === postId ? updatedPost : p));

    try {
      await savePostToFirestore(updatedPost);
    } catch {
      // offline fallback
    }
  };

  const addComment = async (postId: string, text: string, authorName: string = 'Cultural Enthusiast') => {
    const newComment: Comment = {
      id: 'comment-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      postId,
      authorName,
      authorUsername: '@' + authorName.toLowerCase().replace(/\s+/g, '_'),
      text,
      createdAt: new Date().toISOString()
    };
    
    setComments(prev => [newComment, ...prev]);
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, commentsCount: (p.commentsCount || 0) + 1 } : p));

    try {
      await saveCommentToFirestore(newComment);
      const post = posts.find(p => p.id === postId);
      if (post) {
        await savePostToFirestore({
          ...post,
          commentsCount: (post.commentsCount || 0) + 1
        });
      }
    } catch {
      // offline fallback
    }
  };

  const addPost = async (postData: Omit<GalleryPost, 'id' | 'likesCount' | 'likedBy' | 'commentsCount' | 'createdAt'>) => {
    const newPost: GalleryPost = {
      ...postData,
      id: 'post-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      likesCount: 0,
      likedBy: [],
      commentsCount: 0,
      createdAt: new Date().toISOString()
    };
    
    setPosts(prev => [newPost, ...prev]);

    try {
      await savePostToFirestore(newPost);
    } catch {
      // offline fallback
    }
  };

  // Admin Actions with Firebase sync
  const addElephant = async (data: Omit<Elephant, 'id'>) => {
    const newElephant: Elephant = {
      ...data,
      id: 'elephant-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6)
    };
    setElephants(prev => [newElephant, ...prev]);

    try {
      await saveElephantToFirestore(newElephant);
    } catch {
      // offline fallback
    }
  };

  const updateElephant = async (id: string, data: Partial<Elephant>) => {
    const updated = elephants.map(el => el.id === id ? { ...el, ...data } : el);
    setElephants(updated);
    if (selectedElephant && selectedElephant.id === id) {
      setSelectedElephant({ ...selectedElephant, ...data });
    }

    const current = updated.find(el => el.id === id);
    if (current) {
      try {
        await saveElephantToFirestore(current);
      } catch {
        // offline fallback
      }
    }
  };

  const deleteElephant = async (id: string) => {
    setElephants(prev => prev.filter(el => el.id !== id));
    if (selectedElephant && selectedElephant.id === id) {
      setSelectedElephant(null);
    }

    try {
      await deleteElephantFromFirestore(id);
    } catch {
      // offline fallback
    }
  };

  const toggleVerifyElephant = async (id: string) => {
    const current = elephants.find(e => e.id === id);
    if (!current) return;
    const updated = { ...current, verified: !current.verified };
    setElephants(prev => prev.map(e => e.id === id ? updated : e));

    try {
      await saveElephantToFirestore(updated);
    } catch {
      // offline fallback
    }
  };

  const addPerahera = async (data: Omit<PeraheraEvent, 'id'>) => {
    const newPerahera: PeraheraEvent = {
      ...data,
      id: 'perahera-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6)
    };
    setPeraheras(prev => [newPerahera, ...prev]);

    try {
      await savePeraheraToFirestore(newPerahera);
    } catch {
      // offline fallback
    }
  };

  const updatePerahera = async (id: string, data: Partial<PeraheraEvent>) => {
    const updated = peraheras.map(p => p.id === id ? { ...p, ...data } : p);
    setPeraheras(updated);
    const target = updated.find(p => p.id === id);
    if (target) {
      try {
        await savePeraheraToFirestore(target);
      } catch {
        // offline fallback
      }
    }
  };

  const deletePerahera = async (id: string) => {
    setPeraheras(prev => prev.filter(p => p.id !== id));
    try {
      await deletePeraheraFromFirestore(id);
    } catch {
      // offline fallback
    }
  };

  const deletePost = async (id: string) => {
    setPosts(prev => prev.filter(p => p.id !== id));
    try {
      await deletePostFromFirestore(id);
    } catch {
      // offline fallback
    }
  };

  const resetToDefaults = () => {
    setElephants(initialElephants);
    setPeraheras(initialPeraheras);
    setPosts(initialPosts);
    setComments([]);
    setBookmarks([]);
    localStorage.removeItem('alimedia_elephants_v4');
    localStorage.removeItem('alimedia_peraheras_v4');
    localStorage.removeItem('alimedia_posts_v4');
    localStorage.removeItem('alimedia_comments_v4');
    localStorage.removeItem('alimedia_bookmarks_v4');
    localStorage.removeItem('alimedia_elephants_v3');
    localStorage.removeItem('alimedia_peraheras_v3');
    localStorage.removeItem('alimedia_posts_v3');
  };

  const exportDatabaseJSON = () => {
    const backup = {
      version: "4.0",
      firebaseProjectId: firebaseConfig.projectId,
      timestamp: new Date().toISOString(),
      elephants,
      peraheras,
      posts,
      comments
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alimedia-realtime-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportElephantsCSV = () => {
    const headers = ["ID", "Name", "Sinhala Name", "Status", "Type", "Age", "Location", "Custodian / Temple", "Mahout", "Tusks", "Verified"];
    const rows = elephants.map(e => [
      `"${e.id}"`,
      `"${(e.name || '').replace(/"/g, '""')}"`,
      `"${(e.sinhalaName || '').replace(/"/g, '""')}"`,
      `"${e.status || (e.isLive ? 'living' : 'memorial')}"`,
      `"${e.type || 'tusker'}"`,
      `"${e.age || ''}"`,
      `"${(e.location || '').replace(/"/g, '""')}"`,
      `"${(e.organization || '').replace(/"/g, '""')}"`,
      `"${(e.mahout || '').replace(/"/g, '""')}"`,
      `"${(e.tusks || '').replace(/"/g, '""')}"`,
      `"${e.verified ? 'YES' : 'NO'}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alimedia-elephants-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importDatabaseJSON = (jsonData: string): boolean => {
    try {
      const data = JSON.parse(jsonData);
      if (Array.isArray(data.elephants)) setElephants(data.elephants);
      if (Array.isArray(data.peraheras)) setPeraheras(data.peraheras);
      if (Array.isArray(data.posts)) setPosts(data.posts);
      if (Array.isArray(data.comments)) setComments(data.comments);
      return true;
    } catch {
      return false;
    }
  };

  // Firebase Auth and Sync Helpers
  const signInWithFirebase = async (email?: string, password?: string): Promise<boolean> => {
    try {
      if (email && password) {
        try {
          await signInWithEmailAndPassword(auth, email, password);
        } catch {
          // If user doesn't exist, create account
          await createUserWithEmailAndPassword(auth, email, password);
        }
      } else {
        await signInAnonymously(auth);
      }
      setIsFirebaseLive(true);
      setFirebaseStatus('connected');
      return true;
    } catch (err) {
      console.warn('Firebase sign-in error:', err);
      return false;
    }
  };

  const signOutFirebase = async () => {
    try {
      await signOut(auth);
      setAuthUser(null);
    } catch (err) {
      console.warn('Sign out error:', err);
    }
  };

  const syncAllToFirebaseDB = async (): Promise<{ success: boolean; count: number }> => {
    try {
      const count = await seedAllToFirestore(elephants, peraheras, posts);
      setIsFirebaseLive(true);
      setFirebaseStatus('synced');
      return { success: true, count };
    } catch (err) {
      console.error('Firebase batch sync failed:', err);
      return { success: false, count: 0 };
    }
  };

  return (
    <RegistryContext.Provider
      value={{
        elephants,
        peraheras,
        posts,
        comments,
        bookmarks,
        compareList,
        activeTab,
        setActiveTab,
        selectedElephant,
        setSelectedElephant,
        searchQuery,
        setSearchQuery,
        filterStatus,
        setFilterStatus,
        filterType,
        setFilterType,
        isFirebaseLive,
        firebaseStatus,
        authUser,
        signInWithFirebase,
        signOutFirebase,
        syncAllToFirebaseDB,
        firestoreRules: FIRESTORE_SECURITY_RULES,
        rtdbRules: RTDB_SECURITY_RULES,
        firebaseProjectId: firebaseConfig.projectId,
        toggleBookmark,
        toggleCompare,
        clearCompare,
        likePost,
        addComment,
        addPost,
        isAdmin,
        setIsAdmin,
        addElephant,
        updateElephant,
        deleteElephant,
        toggleVerifyElephant,
        addPerahera,
        updatePerahera,
        deletePerahera,
        deletePost,
        resetToDefaults,
        exportDatabaseJSON,
        exportElephantsCSV,
        importDatabaseJSON
      }}
    >
      {children}
    </RegistryContext.Provider>
  );
};

export const useRegistry = () => {
  const context = useContext(RegistryContext);
  if (!context) {
    throw new Error('useRegistry must be used within a RegistryProvider');
  }
  return context;
};
