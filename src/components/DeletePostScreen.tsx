import React, { useState } from 'react';
import { ArrowLeft, Trash2, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { ElephantPost } from '../types/elephant';
import { Language } from '../utils/translations';
import { useAuth } from '../firebase/authContext';
import { deleteElephantPost } from '../firebase/postService';
import { isSuperAdminPostEmail } from '../utils/aliMediaTeam';

interface DeletePostScreenProps {
  post: ElephantPost;
  language: Language;
  onBack: () => void;
  onDeleted?: (postId: string) => void;
  onShowNotification?: (msg: string) => void;
}

/**
 * Dedicated full-screen delete confirmation for a community post.
 * Not an inline feed popup — navigated to from the post options menu,
 * mirroring EditPostScreen so the destructive action gets its own page.
 */
export const DeletePostScreen: React.FC<DeletePostScreenProps> = ({
  post,
  language,
  onBack,
  onDeleted,
  onShowNotification,
}) => {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const myUid = user?.uid && !user.isAnonymous ? user.uid : '';
  const isOwner = !!(myUid && post.authorUid && myUid === post.authorUid);
  const isSuperAdmin = isSuperAdminPostEmail(user?.email);
  const canDelete = isOwner || isSuperAdmin;

  const handleDelete = async () => {
    if (!post.id) {
      setError(language === 'si' ? 'පෝස්ට් හමු නොවීය' : 'Post not found');
      return;
    }
    if (!user?.uid || user.isAnonymous) {
      setError(language === 'si' ? 'පිවිසීම අවශ්‍යයි' : 'Sign in required');
      return;
    }
    if (!canDelete) {
      setError(
        language === 'si'
          ? 'ඔබට මෙම පෝස්ට් මකා දැමීමට අවසර නැත'
          : 'You do not have permission to delete this post'
      );
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await deleteElephantPost(post.id);
      onShowNotification?.(
        language === 'si' ? 'පෝස්ට් මකා දමන ලදී' : 'Post deleted'
      );
      onDeleted?.(post.id);
      onBack();
    } catch (err: any) {
      console.error('[DeletePostScreen] delete failed', err);
      const msg =
        err?.message ||
        (language === 'si' ? 'මකා දැමීම අසාර්ථක විය' : 'Delete failed');
      setError(msg);
      onShowNotification?.(msg);
    } finally {
      setBusy(false);
    }
  };

  const photoUrl =
    post.photoUrl && post.photoUrl.trim().length > 0 ? post.photoUrl : null;

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
          <h1 className="text-lg font-extrabold text-red-600 dark:text-red-400 flex items-center gap-2">
            <Trash2 className="w-4 h-4 shrink-0" />
            {language === 'si' ? 'පෝස්ට් මකන්න' : 'Delete Post'}
          </h1>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
            {(post.elephantName && !/^unknown\s+elephant$/i.test(post.elephantName.trim())
              ? post.elephantName
              : null) ||
              post.authorName ||
              'Community post'}
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

      {post.caption && (
        <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap break-words px-1">
          {post.caption}
        </p>
      )}

      {/* Warning */}
      <div className="flex items-start gap-2 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 px-3 py-2.5 text-xs text-red-700 dark:text-red-300">
        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          {language === 'si'
            ? 'මෙම ක්‍රියාව ආපසු හැරවිය නොහැක. පෝස්ට් සහ එහි අදහස් සම්පූර්ණයෙන්ම ඉවත් වේ.'
            : 'This action cannot be undone. The post and its comments will be permanently removed.'}
        </span>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 px-3 py-2.5 text-xs text-red-700 dark:text-red-300">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {!canDelete && (
        <div className="flex items-start gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-200">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            {language === 'si'
              ? 'ඔබට මෙම පෝස්ට් මකා දැමීමට අවසර නැත.'
              : 'You do not have permission to delete this post.'}
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
          disabled={busy || !canDelete}
          onClick={handleDelete}
          className="flex-1 px-4 py-3 rounded-full text-sm font-bold bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 shadow-sm"
        >
          {busy
            ? language === 'si'
              ? 'මකමින්...'
              : 'Deleting...'
            : language === 'si'
              ? 'මකන්න'
              : 'Delete'}
        </button>
      </div>
    </div>
  );
};
