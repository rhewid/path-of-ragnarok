# Path of Ragnarok 1.2.0

**Skill points instead of permanent node skills:** nodes no longer teach skills. Ten skill points sit on an outer ring of the tree; spend them on the new **Skills** tab to learn any skill of any class.

## New

- **Skill Point ring**: ten cyan "+" nodes on a ring outside the rest of the tree, linked to each other. Only four ways lead in, at the north, east, south and west (a short chain from the outermost node of the tree in that direction). Each node costs a passive point to allocate and gives one skill point.
- A skill point stays yours once collected, even if you refund the node, so the total never goes above 10 and learned skills are never at risk.
- **Skills tab** next to the Passive Tree tab: each point buys one level of any skill of any class. Class filter, search box, "Learned only" switch, **+1** and **Max** buttons. Learned skills are permanent and survive job changes. No refund.
- New setting **Most skill points** (0-10, default 10; 0 switches spending off, skills already learned stay).
- New server command `slearn <skill id> <level>` (the window sends it).
- New generated files: `npc/passive_tree_skills.txt` and `pre-renewal/npc/passive_tree_skills.txt` (the skills each era can learn) and `client/skill-data.js`.

## Changed

- The notables that taught a skill (Item Appraisal, Heal, Teleport, Hiding, Discount, Overcharge, Pushcart, Blessing, Increase AGI, Ruwach, Sight, Steal, Detoxify, Owl's Eye, Vulture's Eye, Improve Concentration, SP/HP Recovery, Endure, Falconry Mastery ...) keep their stat bonuses and lose the skill. Existing node ids and the layout are unchanged (18 nodes were added at the end), so nobody's allocation is touched.
- The **Falconry** node still gives a falcon to any class, but no longer teaches Falconry Mastery.
- The setting **Nodes can teach skills** is gone. The "Skills taught" list of the side panel is now "Skills learned".
- The state line the server sends has five more fields (setting, collected, spent, renewal flag, learned skills). Window and script are released together.
- The tree has 713 nodes (10 skill points and 8 connector nodes added). The window zooms out a little further to show the ring.
- `mod.json` author and LICENSE now say rhewid.

## Notes

- Existing characters: the skills the old nodes taught are taken back at the next login (only skills the character did not already have were ever recorded, so class skills are not touched).
- A skill you already know at that level cannot be bought again; levels you already have from your class are not charged.
- Skill prerequisites are ignored on purpose ("any skill of any class"). Some skills still need their weapon, a falcon, a cart or a mount to be usable.
- Support nodes that add skill levels (Blessing, Increase AGI ...) only work for skills you know, so learn the skill first.
- Not yet confirmed in game: please test walking to the ring, collecting a point, learning a skill from another class (the skill window may need a relog to show it), **Max**, and a character that had node skills before the update.
- Copy the mod folder over the installed one, press Apply and restart the client.
