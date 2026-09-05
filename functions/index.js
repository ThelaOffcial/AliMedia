const { onValueCreated, onValueUpdated } = require('firebase-functions/v2/database');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');
const { moderateCommentText } = require('./moderateCommentText');

admin.initializeApp();
setGlobalOptions({ region: 'us-central1' });

const TITLE_BY_TYPE = {
  reply: 'New reply',
  mention: 'New mention',
};

/**
 * Triggers on every new child written under user_notifications/{uid} — the same
 * path src/firebase/commentService.ts already writes to for in-app reply/mention
 * notifications. Looks up that user's saved FCM tokens (users/{uid}/fcmTokens,
 * written by src/firebase/messaging.ts) and pushes to all of them.
 */
exports.sendPushOnNotification = onValueCreated('/user_notifications/{uid}/{notifId}', async (event) => {
  const uid = event.params.uid;
  const notif = event.data.val();
  if (!notif) return;

  const tokensSnap = await admin.database().ref(`users/${uid}/fcmTokens`).get();
  if (!tokensSnap.exists()) return;

  const tokens = [];
  tokensSnap.forEach((child) => {
    const t = child.val() && child.val().token;
    if (t) tokens.push(t);
  });
  if (tokens.length === 0) return;

  const title = TITLE_BY_TYPE[notif.type] || 'AliMedia';
  const body = String(notif.text || '').slice(0, 160);

  const message = {
    notification: { title, body },
    data: {
      title,
      body,
      url: notif.postId ? `/#post-${notif.postId}` : '/',
      tag: notif.type || 'general',
    },
    tokens,
  };

  const response = await admin.messaging().sendEachForMulticast(message);

  // Prune tokens FCM says are dead (app uninstalled, permission revoked, expired, etc.)
  const deadTokens = new Set();
  response.responses.forEach((r, i) => {
    if (!r.success) {
      const code = (r.error && r.error.code) || '';
      if (
        code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token'
      ) {
        deadTokens.add(tokens[i]);
      }
    }
  });

  if (deadTokens.size > 0) {
    const updates = {};
    tokensSnap.forEach((child) => {
      const t = child.val() && child.val().token;
      if (t && deadTokens.has(t)) updates[child.key] = null;
    });
    if (Object.keys(updates).length > 0) {
      await admin.database().ref(`users/${uid}/fcmTokens`).update(updates);
    }
  }
});

/**
 * Server-side re-check of every new comment written to post_comments/{postId}/{commentId}.
 * src/utils/commentModeration.ts already runs this client-side before a normal
 * comment submission, but that check is only enforced in the app UI — nothing
 * stops someone from writing directly to the database (e.g. via the REST API
 * with a valid auth token) with a crafted payload claiming status: 'visible',
 * flagged: false. The RTDB .validate rules block empty/oversized text but
 * don't run the profanity filter, so this closes that gap: every comment gets
 * re-moderated here regardless of what the client claimed, and anything the
 * filter flags is forced back into the same pending/sanitized state (and
 * logged to moderation_queue) that the normal client-side path would have
 * produced.
 */
exports.moderateNewComment = onValueCreated('/post_comments/{postId}/{commentId}', async (event) => {
  const { postId, commentId } = event.params;
  const comment = event.data.val();
  if (!comment) return;

  const mod = moderateCommentText(comment.text || '');
  if (!mod.flagged) return; // genuinely clean — leave the client's write as-is

  // Already correctly pending/flagged/sanitized (the normal client-side path) — nothing to fix.
  if (
    comment.status === 'pending' &&
    comment.flagged === true &&
    comment.displayText === mod.sanitized
  ) {
    return;
  }

  const db = admin.database();

  await db.ref(`post_comments/${postId}/${commentId}`).update({
    status: 'pending',
    flagged: true,
    displayText: mod.sanitized,
    flagReason: mod.reason || 'policy',
    matchedTerms: mod.matchedTerms.slice(0, 20),
  });

  // Avoid a duplicate moderation_queue entry if the client-side path already
  // filed one correctly — only the bypass case (client sent flagged: false)
  // needs a new one created here.
  const existingSnap = await db
    .ref('moderation_queue')
    .orderByChild('commentId')
    .equalTo(commentId)
    .get();
  if (!existingSnap.exists()) {
    await db.ref('moderation_queue').push({
      type: 'comment',
      commentId,
      postId,
      text: comment.text || '',
      authorUid: comment.authorUid || '',
      authorName: comment.authorName || 'User',
      flagReason: mod.reason || 'policy',
      matchedTerms: mod.matchedTerms.slice(0, 20),
      createdAt: comment.createdAt || Date.now(),
      status: 'open',
    });
  }
});

