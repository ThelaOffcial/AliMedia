AUTHOR EDIT/DELETE FIX — READ THIS
==================================

1) MUST publish database rules or edit/delete will still fail:

   Firebase Console → Realtime Database → Rules
   → paste database.rules.json from this zip
   → Publish

2) Copy app files:
   src/firebase/postService.ts
   src/components/DiscoverFeed.tsx
   src/components/CreatePostModal.tsx
   src/App.tsx

3) How it works now:
   - Menu (⋯) only on YOUR posts (or if you are admin)
   - Edit/Delete uses Firebase Auth uid vs post.authorUid
   - Server rules also require the same

4) Test:
   - Sign in with Google
   - Create a new post
   - Open ⋯ on that post → Edit caption → Save
   - Delete works the same way

Old posts without authorUid cannot be edited by normal users
(only admin). New posts always store authorUid.
