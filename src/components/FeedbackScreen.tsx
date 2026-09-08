import React, { useEffect, useState } from 'react';
import { X, MessageSquarePlus, Heart, Lightbulb, AlertTriangle, Send, Loader2, User as UserIcon } from 'lucide-react';
import { Language } from '../utils/translations';
import { useAuth } from '../firebase/authContext';
import {
  PlatformFeedback,
  FeedbackType,
  subscribeToPlatformFeedback,
  addPlatformFeedback,
  toggleLikeFeedback,
} from '../firebase/feedbackService';
import { formatRelativeTime } from '../firebase/postService';

interface FeedbackScreenProps {
  language: Language;
  onClose: () => void;
}

const STR = {
  title: { en: 'Feedback & Suggestions', si: 'අදහස් සහ යෝජනා' },
  subtitle: {
    en: 'Tell us what you love, what\u2019s broken, or what you\u2019d like to see next.',
    si: 'ඔබට කැමති දේ, දෝෂ, හෝ ඉදිරියට ඕන දේ අපිට කියන්න.',
  },
  empty: { en: 'No feedback yet — be the first to share an idea.', si: 'තවම අදහස් නැත — පළමු අදහස බෙදාගන්න.' },
  newButton: { en: 'Share feedback', si: 'අදහසක් දාන්න' },
  suggestion: { en: 'Suggestion', si: 'යෝජනාව' },
  complaint: { en: 'Complaint', si: 'පැමිණිල්ල' },
  all: { en: 'All', si: 'සියල්ල' },
  composerTitle: { en: 'Share your feedback', si: 'ඔබේ අදහස බෙදාගන්න' },
  placeholder: {
    en: 'What\u2019s on your mind about AliMedia?',
    si: 'AliMedia ගැන ඔබේ අදහස කුමක්ද?',
  },
  guestName: { en: 'Your name (optional)', si: 'ඔබේ නම (විකල්ප)' },
  post: { en: 'Post feedback', si: 'පළ කරන්න' },
  posting: { en: 'Posting...', si: 'පළ කෙරෙමින්...' },
} as const;