/**
 * Server-side re-check for comment EDITS (updateComment in src/firebase/commentService.ts).
 * moderateNewComment above only fires on creation — without this, someone could
 * post a clean comment then edit it via a direct REST write with a crafted
 * payload claiming status: 'visible' to slip flagged text past the client-side
 * filter. Only re-checks when the text actually changed, so admin moderation
 * writes (approve/remove, which never touch `text`) don't re-trigger this.
 */
exports.moderateEditedComment = onValueUpdated('/post_comments/{postId}/{commentId}', async (event) => {
  const { postId, commentId } = event.params;
  const before = event.data.before.val();
  const after = event.data.after.val();
  if (!after || !before || before.text === after.text) return;

  const mod = moderateCommentText(after.text || '');
  if (!mod.flagged) return; // genuinely clean edit — leave as-is

  if (
    after.status === 'pending' &&
    after.flagged === true &&
    after.displayText === mod.sanitized
  ) {
    return; // already correctly re-flagged by the client-side edit path
  }

  const db = admin.database();
  await db.ref(`post_comments/${postId}/${commentId}`).update({
    status: 'pending',
    flagged: true,
    displayText: mod.sanitized,
    flagReason: mod.reason || 'policy',
    matchedTerms: mod.matchedTerms.slice(0, 20),
  });

  const existingSnap = await db
    .ref('moderation_queue')
    .orderByChild('commentId')
    .equalTo(commentId)
    .get();
  if (!existingSnap.exists()) {
    await db.ref('moderation_queue').push({
      type: 'comment',
      commentId,
      postId,
      text: after.text || '',
      authorUid: after.authorUid || '',
      authorName: after.authorName || 'User',
      flagReason: mod.reason || 'policy',
      matchedTerms: mod.matchedTerms.slice(0, 20),
      createdAt: after.createdAt || Date.now(),
      status: 'open',
    });
  }
});

// Mirrors src/utils/commentSecurity.ts COMMENT_LIMITS (rateMax / rateWindowMs).
// Keep both in sync if either changes.
const RATE_MAX = 8;
const RATE_WINDOW_MS = 60 * 1000;

/**
 * src/utils/commentSecurity.ts checkCommentRateLimit() only tracks a
 * per-browser localStorage counter, which is trivially bypassed (incognito
 * tab, clearing storage, or writing to post_comments directly with a valid
 * auth token). This is the real, server-enforced limit: on every new
 * comment, count how many comments this author has posted across all posts
 * in the last RATE_WINDOW_MS. If they're over RATE_MAX, the newest
 * comment(s) over the limit are removed and logged, since RTDB security
 * rules alone can't express a rolling rate limit.
 */
exports.enforceCommentRateLimit = onValueCreated('/post_comments/{postId}/{commentId}', async (event) => {
  const { postId, commentId } = event.params;
  const comment = event.data.val();
  const authorUid = comment && comment.authorUid;
  if (!authorUid) return;

  const db = admin.database();
  const cutoff = Date.now() - RATE_WINDOW_MS;

  // post_comments is keyed by postId then commentId, so there's no single
  // indexed query across all posts for "this author's recent comments" —
  // scan the (small, recent) comment set. For a high-traffic app this should
  // be swapped for a maintained per-user counter (e.g. rate_limits/{uid})
  // instead of a full scan; left as-is here since it mirrors the existing
  // data model without a schema migration.
  const allPostsSnap = await db.ref('post_comments').get();
  if (!allPostsSnap.exists()) return;

  let recentCount = 0;
  const matches = [];
  allPostsSnap.forEach((postSnap) => {
    postSnap.forEach((commentSnap) => {
      const c = commentSnap.val();
      if (c && c.authorUid === authorUid && typeof c.createdAt === 'number' && c.createdAt >= cutoff) {
        recentCount++;
        matches.push({ postId: postSnap.key, commentId: commentSnap.key, createdAt: c.createdAt });
      }
    });
  });

  if (recentCount <= RATE_MAX) return;

  // Remove the newest comments over the limit (keep the earliest RATE_MAX),
  // including this one if it's among the excess.
  matches.sort((a, b) => b.createdAt - a.createdAt);
  const overLimit = matches.slice(0, recentCount - RATE_MAX);

  await Promise.all(
    overLimit.map((m) =>
      db.ref(`post_comments/${m.postId}/${m.commentId}`).remove().catch(() => {})
    )
  );

  console.warn(`[rate-limit] Removed ${overLimit.length} comment(s) from ${authorUid} for exceeding ${RATE_MAX}/min`);
});
