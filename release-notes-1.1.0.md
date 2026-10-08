# Path of Ragnarok 1.1.0

**Saved builds:** save up to 5 versions of your tree and swap between them to try different builds.

## New

- **Builds bar** in the tree window with five slots. Click a slot to save the current tree into it, overwrite, load, rename or delete it (two clicks to confirm).
- A slot keeps the allocated nodes, the mastery choices and the socketed cards. Loading a build clears the current tree (socketed cards return to the inventory), replays the saved nodes through the normal allocation rules and sockets the saved cards again where you still own them.
- Two new settings: **Saved builds per character** (0-5, default 5; 0 switches the feature off) and **Swapping to a saved build: price** (zeny, default 50,000; saving is free).
- Server commands behind it: `bsave`, `bload`, `bdel`, `bname` (the window sends them; you do not need to type them).

## Changed

- The state line the server sends to the window has three more fields (slot summaries, last used slot, swap price). Window and script are released together.

## Notes

- Only a character with the same starting class can load a build. Builds saved before a tree layout change are marked and cannot be loaded.
- Nodes that cannot be taken at load time (fewer points, keystone limit, job line, skill requirement) are skipped, and the chat message says how many.
- Settings: now 14 (limit 20). Existing settings keep their values.
- Not yet confirmed in game: please test save, load, a build with a card in a socket, and a build with a mastery choice.
- Copy the mod folder over the installed one, press Apply and restart the client.