export const FeedbackScreen: React.FC<FeedbackScreenProps> = ({ language, onClose }) => {
  const { user, profile } = useAuth();
  const t = (key: keyof typeof STR) => STR[key][language];

  const [items, setItems] = useState<PlatformFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | FeedbackType>('all');
  const [showComposer, setShowComposer] = useState(false);

  const [composerType, setComposerType] = useState<FeedbackType>('suggestion');
  const [message, setMessage] = useState('');
  const [guestName, setGuestName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToPlatformFeedback((data) => {
      setItems(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const filteredItems = filter === 'all' ? items : items.filter((i) => i.type === filter);

  const handleLike = async (id: string) => {
    if (!user?.uid) return;
    try {
      await toggleLikeFeedback(id, user.uid);
    } catch {}
  };

  const handleSubmit = async () => {
    setError(null);
    const trimmed = message.trim();
    if (!trimmed) {
      setError(language === 'si' ? 'කරුණාකර පණිවිඩයක් ලියන්න.' : 'Please write a message.');
      return;
    }
    if (!user?.uid) {
      setError(language === 'si' ? 'මොහොතක් රැඳී සිටින්න, පසුව උත්සාහ කරන්න.' : 'Still connecting — please try again in a moment.');
      return;
    }

    const authorName =
      profile?.displayName ||
      user?.displayName ||
      guestName.trim() ||
      (language === 'si' ? 'නිර්නාමික' : 'Anonymous');

    try {
      setSubmitting(true);
      await addPlatformFeedback({
        type: composerType,
        message: trimmed,
        authorUid: user.uid,
        authorName,
        authorUsername: profile?.username,
        authorPhotoURL: profile?.photoURL || user?.photoURL || undefined,
      });
      setMessage('');
      setGuestName('');
      setShowComposer(false);
    } catch (err: any) {
      setError(err.message || (language === 'si' ? 'යැවීම අසාර්ථක විය.' : 'Failed to submit.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-14 shrink-0 bg-white/95 dark:bg-black/95 backdrop-blur-md border-b border-zinc-200 dark:border-emerald-900/30">
        <button onClick={onClose} className="p-1.5 -ml-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-[#1A2C27] transition-colors cursor-pointer">
          <X className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
        </button>
        <h1 className="text-sm font-extrabold text-zinc-900 dark:text-white">{t('title')}</h1>
        <span className="w-8" />
      </div>

      <div className="px-4 pt-3 pb-2 shrink-0">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('subtitle')}</p>
      </div>

      {/* Filter pills */}
      <div className="px-4 pb-2 flex items-center gap-1.5 shrink-0">
        {(['all', 'suggestion', 'complaint'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all cursor-pointer ${
              filter === f
                ? 'bg-[#062E22] dark:bg-emerald-700 text-white border-transparent'
                : 'bg-zinc-50 dark:bg-[#121F1B] text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-emerald-900/40'
            }`}
          >
            {f === 'all' ? t('all') : f === 'suggestion' ? t('suggestion') : t('complaint')}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-2.5">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 animate-spin" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-14">
            <MessageSquarePlus className="w-8 h-8 text-zinc-300 dark:text-zinc-700 mx-auto mb-2" />
            <p className="text-xs text-zinc-400 dark:text-zinc-600">{t('empty')}</p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const isLiked = !!(user?.uid && item.likedBy.includes(user.uid));
            return (
              <div
                key={item.id}
                className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-[#121F1B] border border-zinc-200 dark:border-emerald-900/40"
              >
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-zinc-200 dark:bg-[#1A2C27] shrink-0 flex items-center justify-center">
                    {item.authorPhotoURL ? (
                      <img src={item.authorPhotoURL} alt={item.authorName} className="w-full h-full object-cover" />
                    ) : (
                      <UserIcon className="w-4 h-4 text-zinc-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-extrabold text-zinc-900 dark:text-white truncate">
                        {item.authorName}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                          item.type === 'suggestion'
                            ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                            : 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400'
                        }`}
                      >
                        {item.type === 'suggestion' ? <Lightbulb className="w-2.5 h-2.5" /> : <AlertTriangle className="w-2.5 h-2.5" />}
                        {item.type === 'suggestion' ? t('suggestion') : t('complaint')}
                      </span>
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-600">
                        {formatRelativeTime(item.createdAt, language)}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-700 dark:text-zinc-300 mt-1 leading-relaxed whitespace-pre-wrap break-words">
                      {item.message}
                    </p>
                    <button
                      onClick={() => handleLike(item.id)}
                      disabled={!user?.uid}
                      className={`mt-2 flex items-center gap-1 text-[11px] font-bold transition-colors cursor-pointer disabled:cursor-not-allowed ${
                        isLiked ? 'text-red-500' : 'text-zinc-400 dark:text-zinc-500 hover:text-red-400'
                      }`}
                    >
                      <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-red-500' : ''}`} />
                      {item.likesCount > 0 ? item.likesCount : ''}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Floating add button */}
      {!showComposer && (
        <button
          onClick={() => setShowComposer(true)}
          className="absolute bottom-5 right-5 flex items-center gap-2 px-4 py-3 rounded-full bg-[#062E22] dark:bg-emerald-700 text-white text-xs font-extrabold shadow-lg hover:opacity-90 transition-all cursor-pointer active:scale-95"
        >
          <MessageSquarePlus className="w-4 h-4" />
          {t('newButton')}
        </button>
      )}

      {/* Composer bottom sheet */}
      {showComposer && (
        <div
          className="absolute inset-0 z-10 bg-black/50 backdrop-blur-sm flex items-end sm:items-center sm:justify-center animate-fadeIn"
          onClick={(e) => { if (e.target === e.currentTarget) setShowComposer(false); }}
        >
          <div className="w-full sm:max-w-sm bg-white dark:bg-[#0B1512] rounded-t-3xl sm:rounded-3xl p-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-extrabold text-zinc-900 dark:text-white">{t('composerTitle')}</h3>
              <button onClick={() => setShowComposer(false)} className="p-1 rounded-full hover:bg-zinc-100 dark:hover:bg-[#1A2C27] cursor-pointer">
                <X className="w-4 h-4 text-zinc-500" />
              </button>
            </div>

            <div className="flex items-center gap-2 mb-3">
              <button
                onClick={() => setComposerType('suggestion')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  composerType === 'suggestion'
                    ? 'bg-emerald-600 text-white border-transparent'
                    : 'bg-zinc-50 dark:bg-[#121F1B] text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-emerald-900/40'
                }`}
              >
                <Lightbulb className="w-3.5 h-3.5" /> {t('suggestion')}
              </button>
              <button
                onClick={() => setComposerType('complaint')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  composerType === 'complaint'
                    ? 'bg-amber-600 text-white border-transparent'
                    : 'bg-zinc-50 dark:bg-[#121F1B] text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-emerald-900/40'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" /> {t('complaint')}
              </button>
            </div>

            <textarea
              rows={4}
              maxLength={2000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t('placeholder')}
              autoFocus
              className="w-full px-3.5 py-2.5 rounded-2xl bg-zinc-50 dark:bg-[#121F1B] border border-zinc-300 dark:border-emerald-900/40 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#062E22] dark:focus:ring-emerald-600 resize-none leading-relaxed"
            />

            {!user?.displayName && !profile?.displayName && (
              <input
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder={t('guestName')}
                className="w-full mt-2 px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-[#121F1B] border border-zinc-300 dark:border-emerald-900/40 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#062E22] dark:focus:ring-emerald-600"
              />
            )}

            {error && <p className="text-xs text-red-500 mt-2">{error}</p>}

            <button
              onClick={handleSubmit}
              disabled={submitting || !message.trim()}
              className="w-full mt-3 py-3 rounded-2xl bg-[#062E22] dark:bg-emerald-700 text-white text-sm font-extrabold flex items-center justify-center gap-2 hover:opacity-90 transition-all cursor-pointer active:scale-98 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> {t('posting')}
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 text-amber-300" /> {t('post')}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
