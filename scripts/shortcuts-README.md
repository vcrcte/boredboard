# iOS Shortcuts

Signed Shortcut files linked from `/raccourci`. Rebuild them with
`scripts/build-shortcuts.py` (it reads the original unsigned `.shortcut` exports),
then sign on a Mac signed into iCloud:

    shortcuts sign --mode anyone --input share-v2.shortcut --output boredboard-share.shortcut

Both ask for the person's BoredBoard code at install time (no token is baked in).
The share one copies `share_url` from `/api/shortcuts/music`, or the original link when there is none.
