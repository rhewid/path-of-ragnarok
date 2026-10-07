# Path of Ragnarok 1.0.0

First release of **Path of Ragnarok**, a Path-of-Exile style passive skill tree for Ragnarok Offline. Your first class gives you an origin in the centre of a 695-node tree, every job level earns a point (up to 50), and the tree grows outward in all directions with keystones, masteries, card sockets, job-line and rebirth branches and teleport rifts.

## New

- The whole mod: tree window (Alt+P, the PT button or `@passive`), search, active-effects list, refunds, 12 keystones with a configurable limit, 6 card sockets, 12 masteries, 48 job-line and rebirth branches, 4 teleport rifts, race wagers, auto-casts with weapon requirements, free recasts, skill-level nodes, weak-skill clusters.
- 12 settings: point cap, points per level, refund price, refunds on/off, bonus strength, skills on/off, PT button, card sockets, MVP cards, socketing price, keystone limit, drop rate cap.

## Changed

- Renamed from the working name `passive-tree` to `path-of-ragnarok` (mod name, settings key, client window id).
- The tree window now uses the game's own mouse pointer instead of the system pointer.

## Notes

- Needs Ragnarok Offline 1.4.5 or newer; works in renewal and pre-renewal (separate card tables per era).
- Remove any installed `passive-tree` folder before installing this one, then press **Apply** and restart the client. Settings are stored under the new name, so they start at their defaults. Character data (points, nodes, cards) is kept in character variables and carries over; the tree version check refunds a character once if the tree layout it saved is older.
- Not everything has been confirmed in game: see "Known limits" in the README.
