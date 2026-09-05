# FCM Web Push — setup checklist

The code is done and builds clean, but push requires two things only you can do
(a console-generated key, and a deploy), plus an icon file.

## 1. Generate a VAPID key
Firebase Console → your project (`aliapp-e5196`) → ⚙️ Project settings →
**Cloud Messaging** tab → **Web configuration** → **Web Push certificates** →
**Generate key pair**.

Copy the key it gives you and paste it into `src/firebase/messaging.ts`,
replacing:
```ts
const VAPID_KEY = 'REPLACE_WITH_YOUR_FCM_VAPID_KEY';
```
This key is public (safe to ship in client code) — it's not the same as your `apiKey`.

## 2. Confirm your project is on the Blaze (pay-as-you-go) plan
Cloud Functions require Blaze. The free tier covers this app's volume comfortably
(2M invocations/month free) — you'll only see charges if usage grows a lot.
Firebase Console → bottom-left "Upgrade" if you're still on Spark.

## 3. Deploy the Cloud Function
```bash
npm install -g firebase-tools   # if you don't have it
firebase login
cd functions && npm install && cd ..
firebase deploy --only functions
```
This deploys `sendPushOnNotification` (in `functions/index.js`), which listens for
new writes at `user_notifications/{uid}/{notifId}` — the same path replies/mentions
already write to — and pushes to every token saved under `users/{uid}/fcmTokens`.

## 4. Ship real notification icons (optional but recommended)
`public/firebase-messaging-sw.js` currently reuses `/icons/alimedia-logo.png` for
notification icons. A dedicated 192×192 icon will look sharper in the OS notification
tray — swap the `icon`/`badge` paths in that file if you add one.

## How it all connects
1. User taps "Enable notifications" in their profile → `src/firebase/messaging.ts`
   requests permission, registers `public/firebase-messaging-sw.js`, and saves an
   FCM token to `users/{uid}/fcmTokens/{token}`.
2. Someone replies/mentions them → `commentService.ts` writes a notification to
   `user_notifications/{uid}` (unchanged, existing behavior).
3. That write triggers `functions/sendPushOnNotification`, which reads the user's
   saved tokens and sends the push via FCM.
4. If the tab is open, `subscribeToForegroundPush` (wired into `App.tsx`) shows it
   as the existing in-app toast. If the tab is closed, the service worker shows a
   native OS notification, and tapping it opens/focuses the app.

## Also in `functions/`: server-side comment moderation
`functions/index.js` also exports `moderateNewComment`, which triggers on every
new write to `post_comments/{postId}/{commentId}` and re-runs the same
profanity/link filter as `src/utils/commentModeration.ts` (ported to
`functions/moderateCommentText.js` — keep the two in sync if you edit the word
lists). This closes the gap where someone could write directly to the database
with a crafted payload claiming `status: 'visible'` to skip moderation entirely:
regardless of what the client sent, a flagged comment gets forced back to
`pending` with the sanitized text and logged to `moderation_queue`. This deploys
with the same `firebase deploy --only functions` command above — no separate
setup needed.

## Testing
- Enable notifications on your own account, then have a second (test) account
  reply to one of your comments — you should get a push within a few seconds.
- To test background delivery specifically, close the AliMedia tab entirely
  before triggering the reply.
- Watch function logs with `firebase functions:log` if a push doesn't arrive.
