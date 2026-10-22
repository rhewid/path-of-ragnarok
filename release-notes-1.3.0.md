# Path of Ragnarok 1.3.0

Skills by class tier, job skill points, rebirth handling, class regions that no longer touch early, and a lot more for Gunslinger, Ninja and Taekwon.

## New

- **Gunslinger, Ninja and Taekwon** (and Summoner, Gangsi, Super Novice) all start at the **Wanderer centre**. Gunslinger and Ninja used to start in the Archer and Mage origins.
- **Inner branches**: each of the three gets a dead-end chain of four inner nodes up the centre line of the region that suits it (Gunslinger in Archer, Ninja in Mage, Taekwon in Thief), with weapon and skill damage for the class: revolver, rifle, gatling, shotgun and the Gunslinger skills; the Ninja spells, Shuriken and Kunai; the Taekwon kicks and bare-handed fighting.
- **Outer branches**: four more nodes each, hung off the ring-4 node next to a border keystone, so the keystone is not needed: Ninja beyond Overchannel (notable Shinobi Path), Gunslinger beyond Deadeye (notable Dead Aim), Taekwon beyond Phantom Gambit (notable Hwarang).
- **Free recasts for the Ninja stone spells**: Stone Echo and Ninpo Mastery give a chance to cast Kamaitachi, Lightning Strike of Destruction, Crimson Fire Formation, Raging Fire Dragon or Ice Meteor again with no stone, no SP and no cast time. Not tested in game.
- **Class tier lock** (setting, on): skill points only learn skills of your own tier and below (Novice, first, second, transcended, third, fourth class).
- **Job skill points can learn any skill** (setting, off): the normal skill points of a job level can be spent on the Skills tab on any skill of any class within your tier. They obey the skill's prerequisites; the outer ring points still ignore them.
- **Skill reset NPC**: opening the window after using it takes back the skills learned with ring and job points (job points come back); the passive tree stays.
- **Rebirth**: the skills learned with ring points are kept for good and the ring nodes are given back, so the ring can be taken a second time (setting "Skill point ring again after rebirth").
- **Every job earns points** (setting, on): every job level of every job earns passive points, and the default cap is 150.

## Changed

- **Regions no longer touch early**: each border keystone belongs to one region only (the link into the neighbour's outer ring is gone). Another class's nodes are now about 27 steps away instead of 15 (a Merchant used to reach Light Fingers early). The classes only meet on the far outer ring. The generator fails the build if a class could reach another class's inner rings in under 24 steps.
- **Tree version 5**: the layout changed, so every character's nodes are refunded for free once at the next login. A character that spent skill points loses the learned skills with the usual warning and learns them again. The tree has 737 nodes (175 notables); the skill point ring moved to ids 726-737.
- Positive penalties are drawn red like negative ones: +25% cast time on Overchannel, and the "+% damage taken" effects of Glass Cannon and the six Wager nodes.

## Fixed

- The server script did not load (`getskillname` is not an rAthena command), so the window showed "no answer to passive within 6000ms". Prerequisite skill names now come from a generated table.
- The Skills tab no longer offers 13 NPC-only skills (Suicide, Coma, Class Change, Leveling, Gravity, Grim Reaper and others) or a hidden helper skill.

## Notes

- Characters keep the points they have. Only new job levels count from now on.
- A character that was already reborn has its ring skills banked and the ring given back at the first window open or login.
- The skill reset check runs when the window is opened, not before.
- Copy the mod folder over the installed one, press Apply and restart the client.
