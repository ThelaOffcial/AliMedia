# Admin Console — Setup (read this once)

The admin console uses **real Firebase Authentication**, and Realtime Database
security rules only allow writes (add/edit/delete elephants, events, etc.)
from accounts on an admin allowlist. You must do a **one-time setup** in the
Firebase Console before you can log in.

## 1. Create your admin login (Firebase Authentication)

1. Go to the [Firebase Console](https://console.firebase.google.com/) → your project.
2. **Authentication** → **Sign-in method** → make sure **Email/Password** is enabled.
3. **Authentication** → **Users** → **Add user**. Enter the email + password you
   want to use to log into the admin console, then save.
4. Copy the **User UID** shown next to the new user (looks like `aB3xY...`).

## 2. Add that account to the admin allowlist (Realtime Database)

1. Go to **Realtime Database** → **Data**.
2. Create a node named exactly `admins` (if it doesn't exist yet).
3. Inside it, create a child whose **key** is the UID you copied in step 1
   (any value is fine, e.g. `{ "role": "owner" }` or just `true`).
4. Save.

That's it. Any account with a matching node at `/admins/{uid}` can now
sign into the admin console (the shield icon in the top navbar) with their
email + password. Accounts *not* in `/admins` will be rejected even if the
email/password is correct.

### Super-admin post override (`samithudinildewapriya@gmail.com`)

This email can **edit or delete any community post** (not only posts they authored).
Client UI shows Edit/Delete when the signed-in email matches. **Realtime Database
rules still require the UID under `/admins/{uid}`** — they cannot safely match
on email alone.

1. Sign in once with Google (or email) as `samithudinildewapriya@gmail.com`.
2. In **Authentication → Users**, copy that account’s **UID**.
3. In **Realtime Database → Data**, add `/admins/{thatUid}` (value `true` or
   `{ "role": "super" }`).

Until the UID is on the allowlist, the UI may show Edit/Delete but RTDB will
deny the write.

## 3. Create / enable Realtime Database & deploy rules

1. In Firebase Console → **Build** → **Realtime Database** → create the database
   if it does not exist yet (choose a region close to your users).
2. Copy the database URL (e.g. `https://YOUR-PROJECT-default-rtdb.firebaseio.com`)
   into `firebase-applet-config.json` as `"databaseURL"`.
3. Deploy the included `database.rules.json` (or paste its contents into
   **Realtime Database → Rules** and click **Publish**):

```bash
firebase deploy --only database
```

## Cloudinary

Cloudinary is hardcoded in `src/firebase/cloudinaryService.ts`:

- Cloud name: `drmmn0xp3`
- Upload preset: `alimanagement`

There is no Cloudinary settings screen in the admin console - if these ever
need to change, edit that file directly.

## Story Bot (admin-only, on-demand publishing)

The Admin Console's **Story Bot** tab creates an editable draft from an
elephant's AliMedia registry record. It can optionally generate an illustrative
image; an administrator must review the draft and click **Publish to AliMedia**
before it is added to the community feed. Generated images are uploaded to the
existing Cloudinary unsigned preset. An AI-image disclosure is appended to the
caption when the bot generates an illustration.

### One-time setup

0. Merge the Story Bot change and deploy the updated AliMedia web app through its
   existing host (for example, the repository's current Vercel/Netlify flow).
   If deploying manually, build the site with `npm run build` and publish the
   resulting `dist/` directory as usual.
1. Create a Gemini API key in [Google AI Studio](https://aistudio.google.com/apikey).
2. From the repository root, select the Firebase project (`aliapp-e5196`) and
   store the key as a Firebase Functions secret (Firebase CLI prompts for the
   secret value; do not commit it to the repository):

   ```bash
   firebase use aliapp-e5196
   firebase functions:secrets:set GEMINI_API_KEY
   firebase deploy --only functions
   ```

3. Confirm Cloud Functions and the selected Gemini API have the required Google
   Cloud project billing/API access enabled. Text draft generation uses
   `gemini-3.8-flash`; optional image generation uses `gemini-3.1-flash-image`.
4. Sign into AliMedia's Admin Console with an account listed under
   `/admins/{uid}`, open **Story Bot**, and generate a draft.

The Gemini key is read only by the server-side callable functions and is never
sent to the browser. Those functions re-check the caller against the Firebase
`/admins` allowlist, apply a per-admin rate limit, and send Gemini requests with
`store: false`. Story-only posts follow AliMedia's existing 24-hour expiry;
regular feed posts stay in the community feed. This bot does not publish on a
timer and never auto-publishes generated drafts.

### Updating the bot functions

After code changes, deploy with `firebase deploy --only functions`. To rotate
the Gemini key, run `firebase functions:secrets:set GEMINI_API_KEY` again and
redeploy the functions that use it.

## Data paths (Realtime Database)

| Path                 | Purpose                          |
|----------------------|----------------------------------|
| `/elephants/{id}`    | Elephant registry                |
| `/elephant_posts/{id}` | Community posts & stories      |
| `/cultural_events/{id}` | Events / notifications        |
| `/users/{uid}`       | User profiles                    |
| `/admins/{uid}`      | Admin allowlist                  |
| `/visitors/{id}`     | Live visitor presence            |
