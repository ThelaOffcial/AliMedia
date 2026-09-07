import React, { useState, useEffect, useRef } from 'react';
import { Elephant, ElephantPost, PhotoAspectRatio } from '../types/elephant';
import {
  X,
  Camera,
  Upload,
  Sparkles,
  Link as LinkIcon,
  Search,
  CheckCircle2,
  Radio,
  Image as ImageIcon,
  LogIn,
  Send,
  AlertCircle,
  SmilePlus,
  Tag,
  ImagePlus,
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
  if (Math.abs(r - 1) < 0.08) return '1:1';
  if (Math.abs(r - 9 / 16) < 0.08) return '9:16';
  if (Math.abs(r - 3 / 4) < 0.08) return '3:4';
  if (Math.abs(r - 4 / 3) < 0.08) return '4:3';
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
      return 'aspect-[9/16] max-h-80 mx-auto';
    case '3:4':
      return 'aspect-[3/4] max-h-80 mx-auto';
    case '4:3':
      return 'aspect-[4/3]';
    default:
      return 'aspect-[3/4] max-h-80 mx-auto';
  }
}

const EMOJI_PALETTE = [
  '🐘', '🌿', '🌳', '🌾', '🏞️', '🌅', '🌄', '☀️', '🌧️', '🌙',
  '❤️', '🧡', '💚', '💙', '🙏', '👏', '🔥', '✨', '🎉', '📸',
  '😍', '🥰', '😊', '😄', '🤩', '😢', '🥹', '😮', '🤗', '👀',
  '🐾', '🌸', '🍃', '🛕', '🎋', '🥭', '🍌', '🚩', '💧', '🌊',
];

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
  const [showElephantPicker, setShowElephantPicker] = useState<boolean>(false);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [photoUrlInput, setPhotoUrlInput] = useState<string>('');
  const [useUrlMode, setUseUrlMode] = useState<boolean>(false);
  const [caption, setCaption] = useState<string>('');
  const [isStoryOnly, setIsStoryOnly] = useState<boolean>(isStoryOnlyInitial);
  const [autoShareStory, setAutoShareStory] = useState<boolean>(true);
  const [aspectRatio, setAspectRatio] = useState<PhotoAspectRatio>('3:4');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);

  const [guestName, setGuestName] = useState<string>('');
  const [guestHandle, setGuestHandle] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const captionRef = useRef<HTMLTextAreaElement>(null);
  const emojiPopoverRef = useRef<HTMLDivElement>(null);

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

  // Close emoji popover when clicking outside it
  useEffect(() => {
    if (!showEmojiPicker) return;
    const handler = (e: MouseEvent) => {
      if (emojiPopoverRef.current && !emojiPopoverRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showEmojiPicker]);

  const processFile = async (file: File) => {
    if (file.size > 25 * 1024 * 1024) {
      setErrorMsg(language === 'si' ? 'ඡායාරූපය 25MB ට වඩා අඩු විය යුතුය.' : 'Photo must be under 25MB.');
      return;
    }
    if (!file.type.startsWith('image/')) {
      setErrorMsg(language === 'si' ? 'කරුණාකර image file එකක් තෝරන්න.' : 'Please choose an image file.');
      return;
    }

    setErrorMsg(null);

    try {
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const handleDrop = async (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await processFile(file);
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

  const insertEmoji = (emoji: string) => {
    const el = captionRef.current;
    if (!el) {
      setCaption((c) => c + emoji);
      return;
    }
    const start = el.selectionStart ?? caption.length;
    const end = el.selectionEnd ?? caption.length;
    const next = caption.slice(0, start) + emoji + caption.slice(end);
    setCaption(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + emoji.length;
      el.setSelectionRange(pos, pos);
    });
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

      if (imageToUse && (imageToUse.startsWith('data:image/') || imageToUse.startsWith('blob:'))) {
        try {
          finalPhotoUrl = await uploadImageToCloudinary(imageToUse);
          if (!finalPhotoUrl || finalPhotoUrl.startsWith('data:image/') || finalPhotoUrl.startsWith('blob:')) {
            throw new Error('Cloudinary upload did not return a valid hosted URL.');
          }
        } catch (cloudinaryErr: any) {
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

      const newPostId = await addElephantPost(postPayload);

      const createdPost: ElephantPost = {
        ...postPayload,
        id: newPostId,
        createdAt: new Date(),
      };

      if (selectedElephantId && !isFollowing(selectedElephantId)) {
        try {
          await toggleFollowElephant(selectedElephantId);
        } catch {}
      }

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
      <div className="relative w-full max-w-lg bg-white dark:bg-[#0B1512] rounded-3xl shadow-2xl border border-zinc-200 dark:border-emerald-900/40 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-[#062E22] text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-amber-300 ring-1 ring-white/10">
              {isStoryOnly ? <Radio className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
            </div>
            <div>
              <h2 className="font-extrabold text-sm sm:text-base leading-tight">
                {isStoryOnly
                  ? (language === 'si' ? 'අලියාට Story එකක් එක්කරන්න' : 'Add Elephant Story')
                  : (language === 'si' ? 'නව ඡායාරූපයක් හෝ Story එකක් පළ කරන්න' : 'Share Photo / Story')}
              </h2>
              <p className="text-[11px] text-emerald-200/80">
                {isStoryOnly
                  ? (language === 'si' ? 'ඉහළ Stories තීරුවේ දිස්වේ · පැය 24 කින් auto-delete' : 'Shows in top Stories · auto-deletes in 24h')
                  : (language === 'si' ? 'ශ්‍රී ලාංකීය අලි ඇතුන්ගේ මතකයන් බෙදාගන්න' : 'Share photos & memories with the community')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-5 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center gap-2 animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Photo Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-zinc-800 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>{language === 'si' ? 'ඡායාරූපය' : 'Photo'}</span>
              </label>

              {/* Segmented toggle: Upload / Paste Link */}
              {!photoPreview && (
                <div className="flex items-center bg-zinc-100 dark:bg-[#121F1B] rounded-full p-0.5 border border-zinc-200 dark:border-emerald-900/40">
                  <button
                    type="button"
                    onClick={() => setUseUrlMode(false)}
                    className={`px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                      !useUrlMode ? 'bg-[#062E22] dark:bg-emerald-700 text-white shadow-sm' : 'text-zinc-500 dark:text-zinc-400'
                    }`}
                  >
                    <ImagePlus className="w-3 h-3" />
                    {language === 'si' ? 'Upload' : 'Upload'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setUseUrlMode(true)}
                    className={`px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                      useUrlMode ? 'bg-[#062E22] dark:bg-emerald-700 text-white shadow-sm' : 'text-zinc-500 dark:text-zinc-400'
                    }`}
                  >
                    <LinkIcon className="w-3 h-3" />
                    {language === 'si' ? 'Link' : 'Link'}
                  </button>
                </div>
              )}
            </div>

            {photoPreview ? (
              <div className="space-y-2">
                <div className={`relative ${aspectPreviewClass(aspectRatio)} w-full rounded-2xl overflow-hidden bg-zinc-900 border-2 border-emerald-500 shadow-md group flex items-center justify-center`}>
                  <img src={photoPreview} alt="Preview" className="w-full h-full object-contain" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
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
                <div className="flex flex-wrap gap-1.5">
                  {(['1:1', '3:4', '9:16'] as PhotoAspectRatio[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setAspectRatio(r)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                        aspectRatio === r
                          ? 'bg-[#062E22] dark:bg-emerald-700 text-white border-transparent'
                          : 'bg-zinc-100 dark:bg-[#121F1B] text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-emerald-900/40'
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
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-[#121F1B] border border-zinc-300 dark:border-emerald-900/40 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#062E22] dark:focus:ring-emerald-600"
                />
                <button
                  type="button"
                  onClick={handleApplyUrl}
                  className="px-4 py-2 bg-[#062E22] dark:bg-emerald-700 hover:opacity-90 text-white rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95"
                >
                  {language === 'si' ? 'යොදන්න' : 'Apply'}
                </button>
              </div>
            ) : (
              <label
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`relative flex flex-col items-center justify-center aspect-[16/9] rounded-2xl border-2 border-dashed cursor-pointer group transition-all ${
                  isDragging
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 scale-[1.01]'
                    : 'border-zinc-300 dark:border-emerald-900/40 hover:border-emerald-500 dark:hover:border-emerald-500 bg-zinc-50 dark:bg-[#121F1B]'
                }`}
              >
                <div className="flex flex-col items-center justify-center p-4 text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-[#062E22] dark:bg-emerald-700 text-white flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
                    <Upload className="w-6 h-6 stroke-[2.2]" />
                  </div>
                  <div>
                    <span className="text-xs font-extrabold text-zinc-800 dark:text-zinc-200 block">
                      {isDragging
                        ? (language === 'si' ? 'මෙතැනට drop කරන්න' : 'Drop it here')
                        : (language === 'si' ? 'ඡායාරූපය තෝරන්න හෝ drag & drop කරන්න' : 'Click, or drag & drop a photo')}
                    </span>
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block mt-0.5">
                      JPEG, PNG, WEBP · {language === 'si' ? 'Auto-optimized' : 'Auto-optimized'}
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

          {/* Elephant Tagging — chip style */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowElephantPicker((s) => !s)}
              className="w-full flex items-center justify-between p-2.5 rounded-xl bg-zinc-50 dark:bg-[#121F1B] border border-zinc-200 dark:border-emerald-900/40 cursor-pointer transition-colors hover:bg-zinc-100 dark:hover:bg-[#1A2C27]"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Tag className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                {selectedElephantObj ? (
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-100 truncate">
                    {formatBilingualElephantName({ name: selectedElephantObj.name, sinhalaName: selectedElephantObj.sinhalaName }, language)}
                  </span>
                ) : (
                  <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    {language === 'si' ? 'අලියා tag කරන්න (අනිවාර්ය නොවේ)' : 'Tag an elephant (optional)'}
                  </span>
                )}
              </div>
              {selectedElephantObj && (
                <span
                  onClick={(e) => { e.stopPropagation(); setSelectedElephantId(''); }}
                  className="text-[10px] font-bold text-red-500 hover:underline shrink-0 cursor-pointer"
                >
                  {language === 'si' ? 'ඉවත් කරන්න' : 'remove'}
                </span>
              )}
            </button>

            {showElephantPicker && (
              <div className="space-y-2 p-2.5 rounded-2xl border border-zinc-200 dark:border-emerald-900/40 bg-white dark:bg-[#0B1512]">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    placeholder={language === 'si' ? 'ඇතුන්ගේ නම් සොයන්න...' : 'Search elephant names...'}
                    value={elephantSearch}
                    onChange={(e) => setElephantSearch(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-zinc-50 dark:bg-[#121F1B] border border-zinc-300 dark:border-emerald-900/40 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#062E22] dark:focus:ring-emerald-600"
                  />
                </div>

                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 no-scrollbar">
                  {filteredElephants.map((el) => {
                    const isSelected = el.id === selectedElephantId;
                    const bilingual = formatBilingualElephantName({ name: el.name, sinhalaName: el.sinhalaName }, language);
                    return (
                      <div
                        key={el.id}
                        onClick={() => { setSelectedElephantId(el.id); setShowElephantPicker(false); }}
                        className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-[#062E22] dark:bg-emerald-700 text-white shadow-sm'
                            : 'bg-zinc-50 dark:bg-[#121F1B] text-zinc-800 dark:text-zinc-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border border-zinc-200/60 dark:border-emerald-900/30'
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
                            <span className="font-extrabold text-xs truncate leading-tight block">{bilingual}</span>
                            <span className={`text-[10px] truncate block ${isSelected ? 'text-emerald-200' : 'text-zinc-500'}`}>
                              {el.location || (language === 'si' ? 'ශ්‍රී ලංකාව' : 'Sri Lanka')}
                            </span>
                          </div>
                        </div>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-white shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Story Options — toggle switches */}
          <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/50 space-y-3">
            <div className="text-xs font-black text-[#062E22] dark:text-emerald-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>{language === 'si' ? 'Story විකල්ප' : 'Story Options'}</span>
            </div>

            <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
              <div className="text-[11px]">
                <span className="font-bold text-zinc-800 dark:text-zinc-200 block">
                  {language === 'si' ? 'Stories තීරුවට ස්වයංක්‍රීයව එක්කරන්න' : 'Auto Share to Story'}
                </span>
                <span className="text-zinc-500 dark:text-zinc-400 text-[10px]">
                  {language === 'si' ? 'ඉහළින් ඇති Stories Tray එකේ දිස්වේ' : 'Shows in the top Stories row'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setAutoShareStory((v) => !v)}
                className={`relative shrink-0 w-10 h-6 rounded-full transition-colors cursor-pointer ${autoShareStory ? 'bg-[#062E22] dark:bg-emerald-600' : 'bg-zinc-300 dark:bg-zinc-700'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${autoShareStory ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </label>

            <label className="flex items-center justify-between gap-3 cursor-pointer select-none border-t border-emerald-200/50 dark:border-emerald-900/40 pt-3">
              <div className="text-[11px]">
                <span className="font-bold text-zinc-800 dark:text-zinc-200 block">
                  {language === 'si' ? 'Story-Only ක්‍රමය' : 'Story Only Mode'}
                </span>
                <span className="text-zinc-500 dark:text-zinc-400 text-[10px]">
                  {language === 'si' ? 'Feed එකට නොදා, පැය 24කින් auto-delete වේ' : "Skips the feed, auto-deletes after 24h"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsStoryOnly((v) => !v)}
                className={`relative shrink-0 w-10 h-6 rounded-full transition-colors cursor-pointer ${isStoryOnly ? 'bg-[#062E22] dark:bg-emerald-600' : 'bg-zinc-300 dark:bg-zinc-700'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${isStoryOnly ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </label>
          </div>

          {/* Caption + Emoji Picker */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">
                {language === 'si' ? 'විස්තරය / Caption (විකල්ප)' : 'Caption (optional)'}
              </label>
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">{caption.length}/500</span>
            </div>
            <div className="relative">
              <textarea
                ref={captionRef}
                rows={4}
                maxLength={500}
                placeholder={language === 'si'
                  ? 'මෙම අවස්ථාව ගැන යමක් ලියන්න... 🐘'
                  : 'Write a caption or memory... 🐘'}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="w-full px-3.5 py-2.5 pb-9 rounded-xl bg-zinc-50 dark:bg-[#121F1B] border border-zinc-300 dark:border-emerald-900/40 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#062E22] dark:focus:ring-emerald-600 resize-y min-h-[100px] whitespace-pre-wrap leading-relaxed"
              />
              <button
                type="button"
                onClick={() => setShowEmojiPicker((s) => !s)}
                className="absolute bottom-2.5 left-2.5 p-1.5 rounded-full bg-white dark:bg-[#1A2C27] border border-zinc-200 dark:border-emerald-900/40 text-amber-500 hover:scale-110 transition-transform cursor-pointer shadow-2xs"
                title="Add emoji"
              >
                <SmilePlus className="w-4 h-4" />
              </button>

              {showEmojiPicker && (
                <div
                  ref={emojiPopoverRef}
                  className="absolute bottom-11 left-2.5 z-10 w-64 max-h-40 overflow-y-auto p-2 rounded-xl bg-white dark:bg-[#121F1B] border border-zinc-200 dark:border-emerald-900/40 shadow-xl grid grid-cols-8 gap-1"
                >
                  {EMOJI_PALETTE.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => insertEmoji(emoji)}
                      className="text-lg leading-none p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-[#1A2C27] transition-colors cursor-pointer"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Guest Author Info */}
          {!user && (
            <div className="p-3 rounded-2xl bg-zinc-100 dark:bg-[#121F1B] border border-zinc-200 dark:border-emerald-900/40 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                  {language === 'si' ? 'ඔබේ විස්තර (Guest Author)' : 'Author Info'}
                </span>
                <button
                  type="button"
                  onClick={signInWithGoogle}
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#1A2C27] border border-zinc-300 dark:border-emerald-900/40 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1 shadow-2xs hover:bg-zinc-50 cursor-pointer"
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
                  className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-[#0B1512] border border-zinc-300 dark:border-emerald-900/40 text-xs"
                />
                <input
                  type="text"
                  placeholder="@username"
                  value={guestHandle}
                  onChange={(e) => setGuestHandle(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-[#0B1512] border border-zinc-300 dark:border-emerald-900/40 text-xs font-mono"
                />
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || !photoPreview}
            className="w-full py-3.5 px-4 rounded-2xl bg-[#062E22] dark:bg-emerald-700 hover:opacity-90 text-white font-extrabold text-xs sm:text-sm shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed"
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
