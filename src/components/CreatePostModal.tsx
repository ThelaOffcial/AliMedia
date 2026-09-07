import React, { useState, useEffect, useRef } from 'react';
import { Elephant, ElephantPost, PhotoAspectRatio } from '../types/elephant';
import {
  X,
  ChevronLeft,
  Upload,
  Link as LinkIcon,
  Search,
  CheckCircle2,
  Radio,
  LogIn,
  Send,
  AlertCircle,
  SmilePlus,
  Tag,
  Sparkles,
  Rows3,
  Square,
  RectangleVertical,
  ImagePlus,
} from 'lucide-react';
import { Language, translations, formatBilingualElephantName } from '../utils/translations';
import { useAuth } from '../firebase/authContext';
import { addElephantPost } from '../firebase/postService';
import { compressImageFile } from '../utils/imageCompressor';
import { uploadImageToCloudinary } from '../firebase/cloudinaryService';
import { resolveAuthorIdentity } from '../utils/aliMediaTeam';

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

const EMOJI_PALETTE = [
  '🐘', '🌿', '🌳', '🌾', '🏞️', '🌅', '🌄', '☀️', '🌧️', '🌙',
  '❤️', '🧡', '💚', '💙', '🙏', '👏', '🔥', '✨', '🎉', '📸',
  '😍', '🥰', '😊', '😄', '🤩', '😢', '🥹', '😮', '🤗', '👀',
  '🐾', '🌸', '🍃', '🛕', '🎋', '🥭', '🍌', '🚩', '💧', '🌊',
];

const RATIO_ICON: Record<PhotoAspectRatio, React.ReactNode> = {
  '1:1': <Square className="w-3.5 h-3.5" />,
  '3:4': <RectangleVertical className="w-3.5 h-3.5" />,
  '9:16': <RectangleVertical className="w-3.5 h-3.5" />,
  '4:3': <Rows3 className="w-3.5 h-3.5 rotate-90" />,
};

