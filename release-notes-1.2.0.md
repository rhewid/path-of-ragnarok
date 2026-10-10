# Path of Ragnarok 1.2.0

**Skill points instead of permanent node skills:** nodes no longer teach skills. Every character gets 5 skill points, collectable once, to learn any skill of any class from a new **ETC** tab in the window.

## New

- **ETC tab** next to the Passive Tree tab. A button collects the skill points (once per character); each point buys one level of any skill of any class. Class filter, search box, "Learned only" switch, **+1** and **Max** buttons.
- Learned skills are permanent and survive job changes. There is no refund.
- New setting **Skill points on the ETC tab** (0-50, default 5; 0 switches the feature off, skills already learned stay).
- New server commands behind it: `sclaim`, `slearn <skill id> <level>` (the window sends them).
- New generated files: `npc/passive_tree_skills.txt` and `pre-renewal/npc/passive_tree_skills.txt` (the skills each era can learn) and `client/skill-data.js`.

## Changed

- The notables that taught a skill (Item Appraisal, Heal, Teleport, Hiding, Discount, Overcharge, Pushcart, Blessing, Increase AGI, Ruwach, Sight, Steal, Detoxify, Owl's Eye, Vulture's Eye, Improve Concentration, SP/HP Recovery, Endure, Falconry Mastery ...) keep their stat bonuses and lose the skill. Node ids and the tree layout are unchanged, so nobody's allocation is touched.
- The **Falconry** node still gives a falcon to any class, but no longer teaches Falconry Mastery.
- The setting **Nodes can teach skills** is gone (replaced by the skill points setting). The "Skills taught" list of the side panel is now "Skills learned".
- The state line the server sends has five more fields (setting, collected, spent, renewal flag, learned skills). Window and script are released together.
- `mod.json` author and LICENSE now say rhewid.

## Notes

- Existing characters: the skills the old nodes taught are taken back at the next login (the script only recorded skills the character did not already have, so class skills are not touched). Their 5 skill points are still waiting on the ETC tab.
- A skill you already know at that level cannot be bought again; levels you already have from your class are not charged.
- Skill prerequisites are ignored on purpose ("any skill of any class"). Some skills still need their weapon, a falcon, a cart or a mount to be usable.
- Support nodes that add skill levels (Blessing, Increase AGI ...) only work for skills you know, so learn the skill first.
- Not yet confirmed in game: please test collecting the points, learning a skill from another class (the skill window may need a relog to show it), **Max**, and a character that had node skills before the update.
- Copy the mod folder over the installed one, press Apply and restart the client.
