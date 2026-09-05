import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useRegistry } from '../context/RegistryContext';
import { Elephant, PeraheraEvent, ElephantType, ElephantStatus, ElephantGender } from '../types';
import { uploadImageToCloudinary, CLOUDINARY_CONFIG } from '../services/cloudinary';
import { 
  ShieldCheck, 
  Plus, 
  Trash2, 
  Edit, 
  Download, 
  Upload, 
  RotateCcw, 
  Search, 
  Check, 
  X, 
  Lock, 
  FileSpreadsheet, 
  Database,
  Calendar,
  Image as ImageIcon,
  Sparkles,
  CloudLightning,
  Copy,
  Radio,
  Loader2,
  AlertCircle,
  Key,
  Layers,
  Flame,
  CheckCircle2
} from 'lucide-react';

export const AdminPortal: React.FC = () => {
  const { lang, t } = useLanguage();
  const { 
    elephants, 
    peraheras, 
    posts, 
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
    importDatabaseJSON,
    isFirebaseLive,
    firebaseStatus,
    syncAllToFirebaseDB,
    firestoreRules,
    rtdbRules,
    firebaseProjectId,
    authUser,
    signInWithFirebase,
    signOutFirebase
  } = useRegistry();

  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [adminTab, setAdminTab] = useState<'elephants' | 'peraheras' | 'gallery' | 'rules' | 'backup'>('elephants');
  const [searchTableQuery, setSearchTableQuery] = useState('');
  const [copiedType, setCopiedType] = useState<'firestore' | 'rtdb' | null>(null);
  const [isSyncingLive, setIsSyncingLive] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Email/Password login state
  const [emailInput, setEmailInput] = useState('admin@alimedia.lk');
  const [passwordInput, setPasswordInput] = useState('Admin@1234');
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // Modal / Form state for Add/Edit Elephant
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingElephantId, setEditingElephantId] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoUploadProgress, setPhotoUploadProgress] = useState(0);

  // Elephant Form Fields
  const [formData, setFormData] = useState({
    name: '',
    sinhalaName: '',
    otherNames: '',
    type: 'tusker' as ElephantType,
    gender: 'male' as ElephantGender,
    status: 'living' as ElephantStatus,
    age: '',
    dateOfBirth: '',
    location: '',
    organization: '',
    mahout: '',
    tusks: '',
    physicalCharacteristics: '',
    description: '',
    photos: ['https://upload.wikimedia.org/wikipedia/commons/4/4e/Nadungamuwa_Raja.jpg'],
    peraheraParticipation: '',
    sourceTitle: 'Department of Wildlife Conservation Registry',
    sourcePublisher: 'Sri Lanka Elephant Archive',
    sourceVerifiedDate: '2026',
    customBadge: '',
    verified: true
  });

  // Perahera Form State
  const [isPeraheraFormOpen, setIsPeraheraFormOpen] = useState(false);
  const [editingPeraheraId, setEditingPeraheraId] = useState<string | null>(null);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [bannerUploadProgress, setBannerUploadProgress] = useState(0);
  const [peraheraFormData, setPeraheraFormData] = useState({
    title: '',
    sinhalaTitle: '',
    description: '',
    location: '',
    date: '',
    temple: '',
    sacredRelicBearer: '',
    participatingElephants: '',
    bannerImage: 'https://upload.wikimedia.org/wikipedia/commons/9/90/KandyPerahara.jpg'
  });

  // Handle PIN Login
  const handlePinLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput.trim() === '1234' || pinInput.trim().toLowerCase() === 'admin') {
      setIsAdmin(true);
      setPinError(false);
      setPinInput('');
      signInWithFirebase().catch(() => {});
    } else {
      setPinError(true);
    }
  };

  const handleFirebaseAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthLoading(true);
    const success = await signInWithFirebase(emailInput, passwordInput);
    setIsAuthLoading(false);
    if (success) {
      setIsAdmin(true);
    }
  };

  const handleCopyRules = (type: 'firestore' | 'rtdb') => {
    const text = type === 'firestore' ? firestoreRules : rtdbRules;
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2500);
  };

  const handleSyncFirebase = async () => {
    setIsSyncingLive(true);
    setSyncFeedback(null);
    const res = await syncAllToFirebaseDB();
    setIsSyncingLive(false);
    if (res.success) {
      setSyncFeedback(`සාර්ථකයි! ලේඛන ${res.count} ක් Firebase Realtime Database (${firebaseProjectId}) වෙත සජීවීව සුරැකිණි.`);
    } else {
      setSyncFeedback('සමමුහුර්තකරණයේ දෝෂයක්. කරුණාකර ඔබගේ Firestore Rules පරීක්ෂා කරන්න.');
    }
  };

  const handleElephantPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingPhoto(true);
    setPhotoUploadProgress(10);
    try {
      const url = await uploadImageToCloudinary(file, (p) => setPhotoUploadProgress(p));
      setFormData(prev => ({
        ...prev,
        photos: [url, ...prev.photos.filter(p => p !== url)]
      }));
      setIsUploadingPhoto(false);
    } catch (err: unknown) {
      setIsUploadingPhoto(false);
      alert('Cloudinary upload error: ' + ((err as Error)?.message || 'Failed'));
    }
  };

  const handlePeraheraBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingBanner(true);
    setBannerUploadProgress(10);
    try {
      const url = await uploadImageToCloudinary(file, (p) => setBannerUploadProgress(p));
      setPeraheraFormData(prev => ({ ...prev, bannerImage: url }));
      setIsUploadingBanner(false);
    } catch (err: unknown) {
      setIsUploadingBanner(false);
      alert('Cloudinary upload error: ' + ((err as Error)?.message || 'Failed'));
    }
  };

  const openAddElephantModal = () => {
    setEditingElephantId(null);
    setFormData({
      name: '',
      sinhalaName: '',
      otherNames: '',
      type: 'tusker',
      gender: 'male',
      status: 'living',
      age: '',
      dateOfBirth: '',
      location: 'Kandy (මහනුවර)',
      organization: 'Sri Dalada Maligawa (ශ්‍රී දළදා මාළිගාව)',
      mahout: '',
      tusks: 'Symmetrical Ivory Tusks (සමබර දළ යුගල)',
      physicalCharacteristics: 'Tall stature, noble gait, calm demeanor.',
      description: 'Revered tusker participating in sacred Buddhist processions across Sri Lanka.',
      photos: ['https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?auto=format&fit=crop&w=1200&q=80'],
      peraheraParticipation: 'Kandy Esala Perahera',
      sourceTitle: 'Official Custodian Registry',
      sourcePublisher: 'Sri Lankan Elephant Archive',
      sourceVerifiedDate: '2026',
      customBadge: '',
      verified: true
    });
    setIsFormOpen(true);
  };

  const openEditElephantModal = (el: Elephant) => {
    setEditingElephantId(el.id);
    setFormData({
      name: el.name,
      sinhalaName: el.sinhalaName || '',
      otherNames: el.otherNames?.join(', ') || '',
      type: el.type,
      gender: el.gender,
      status: el.status,
      age: el.age ? String(el.age) : '',
      dateOfBirth: el.dateOfBirth || '',
      location: el.location || '',
      organization: el.organization || '',
      mahout: el.mahout || '',
      tusks: el.tusks || '',
      physicalCharacteristics: el.physicalCharacteristics || '',
      description: el.description || '',
      photos: el.photos?.length ? el.photos : ['https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?auto=format&fit=crop&w=1200&q=80'],
      peraheraParticipation: el.peraheraParticipation?.join(', ') || '',
      sourceTitle: el.sources?.[0]?.title || 'Official Registry',
      sourcePublisher: el.sources?.[0]?.publisher || 'Department of Wildlife',
      sourceVerifiedDate: el.sources?.[0]?.verifiedDate || '2026',
      customBadge: el.customBadge || '',
      verified: el.verified
    });
    setIsFormOpen(true);
  };

  const handleSaveElephant = async (e: React.FormEvent) => {
    e.preventDefault();
    const otherNamesArr = formData.otherNames.split(',').map(s => s.trim()).filter(Boolean);
    const peraheraArr = formData.peraheraParticipation.split(',').map(s => s.trim()).filter(Boolean);
    const photosArr = formData.photos.map(p => p.trim()).filter(Boolean);

    const elephantPayload: Omit<Elephant, 'id'> = {
      name: formData.name.trim(),
      sinhalaName: formData.sinhalaName.trim(),
      otherNames: otherNamesArr,
      type: formData.type,
      gender: formData.gender,
      status: formData.status,
      isLive: formData.status === 'living',
      age: formData.age ? parseInt(formData.age) || formData.age : '',
      dateOfBirth: formData.dateOfBirth,
      location: formData.location,
      organization: formData.organization,
      mahout: formData.mahout,
      tusks: formData.tusks,
      physicalCharacteristics: formData.physicalCharacteristics,
      description: formData.description,
      photos: photosArr.length ? photosArr : ['https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?auto=format&fit=crop&w=1200&q=80'],
      peraheraParticipation: peraheraArr,
      sources: [
        {
          title: formData.sourceTitle,
          publisher: formData.sourcePublisher,
          verifiedDate: formData.sourceVerifiedDate
        }
      ],
      verified: formData.verified,
      customBadge: formData.customBadge
    };

    if (editingElephantId) {
      await updateElephant(editingElephantId, elephantPayload);
    } else {
      await addElephant(elephantPayload);
    }

    setIsFormOpen(false);
  };

  const openAddPeraheraModal = () => {
    setEditingPeraheraId(null);
    setPeraheraFormData({
      title: '',
      sinhalaTitle: '',
      description: '',
      location: '',
      date: '',
      temple: '',
      sacredRelicBearer: '',
      participatingElephants: '',
      bannerImage: 'https://images.unsplash.com/photo-1549366021-9f761d450615?auto=format&fit=crop&w=1200&q=80'
    });
    setIsPeraheraFormOpen(true);
  };

  const openEditPeraheraModal = (p: PeraheraEvent) => {
    setEditingPeraheraId(p.id);
    setPeraheraFormData({
      title: p.title,
      sinhalaTitle: p.sinhalaTitle,
      description: p.description,
      location: p.location,
      date: p.date,
      temple: p.temple || '',
      sacredRelicBearer: p.sacredRelicBearer || '',
      participatingElephants: p.participatingElephants.join(', '),
      bannerImage: p.bannerImage || 'https://images.unsplash.com/photo-1549366021-9f761d450615?auto=format&fit=crop&w=1200&q=80'
    });
    setIsPeraheraFormOpen(true);
  };

  const handleSavePerahera = async (e: React.FormEvent) => {
    e.preventDefault();
    const participating = peraheraFormData.participatingElephants.split(',').map(s => s.trim()).filter(Boolean);
    const payload: Omit<PeraheraEvent, 'id'> = {
      title: peraheraFormData.title,
      sinhalaTitle: peraheraFormData.sinhalaTitle,
      description: peraheraFormData.description,
      location: peraheraFormData.location,
      date: peraheraFormData.date,
      temple: peraheraFormData.temple,
      sacredRelicBearer: peraheraFormData.sacredRelicBearer,
      participatingElephants: participating,
      bannerImage: peraheraFormData.bannerImage,
      type: 'perahera',
      isActive: true
    };

    if (editingPeraheraId) {
      await updatePerahera(editingPeraheraId, payload);
    } else {
      await addPerahera(payload);
    }
    setIsPeraheraFormOpen(false);
  };

  const handleFileRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const success = importDatabaseJSON(content);
        if (success) {
          alert("Database successfully restored from JSON backup!");
        } else {
          alert("Invalid backup file format. Please upload a valid AliMedia JSON file.");
        }
      }
    };
    reader.readAsText(file);
  };

  // If Not Authenticated, show Login PIN & Firebase Auth view
  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
          
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 border border-amber-300 text-amber-800 flex items-center justify-center mx-auto text-2xl shadow-xs">
              <Lock className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 font-display">
              {t('adminLoginTitle')}
            </h2>
            <p className="text-xs text-slate-600 font-medium">
              Firebase Project: <code className="text-amber-800 font-mono font-bold">{firebaseProjectId}</code>
            </p>
          </div>

          {/* Quick PIN Form */}
          <form onSubmit={handlePinLogin} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Master Security PIN
              </label>
              <input
                type="password"
                value={pinInput}
                onChange={e => {
                  setPinInput(e.target.value);
                  setPinError(false);
                }}
                placeholder={t('pinPlaceholder')}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-center text-slate-900 text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-amber-500 font-bold"
                autoFocus
              />
              {pinError && (
                <div className="text-rose-600 text-xs mt-2 text-center font-bold">
                  වලංගු නොවන රහස්‍ය අංකයකි. Master PIN (1234) ඇතුළත් කරන්න.
                </div>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-amber-600 text-white font-bold text-xs hover:bg-amber-700 transition-colors cursor-pointer shadow-xs uppercase tracking-wider"
            >
              {t('loginBtn')} (PIN 1234)
            </button>
          </form>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
            <button
              onClick={() => {
                setIsAdmin(true);
                signInWithFirebase().catch(() => {});
              }}
              className="text-amber-800 hover:text-amber-900 font-bold underline cursor-pointer"
            >
              ක්ෂණික පිවිසුම (1-Click Demo Login)
            </button>
            <span className="text-slate-400 font-mono text-[11px]">v3.0 Realtime</span>
          </div>

        </div>
      </div>
    );
  }

  const filteredElephants = elephants.filter(e => {
    if (!searchTableQuery) return true;
    const q = searchTableQuery.toLowerCase();
    return (
      e.name.toLowerCase().includes(q) ||
      e.sinhalaName?.toLowerCase().includes(q) ||
      e.organization?.toLowerCase().includes(q) ||
      e.location?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      
      {/* Admin Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-950 text-xs font-bold uppercase shadow-2xs">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
              <span>පරිපාලන පාලක මැදිරිය • Admin Portal</span>
            </div>

            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-mono font-bold">
              <Radio className="w-3 h-3 text-emerald-600 animate-pulse" />
              <span>Firebase: {firebaseProjectId}</span>
            </div>

            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-300 text-blue-800 text-xs font-mono font-bold">
              <Sparkles className="w-3 h-3 text-blue-600" />
              <span>Cloudinary: {CLOUDINARY_CONFIG.cloudName}</span>
            </div>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-display">
            {t('adminTitle')}
          </h2>
          <p className="text-xs text-slate-600 mt-0.5 font-medium">
            සජීවී Firebase Realtime Database සහ Cloudinary Storage මගින් බලගැන්වෙන නිල පාලක මැදිරිය.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={openAddElephantModal}
            className="px-4 py-2 bg-amber-600 text-white font-bold text-xs rounded-xl hover:bg-amber-700 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>{t('addNewElephant')}</span>
          </button>

          <button
            onClick={() => {
              setIsAdmin(false);
              signOutFirebase().catch(() => {});
            }}
            className="px-3.5 py-2 bg-white border border-slate-300 text-slate-700 hover:text-slate-900 text-xs font-bold rounded-xl hover:bg-slate-100 transition-colors shadow-xs cursor-pointer"
          >
            {t('logoutBtn')}
          </button>
        </div>
      </div>

      {/* Subnav Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 overflow-x-auto">
        <button
          onClick={() => setAdminTab('elephants')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
            adminTab === 'elephants'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
          }`}
        >
          🐘 {t('manageElephants')} ({elephants.length})
        </button>

        <button
          onClick={() => setAdminTab('peraheras')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
            adminTab === 'peraheras'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
          }`}
        >
          👑 {t('managePeraheras')} ({peraheras.length})
        </button>

        <button
          onClick={() => setAdminTab('gallery')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
            adminTab === 'gallery'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
          }`}
        >
          📸 {t('manageGallery')} ({posts.length})
        </button>

        <button
          onClick={() => setAdminTab('rules')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
            adminTab === 'rules'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
          }`}
        >
          <CloudLightning className="w-3.5 h-3.5" />
          <span>Firebase DB Rules & Sync</span>
        </button>

        <button
          onClick={() => setAdminTab('backup')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
            adminTab === 'backup'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
          }`}
        >
          💾 දත්ත සුරැකුම් (Backup)
        </button>
      </div>

      {/* TAB: Firebase DB Rules & Realtime Status */}
      {adminTab === 'rules' && (
        <div className="space-y-6">
          
          {/* Sync Trigger Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 font-display flex items-center gap-2">
                  <Radio className="w-5 h-5 text-emerald-600" />
                  <span>Realtime Database Synchronizer (Firebase: {firebaseProjectId})</span>
                </h3>
                <p className="text-xs text-slate-600 mt-1 font-medium">
                  සියලු දත්ත (Elephants, Peraheras, Gallery Posts) ඔබගේ Firebase Realtime / Firestore ව්‍යාපෘතියට සජීවීව සමමුහුර්ත කරන්න.
                </p>
              </div>

              <button
                onClick={handleSyncFirebase}
                disabled={isSyncingLive}
                className="px-5 py-2.5 bg-emerald-600 text-white font-bold text-xs rounded-xl hover:bg-emerald-700 transition-colors flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isSyncingLive ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudLightning className="w-4 h-4" />}
                <span>Sync All to Firebase DB</span>
              </button>
            </div>

            {syncFeedback && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{syncFeedback}</span>
              </div>
            )}
          </div>

          {/* Cloud Firestore Security Rules Box */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  1. Cloud Firestore Security Rules List
                </h4>
                <p className="text-[11px] text-slate-500">
                  Firebase Console &gt; Firestore Database &gt; Rules තුළට paste කරන්න.
                </p>
              </div>
              <button
                onClick={() => handleCopyRules('firestore')}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                {copiedType === 'firestore' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedType === 'firestore' ? 'Copied!' : 'Copy Rules'}</span>
              </button>
            </div>

            <pre className="p-4 rounded-xl bg-slate-900 text-emerald-400 font-mono text-xs overflow-x-auto leading-relaxed border border-slate-800 select-all">
              {firestoreRules}
            </pre>
          </div>

          {/* Firebase Realtime Database Rules Box */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  2. Firebase Realtime Database (RTDB) Rules List
                </h4>
                <p className="text-[11px] text-slate-500">
                  Firebase Console &gt; Realtime Database &gt; Rules තුළට paste කරන්න.
                </p>
              </div>
              <button
                onClick={() => handleCopyRules('rtdb')}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                {copiedType === 'rtdb' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedType === 'rtdb' ? 'Copied!' : 'Copy Rules'}</span>
              </button>
            </div>

            <pre className="p-4 rounded-xl bg-slate-900 text-amber-300 font-mono text-xs overflow-x-auto leading-relaxed border border-slate-800 select-all">
              {rtdbRules}
            </pre>
          </div>

          {/* Cloudinary Info Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-xs text-slate-700 space-y-2">
            <h4 className="font-bold text-slate-900">Cloudinary Image Storage Configuration:</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-[11px]">
              <div><strong>Cloud Name:</strong> {CLOUDINARY_CONFIG.cloudName}</div>
              <div><strong>Unsigned Preset:</strong> {CLOUDINARY_CONFIG.uploadPreset}</div>
              <div className="sm:col-span-2"><strong>API Endpoint:</strong> {CLOUDINARY_CONFIG.uploadUrl}</div>
            </div>
          </div>

        </div>
      )}

      {/* TAB 1: Manage Elephants */}
      {adminTab === 'elephants' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative max-w-sm w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchTableQuery}
                onChange={e => setSearchTableQuery(e.target.value)}
                placeholder="ලේඛනාගාර සටහන් සොයන්න..."
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium"
              />
            </div>
            <span className="text-xs text-slate-600 font-bold">
              වාර්තා {filteredElephants.length} / {elephants.length}
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-700 uppercase tracking-wider font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3.5">Elephant Name</th>
                    <th className="p-3.5">සිංහල නම</th>
                    <th className="p-3.5">තත්ත්වය</th>
                    <th className="p-3.5">භාරකාරත්වය</th>
                    <th className="p-3.5">තහවුරු කිරීම</th>
                    <th className="p-3.5 text-right">ක්‍රියාකාරකම්</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredElephants.map(elephant => (
                    <tr key={elephant.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3.5 font-bold text-slate-900 flex items-center gap-2">
                        <img 
                          src={elephant.photos?.[0] || 'https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?auto=format&fit=crop&w=100&q=80'} 
                          alt="" 
                          className="w-8 h-8 rounded-lg object-cover border border-slate-200"
                        />
                        <span>{elephant.name}</span>
                      </td>
                      <td className="p-3.5 font-sinhala text-amber-800 font-bold">
                        {elephant.sinhalaName || '-'}
                      </td>
                      <td className="p-3.5">
                        {elephant.status === 'memorial' || !elephant.isLive ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-950 border border-purple-300">
                            දිවංගත (MEMORIAL)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-950 border border-emerald-300">
                            ජීවමාන (LIVING)
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-slate-700 max-w-[180px] truncate font-medium">
                        {elephant.organization || 'පුද්ගලික'}
                      </td>
                      <td className="p-3.5">
                        <button
                          onClick={() => toggleVerifyElephant(elephant.id)}
                          className={`px-2.5 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                            elephant.verified
                              ? 'bg-blue-100 text-blue-950 border border-blue-300'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {elephant.verified ? '✓ තහවුරු කළ' : 'නොකළ'}
                        </button>
                      </td>
                      <td className="p-3.5 text-right space-x-1.5">
                        <button
                          onClick={() => openEditElephantModal(elephant)}
                          className="p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:text-amber-800 hover:bg-amber-100 transition-colors cursor-pointer border border-slate-200"
                          title="Edit"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`${elephant.name} ඇතාගේ දත්ත මකා දැමීමට අවශ්‍යද?`)) {
                              deleteElephant(elephant.id);
                            }
                          }}
                          className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer border border-slate-200"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Manage Peraheras */}
      {adminTab === 'peraheras' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-600 font-bold">පූජනීය පෙරහැර මංගල්‍යයන්: {peraheras.length}</span>
            <button
              onClick={openAddPeraheraModal}
              className="px-4 py-2 bg-amber-600 text-white font-bold text-xs rounded-xl hover:bg-amber-700 flex items-center gap-1 cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>නව පෙරහැරක් එක් කරන්න</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {peraheras.map(p => (
              <div key={p.id} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-xs hover:border-amber-400 transition-all">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{p.title}</h4>
                    <div className="text-xs font-sinhala text-amber-800 font-bold">{p.sinhalaTitle}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditPeraheraModal(p)}
                      className="p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:text-amber-800 hover:bg-amber-100 border border-slate-200 cursor-pointer"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete pageant ${p.title}?`)) deletePerahera(p.id);
                      }}
                      className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:text-rose-700 hover:bg-rose-100 border border-slate-200 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="text-xs text-slate-600 space-y-1 font-medium">
                  <div><strong className="text-slate-900">විහාරස්ථානය:</strong> {p.temple || p.location}</div>
                  <div><strong className="text-slate-900">කාලය:</strong> {p.date}</div>
                  <div><strong className="text-slate-900">ධාතු කරඬු වාහක:</strong> {p.sacredRelicBearer || 'සටහන් නැත'}</div>
                  <div><strong className="text-slate-900">සහභාගීවන ඇතුන්:</strong> {p.participatingElephants.join(', ')}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: Moderate Gallery */}
      {adminTab === 'gallery' && (
        <div className="space-y-4">
          <div className="text-xs text-slate-600 font-bold">ප්‍රජා ඡායාරූප එකතුව: {posts.length}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {posts.map(post => (
              <div key={post.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs hover:border-amber-400 transition-all">
                <img src={post.photoUrl} alt="" className="w-full aspect-[4/3] object-cover" />
                <div className="p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-900 truncate">
                      {post.elephantName && !/^unknown\s+elephant$/i.test(String(post.elephantName).trim())
                        ? post.elephantName
                        : post.authorName || 'Community'}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">{post.authorName}</span>
                  </div>
                  <p className="text-[11px] text-slate-600 line-clamp-2">{post.caption}</p>
                  <div className="pt-2 border-t border-slate-100 flex justify-end">
                    <button
                      onClick={() => {
                        if (confirm('මෙම ඡායාරූපය මකා දැමීමට අවශ්‍යද?')) deletePost(post.id);
                      }}
                      className="px-2.5 py-1 rounded-md bg-rose-100 text-rose-900 text-[10px] font-bold border border-rose-300 hover:bg-rose-200 cursor-pointer"
                    >
                      මකා දමන්න (Delete)
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: Backup & Restore */}
      {adminTab === 'backup' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-300 text-amber-800 flex items-center justify-center shadow-xs">
              <Database className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">{t('exportBackup')}</h3>
            <p className="text-xs text-slate-600 font-medium">
              සියලුම ඇතුන් ({elephants.length}), පෙරහැරවල් සහ ඡායාරූප JSON ගොනුවක් ලෙස බාගත කරන්න.
            </p>
            <button
              onClick={exportDatabaseJSON}
              className="w-full py-2.5 bg-amber-600 text-white font-bold text-xs rounded-xl hover:bg-amber-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Download className="w-4 h-4" />
              <span>JSON Backup බාගත කරන්න</span>
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-800 flex items-center justify-center shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">{t('exportCSV')}</h3>
            <p className="text-xs text-slate-600 font-medium">
              ලේඛනාගාර විස්තර Excel / Spreadsheet (CSV) ලෙස බාගත කරන්න.
            </p>
            <button
              onClick={exportElephantsCSV}
              className="w-full py-2.5 bg-emerald-600 text-white font-bold text-xs rounded-xl hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Download className="w-4 h-4" />
              <span>CSV Sheet බාගත කරන්න</span>
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-blue-100 border border-blue-300 text-blue-800 flex items-center justify-center shadow-xs">
              <Upload className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">{t('restoreData')}</h3>
            <p className="text-xs text-slate-600 font-medium">
              පෙර සුරැකි AliMedia JSON ගොනුවක් මගින් දත්ත යළි ප්‍රතිස්ථාපනය කරන්න.
            </p>
            <label className="w-full py-2.5 bg-blue-600 text-white font-bold text-xs rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs">
              <Upload className="w-4 h-4" />
              <span>Backup JSON ගොනුව තෝරන්න</span>
              <input type="file" accept=".json" onChange={handleFileRestore} className="hidden" />
            </label>
          </div>

          <div className="md:col-span-3 bg-slate-50 border border-slate-200 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h4 className="text-xs font-bold text-slate-800 uppercase">මූලික දත්ත යළි පිහිටුවීම (Factory Reset)</h4>
              <p className="text-xs text-slate-500 mt-0.5">ලේඛනාගාරය ආරම්භක ප්‍රමුඛ ඇතුන්ගේ තොරතුරු වලට යළි පිහිටුවන්න.</p>
            </div>
            <button
              onClick={() => {
                if (confirm('සියලු දත්ත ආරම්භක මූලික තත්ත්වයට පත් කිරීමට අවශ්‍යද?')) {
                  resetToDefaults();
                  alert('සාර්ථකව නැවත පිහිටුවන ලදී!');
                }
              }}
              className="px-4 py-2 rounded-xl bg-white text-slate-700 hover:text-rose-700 border border-slate-300 hover:border-rose-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Factory Defaults</span>
            </button>
          </div>
        </div>
      )}

      {/* MODAL: Add / Edit Elephant with Cloudinary uploader */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-white border border-slate-300 rounded-2xl p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-lg font-bold text-slate-900 font-display">
                {editingElephantId ? 'ඇත් වාර්තාව සංස්කරණය' : t('addNewElephant')}
              </h3>
              <button onClick={() => setIsFormOpen(false)} className="p-1 text-slate-400 hover:text-slate-900 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveElephant} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">නම (English) *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">නම (සිංහල) *</label>
                  <input
                    type="text"
                    required
                    value={formData.sinhalaName}
                    onChange={e => setFormData({ ...formData, sinhalaName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-sinhala font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">තත්ත්වය (Status)</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value as ElephantStatus })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-medium"
                  >
                    <option value="living">Living (ජීවත්වන)</option>
                    <option value="memorial">Memorial (අභාවප්‍රාප්ත / ජාතික උරුමය)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">වර්ගීකරණය (Type)</label>
                  <select
                    value={formData.type}
                    onChange={e => setFormData({ ...formData, type: e.target.value as ElephantType })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-medium"
                  >
                    <option value="tusker">Tusker (දළ ඇතා)</option>
                    <option value="elephant">Elephant (අලියා / ඇතින්න)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">වයස / උපන් වර්ෂය</label>
                  <input
                    type="text"
                    value={formData.age}
                    onChange={e => setFormData({ ...formData, age: e.target.value })}
                    placeholder="උදා: 45 හෝ 1980"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">විශේෂ ගෞරව නාමය (Custom Badge)</label>
                  <input
                    type="text"
                    value={formData.customBadge}
                    onChange={e => setFormData({ ...formData, customBadge: e.target.value })}
                    placeholder="උදා: ජාතික වස්තුවක්"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">භාරකාර විහාරස්ථානය / හිමිකරු</label>
                  <input
                    type="text"
                    value={formData.organization}
                    onChange={e => setFormData({ ...formData, organization: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">ප්‍රදේශය / දිස්ත්‍රික්කය</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={e => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-medium"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-700 font-bold mb-1">ඇත්ගොව්වා (Mahout)</label>
                  <input
                    type="text"
                    value={formData.mahout}
                    onChange={e => setFormData({ ...formData, mahout: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-medium"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-700 font-bold mb-1">දළ ලක්ෂණ (Tusks)</label>
                  <input
                    type="text"
                    value={formData.tusks}
                    onChange={e => setFormData({ ...formData, tusks: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-medium"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-700 font-bold mb-1">ඓතිහාසික පසුබිම සහ විස්තරය</label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-medium"
                  />
                </div>

                {/* Cloudinary Image Upload */}
                <div className="sm:col-span-2 space-y-2">
                  <label className="block text-slate-700 font-bold">
                    ඡායාරූපය (Cloudinary Direct Upload)
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="px-3.5 py-2 bg-slate-100 border border-slate-300 text-slate-800 rounded-xl hover:bg-slate-200 cursor-pointer font-bold flex items-center gap-2">
                      {isUploadingPhoto ? <Loader2 className="w-4 h-4 animate-spin text-amber-600" /> : <Upload className="w-4 h-4 text-amber-600" />}
                      <span>{isUploadingPhoto ? `Uploading (${photoUploadProgress}%)...` : 'Upload to Cloudinary'}</span>
                      <input type="file" accept="image/*" onChange={handleElephantPhotoUpload} disabled={isUploadingPhoto} className="hidden" />
                    </label>
                    <span className="text-[11px] text-slate-500">
                      Cloud: <strong className="text-slate-800">{CLOUDINARY_CONFIG.cloudName}</strong> &bull; Preset: <strong className="text-slate-800">{CLOUDINARY_CONFIG.uploadPreset}</strong>
                    </span>
                  </div>

                  <input
                    type="text"
                    value={formData.photos[0] || ''}
                    onChange={e => setFormData({ ...formData, photos: [e.target.value] })}
                    placeholder="https://..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono text-[11px]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-700 font-bold mb-1">පෙරහැර සහභාගීත්වය (කොමා මගින් වෙන් කරන්න)</label>
                  <input
                    type="text"
                    value={formData.peraheraParticipation}
                    onChange={e => setFormData({ ...formData, peraheraParticipation: e.target.value })}
                    placeholder="මහනුවර ඇසළ පෙරහැර, කැළණි පෙරහැර"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-medium"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 cursor-pointer font-bold"
                >
                  අවලංගු කරන්න
                </button>
                <button
                  type="submit"
                  disabled={isUploadingPhoto}
                  className="px-5 py-2 bg-amber-600 text-white font-bold rounded-xl hover:bg-amber-700 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  තොරතුරු සුරකින්න
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Add / Edit Perahera */}
      {isPeraheraFormOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg bg-white border border-slate-300 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingPeraheraId ? 'පෙරහැර විස්තර සංස්කරණය' : 'නව පෙරහැරක් ඇතුළත් කිරීම'}
              </h3>
              <button onClick={() => setIsPeraheraFormOpen(false)} className="p-1 text-slate-400 hover:text-slate-900 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePerahera} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">නම (English) *</label>
                <input
                  type="text"
                  required
                  value={peraheraFormData.title}
                  onChange={e => setPeraheraFormData({ ...peraheraFormData, title: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">නම (සිංහල)</label>
                <input
                  type="text"
                  value={peraheraFormData.sinhalaTitle}
                  onChange={e => setPeraheraFormData({ ...peraheraFormData, sinhalaTitle: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-sinhala font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">දිනය / කාල සීමාව</label>
                <input
                  type="text"
                  value={peraheraFormData.date}
                  onChange={e => setPeraheraFormData({ ...peraheraFormData, date: e.target.value })}
                  placeholder="උදා: අගෝස්තු (ඇසළ පුර පසළොස්වක)"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">ධාතු කරඬු වාහක ඇත් රජුන්</label>
                <input
                  type="text"
                  value={peraheraFormData.sacredRelicBearer}
                  onChange={e => setPeraheraFormData({ ...peraheraFormData, sacredRelicBearer: e.target.value })}
                  placeholder="උදා: ඉන්දි රාජා"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">සහභාගීවන ඇතුන් (කොමා මගින් වෙන් කරන්න)</label>
                <input
                  type="text"
                  value={peraheraFormData.participatingElephants}
                  onChange={e => setPeraheraFormData({ ...peraheraFormData, participatingElephants: e.target.value })}
                  placeholder="Indiraja, Sinha Raja, Vasana"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-medium"
                />
              </div>

              {/* Cloudinary Banner */}
              <div className="space-y-1">
                <label className="block text-slate-700 font-bold">බැනර් ඡායාරූපය (Cloudinary)</label>
                <div className="flex items-center gap-2">
                  <label className="px-3 py-1.5 bg-slate-100 border border-slate-300 text-slate-800 rounded-lg hover:bg-slate-200 cursor-pointer font-bold flex items-center gap-1.5">
                    {isUploadingBanner ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    <span>Upload</span>
                    <input type="file" accept="image/*" onChange={handlePeraheraBannerUpload} disabled={isUploadingBanner} className="hidden" />
                  </label>
                  <input
                    type="text"
                    value={peraheraFormData.bannerImage}
                    onChange={e => setPeraheraFormData({ ...peraheraFormData, bannerImage: e.target.value })}
                    className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono text-[11px]"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPeraheraFormOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 font-bold cursor-pointer"
                >
                  අවලංගු කරන්න
                </button>
                <button
                  type="submit"
                  disabled={isUploadingBanner}
                  className="px-5 py-2 bg-amber-600 text-white font-bold rounded-xl hover:bg-amber-700 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  පෙරහැර සුරකින්න
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
