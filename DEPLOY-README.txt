Ali Media — PRODUCTION READY build
==================================

Verified:
- TypeScript: 0 errors (tsc --noEmit)
- Vite production build: SUCCESS

Includes fixed:
1) Edit/Delete → bottom notification bars (not center of feed)
2) Age: living → today; memorial → death date only
3) AdminPanel duplicate statusRaw crash fixed
4) Bookmark typing / reshare casts fixed
5) PNG module declarations for Vite
6) Stories 24h auto-delete + correct relative times
7) Author/admin-only post edit/delete + database.rules.json

MUST after deploy:
Firebase Console → Realtime Database → Rules
→ paste database.rules.json → Publish

Otherwise author edit/delete will still fail in production.
