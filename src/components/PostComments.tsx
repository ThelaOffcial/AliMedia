import React, { useEffect, useState, useRef, useCallback, useMemo, useLayoutEffect } from 'react';
import { MessageCircle, Send, Loader2, AlertTriangle, CornerDownRight, Flag } from 'lucide-react';
import { useAuth } from '../firebase/authContext';
import {
  addPostComment,
  subscribeToRecentPostComments,
  fetchOlderPostComments,
  deleteComment,
  updateComment,
  reportComment,
  type PostComment,
  type ReportReason,
} from '../firebase/commentService';
import {
  searchUsernames,
  blockUser,
  getBlockedUsers,
  type UsernameIndexEntry,
} from '../firebase/userService';
import type { Language } from '../utils/translations';
import { VerifiedBadge } from './VerifiedBadge';
import { ALI_MEDIA_LOGO_URL } from '../utils/aliMediaTeam';

interface Props {
  postId: string;
  language: Language;
  onNotify?: (msg: string) => void;
  /** When true, forces the comment thread open (e.g. arriving from a notification) */
  forceOpen?: boolean;
  /** Comment id to scroll to and highlight once loaded (e.g. a reply from a notification) */
  highlightCommentId?: string;
  /** Called once the highlighted comment has been scrolled to / handled */
  onFocusHandled?: () => void;
  /** True when the signed-in user is an admin/super-admin — can delete any comment */
  isAdmin?: boolean;
}

