# Path of Ragnarok 1.3.1

**Fix: Divine Protection could not be learned.** On the Skills tab Divine Protection asked for Cure 1, which asked for Heal 2, which asked for Demon Bane 5 and Faith 10, which asked for Divine Protection 3. No skill in the loop could be taken first.

## Fixed

- Skill prerequisites came from the first class in rAthena's skill tree that lists a requirement, so later classes' requirements leaked onto Acolyte skills. They now come from the first class that lists the skill: no requirement there means none.
- Skills that lost a wrong prerequisite: Divine Protection (was Cure 1), Heal (was Demon Bane 5 and Faith 10), skill 46 (was skill 44 level 10, both eras) and, pre-renewal only, Cure's link to Status Recovery. A check over both tables finds no prerequisite loops.

## Notes

- Nothing else changed: no new settings, items or NPCs. Skills you already learned are not touched.
- Copy the mod folder over the installed one, press Apply and restart the client.
- Thanks to the player who reported it.