type Step = 'photo' | 'details';

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
}) => {
  const { user, profile, signInWithGoogle, isFollowing, toggleFollowElephant } = useAuth();

  const [step, setStep] = useState<Step>('photo');
  const [stepDirection, setStepDirection] = useState<'forward' | 'back'>('forward');

  const [selectedElephantId, setSelectedElephantId] = useState<string>(preselectedElephantId || '');
  const [elephantSearch, setElephantSearch] = useState<string>('');
  const [showElephantSheet, setShowElephantSheet] = useState<boolean>(false);
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
    if (preselectedElephantId) setSelectedElephantId(preselectedElephantId);
  }, [preselectedElephantId]);

  useEffect(() => {
    if (isStoryOnlyInitial) setIsStoryOnly(true);
  }, [isStoryOnlyInitial]);

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

  const goToDetails = () => { setStepDirection('forward'); setStep('details'); };
  const goToPhoto = () => { setStepDirection('back'); setStep('photo'); };

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
      const compressedData = await compressImageFile(file, { maxDimension: 1200, quality: 0.78, mimeType: 'image/jpeg' });
      if (compressedData) {
        setPhotoPreview(compressedData);
        const size = await loadImageSize(compressedData);
        setAspectRatio(detectAspectRatio(size.width, size.height));
        goToDetails();
      }
    } catch {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const rawData = event.target?.result as string;
        if (rawData) {
          setPhotoPreview(rawData);
          const size = await loadImageSize(rawData);
          setAspectRatio(detectAspectRatio(size.width, size.height));
          goToDetails();
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
    goToDetails();
  };

  const insertEmoji = (emoji: string) => {
    const el = captionRef.current;
    if (!el) { setCaption((c) => c + emoji); return; }
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

  const handleSubmit = async () => {
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
    if (typeof finalPhotoUrl === 'string' && !finalPhotoUrl.startsWith('data:') && !finalPhotoUrl.startsWith('blob:') && !/^https:\/\//i.test(finalPhotoUrl)) {
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
          setErrorMsg(language === 'si' ? `ඡායාරූපය Upload කිරීම අසාර්ථක විය: ${cloudinaryErr.message || cloudinaryErr}` : `Failed to upload photo to Cloudinary: ${cloudinaryErr.message || cloudinaryErr}`);
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
      const createdPost: ElephantPost = { ...postPayload, id: newPostId, createdAt: new Date() };

      if (selectedElephantId && !isFollowing(selectedElephantId)) {
        try { await toggleFollowElephant(selectedElephantId); } catch {}
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
      setErrorMsg(language === 'si' ? `දත්ත සුරැකීම අසාර්ථක විය: ${err.message || err}` : `Failed to save post: ${err.message || err}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const ratioClass = aspectRatio === '1:1' ? 'aspect-square' : aspectRatio === '9:16' ? 'aspect-[9/16]' : aspectRatio === '4:3' ? 'aspect-[4/3]' : 'aspect-[3/4]';

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center sm:p-4 overflow-hidden">
      <div className="relative w-full h-full sm:h-auto sm:max-h-[94vh] sm:max-w-md bg-white dark:bg-[#0B1512] sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col">

        {/* Top bar — shared across both steps */}
        <div className="flex items-center justify-between px-4 h-14 shrink-0 bg-white/95 dark:bg-[#0B1512]/95 backdrop-blur-md border-b border-zinc-200 dark:border-emerald-900/30 z-20">
          {step === 'details' ? (
            <button onClick={goToPhoto} className="p-1.5 -ml-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-[#1A2C27] transition-colors cursor-pointer">
              <ChevronLeft className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
            </button>
          ) : (
            <span className="w-8" />
          )}

          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full transition-colors ${step === 'photo' ? 'bg-[#062E22] dark:bg-emerald-400' : 'bg-zinc-300 dark:bg-zinc-700'}`} />
            <div className={`w-1.5 h-1.5 rounded-full transition-colors ${step === 'details' ? 'bg-[#062E22] dark:bg-emerald-400' : 'bg-zinc-300 dark:bg-zinc-700'}`} />
          </div>

          <button onClick={onClose} className="p-1.5 -mr-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-[#1A2C27] transition-colors cursor-pointer">
            <X className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
          </button>
        </div>

        {errorMsg && (
          <div className="mx-4 mt-3 p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* STEP 1 — Photo */}
        {step === 'photo' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col animate-fadeIn">
            <div className="text-center mb-4">
              <h2 className="text-base font-extrabold text-zinc-900 dark:text-white">
                {language === 'si' ? 'ඡායාරූපයක් හෝ Story එකක් එක්කරන්න' : 'Add a photo or story'}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                {language === 'si' ? 'Upload කරන්න, drag & drop කරන්න, හෝ link එකක් paste කරන්න' : 'Upload, drag & drop, or paste a link'}
              </p>
            </div>

            <div className="flex items-center justify-center mb-4">
              <div className="flex items-center bg-zinc-100 dark:bg-[#121F1B] rounded-full p-1 border border-zinc-200 dark:border-emerald-900/40">
                <button
                  onClick={() => setUseUrlMode(false)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${!useUrlMode ? 'bg-[#062E22] dark:bg-emerald-700 text-white shadow-sm' : 'text-zinc-500 dark:text-zinc-400'}`}
                >
                  <ImagePlus className="w-3.5 h-3.5" /> Upload
                </button>
                <button
                  onClick={() => setUseUrlMode(true)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${useUrlMode ? 'bg-[#062E22] dark:bg-emerald-700 text-white shadow-sm' : 'text-zinc-500 dark:text-zinc-400'}`}
                >
                  <LinkIcon className="w-3.5 h-3.5" /> Link
                </button>
              </div>
            </div>

            {useUrlMode ? (
              <div className="flex-1 flex flex-col justify-center gap-3 max-w-sm mx-auto w-full">
                <div className="w-16 h-16 rounded-2xl bg-[#062E22] dark:bg-emerald-700 text-white flex items-center justify-center mx-auto mb-1">
                  <LinkIcon className="w-7 h-7" />
                </div>
                <input
                  type="url"
                  placeholder="https://example.com/elephant-photo.jpg"
                  value={photoUrlInput}
                  onChange={(e) => setPhotoUrlInput(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-zinc-50 dark:bg-[#121F1B] border border-zinc-300 dark:border-emerald-900/40 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#062E22] dark:focus:ring-emerald-600 text-center"
                />
                <button
                  onClick={handleApplyUrl}
                  className="w-full py-3 rounded-2xl bg-[#062E22] dark:bg-emerald-700 text-white text-sm font-bold hover:opacity-90 transition-all cursor-pointer active:scale-98"
                >
                  {language === 'si' ? 'ඉදිරියට' : 'Continue'}
                </button>
              </div>
            ) : (
              <label
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`flex-1 min-h-[280px] flex flex-col items-center justify-center rounded-3xl border-2 border-dashed cursor-pointer transition-all ${
                  isDragging
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 scale-[1.01]'
                    : 'border-zinc-300 dark:border-emerald-900/40 hover:border-emerald-500 bg-zinc-50 dark:bg-[#121F1B]'
                }`}
              >
                <div className="w-16 h-16 rounded-2xl bg-[#062E22] dark:bg-emerald-700 text-white flex items-center justify-center mb-3 shadow-sm">
                  <Upload className="w-7 h-7" />
                </div>
                <span className="text-sm font-extrabold text-zinc-800 dark:text-zinc-100">
                  {isDragging
                    ? (language === 'si' ? 'මෙතැනට drop කරන්න' : 'Drop it here')
                    : (language === 'si' ? 'ඡායාරූපය තෝරන්න' : 'Tap to choose a photo')}
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  {language === 'si' ? 'හෝ drag & drop කරන්න' : 'or drag & drop it here'}
                </span>
                <span className="text-[10px] text-zinc-400 dark:text-zinc-600 mt-3">JPEG · PNG · WEBP · Max 25MB</span>
                <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              </label>
            )}
          </div>
        )}

        {/* STEP 2 — Details (image + caption + options) */}
        {step === 'details' && (
          <div className={`flex-1 overflow-y-auto ${stepDirection === 'forward' ? 'animate-slideInRight' : 'animate-slideInLeft'}`}>
            {/* Image with overlaid ratio switcher */}
            <div className={`relative w-full ${ratioClass} max-h-[38vh] bg-black overflow-hidden`}>
              <img src={photoPreview} alt="Preview" className="w-full h-full object-contain" />
              <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />

              <div className="absolute bottom-2.5 left-2.5 flex gap-1.5">
                {(['1:1', '3:4', '9:16'] as PhotoAspectRatio[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => setAspectRatio(r)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border backdrop-blur-md transition-colors cursor-pointer ${
                      aspectRatio === r ? 'bg-white text-[#062E22] border-white' : 'bg-black/40 text-white border-white/30'
                    }`}
                  >
                    {RATIO_ICON[r]} {r}
                  </button>
                ))}
              </div>

              <button
                onClick={() => { setPhotoPreview(''); setPhotoUrlInput(''); goToPhoto(); }}
                className="absolute top-2.5 right-2.5 p-1.5 rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-md transition-all active:scale-95 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Elephant tag pill overlaid on the image, Instagram-style */}
              <button
                onClick={() => setShowElephantSheet(true)}
                className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/50 hover:bg-black/70 text-white text-[10px] font-bold backdrop-blur-md transition-all cursor-pointer max-w-[65%]"
              >
                <Tag className="w-3 h-3 shrink-0" />
                <span className="truncate">
                  {selectedElephantObj
                    ? formatBilingualElephantName({ name: selectedElephantObj.name, sinhalaName: selectedElephantObj.sinhalaName }, language)
                    : (language === 'si' ? 'අලියා tag කරන්න' : 'Tag elephant')}
                </span>
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4">
              {/* Caption */}
              <div className="relative">
                <textarea
                  ref={captionRef}
                  rows={3}
                  maxLength={500}
                  placeholder={language === 'si' ? 'මෙම අවස්ථාව ගැන යමක් ලියන්න... 🐘' : 'Write a caption or memory... 🐘'}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  className="w-full px-3.5 py-2.5 pb-9 rounded-2xl bg-zinc-50 dark:bg-[#121F1B] border border-zinc-300 dark:border-emerald-900/40 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#062E22] dark:focus:ring-emerald-600 resize-none leading-relaxed"
                />
                <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker((s) => !s)}
                    className="p-1.5 rounded-full bg-white dark:bg-[#1A2C27] border border-zinc-200 dark:border-emerald-900/40 text-amber-500 hover:scale-110 transition-transform cursor-pointer shadow-2xs"
                  >
                    <SmilePlus className="w-4 h-4" />
                  </button>
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">{caption.length}/500</span>
                </div>

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

              {/* Story destination — selectable cards instead of switches */}
              <div className="space-y-2">
                <div className="text-[11px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  {language === 'si' ? 'කොහේද පළ කරන්නේ' : 'Where to publish'}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => { setIsStoryOnly(false); setAutoShareStory(true); }}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      !isStoryOnly
                        ? 'bg-[#062E22] dark:bg-emerald-700 border-transparent text-white shadow-sm'
                        : 'bg-zinc-50 dark:bg-[#121F1B] border-zinc-200 dark:border-emerald-900/40 text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    <span className="text-xs font-extrabold block">{language === 'si' ? 'Feed + Story' : 'Feed + Story'}</span>
                    <span className={`text-[10px] block mt-0.5 ${!isStoryOnly ? 'text-emerald-200' : 'text-zinc-500 dark:text-zinc-400'}`}>
                      {language === 'si' ? 'දෙකෙහිම පෙන්වයි' : 'Shows in both places'}
                    </span>
                  </button>

                  <button
                    onClick={() => { setIsStoryOnly(true); setAutoShareStory(true); }}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      isStoryOnly
                        ? 'bg-[#062E22] dark:bg-emerald-700 border-transparent text-white shadow-sm'
                        : 'bg-zinc-50 dark:bg-[#121F1B] border-zinc-200 dark:border-emerald-900/40 text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    <span className="text-xs font-extrabold flex items-center gap-1">
                      <Radio className="w-3 h-3" /> {language === 'si' ? 'Story පමණයි' : 'Story only'}
                    </span>
                    <span className={`text-[10px] block mt-0.5 ${isStoryOnly ? 'text-emerald-200' : 'text-zinc-500 dark:text-zinc-400'}`}>
                      {language === 'si' ? 'පැය 24කින් auto-delete' : 'Auto-deletes in 24h'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Guest author */}
              {!user && (
                <div className="p-3 rounded-2xl bg-zinc-100 dark:bg-[#121F1B] border border-zinc-200 dark:border-emerald-900/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                      {language === 'si' ? 'ඔබේ විස්තර' : 'Author Info'}
                    </span>
                    <button
                      onClick={signInWithGoogle}
                      className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#1A2C27] border border-zinc-300 dark:border-emerald-900/40 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1 shadow-2xs hover:bg-zinc-50 cursor-pointer"
                    >
                      <LogIn className="w-3 h-3" /> {language === 'si' ? 'පිවිසෙන්න' : 'Sign in'}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder={language === 'si' ? 'ඔබේ නම' : 'Your Name'}
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
            </div>
          </div>
        )}

        {/* Sticky bottom publish bar (only on details step) */}
        {step === 'details' && (
          <div className="p-4 border-t border-zinc-200 dark:border-emerald-900/30 bg-white dark:bg-[#0B1512] shrink-0">
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !photoPreview}
              className="w-full py-3.5 rounded-2xl bg-[#062E22] dark:bg-emerald-700 hover:opacity-90 text-white font-extrabold text-sm shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {language === 'si' ? 'පළ කෙරෙමින් පවතී...' : 'Publishing...'}
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 text-amber-300" />
                  {isStoryOnly
                    ? (language === 'si' ? 'Story එක පළ කරන්න' : 'Publish Story')
                    : (language === 'si' ? 'ඡායාරූපය පළ කරන්න' : 'Publish Photo')}
                </>
              )}
            </button>
          </div>
        )}

        {/* Elephant tag bottom sheet */}
        {showElephantSheet && (
          <div
            className="absolute inset-0 z-30 bg-black/50 backdrop-blur-sm flex items-end sm:items-center sm:justify-center animate-fadeIn"
            onClick={(e) => { if (e.target === e.currentTarget) setShowElephantSheet(false); }}
          >
            <div className="w-full sm:max-w-sm bg-white dark:bg-[#0B1512] rounded-t-3xl sm:rounded-3xl p-4 max-h-[70vh] flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-extrabold text-zinc-900 dark:text-white">
                  {language === 'si' ? 'අලියා tag කරන්න' : 'Tag an elephant'}
                </h3>
                <button onClick={() => setShowElephantSheet(false)} className="p-1 rounded-full hover:bg-zinc-100 dark:hover:bg-[#1A2C27] cursor-pointer">
                  <X className="w-4 h-4 text-zinc-500" />
                </button>
              </div>

              <div className="relative mb-2 shrink-0">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  autoFocus
                  placeholder={language === 'si' ? 'ඇතුන්ගේ නම් සොයන්න...' : 'Search elephant names...'}
                  value={elephantSearch}
                  onChange={(e) => setElephantSearch(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-[#121F1B] border border-zinc-300 dark:border-emerald-900/40 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#062E22] dark:focus:ring-emerald-600"
                />
              </div>

              {selectedElephantObj && (
                <button
                  onClick={() => { setSelectedElephantId(''); }}
                  className="mb-2 self-start text-[11px] font-bold text-red-500 hover:underline shrink-0 cursor-pointer"
                >
                  {language === 'si' ? 'Tag එක ඉවත් කරන්න' : 'Remove current tag'}
                </button>
              )}

              <div className="overflow-y-auto space-y-1.5 pr-1 no-scrollbar flex-1">
                {filteredElephants.map((el) => {
                  const isSelected = el.id === selectedElephantId;
                  const bilingual = formatBilingualElephantName({ name: el.name, sinhalaName: el.sinhalaName }, language);
                  return (
                    <div
                      key={el.id}
                      onClick={() => { setSelectedElephantId(el.id); setShowElephantSheet(false); }}
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
          </div>
        )}
      </div>
    </div>
  );
};
