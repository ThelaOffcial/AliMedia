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
before it is added to the community feed. Generated images are created and
uploaded server-side to the existing Cloudinary unsigned preset. An AI-image
disclosure is appended to the caption when the bot generates an illustration.

### Hosting and secrets

The Story Bot's private API runs as Vercel Functions in the existing `ali-media`
project, so Firebase can remain on the Spark plan. Both required server-side
settings already exist in Vercel's **Production** environment:

- `GEMINI_API_KEY` — used only for server-side draft and illustration generation.
- `FIREBASE_SERVICE_ACCOUNT_KEY` — used only to verify signed-in admins, read
  elephant records, and enforce the rate limit in Realtime Database.

No new API key, Firebase plan change, or Firebase Functions deployment is
needed. Merge the Vercel backend change to `main`; the connected Vercel project
will deploy it automatically. Do not expose or commit either secret. Gemini
usage may be subject to Google's account quotas or charges.

Each API call verifies the Firebase ID token and checks the caller against the
`/admins/{uid}` allowlist. Draft and image generation are limited to eight calls
per admin per minute. Requests to Gemini use `store: false`. Story-only posts
follow AliMedia's existing 24-hour expiry; regular feed posts stay in the
community feed. The bot does not publish on a timer and never auto-publishes.

### Updating the bot backend

After code changes, merge to `main` and Vercel will create a production
deployment. If a required Vercel secret is rotated or changed, create a new
production deployment so the server functions receive the updated setting.

## Data paths (Realtime Database)

| Path                 | Purpose                          |
|----------------------|----------------------------------|
| `/elephants/{id}`    | Elephant registry                |
| `/elephant_posts/{id}` | Community posts & stories      |
| `/cultural_events/{id}` | Events / notifications        |
| `/users/{uid}`       | User profiles                    |
| `/admins/{uid}`      | Admin allowlist                  |
| `/visitors/{id}`     | Live visitor presence            |
