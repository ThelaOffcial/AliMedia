# Security

## Realtime Database rules (`database.rules.json`)

Deploy in Firebase Console → Realtime Database → Rules, or:

```bash
firebase deploy --only database
```

Highlights:

- Default deny (`.read` / `.write` false at root)
- **elephants / cultural_events**: public read; write only for UIDs under `/admins/{uid}`
- **elephant_posts**: public read; create only as yourself (`authorUid === auth.uid`); updates for likes; delete by author or admin; **https://** photo URLs only; suspended users cannot write
- **users**: read own profile or admin; write own profile (not if suspended) or admin; only admin can set `suspended`
- **admins**: readable when authenticated; never writable from client
- **visitors**: limited write; admin-only list read

## App-side

- Google Sign-In with popup + redirect fallback
- Anonymous auth only for guest DB access (not shown as logged-in)
- Image URLs must be `https://`
- Suspended users blocked from posts and follows

## Live streams

Admin sets **Live** + **Stream URL** on an elephant. Profile embeds YouTube / Twitch / Facebook / HLS / MP4 when LIVE is on.

- **moderation_queue**: admin read; create allowed for authenticated users when
  - auto-flag (`type: comment`) and `authorUid === auth.uid`, or
  - user report of a comment/post (`type: user_report` | `post_report`) and `reportedBy === auth.uid`
  - admins can update/delete queue items
  Anyone signed-in can report; admin makes the final decision (dismiss or remove).
