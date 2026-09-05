import React, { useState, useEffect } from 'react';
import { ArrowLeft, Pencil, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { ElephantPost } from '../types/elephant';
import { Language } from '../utils/translations';
import { useAuth } from '../firebase/authContext';
import { updateElephantPost } from '../firebase/postService';
import { isSuperAdminPostEmail } from '../utils/aliMediaTeam';

interface EditPostScreenProps {
  post: ElephantPost;
  language: Language;
  onBack: () => void;
  onSaved?: (updated: ElephantPost) => void;
  onShowNotification?: (msg: string) => void;
}

/**
 * Dedicated full-screen editor for a community post caption.
 * Not an inline feed modal — navigated to from the post options menu.
 */
export const EditPostScreen: React.FC<EditPostScreenProps> = ({
  post,
  language,
  onBack,
  onSaved,
  onShowNotification,
}) => {
  const { user } = useAuth();
  const [caption, setCaption] = useState(post.caption || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCaption(post.caption || '');
    setError(null);
  }, [post.id, post.caption]);

  const myUid = user?.uid && !user.isAnonymous ? user.uid : '';
  const isOwner = !!(myUid && post.authorUid && myUid === post.authorUid);
  const isSuperAdmin = isSuperAdminPostEmail(user?.email);
  const canEdit = isOwner || isSuperAdmin;

  const handleSave = async () => {
    if (!post.id) {
      setError(language === 'si' ? 'පෝස්ට් හමු නොවීය' : 'Post not found');
      return;
    }
    if (!user?.uid || user.isAnonymous) {
      setError(language === 'si' ? 'පිවිසීම අවශ්‍යයි' : 'Sign in required');
      return;
    }
    if (!canEdit) {
      setError(
        language === 'si'
          ? 'ඔබට මෙම පෝස්ට් සංස්කරණය කළ නොහැක'
          : 'You cannot edit this post'
      );
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await updateElephantPost(post.id, { caption });
      const updated: ElephantPost = {
        ...post,
        caption,
        updatedAt: Date.now(),
      };
      onSaved?.(updated);
      onShowNotification?.(
        language === 'si' ? 'පෝස්ට් යාවත්කාලීන විය' : 'Post updated'
      );
      onBack();
    } catch (err: any) {
      console.error('[EditPostScreen] save failed', err);
      const msg =
        err?.message ||
        (language === 'si' ? 'යාවත්කාලීන කිරීම අසාර්ථක විය' : 'Update failed');
      setError(msg);
      onShowNotification?.(msg);
    } finally {
      setBusy(false);
    }
  };

  const photoUrl =
    post.photoUrl && post.photoUrl.trim().length > 0
      ? post.photoUrl
      : null;

  return (
    <div className="min-h-[70vh] pb-24 animate-fadeIn space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={onBack}
          disabled={busy}
          className="p-2 rounded-full bg-zinc-100 dark:bg-zinc-900 text-[#062E22] dark:text-emerald-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
          title={language === 'si' ? 'ආපසු' : 'Back'}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-extrabold text-[#062E22] dark:text-white flex items-center gap-2">
            <Pencil className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
            {language === 'si' ? 'පෝස්ට් සංස්කරණය' : 'Edit Post'}
          </h1>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
            {(post.elephantName && !/^unknown\s+elephant$/i.test(post.elephantName.trim())
              ? post.elephantName
              : null) ||
              post.authorName ||
              (language === 'si' ? 'Community post' : 'Community post')}
          </p>
        </div>
      </div>

      {/* Photo preview (read-only) */}
      <div className="rounded-2xl overflow-hidden border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-zinc-900">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={post.caption || 'Post'}
            className="w-full max-h-64 object-contain bg-black/5 dark:bg-black"
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
            <ImageIcon className="w-8 h-8 mb-2 opacity-50" />
            <span className="text-xs font-medium">
              {language === 'si' ? 'ඡායාරූපයක් නැත' : 'No photo'}
            </span>
          </div>
        )}
      </div>

      {/* Caption field */}
      <div className="space-y-2">
        <label className="block text-xs font-bold uppercase tracking-wide text-[#062E22] dark:text-emerald-300">
          {language === 'si' ? 'Caption' : 'Caption'}
        </label>
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value.slice(0, 2000))}
          rows={6}
          disabled={busy || !canEdit}
          autoFocus
          className="w-full rounded-2xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-black px-4 py-3 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600 resize-y whitespace-pre-wrap leading-relaxed disabled:opacity-60"
          placeholder={language === 'si' ? 'Caption ලියන්න...' : 'Write a caption...'}
        />
        <p className="text-[10px] text-zinc-400 text-right">{caption.length}/2000</p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 px-3 py-2.5 text-xs text-red-700 dark:text-red-300">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {!canEdit && (
        <div className="flex items-start gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-200">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            {language === 'si'
              ? 'ඔබට මෙම පෝස්ට් සංස්කරණය කිරීමට අවසර නැත.'
              : 'You do not have permission to edit this post.'}
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          disabled={busy}
          onClick={onBack}
          className="flex-1 px-4 py-3 rounded-full text-sm font-bold bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
        >
          {language === 'si' ? 'අවලංගු' : 'Cancel'}
        </button>
        <button
          type="button"
          disabled={busy || !canEdit}
          onClick={handleSave}
          className="flex-1 px-4 py-3 rounded-full text-sm font-bold bg-[#062E22] text-white hover:bg-emerald-900 transition-colors disabled:opacity-50 shadow-sm"
        >
          {busy
            ? language === 'si'
              ? 'සුරකිමින්...'
              : 'Saving...'
            : language === 'si'
              ? 'සුරකින්න'
              : 'Save'}
        </button>
      </div>
    </div>
  );
};
