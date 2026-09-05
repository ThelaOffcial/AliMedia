# Google Sign-In setup (Firebase + Google Cloud)

App project: **aliapp-e5196**  
Project number / public-facing id: **project-879533198243**  
Auth domain: **aliapp-e5196.firebaseapp.com**

## 1. Enable Google provider

1. [Firebase Console](https://console.firebase.google.com/) → **aliapp-e5196**
2. **Authentication** → **Sign-in method**
3. Enable **Google**
4. Set a **Project support email**
5. Save

Optional but recommended: also enable **Anonymous** (used only for guest DB writes).

## 2. Authorized domains

**Authentication** → **Settings** → **Authorized domains**

Add every domain where the app runs, for example:

- `localhost`
- `aliapp-e5196.firebaseapp.com`
- `aliapp-e5196.web.app`
- your custom domain (e.g. `alimedia.lk`, `www.alimedia.lk`)
- Vercel/Netlify host if used

## 3. Google Cloud OAuth consent screen

1. Open [Google Cloud Console](https://console.cloud.google.com/) → select project **aliapp-e5196** (number **879533198243**)
2. **APIs & Services** → **OAuth consent screen**
3. **User type**: External (unless Workspace-only)
4. **App name** (public-facing name users see): e.g. **Alimedia**  
   (Google may show `project-879533198243` until you set a proper app name)
5. Support email, developer contact
6. Publishing status: **Testing** (add test users) or **In production**

## 4. OAuth client (Web)

Firebase usually creates a Web client automatically when Google Sign-In is enabled.

**APIs & Services** → **Credentials** → OAuth 2.0 Client IDs → Web client

Authorized JavaScript origins should include:

- `http://localhost:3000` (or your Vite port)
- `https://aliapp-e5196.firebaseapp.com`
- `https://aliapp-e5196.web.app`
- your production URL

Authorized redirect URIs should include:

- `https://aliapp-e5196.firebaseapp.com/__/auth/handler`

## 5. App behaviour

- Popup sign-in is tried first
- If the popup is blocked, the app falls back to **redirect** sign-in
- Anonymous sessions are **not** shown as “logged in”
- Only a real Google account appears as the signed-in member

## Common errors

| Error | Fix |
|--------|-----|
| `auth/operation-not-allowed` | Enable Google in Authentication → Sign-in method |
| `auth/unauthorized-domain` | Add domain under Authorized domains |
| `auth/popup-blocked` | Allow popups, or use the automatic redirect fallback |
| Consent shows `project-879533198243` | Set App name on OAuth consent screen to **Alimedia** |