/** Render comment body with @handles highlighted */
function CommentBody({ text }: { text: string }) {
  const parts = text.split(/(@[a-zA-Z0-9._]{2,32})/g);
  return (
    <span className="text-xs text-zinc-700 dark:text-zinc-300 leading-snug whitespace-pre-wrap break-words">
      {parts.map((p, i) =>
        p.startsWith('@') ? (
          <span key={i} className="font-bold text-emerald-700 dark:text-emerald-400">
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </span>
  );
}

function AuthorLabel({ c }: { c: PostComment }) {
  const isTeam = !!c.authorIsAliMedia || /ali\s*media/i.test(c.authorName || '');
  return (
    <span className="text-[11px] font-bold text-[#062E22] dark:text-emerald-200 inline-flex items-center gap-1 min-w-0">
      <span className="truncate">{isTeam ? 'Ali Media' : c.authorName}</span>
      {isTeam && <VerifiedBadge size={18} />}
      {!isTeam && c.authorUsername ? (
        <span className="font-medium text-zinc-400 truncate">{c.authorUsername}</span>
      ) : null}
    </span>
  );
}

function Avatar({ c, size = 28 }: { c: PostComment; size?: number }) {
  const isTeam = !!c.authorIsAliMedia || /ali\s*media/i.test(c.authorName || '');
  const src = isTeam ? ALI_MEDIA_LOGO_URL : c.authorPhotoURL;
  return (
    <div
      className="rounded-full overflow-hidden bg-zinc-200 dark:bg-zinc-800 shrink-0"
      style={{ width: size, height: size }}
    >
      {src ? (
        <img
          src={src}
          alt=""
          className={`w-full h-full object-cover ${isTeam ? 'team-logo-theme-aware' : ''}`}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-zinc-500">
          {(c.authorName || '?')[0]}
        </div>
      )}
    </div>
  );
}

const REPORT_REASONS: { key: ReportReason; en: string; si: string }[] = [
  { key: 'harassment', en: 'Harassment', si: 'හිරිහැරකිරීම' },
  { key: 'spam', en: 'Spam', si: 'කම්පල' },
  { key: 'wrong_id', en: 'Wrong elephant', si: 'වැරදි අලිය' },
  { key: 'off_topic', en: 'Off-topic', si: 'අදාළ නැත' },
  { key: 'other', en: 'Other', si: 'වෙනත්' },
];

/** Live comments (real-time listener). Older history loads on demand as a one-shot page. */
const LIVE_TAIL_SIZE = 20;
const OLDER_PAGE_SIZE = 20;
/** How many replies show by default under a comment before "View N more replies" appears */
const REPLY_PREVIEW_COUNT = 2;

export const PostComments: React.FC<Props> = ({
  postId,
  language,
  onNotify,
  forceOpen,
  highlightCommentId,
  onFocusHandled,
  isAdmin,
}) => {
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [liveComments, setLiveComments] = useState<PostComment[]>([]);
  const [olderComments, setOlderComments] = useState<PostComment[]>([]);
  const [hasMoreOlder, setHasMoreOlder] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [suggestions, setSuggestions] = useState<UsernameIndexEntry[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<PostComment | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [savingEditId, setSavingEditId] = useState<string | null>(null);
  const [expandedRoots, setExpandedRoots] = useState<Set<string>>(new Set());
  // Report & block state
  const [blockedUids, setBlockedUids] = useState<Set<string>>(new Set());
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [submittingReportId, setSubmittingReportId] = useState<string | null>(null);
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());
  const [blockConfirmId, setBlockConfirmId] = useState<string | null>(null);
  const [blockingId, setBlockingId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const commentRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const scrollAdjustRef = useRef<{ height: number; top: number } | null>(null);

  const isSignedIn = !!(profile && user && !user.isAnonymous);

  // Merge the live tail with any older pages loaded on scroll, deduping by id
  // (the live window can briefly overlap a just-loaded older page).
  // Also filter out comments from users the viewer has blocked.
  const comments = useMemo(() => {
    const map = new Map<string, PostComment>();
    for (const c of olderComments) map.set(c.id, c);
    for (const c of liveComments) map.set(c.id, c);
    return Array.from(map.values())
      .filter((c) => !blockedUids.has(c.authorUid))
      .sort((a, b) => a.createdAt - b.createdAt);
  }, [olderComments, liveComments, blockedUids]);

  // Load the current user's block list once when the panel opens.
  useEffect(() => {
    if (!open || !isSignedIn || !user?.uid) return;
    getBlockedUsers(user.uid)
      .then((uids) => setBlockedUids(new Set(uids)))
      .catch(() => {});
  }, [open, isSignedIn, user?.uid]);

  useEffect(() => {
    if (!open || !postId) return;
    setOlderComments([]);
    setHasMoreOlder(true);
    return subscribeToRecentPostComments(postId, LIVE_TAIL_SIZE, (list) => {
      setLiveComments(list);
      // Fewer than the live-tail size means that IS the whole thread — no need
      // to ever hit the network for an older page on a short comment thread.
      if (list.length < LIVE_TAIL_SIZE) setHasMoreOlder(false);
    });
  }, [open, postId]);

  const handleLoadOlder = useCallback(async () => {
    if (loadingOlder || !hasMoreOlder || !postId) return;
    const oldest = comments[0];
    if (!oldest) return;
    setLoadingOlder(true);
    if (listRef.current) {
      scrollAdjustRef.current = {
        height: listRef.current.scrollHeight,
        top: listRef.current.scrollTop,
      };
    }
    try {
      const { comments: older, hasMore } = await fetchOlderPostComments(
        postId,
        oldest.createdAt,
        oldest.id,
        OLDER_PAGE_SIZE
      );
      setOlderComments((prev) => {
        const map = new Map<string, PostComment>();
        for (const c of prev) map.set(c.id, c);
        for (const c of older) map.set(c.id, c);
        return Array.from(map.values());
      });
      setHasMoreOlder(hasMore);
    } catch (e) {
      console.warn('Load older comments failed:', e);
      scrollAdjustRef.current = null;
    } finally {
      setLoadingOlder(false);
    }
  }, [loadingOlder, hasMoreOlder, postId, comments]);

  // Prepending older comments shifts everything below them down — restore the
  // scroll position the user was at instead of letting the view jump.
  useLayoutEffect(() => {
    const adjust = scrollAdjustRef.current;
    if (adjust && listRef.current) {
      const newHeight = listRef.current.scrollHeight;
      listRef.current.scrollTop = adjust.top + (newHeight - adjust.height);
      scrollAdjustRef.current = null;
    }
  }, [olderComments]);

  const handleListScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    if (el.scrollTop < 60 && hasMoreOlder && !loadingOlder) {
      handleLoadOlder();
    }
  }, [hasMoreOlder, loadingOlder, handleLoadOlder]);

  // Arriving from a notification: force the thread open
  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);

  // Auto-scroll to the newest message — keyed on the live tail only, so it
  // doesn't fight with the scroll-position-preservation above when older
  // comments load in.
  useEffect(() => {
    if (open && listRef.current && !highlightCommentId) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [liveComments, open, highlightCommentId]);

  // Scroll to & highlight the target comment (e.g. the reply a notification points to).
  // If it's older than what's currently loaded, keep paging back until we find it
  // (or run out of history). If it's tucked under a collapsed "N more replies"
  // group, expand every ancestor along its parent chain first, then scroll once
  // it's actually mounted (one extra render pass after expanding).
  const handledHighlightRef = useRef<string | null>(null);
  useEffect(() => {
    if (!open || !highlightCommentId) return;
    if (handledHighlightRef.current === highlightCommentId) return;
    const target = comments.find((c) => c.id === highlightCommentId);
    if (!target) {
      if (hasMoreOlder && !loadingOlder) handleLoadOlder();
      return;
    }
    if (target.parentId) {
      const byId = new Map<string, PostComment>(comments.map((c) => [c.id, c] as [string, PostComment]));
      const toExpand: string[] = [];
      let cur: PostComment | undefined = target;
      while (cur?.parentId) {
        toExpand.push(cur.parentId);
        cur = byId.get(cur.parentId);
      }
      const needsExpand = toExpand.some((id) => !expandedRoots.has(id));
      if (needsExpand) {
        setExpandedRoots((prev) => {
          const next = new Set(prev);
          toExpand.forEach((id) => next.add(id));
          return next;
        });
        return; // wait for the re-render that mounts the now-expanded reply
      }
    }
    const el = commentRefs.current[highlightCommentId];
    if (!el) return; // not mounted yet
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedId(highlightCommentId);
    handledHighlightRef.current = highlightCommentId;
    onFocusHandled?.();
    const timer = setTimeout(() => setHighlightedId(null), 2500);
    return () => clearTimeout(timer);
  }, [open, comments, highlightCommentId, hasMoreOlder, loadingOlder, expandedRoots, onFocusHandled]);

  /** Top-level comments + map of replies. Replies whose parent was deleted
   *  (parent node removed, but the reply itself is still a separate DB entry)
   *  are promoted to top-level so they never silently disappear. */
  const { roots, repliesByParent } = useMemo(() => {
    const roots: PostComment[] = [];
    const repliesByParent: Record<string, PostComment[]> = {};
    const sorted = [...comments].sort((a, b) => a.createdAt - b.createdAt);
    const idSet = new Set(sorted.map((c) => c.id));
    for (const c of sorted) {
      if (c.parentId && idSet.has(c.parentId)) {
        if (!repliesByParent[c.parentId]) repliesByParent[c.parentId] = [];
        repliesByParent[c.parentId].push(c);
      } else {
        roots.push(c);
      }
    }
    return { roots, repliesByParent };
  }, [comments]);

  const updateMentionSuggestions = useCallback(async (value: string, caret: number) => {
    const before = value.slice(0, caret);
    const m = before.match(/@([a-zA-Z0-9._]{0,32})$/);
    if (!m) {
      setMentionQuery(null);
      setSuggestions([]);
      return;
    }
    const q = m[1];
    setMentionQuery(q);
    if (q.length < 1) {
      setSuggestions([]);
      return;
    }
    const found = await searchUsernames(q, 6);
    setSuggestions(found);
  }, []);

  const insertMention = (entry: UsernameIndexEntry) => {
    const el = inputRef.current;
    const value = text;
    const caret = el?.selectionStart ?? value.length;
    const before = value.slice(0, caret);
    const after = value.slice(caret);
    const replaced = before.replace(/@([a-zA-Z0-9._]{0,32})$/, `@${entry.handle} `);
    const next = (replaced + after).slice(0, 500);
    setText(next);
    setSuggestions([]);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const pos = replaced.length;
        inputRef.current.setSelectionRange(pos, pos);
      }
    });
  };

  const startReply = (c: PostComment) => {
    setReplyTo(c);
    // Pre-fill @mention of the person being replied to
    const handle = (c.authorUsername || '').replace(/^@/, '') || '';
    if (handle && !c.authorIsAliMedia) {
      setText(`@${handle} `);
    } else if (c.authorIsAliMedia) {
      setText('@alimedia ');
    } else {
      setText('');
    }
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const cancelReply = () => {
    setReplyTo(null);
  };

  const handleReport = async (c: PostComment, reason: ReportReason) => {
    if (!user?.uid) return;
    setSubmittingReportId(c.id);
    try {
      await reportComment({
        postId,
        commentId: c.id,
        commentText: c.displayText || c.text,
        commentAuthorUid: c.authorUid,
        commentAuthorName: c.authorName,
        reportedByUid: user.uid,
        reason,
      });
      setReportedIds((prev) => new Set(prev).add(c.id));
      setReportingId(null);
      onNotify?.(
        language === 'si' ? 'වාර්තාව ලැබිණ. ස්තූතියි!' : 'Report received. Thank you!'
      );
    } catch (err: any) {
      onNotify?.(
        err?.message ||
          (language === 'si' ? 'වාර්තා කිරීම අසාර්ථකයි.' : 'Could not submit report.')
      );
    } finally {
      setSubmittingReportId(null);
    }
  };

  const handleBlockUser = async (c: PostComment) => {
    if (!user?.uid) return;
    setBlockingId(c.id);
    try {
      await blockUser(user.uid, c.authorUid);
      setBlockedUids((prev) => new Set(prev).add(c.authorUid));
      setBlockConfirmId(null);
      onNotify?.(
        language === 'si'
          ? `${c.authorName} අවහිර කළා.`
          : `${c.authorName} blocked — their comments are now hidden from you.`
      );
    } catch (err: any) {
      onNotify?.(
        err?.message ||
          (language === 'si' ? 'අවහිරය අසාර්ථකයි.' : 'Could not block user.')
      );
    } finally {
      setBlockingId(null);
    }
  };

  const canDeleteComment = (c: PostComment) =>
    !!(isSignedIn && user?.uid && (c.authorUid === user.uid || isAdmin));

  const canEditComment = (c: PostComment) =>
    !!(isSignedIn && user?.uid && c.authorUid === user.uid);

  const startEdit = (c: PostComment) => {
    setEditingId(c.id);
    setEditText(c.text);
    setConfirmDeleteId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText('');
  };

  const handleSaveEdit = async (c: PostComment) => {
    const trimmed = editText.trim();
    if (!trimmed) {
      onNotify?.(language === 'si' ? 'අදහස හිස් විය නොහැක.' : 'Comment cannot be empty.');
      return;
    }
    if (trimmed === c.text.trim()) {
      cancelEdit();
      return;
    }
    setSavingEditId(c.id);
    try {
      const result = await updateComment(postId, c.id, trimmed);
      if (result.flagged) {
        onNotify?.(
          language === 'si'
            ? 'ඔබේ සංස්කරණය පරීක්ෂාවට යවන ලදී. පරිපාලක අනුමත කළ පසු පෙනෙනු ඇත.'
            : 'Your edit was flagged for review. An admin will decide before it appears again.'
        );
      }
      cancelEdit();
    } catch (err: any) {
      onNotify?.(
        err?.message ||
          (language === 'si' ? 'සංස්කරණය අසාර්ථක විය' : 'Could not save edit.')
      );
    } finally {
      setSavingEditId(null);
    }
  };

  const handleDeleteComment = async (c: PostComment) => {
    if (deletingId) return;
    setDeletingId(c.id);
    try {
      await deleteComment(postId, c.id);
      if (replyTo?.id === c.id) setReplyTo(null);
    } catch (err: any) {
      onNotify?.(
        err?.message ||
          (language === 'si' ? 'මකා දැමීම අසාර්ථක විය' : 'Could not delete comment.')
      );
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  const handleSend = async () => {
    if (!isSignedIn) {
      onNotify?.(
        language === 'si'
          ? 'අදහස් දැක්වීමට Google මගින් පිවිසෙන්න.'
          : 'Sign in with Google to comment.'
      );
      return;
    }
    if (profile?.suspended) {
      onNotify?.(
        language === 'si'
          ? 'ඔබගේ ගිණුම අත්හිටුවා ඇත.'
          : 'Your account is suspended.'
      );
      return;
    }
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setSending(true);
    try {
      const result = await addPostComment({
        postId,
        text: trimmed,
        authorUid: user!.uid,
        authorName: profile?.displayName || user?.displayName || 'User',
        authorUsername: profile?.username,
        authorPhotoURL: profile?.photoURL || user?.photoURL || undefined,
        parentId: replyTo?.id || null,
        replyToName: replyTo?.authorName,
        replyToUsername: replyTo?.authorUsername,
        replyToAuthorUid: replyTo?.authorUid || null,
      });
      setText('');
      setSuggestions([]);
      setReplyTo(null);
      if (result.flagged) {
        onNotify?.(
          language === 'si'
            ? 'ඔබේ අදහස පරීක්ෂාවට යවන ලදී. පරිපාලක අනුමත කළ පසු පෙනෙනු ඇත.'
            : 'Your comment was flagged for review. An admin will decide before it appears.'
        );
      } else if (result.comment.mentions && result.comment.mentions.length > 0) {
        onNotify?.(
          language === 'si'
            ? `අදහස යැවිණි · @mention ${result.comment.mentions.length}`
            : `Comment posted · notified ${result.comment.mentions.length} user(s)`
        );
      }
    } catch (err: any) {
      onNotify?.(
        err?.message ||
          (language === 'si' ? 'අදහස් යැවීම අසාර්ථකයි.' : 'Could not post comment.')
      );
    } finally {
      setSending(false);
    }
  };

  const countLabel = comments.length;

  const renderComment = (c: PostComment, isReply: boolean) => {
    const childReplies = repliesByParent[c.id] || [];
    const isHighlighted = highlightedId === c.id;
    const isExpanded = expandedRoots.has(c.id) || childReplies.length <= REPLY_PREVIEW_COUNT;
    const visibleReplies = isExpanded ? childReplies : childReplies.slice(0, REPLY_PREVIEW_COUNT);
    const hiddenReplyCount = childReplies.length - visibleReplies.length;
    const isEditing = editingId === c.id;
    return (
      <div
        key={c.id}
        ref={(el) => {
          commentRefs.current[c.id] = el;
        }}
        className={isReply ? 'mt-1.5' : ''}
      >
        <div className={`flex gap-2 items-start ${isReply ? 'pl-0' : ''}`}>
          <Avatar c={c} size={isReply ? 24 : 28} />
          <div className="min-w-0 flex-1">
            <div
              className={`rounded-2xl px-2.5 py-1.5 transition-colors duration-700 ${
                isHighlighted
                  ? 'bg-emerald-100 dark:bg-emerald-900/50 ring-2 ring-emerald-500'
                  : isReply
                    ? 'bg-zinc-100/80 dark:bg-zinc-900/60 border border-zinc-100 dark:border-white/5'
                    : 'bg-zinc-50 dark:bg-zinc-900/80'
              }`}
            >
              <div className="flex items-center gap-1 flex-wrap">
                <AuthorLabel c={c} />
                {c.editedAt ? (
                  <span
                    className="text-[9px] text-zinc-400 italic"
                    title={language === 'si' ? 'මෙම අදහස සංස්කරණය කර ඇත' : 'This comment was edited'}
                  >
                    · {language === 'si' ? 'සංස්කරණය කළා' : 'edited'}
                  </span>
                ) : null}
              </div>
              {c.replyToName && (
                <p className="text-[10px] text-zinc-400 mt-0.5 flex items-center gap-0.5">
                  <CornerDownRight className="w-3 h-3" />
                  {language === 'si' ? 'පිළිතුරු' : 'Replying to'}{' '}
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                    {c.replyToName}
                  </span>
                </p>
              )}
              {isEditing ? (
                <div className="mt-1 space-y-1.5">
                  <input
                    type="text"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value.slice(0, 500))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSaveEdit(c);
                      }
                      if (e.key === 'Escape') cancelEdit();
                    }}
                    autoFocus
                    maxLength={500}
                    disabled={savingEditId === c.id}
                    className="w-full text-xs rounded-full border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-black px-3 py-1.5 outline-none focus:border-emerald-600 dark:focus:border-emerald-500 disabled:opacity-60"
                  />
                  <div className="flex items-center gap-3 px-1">
                    <button
                      type="button"
                      disabled={savingEditId === c.id}
                      onClick={() => handleSaveEdit(c)}
                      className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {savingEditId === c.id
                        ? language === 'si'
                          ? 'සුරකිමින්...'
                          : 'Saving...'
                        : language === 'si'
                          ? 'සුරකින්න'
                          : 'Save'}
                    </button>
                    <button
                      type="button"
                      disabled={savingEditId === c.id}
                      onClick={cancelEdit}
                      className="text-[10px] font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-white transition-colors cursor-pointer"
                    >
                      {language === 'si' ? 'අවලංගු' : 'Cancel'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-0.5">
                  <CommentBody text={c.displayText} />
                </div>
              )}
            </div>
            {!isEditing && (
              <>
                <div className="flex items-center gap-3 px-1.5 pt-0.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => startReply(c)}
                    className="text-[10px] font-bold text-zinc-500 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors cursor-pointer"
                  >
                    {language === 'si' ? 'පිළිතුරු දෙන්න' : 'Reply'}
                  </button>
                  {canEditComment(c) && (
                    <button
                      type="button"
                      onClick={() => startEdit(c)}
                      className="text-[10px] font-bold text-zinc-500 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors cursor-pointer"
                    >
                      {language === 'si' ? 'සංස්කරණය' : 'Edit'}
                    </button>
                  )}
                  {canDeleteComment(c) && (
                    confirmDeleteId === c.id ? (
                      <span className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          disabled={deletingId === c.id}
                          onClick={() => handleDeleteComment(c)}
                          className="text-[10px] font-bold text-red-600 hover:text-red-700 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {deletingId === c.id
                            ? language === 'si'
                              ? 'මකමින්...'
                              : 'Deleting...'
                            : language === 'si'
                              ? 'තහවුරු කරන්න'
                              : 'Confirm delete'}
                        </button>
                        <button
                          type="button"
                          disabled={deletingId === c.id}
                          onClick={() => setConfirmDeleteId(null)}
                          className="text-[10px] font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-white transition-colors cursor-pointer"
                        >
                          {language === 'si' ? 'අවලංගු' : 'Cancel'}
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(c.id)}
                        className="text-[10px] font-bold text-zinc-500 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer"
                      >
                        {language === 'si' ? 'මකන්න' : 'Delete'}
                      </button>
                    )
                  )}

                  {/* Report — only for other users' comments */}
                  {isSignedIn && user?.uid && c.authorUid !== user.uid && (
                    reportedIds.has(c.id) ? (
                      <span className="text-[10px] text-zinc-400 italic flex items-center gap-0.5">
                        <Flag className="w-2.5 h-2.5" />
                        {language === 'si' ? 'වාර්තා කළා' : 'Reported'}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setReportingId(reportingId === c.id ? null : c.id);
                          setBlockConfirmId(null);
                        }}
                        className="text-[10px] font-bold text-zinc-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors cursor-pointer flex items-center gap-0.5"
                      >
                        <Flag className="w-2.5 h-2.5" />
                        {language === 'si' ? 'වාර්තා' : 'Report'}
                      </button>
                    )
                  )}

                  {/* Block — only for other users, not Ali Media */}
                  {isSignedIn && user?.uid && c.authorUid !== user.uid && !c.authorIsAliMedia && (
                    blockConfirmId === c.id ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="text-[10px] text-zinc-500">
                          {language === 'si' ? 'අවහිර කරන්නද?' : 'Block this user?'}
                        </span>
                        <button
                          type="button"
                          disabled={blockingId === c.id}
                          onClick={() => handleBlockUser(c)}
                          className="text-[10px] font-bold text-red-600 hover:text-red-700 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {blockingId === c.id
                            ? language === 'si' ? 'අවහිර...' : 'Blocking...'
                            : language === 'si' ? 'ඔව්' : 'Block'}
                        </button>
                        <button
                          type="button"
                          disabled={blockingId === c.id}
                          onClick={() => setBlockConfirmId(null)}
                          className="text-[10px] font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-white transition-colors cursor-pointer"
                        >
                          {language === 'si' ? 'නැත' : 'Cancel'}
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setBlockConfirmId(c.id);
                          setReportingId(null);
                        }}
                        className="text-[10px] font-bold text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                      >
                        {language === 'si' ? 'අවහිර' : 'Block'}
                      </button>
                    )
                  )}
                </div>

                {/* Inline report reason picker */}
                {reportingId === c.id && (
                  <div className="mt-1 ml-1 px-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-[9px] text-zinc-400 mr-0.5">
                      {language === 'si' ? 'හේතුව:' : 'Reason:'}
                    </span>
                    {REPORT_REASONS.map(({ key, en, si }) => (
                      <button
                        key={key}
                        type="button"
                        disabled={submittingReportId === c.id}
                        onClick={() => handleReport(c, key)}
                        className="text-[9px] font-bold px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {submittingReportId === c.id
                          ? (language === 'si' ? 'යවමින්...' : '…')
                          : (language === 'si' ? si : en)}
                      </button>
                    ))}
                    <button
                      type="button"
                      disabled={submittingReportId === c.id}
                      onClick={() => setReportingId(null)}
                      className="text-[9px] font-bold text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                    >
                      {language === 'si' ? 'අවලංගු' : 'Cancel'}
                    </button>
                  </div>
                )}
              </>
            )}
            {/* Nested replies */}
            {visibleReplies.length > 0 && (
              <div className="mt-1 ml-1 pl-3 border-l-2 border-zinc-200 dark:border-zinc-700 space-y-1">
                {visibleReplies.map((r) => renderComment(r, true))}
              </div>
            )}
            {hiddenReplyCount > 0 && (
              <button
                type="button"
                onClick={() => setExpandedRoots((prev) => new Set(prev).add(c.id))}
                className="mt-1 ml-1 pl-3 text-[10px] font-bold text-zinc-500 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors cursor-pointer flex items-center gap-1"
              >
                <CornerDownRight className="w-3 h-3" />
                {language === 'si'
                  ? `තවත් පිළිතුරු ${hiddenReplyCount}ක් පෙන්වන්න`
                  : `View ${hiddenReplyCount} more ${hiddenReplyCount === 1 ? 'reply' : 'replies'}`}
              </button>
            )}
            {isExpanded && childReplies.length > REPLY_PREVIEW_COUNT && expandedRoots.has(c.id) && (
              <button
                type="button"
                onClick={() =>
                  setExpandedRoots((prev) => {
                    const next = new Set(prev);
                    next.delete(c.id);
                    return next;
                  })
                }
                className="mt-1 ml-1 pl-3 text-[10px] font-bold text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer"
              >
                {language === 'si' ? 'පිළිතුරු සඟවන්න' : 'Hide replies'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="border-t border-zinc-100 dark:border-white/10 pt-2 mt-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:text-[#062E22] dark:hover:text-emerald-400 transition-colors cursor-pointer"
      >
        <MessageCircle className="w-4 h-4" />
        {open
          ? language === 'si'
            ? 'අදහස් වසන්න'
            : 'Hide comments'
          : language === 'si'
            ? `අදහස්${countLabel ? ` (${countLabel})` : ''}`
            : `Comments${countLabel ? ` (${countLabel})` : ''}`}
      </button>

      {open && (
        <div className="mt-2 space-y-2 animate-fadeIn">
          <div
            ref={listRef}
            onScroll={handleListScroll}
            className="max-h-64 overflow-y-auto space-y-2.5 pr-1 scrollbar-thin"
          >
            {loadingOlder && (
              <div className="flex items-center justify-center py-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" />
              </div>
            )}
            {!loadingOlder && hasMoreOlder && comments.length > 0 && (
              <button
                type="button"
                onClick={handleLoadOlder}
                className="w-full text-center text-[10px] font-bold text-zinc-400 hover:text-emerald-700 dark:hover:text-emerald-400 py-1 cursor-pointer"
              >
                {language === 'si' ? 'පැරණි අදහස් පෙන්වන්න' : 'Load earlier comments'}
              </button>
            )}
            {roots.length === 0 ? (
              <p className="text-[11px] text-zinc-400 py-2">
                {language === 'si'
                  ? 'තවම අදහස් නැත. @username භාවිතයෙන් mention කරන්න!'
                  : 'No comments yet. Use @username to mention someone!'}
              </p>
            ) : (
              roots.map((c) => renderComment(c, false))
            )}
          </div>

          <div className="relative">
            {replyTo && (
              <div className="mb-1.5 flex items-center justify-between gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/40 px-2.5 py-1.5">
                <p className="text-[10px] text-emerald-800 dark:text-emerald-300 flex items-center gap-1 min-w-0">
                  <CornerDownRight className="w-3 h-3 shrink-0" />
                  <span className="truncate">
                    {language === 'si' ? 'පිළිතුරු' : 'Replying to'}{' '}
                    <strong>{replyTo.authorIsAliMedia ? 'Ali Media' : replyTo.authorName}</strong>
                  </span>
                </p>
                <button
                  type="button"
                  onClick={cancelReply}
                  className="text-[10px] font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-white shrink-0 cursor-pointer"
                >
                  {language === 'si' ? 'අවලංගු' : 'Cancel'}
                </button>
              </div>
            )}

            {suggestions.length > 0 && mentionQuery !== null && (
              <div className="absolute bottom-full left-0 right-12 mb-1 max-h-40 overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 shadow-lg z-20">
                {suggestions.map((s) => (
                  <button
                    key={s.handle}
                    type="button"
                    onClick={() => insertMention(s)}
                    className="w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
                  >
                    <div className="w-6 h-6 rounded-full overflow-hidden bg-zinc-200 dark:bg-zinc-800 shrink-0">
                      {s.photoURL ? (
                        <img src={s.photoURL} alt="" className="w-full h-full object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 truncate">
                        @{s.handle}
                      </p>
                      <p className="text-[10px] text-zinc-500 truncate">{s.displayName}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={text}
                onChange={(e) => {
                  const v = e.target.value.slice(0, 500);
                  setText(v);
                  const caret = e.target.selectionStart ?? v.length;
                  updateMentionSuggestions(v, caret);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (suggestions.length > 0) {
                      insertMention(suggestions[0]);
                      return;
                    }
                    handleSend();
                  }
                  if (e.key === 'Escape') {
                    setSuggestions([]);
                    setMentionQuery(null);
                    if (replyTo) cancelReply();
                  }
                }}
                placeholder={
                  isSignedIn
                    ? replyTo
                      ? language === 'si'
                        ? 'පිළිතුරු ලියන්න…'
                        : 'Write a reply…'
                      : language === 'si'
                        ? 'අදහසක්… @username mention'
                        : 'Write a comment… use @username'
                    : language === 'si'
                      ? 'අදහස් සඳහා පිවිසෙන්න'
                      : 'Sign in to comment'
                }
                disabled={!isSignedIn || sending}
                className="flex-1 text-xs rounded-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-black px-3 py-2 outline-none focus:border-emerald-600 dark:focus:border-emerald-500 disabled:opacity-60"
                maxLength={500}
                autoComplete="off"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={!isSignedIn || sending || !text.trim()}
                className="w-9 h-9 rounded-full bg-[#062E22] text-white flex items-center justify-center disabled:opacity-40 hover:bg-emerald-900 transition-colors shrink-0"
                aria-label="Send"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <p className="text-[10px] text-zinc-400 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            {language === 'si'
              ? 'හිංසාව / අසභ්‍ය භාෂාව · ස්වයං පරීක්ෂා · Reply + @mention'
              : 'Auto-moderated · Reply & @mention · rate-limited'}
          </p>
        </div>
      )}
    </div>
  );
};
