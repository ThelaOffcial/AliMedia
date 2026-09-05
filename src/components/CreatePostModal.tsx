import React, { useState, useEffect } from 'react';
import { Elephant, ElephantPost, PhotoAspectRatio } from '../types/elephant';
import {
  X,
  Camera,
  Upload,
  Sparkles,
  Link as LinkIcon,
  Crown,
  Search,
  CheckCircle2,
  Lock,
  Radio,
  Image as ImageIcon,
  LogIn,
  Send,
  AlertCircle
} from 'lucide-react';
import { Language, translations, formatBilingualElephantName } from '../utils/translations';
import { useAuth } from '../firebase/authContext';
import { addElephantPost } from '../firebase/postService';
import { compressImageFile } from '../utils/imageCompressor';
import { uploadImageToCloudinary } from '../firebase/cloudinaryService';
import { resolveAuthorIdentity } from '../utils/aliMediaTeam';

/** Classify image dimensions into supported feed ratios (1:1, 3:4, 9:16, 4:3). */
function detectAspectRatio(width: number, height: number): PhotoAspectRatio {
  if (!width || !height) return '3:4';
  const r = width / height;
  // tolerance ~8%
  if (Math.abs(r - 1) < 0.08) return '1:1';
  if (Math.abs(r - 9 / 16) < 0.08) return '9:16';
  if (Math.abs(r - 3 / 4) < 0.08) return '3:4';
  if (Math.abs(r - 4 / 3) < 0.08) return '4:3';
  // portrait-leaning → 3:4 or 9:16
  if (r < 0.7) return '9:16';
  if (r < 1) return '3:4';
  return '4:3';
}

function loadImageSize(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = src;
  });
}

function aspectPreviewClass(ratio: PhotoAspectRatio): string {
  switch (ratio) {
    case '1:1':
      return 'aspect-square';
    case '9:16':
      return 'aspect-[9/16] max-h-72 mx-auto';
    case '3:4':
      return 'aspect-[3/4] max-h-80 mx-auto';
    case '4:3':
      return 'aspect-[4/3]';
    default:
      return 'aspect-[3/4] max-h-80 mx-auto';
  }
}

interface CreatePostModalProps {
  elephants: Elephant[];
  preselectedElephantId?: string;
  isStoryOnlyInitial?: boolean;
  language: Language;
  onClose: () => void;
  onPostSuccess: (newPost: ElephantPost, elephantId?: string) => void;
  onOpenAuthModal?: () => void;
}

export const CreatePostModal: React.FC<CreatePostModalProps> = ({
  elephants,
  preselectedElephantId,
  isStoryOnlyInitial = false,
  language,
  onClose,
  onPostSuccess,
  onOpenAuthModal,
}) => {
  const t = translations[language];
  const { user, profile, signInWithGoogle, isFollowing, toggleFollowElephant } = useAuth();

  const [selectedElephantId, setSelectedElephantId] = useState<string>(preselectedElephantId || '');
  const [elephantSearch, setElephantSearch] = useState<string>('');
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [photoUrlInput, setPhotoUrlInput] = useState<string>('');
  const [useUrlMode, setUseUrlMode] = useState<boolean>(false);
  const [caption, setCaption] = useState<string>('');
  const [isStoryOnly, setIsStoryOnly] = useState<boolean>(isStoryOnlyInitial);
  const [autoShareStory, setAutoShareStory] = useState<boolean>(true);
  const [aspectRatio, setAspectRatio] = useState<PhotoAspectRatio>('3:4');

  // Guest inputs if not signed in
  const [guestName, setGuestName] = useState<string>('');
  const [guestHandle, setGuestHandle] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Preselect if passed
  useEffect(() => {
    if (preselectedElephantId) {
      setSelectedElephantId(preselectedElephantId);
    }
  }, [preselectedElephantId]);

  useEffect(() => {
    if (isStoryOnlyInitial) {
      setIsStoryOnly(true);
    }
  }, [isStoryOnlyInitial]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      setErrorMsg(language === 'si' ? 'ඡායාරූපය 25MB ට වඩා අඩු විය යුතුය.' : 'Photo must be under 25MB.');
      return;
    }

    setErrorMsg(null);

    try {
      // Instant ultra-lean compression (< 80KB) with high quality — keeps original aspect
      const compressedData = await compressImageFile(file, {
        maxDimension: 1200,
        quality: 0.78,
        mimeType: 'image/jpeg',
      });

      if (compressedData) {
        setPhotoPreview(compressedData);
        const size = await loadImageSize(compressedData);
        setAspectRatio(detectAspectRatio(size.width, size.height));
      }
    } catch {
      // Fallback to FileReader
      const reader = new FileReader();
      reader.onload = async (event) => {
        const rawData = event.target?.result as string;
        if (rawData) {
          setPhotoPreview(rawData);
          const size = await loadImageSize(rawData);
          setAspectRatio(detectAspectRatio(size.width, size.height));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleApplyUrl = async () => {
    const url = photoUrlInput.trim();
    if (!url) return;
    if (!/^https:\/\//i.test(url)) {
      setErrorMsg(language === 'si' ? 'URL එක https:// වලින් ආරම්භ විය යුතුය.' : 'Image URL must start with https://');
      return;
    }
    setErrorMsg(null);
    setPhotoPreview(url);
    const size = await loadImageSize(url);
    setAspectRatio(detectAspectRatio(size.width, size.height));
  };

  const filteredElephants = elephants.filter((el) => {
    const query = elephantSearch.toLowerCase().trim();
    if (!query) return true;
    return (
      el.name.toLowerCase().includes(query) ||
      (el.sinhalaName && el.sinhalaName.toLowerCase().includes(query)) ||
      (el.location && el.location.toLowerCase().includes(query))
    );
  });

  const selectedElephantObj = elephants.find((e) => e.id === selectedElephantId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (profile?.suspended) {
      alert('Your account is suspended. You cannot publish posts.');
      return;
    }
    setErrorMsg(null);

    const imageToUse = photoPreview || photoUrlInput.trim();

    if (!imageToUse) {
      setErrorMsg(language === 'si' ? 'කරුණාකර ඡායාරූපයක් තෝරන්න.' : 'Please upload or provide a photo.');
      return;
    }

    // Elephant tagging is optional — community can post freely
    const identity = resolveAuthorIdentity({
      email: profile?.email || user?.email,
      displayName: profile?.displayName || user?.displayName,
      username: profile?.username || (guestHandle.trim() ? (guestHandle.startsWith('@') ? guestHandle.trim() : `@${guestHandle.trim()}`) : '@fan'),
      photoURL: profile?.photoURL || user?.photoURL,
      fallbackName: guestName.trim() || 'Elephant Enthusiast',
    });
    const finalAuthorName = identity.authorName;
    const finalAuthorUsername = identity.authorUsername;
    const finalAuthorPhoto = identity.authorPhotoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80';
    const authorIsAliMedia = identity.authorIsAliMedia;

    let finalPhotoUrl = imageToUse;
    if (
      typeof finalPhotoUrl === 'string' &&
      !finalPhotoUrl.startsWith('data:') &&
      !finalPhotoUrl.startsWith('blob:') &&
      !/^https:\/\//i.test(finalPhotoUrl)
    ) {
      setErrorMsg(language === 'si' ? 'ඡායාරූප URL එක https:// විය යුතුය.' : 'Photo URL must use https://');
      return;
    }

    try {
      setIsSubmitting(true);

      // Upload photo to Cloudinary first
      if (imageToUse && (imageToUse.startsWith('data:image/') || imageToUse.startsWith('blob:'))) {
        try {
          console.log('[USER_POST] Uploading user image to Cloudinary...');
          finalPhotoUrl = await uploadImageToCloudinary(imageToUse);
          if (!finalPhotoUrl || finalPhotoUrl.startsWith('data:image/') || finalPhotoUrl.startsWith('blob:')) {
            throw new Error('Cloudinary upload did not return a valid hosted URL.');
          }
          console.log('[USER_POST] Cloudinary upload successful:', finalPhotoUrl);
        } catch (cloudinaryErr: any) {
          console.error('Failed to upload to Cloudinary:', cloudinaryErr);
          setErrorMsg(
            language === 'si'
              ? `ඡායාරූපය Upload කිරීම අසාර්ථක විය: ${cloudinaryErr.message || cloudinaryErr}`
              : `Failed to upload photo to Cloudinary: ${cloudinaryErr.message || cloudinaryErr}`
          );
          setIsSubmitting(false);
          return;
        }
      }

      const defaultCaption = selectedElephantObj
        ? `${selectedElephantObj.name}${selectedElephantObj.sinhalaName ? ` (${selectedElephantObj.sinhalaName})` : ''}`
        : (language === 'si' ? 'AliMedia community post' : 'AliMedia community post');
      if (!user?.uid || user.isAnonymous) {
        setErrorMsg(language === 'si' ? 'පෝස්ට් කිරීමට පිවිසෙන්න.' : 'Sign in to create a post.');
        setIsSubmitting(false);
        return;
      }

      const postPayload: Omit<ElephantPost, 'id' | 'createdAt' | 'updatedAt'> = {
        elephantId: selectedElephantId || '',
        elephantName: selectedElephantObj?.name || '',
        elephantSinhalaName: selectedElephantObj?.sinhalaName || '',
        photoUrl: finalPhotoUrl,
        caption: caption.trim() || defaultCaption,
        authorUid: user.uid,
        authorName: finalAuthorName,
        authorUsername: finalAuthorUsername,
        authorPhotoURL: finalAuthorPhoto,
        authorIsAliMedia,
        likesCount: 0,
        likedBy: [],
        isStory: autoShareStory || isStoryOnly,
        isStoryOnly: isStoryOnly,
        aspectRatio,
      };

      console.log('[USER_POST] Writing post to Realtime Database...');
      const newPostId = await addElephantPost(postPayload);
      console.log('[USER_POST] Post document created successfully with ID:', newPostId);

      const createdPost: ElephantPost = {
        ...postPayload,
        id: newPostId,
        createdAt: new Date(),
      };

      // Ensure the elephant is followed so its story is immediately visible in the followed stories tray
      if (selectedElephantId && !isFollowing(selectedElephantId)) {
        try {
          await toggleFollowElephant(selectedElephantId);
        } catch {}
      }

      // Reset viewed timestamp for this elephant so it appears as fresh/unviewed at the front
      if (selectedElephantId) {
        try {
          const raw = localStorage.getItem('alimedia_viewed_story_timestamps');
          const map = raw ? JSON.parse(raw) : {};
          delete map[selectedElephantId];
          localStorage.setItem('alimedia_viewed_story_timestamps', JSON.stringify(map));
        } catch {}
      }

      onPostSuccess(createdPost, selectedElephantId || undefined);
    } catch (err: any) {
      console.error('Failed to publish post to Realtime Database:', err);
      setErrorMsg(
        language === 'si'
          ? `දත්ත සුරැකීම අසාර්ථක විය: ${err.message || err}`
          : `Failed to save post: ${err.message || err}`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-lg bg-white dark:bg-[#121F1B] rounded-3xl shadow-2xl border border-zinc-200 dark:border-emerald-900/60 overflow-hidden my-auto max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-[#062E22] to-emerald-900 text-white shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-500/30 flex items-center justify-center text-amber-300">
              {isStoryOnly ? <Radio className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
            </div>
            <div>
              <h2 className="font-extrabold text-sm sm:text-base leading-tight">
                {isStoryOnly
                  ? (language === 'si' ? 'අලියාට Story එකක් එක්කරන්න' : 'Add Elephant Story')
                  : (language === 'si' ? 'නව ඡායාරූපයක් හෝ Story එකක් පළ කරන්න' : 'Share Photo / Story')}
              </h2>
              <p className="text-[11px] text-emerald-200">
                {isStoryOnly
                  ? (language === 'si' ? 'ඉහළ Stories තීරුවේ දිස්වේ (පැය 24 කින් අවසන් වේ)' : 'Visible in top Stories (expires in 24h)')
                  : (language === 'si' ? 'ශ්‍රී ලාංකීය අලි ඇතුන්ගේ සුන්දර මතකයන් බෙදාගන්න' : 'Share photos & stories with the community')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center gap-2 animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. Photo Selection Box */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-zinc-800 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />
                <span>1. {language === 'si' ? 'ඡායාරූපය තෝරන්න' : 'Select Photo'} *</span>
              </label>
              <button
                type="button"
                onClick={() => setUseUrlMode(!useUrlMode)}
                className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <LinkIcon className="w-3 h-3" />
                <span>{useUrlMode ? (language === 'si' ? 'File Upload මඟින්' : 'File Upload') : (language === 'si' ? 'Web Link මඟින්' : 'Image URL')}</span>
              </button>
            </div>

            {photoPreview ? (
              <div className="space-y-2">
                <div className={`relative ${aspectPreviewClass(aspectRatio)} w-full rounded-2xl overflow-hidden bg-zinc-900 border-2 border-emerald-500 shadow-md group flex items-center justify-center`}>
                  <img src={photoPreview} alt="Preview" className="w-full h-full object-contain" />
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoPreview('');
                      setPhotoUrlInput('');
                      setAspectRatio('3:4');
                    }}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 hover:bg-black text-white cursor-pointer shadow-md transition-all active:scale-95"
                    title="Remove photo"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/70 text-white text-[10px] font-bold">
                    {aspectRatio}
                  </span>
                </div>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 px-0.5">
                  {language === 'si'
                    ? 'සහාය දක්වන අනුපාත: 1:1 · 3:4 · 9:16 — සම්පූර්ණ රූපය Feed එකේ පෙනේ.'
                    : 'Supported ratios: 1:1 · 3:4 · 9:16 — full image shows on the feed.'}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(['1:1', '3:4', '9:16'] as PhotoAspectRatio[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setAspectRatio(r)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                        aspectRatio === r
                          ? 'bg-emerald-700 text-white border-emerald-700'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            ) : useUrlMode ? (
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://example.com/elephant-photo.jpg"
                  value={photoUrlInput}
                  onChange={(e) => setPhotoUrlInput(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleApplyUrl}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  {language === 'si' ? 'යොදන්න' : 'Apply'}
                </button>
              </div>
            ) : (
              <label className="relative flex flex-col items-center justify-center aspect-[16/9] rounded-2xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-emerald-500 dark:hover:border-emerald-400 bg-zinc-50 dark:bg-zinc-900/50 cursor-pointer group transition-all">
                <div className="flex flex-col items-center justify-center p-4 text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform shadow-xs">
                    <Upload className="w-6 h-6 stroke-[2.2]" />
                  </div>
                  <div>
                    <span className="text-xs font-extrabold text-zinc-800 dark:text-zinc-200 block">
                      {language === 'si' ? 'ඡායාරූපය තෝරාගන්න (Upload)' : 'Click to Upload Photo'}
                    </span>
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block mt-0.5">
                      JPEG, PNG, WEBP (Auto-optimized)
                    </span>
                  </div>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* 2. Select Elephant Profile */}
          <div className="space-y-1.5">
            <label className="text-xs font-black text-zinc-800 dark:text-zinc-200 uppercase tracking-wider flex items-center justify-between">
              <span>2. {language === 'si' ? 'අලියා/ඇතා tag කරන්න (අනිවාර්ය නොවේ)' : 'Tag Elephant (optional)'}</span>
              {selectedElephantObj ? (
                <button
                  type="button"
                  onClick={() => setSelectedElephantId('')}
                  className="text-emerald-600 dark:text-emerald-400 text-[11px] font-bold lowercase hover:underline cursor-pointer"
                >
                  ✓ {selectedElephantObj.name} · clear
                </button>
              ) : (
                <span className="text-zinc-400 text-[10px] font-medium normal-case">
                  {language === 'si' ? 'හිස්ව තැබිය හැක' : 'Can post without tagging'}
                </span>
              )}
            </label>

            {/* Elephant Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder={language === 'si' ? 'ඇතුන්ගේ නම් සොයන්න (උදා: Raja, Millangoda)...' : 'Search elephant names...'}
                value={elephantSearch}
                onChange={(e) => setElephantSearch(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Elephant List Picker */}
            <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 no-scrollbar border border-zinc-200 dark:border-zinc-800 rounded-2xl p-1.5 bg-zinc-50/50 dark:bg-zinc-900/30">
              {filteredElephants.map((el) => {
                const isSelected = el.id === selectedElephantId;
                const bilingual = formatBilingualElephantName(
                  { name: el.name, sinhalaName: el.sinhalaName },
                  language
                );
                return (
                  <div
                    key={el.id}
                    onClick={() => setSelectedElephantId(el.id)}
                    className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-[#062E22] text-white shadow-xs'
                        : 'bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-zinc-200/60 dark:border-zinc-800'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-lg overflow-hidden bg-zinc-800 shrink-0">
                        <img
                          src={(el.photos?.find((p) => typeof p === 'string' && p.trim().length > 0)) || 'https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?auto=format&fit=crop&w=200&q=80'}
                          alt={el.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="font-extrabold text-xs truncate leading-tight">
                            {bilingual}
                          </span>
                        </div>
                        <span className={`text-[10px] truncate block ${isSelected ? 'text-emerald-200' : 'text-zinc-500'}`}>
                          {el.location || (language === 'si' ? 'ශ්‍රී ලංකාව' : 'Sri Lanka')}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {el.type === 'tusker' && (
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${isSelected ? 'bg-amber-400 text-zinc-950' : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'}`}>
                          {language === 'si' ? 'ඇතා' : 'Tusker'}
                        </span>
                      )}
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. Story vs Feed Mode Options */}
          <div className="p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/50 space-y-2">
            <div className="text-xs font-black text-[#062E22] dark:text-emerald-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>{language === 'si' ? 'Story විකල්ප' : 'Story Options'}</span>
            </div>

            <label className="flex items-start gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoShareStory}
                onChange={(e) => setAutoShareStory(e.target.checked)}
                className="mt-0.5 rounded text-emerald-700 focus:ring-emerald-500"
              />
              <div className="text-[11px]">
                <span className="font-bold text-zinc-800 dark:text-zinc-200 block">
                  {language === 'si' ? 'Stories තීරුවට ස්වයංක්‍රීයව එක්කරන්න' : 'Auto Share to Story'}
                </span>
                <span className="text-zinc-500 dark:text-zinc-400 text-[10px]">
                  {language === 'si' ? 'ඉහළින් ඇති 3s Stories Tray එකේ දිස්වේ.' : 'Displays in the top Stories row.'}
                </span>
              </div>
            </label>

            <label className="flex items-start gap-2 cursor-pointer select-none border-t border-emerald-200/50 dark:border-emerald-900/40 pt-1.5">
              <input
                type="checkbox"
                checked={isStoryOnly}
                onChange={(e) => setIsStoryOnly(e.target.checked)}
                className="mt-0.5 rounded text-emerald-700 focus:ring-emerald-500"
              />
              <div className="text-[11px]">
                <span className="font-bold text-zinc-800 dark:text-zinc-200 block">
                  {language === 'si' ? 'Story-Only ක්‍රමය (පැය 24 කින් ඉවත් වේ)' : 'Story Only Mode (Expires in 24h)'}
                </span>
                <span className="text-zinc-500 dark:text-zinc-400 text-[10px]">
                  {language === 'si' ? 'ප්‍රධාන Feed එකට නොදා Stories තීරුවේ පමණක් පැය 24ක් තබයි.' : 'Published exclusively to the Stories tray without feed placement.'}
                </span>
              </div>
            </label>
          </div>

          {/* 4. Caption */}
          <div className="space-y-1.5">
            <label className="text-xs font-black text-zinc-800 dark:text-zinc-200 uppercase tracking-wider block">
              3. {language === 'si' ? 'විස්තරය / Caption (විකල්ප)' : 'Caption / Story'}
            </label>
            <textarea
              rows={5}
              placeholder={language === 'si'
                ? 'මෙම අවස්ථාව ගැන යමක් ලියන්න...\n\nEnter ඔබා ඡේද වෙන් කරන්න.'
                : 'Write a caption or memory...\n\nPress Enter for a new paragraph.'}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-y min-h-[100px] whitespace-pre-wrap leading-relaxed"
            />
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
              {language === 'si'
                ? 'Enter ඔබා නව ඡේදයක් ආරම්භ කරන්න.'
                : 'Press Enter to start a new paragraph.'}
            </p>
          </div>

          {/* 5. Author Info */}
          {!user && (
            <div className="p-3 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                  {language === 'si' ? 'ඔබේ විස්තර (Guest Author)' : 'Author Info'}
                </span>
                <button
                  type="button"
                  onClick={signInWithGoogle}
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1 shadow-2xs hover:bg-zinc-50"
                >
                  <LogIn className="w-3 h-3" />
                  <span>{language === 'si' ? 'පිවිසෙන්න' : 'Sign in'}</span>
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder={language === 'si' ? 'ඔබේ නම (Name)' : 'Your Name'}
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 text-xs"
                />
                <input
                  type="text"
                  placeholder="@username"
                  value={guestHandle}
                  onChange={(e) => setGuestHandle(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 text-xs font-mono"
                />
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || !photoPreview}
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#062E22] via-emerald-800 to-[#062E22] hover:from-emerald-900 hover:to-emerald-800 text-white font-extrabold text-xs sm:text-sm shadow-lg hover:shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed border border-emerald-500/30"
          >
            {isSubmitting ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>{language === 'si' ? 'පළ කෙරෙමින් පවතී...' : 'Publishing...'}</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4 text-amber-300" />
                <span>
                  {isStoryOnly
                    ? (language === 'si' ? 'Story එක පළ කරන්න' : 'Publish Story')
                    : (language === 'si' ? 'ඡායාරූපය පළ කරන්න' : 'Publish Photo')}
                </span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
