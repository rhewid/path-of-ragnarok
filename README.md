# Path of Ragnarok

A mod for [Ragnarok Offline](https://github.com/Flux159/ragnarokoffline.app) that gives every character a **Path-of-Exile style passive skill tree**. (Formerly developed under the working name "passive-tree".)

- Your **first class decides where you start**: your origin sits in the **centre** of the tree and the tree grows **outward** from it. The starting node is free and gives **+2 to the class's stat**.
- **Every job level earns a passive point**, up to **50** (both numbers are settings).
- The tree is **one web of 713 nodes**, not a grid: nodes join along rings and spokes, so you grow outward from your start in a direction you pick, and the other classes' regions are reachable too.
- Nodes give **stats, flat and % bonuses, resistances to every element and race, damage against every element and race, skill boosts, EXP and drop rate**, plus **10 skill points** on the outer ring that are spent on a **Skills tab** to learn any skill of any class.
- **168 notables** (bigger nodes with two or three effects), **12 keystones** (powerful, with a price), **12 masteries** (choose one of several effects), **6 card sockets**, **24 job-line branches** (second classes), **24 rebirth branches** (High classes) and **4 teleport rifts**.
- **Search box** at the top of the window: type a name, an effect or a skill (`double strafe`, `fire resist`, `identify`, `socket`, `keystone`...). Matches light up, the rest dims, Enter jumps to the next match.
- **Up to 5 saved builds** per character: save your tree, try another, swap back.
- Open it with **Alt+P**, the **PT** button under the minimap, or the **@passive** chat command.

**Designed mainly for pre-renewal.** The tree was built and tested on a pre-renewal server; the numbers (stat and damage values, skill boosts, auto-cast chances, the 50-point cap) are balanced for pre-renewal gameplay. It also loads on renewal (it ships a separate card table for each era and only uses bonuses both eras have), but renewal has not been tested and its values have not been balanced for renewal's stronger skills and higher stats.

Needs Ragnarok Offline 1.4.5 or newer. The core (allocating, refunding, stats) is confirmed in game; some newer parts are not yet (see "Known limits").

## Install

1. Copy the `path-of-ragnarok` folder to `%APPDATA%\Ragnarok Offline\state\mods`, or use **Settings → Mods → Add mod from folder**.
2. Switch it on in Settings → Mods and press **Apply**.
3. Restart the game client once (it loads the window code when the page loads).

The `tools` folder is only for editing the tree; the game ignores it.

## How it plays

| Class | Starts at | +2 |
|---|---|---|
| Swordsman | centre, top | STR |
| Acolyte | centre, upper right | VIT |
| Mage | centre, lower right | INT |
| Archer | centre, bottom | DEX |
| Thief | centre, lower left | AGI |
| Merchant | centre, upper left | LUK |
| Wanderer (very centre) | Super Novice, Taekwon, Summoner, Gangsi | +1 to all stats |

Second, third and transcended classes keep the start of their first class (a Knight starts where a Swordsman does). Gunslingers start as Archers and Ninjas as Mages. A Novice has no tree until the first job.

- **Allocate:** click a node. If it is not next to your tree, the whole shortest path to it is allocated (the window shows the cost first).
- **Refund:** right-click an allocated node, or switch on **Refund mode** and click. A node can only be taken back if the rest of your tree stays connected to your start. Each refund costs zeny (setting).
- **Reset all:** takes everything back (and every card out of its socket); costs the refund price once per node.
- Drag to move, wheel to zoom. Hover a node for its effects and what it costs.
- A **blue ring** marks nodes you can reach next. A **gold glow** marks what you own. Purple diamonds are card sockets.

### Points

A first class earns one point per job level (job level 1 = 1 point, up to the cap). A character who already has a second class or beyond starts with the full cap. Points are never lost: once earned, they stay earned even after a job change.

### The rim clusters

Each region grows four small clusters on the outer rim, so the first thing a class reaches is about its own style:

| Cluster | What is in it |
|---|---|
| Skill | Damage boosts for that class's skills (Swordsman: Bash, Magnum Break, Bowling Bash; Archer: Double Strafe, Arrow Shower; Thief: Sonic Blow, Grimtooth; Mage: the three bolts; Acolyte: Heal, Holy Light; Merchant: Mammonite, Cart Revolution...) and a notable that boosts several, or cuts a skill's SP cost |
| Resist | Resistance to elements and races (-% damage from them). All ten elements and all ten races are covered somewhere on the tree |
| Versus | +% damage against races, elements and sizes (magic damage for the Mage region). Same coverage |
| Socket | Two more skill nodes and a **card socket** at the tip |

Skill nodes use rAthena's per-skill bonuses: damage (`bSkillAtk`), healing (`bSkillHeal`, Acolyte's Heal and Merchant's Potion Pitcher), SP cost (`bSkillUseSPrate`). **Buff duration** has no such bonus in rAthena, so the Blessing and Increase AGI nodes (Acolyte socket cluster) add **a skill level** instead, and a higher level lasts longer. They only work if the character already knows the skill. They are **not** held back at the skill's own maximum: rAthena keeps skill data for levels 1-13 and extends linear tables (buff durations, effect sizes) past the maximum, so a Lv 10 Improve Concentration with +2 levels becomes Lv 12 and lasts longer. The cap is Lv 13.

### Card sockets

6 sockets, one at the tip of each region's socket cluster on the outer rim (the inner sockets next to the origins were removed for balance, together with their node: the inner ring is cut there and you reach its two halves through the origin). Allocate the socket, then **click it** to open the card list:

- Cards from your inventory that can go in are listed with their icon and description. Pick one: it leaves your inventory and its bonuses apply to you as if you wore it.
- **Weapon cards count for the weapon you hold**: a weapon card's "+% damage to a race" applies to your attacks whatever weapon is equipped. Armor, shield, garment, shoe, accessory and headgear cards simply give their bonuses.
- Each card can be socketed **once** (a second copy cannot go in another socket).
- Take a card out at any time (it goes back to your inventory), swap by picking another card, or refund the socket node and the card returns on its own.
- Only cards whose script is plain `bonus` lines work (generated per era from rAthena's item database: about 650 in renewal, 390 in pre-renewal). Cards with conditions (refine level, class, "when attacking with...") or auto-spell effects are left out. MVP cards are left out unless the setting allows them.
- The card list is built when the mod is generated from the rAthena item database, so cards added by other mods are not socketable.

### Layout: origin in the centre, keystones on the rim

Each origin sits in the centre of the tree and the region opens outward from it: first the inner notables, then the rings and rim clusters. **There is no direct bridge between neighbouring regions any more.** To reach another class's bonuses you walk out to the keystone on the border (a trade-off node, so you pay for crossing) or around the far outer ring, and from there you branch into the next region. The six gateway nodes between the very centre and the origins are for the **Wanderer** start only: they are how a Wanderer reaches any class's origin, and class characters cannot use them as a shortcut (the window will not route a path through them).

Whenever the tree layout changes between versions, every character is **refunded once for free** on the first login after the update (cards go back to the inventory), with a chat message, so no allocation is left hanging.

### Keystones

A character can take only a few of them: **2 by default**, adjustable with the "Most keystones a character can take" setting (0 = no limit). The window shows "keystones 1 / 2" next to your points and refuses a path that would go over; the server enforces the same. Someone who already has more keeps them but cannot add another.

Six sit **on the rim between two regions** and are the only way across from one class to the next (apart from the outer ring, below); six more sit on the outer ring. Each trades one thing for another:

| Keystone | Effect |
|---|---|
| Iron Vow | Cannot be flinched when hit (endless Endure); -15% damage taken from everything; -15% attack speed |
| Sanctified Mind | Casting cannot be interrupted; +30% healing skill power; -25% physical damage |
| Overchannel | +30% MATK; +25% cast time; -20% Max HP |
| Deadeye | +25% ranged attack damage; +30 HIT; -30% melee attack damage |
| Phantom Gambit | +20% attack speed; +4 Perfect Dodge; -25% Max HP |
| Golden Gamble | +20% EXP from monsters; +1% monster item drop rate; -20% physical damage |
| Bulwark of Ages | A single hit can take at most 25% of your Max HP; cannot be knocked back; -20% physical damage |
| Blood Pact | 20% chance to drain 10% of damage as HP; -30% healing received from skills; -30% HP restored by items |
| Gemless Grace | Skills need no gemstones; +10% magic damage; -25% Max SP |
| Gambler's Fallacy | +30% critical damage; +20 CRIT; -20 HIT |
| Pyre Pact | Your attacks become Fire element; +25% Fire magic damage; -25% Water resistance |
| Glass Cannon | +40% physical damage; +40% magic damage; +40% damage taken from everything |

### The outer ring

A ring around the whole tree (radius 1020) that every rim cluster plugs into, so the tree can be walked all the way round. Per region it holds:

- **Small nodes** with status chances on hit (Stun, Blind, Bleeding, Poison, Freeze...), weapon-type damage (1H/2H sword, spear, axe, mace, knuckle, staff, book, bow, dagger, katar), regeneration (Max HP/SP every few seconds), melee/ranged/magic damage reduction, zeny per kill and more.
- **Four notables**, some with **auto-cast** (a chance to cast Magnum Break, Holy Light, Thunder Storm or Blitz Beat when you attack), drains, status resistances and trap damage. Six need you to **know a skill** at a level before you can allocate them (the tooltip says which).
- **Two masteries**: allocate, then click the node and pick one option (Swords / Spears / Axes, an element, a hunting target...). The node does nothing until you choose; you can change the choice for free.

### How big the skill boosts are

| Where | Small node | Notable / capstone |
|---|---|---|
| Rim skill clusters (a class's main skills) | +4-5% damage | +8-10% on the end notable |
| Weak-skill clusters: Basics | +6% damage | +12-14% |
| Weak-skill clusters: Support | -10% SP cost, +1 skill level | +2 levels, +8-12% healing |
| Weak-skill clusters: Situational | +10% damage | +18-20% |
| Job-line branches (second class) | +5-6% damage | +8% / +10-12% on the capstone |
| Rebirth branches | +6% damage | +8% / +12% on the capstone |

Some end notables also cut a skill's SP cost by 10-15%.

### Weak-skill clusters

Three clusters per region hang off the outer ring, aimed at skills that fall behind:

| Cluster | For | Examples |
|---|---|---|
| Basics | Low-damage starter skills | Bash, Magnum Break, Napalm Beat, Soul Strike, Arrow Shower, Stone Fling, Envenom, Mammonite: damage and cheaper SP, ending in a notable that stacks them |
| Support | Buffs and heals | Heal power and SP cost, plus **skill levels** for Endure, Provoke, Angelus, Blessing, Increase AGI, Safety Wall, Improve Concentration, Cloaking, Enchant Poison, Adrenaline Rush, Over Thrust, Weapon Perfection (a higher level lasts longer) |
| Situational | Skills few people use | Spear Stab, Spear Boomerang, Shield Charge, Turn Undead, Signum Crucis, Decrease AGI, Frost Diver, Fire Wall, Frost Nova, Skid Trap, Sandman, Shockwave Trap, Sand Attack, Intimidate, Venom Splasher, Marine Sphere, Bomb: large damage boosts (+10% per small node, +18-20% on the notable; see the table above) |

The skill-level nodes only work for skills the character already knows and stop at Lv 13 (the same `addtoskill` mechanism as the Blessing nodes, still not confirmed in game).

### Reflex clusters: low-level skills on your attacks

Two short chains per region (on the outer ring, next to the region borders) whose nodes cast a **low-level skill on your normal attacks**: "4% chance to cast Fire Bolt Lv 1 when attacking": 2-4% at Lv 1-2 on the small nodes and 2-3% at Lv 2-5 on the notable at the end of each chain. The casts are free (no SP, cast time or items) and use rAthena's `bAutoSpell`. Skills by region:

| Region | Skills |
|---|---|
| Swordsman | Bash, Magnum Break, Bowling Bash, Pierce, Spear Stab, Shield Boomerang, Spear Boomerang, Holy Cross |
| Acolyte | Holy Light, Finger Offensive, Turn Undead, Investigate |
| Mage | Fire Bolt, Cold Bolt, Lightning Bolt, Napalm Beat, Soul Strike, Fire Ball, Frost Diver, Thunder Storm |
| Archer | Double Strafe, Arrow Repel, Blitz Beat, Arrow Shower, Sharpshooting |
| Thief | Envenom, Sonic Blow, Grimtooth, Sand Attack, Back Stab, Stone Fling, Raid, Intimidate |
| Merchant | Mammonite, Cart Revolution, Hammer Fall, Bomb, Acid Terror, Marine Sphere, Cart Termination |

**Weapon requirements:** an auto-cast only applies while you could use the skill: Double Strafe, Arrow Shower, Arrow Repel and Sharpshooting need a **bow**, Pierce and the Spear skills a **spear**, Sonic Blow and Grimtooth a **katar or dagger**, Shield Boomerang a **shield**, Blitz Beat a **falcon** (the **Falconry** notable on the Archer outer ring gives any class a falcon), Cart Revolution a **cart**, Bash and Cart Termination any weapon except a bow, and so on. The requirement is read from rAthena's skill database and shown in the tooltip ("needs Bow"). It is checked whenever your stats are recalculated (equipping or swapping a weapon, mounting, a falcon or cart change), so the node switches on and off with your gear. Mage skills (Fire Bolt and the other MG_/WZ_ skills) work with any weapon. Mount skills and Wug/Warg states are not checked. The weak-skill "recast" nodes are separate (they repeat a skill you just used, so the weapon is already right).

### Free recasts

17 notables carry a **free recast**: "5% chance to cast Double Strafe again for free (Lv 5) on the same target". When you use the skill, the server (rAthena's `bAutoSpellOnSkill`) casts it a second time on the same target with no SP, no cast time and no items. Chances: **5%** for Double Strafe, Arrow Shower, Napalm Beat, Soul Strike, Holy Light (Lv 1) and Cart Revolution (Lv 1); **4%** for Bash, Magnum Break, Heal, Sonic Blow, Envenom, Mammonite and Pierce; **3%** for Fire, Cold and Lightning Bolt, Sharpshooting (Lv 3), Meteor Assault (Lv 3), Cart Termination and a second Sonic Blow on the Assassin Cross capstone. All other recasts use Lv 5. They sit on the notables of the skill clusters and the Basics clusters, and on some job-line capstones. The recast has a fixed level (shown in the tooltip), not the level of the cast that triggered it, so a character who has the skill below that level gets a small boost. The recast itself does not trigger further recasts.

### Drop rate: small values, small cap

Item drop rate is deliberately tiny: a small drop node gives **+0.1%**, the Prospector / Merchant Prince / Tycoon / Mammon's Blessing notables and the Plunder mastery **+0.05%**, and the Golden Gamble keystone **+1%**, about **2% if you took every one of them**. As a safety net the total is capped by the setting "Most extra item drop rate the tree can give" (2% by default; 0 = none). rAthena only accepts whole percents for this bonus, so the sum is rounded down: nothing applies until you have collected 1%, then it steps up in whole percents. The Active effects list shows your total and what is applied. Cards in sockets are not part of the cap. EXP bonuses are not capped.

### Saved builds (new in 1.1.0)

Each character has up to **5 build slots** (setting "Saved builds per character", 0-5; 0 turns them off). A slot keeps a copy of your tree: the allocated nodes, your mastery choices and the cards in your sockets. The **Builds:** bar under the top bar shows the slots; click one to open its panel:

- **Save the current tree here** (free) - or **Overwrite** a used slot. Give it a name (letters, digits, - and _, up to 16).
- **Load this build** swaps your tree for the saved one. Your socketed cards go back to the inventory, the whole tree is cleared and the saved nodes are taken again; saved cards are socketed again where you still own them. It costs the **swap price** (setting "Swapping to a saved build: price", 50,000 zeny by default, 0 = free), plus the normal socketing price for each card put back in.
- **Rename** and **Delete**. Overwrite, load and delete ask you to click twice, so nothing is lost by accident.

Loading goes through the same rules as clicking nodes, so a build is rebuilt safely: nodes you can no longer take (fewer points than when you saved, a keystone over the limit, another job line, a missing skill requirement) are skipped, and the chat line says how many. A build can only be loaded by a character with the same starting class, and a build saved before a tree layout change (the tree version bump) is marked red and can only be overwritten or deleted. The slot you saved or loaded last is highlighted; it is only a marker, it does not follow later changes you make to the tree.

### Active effects list

A panel on the right of the window lists **everything your passives give you**, summed up: all stat, damage, resistance and skill bonuses (the same effect from many nodes is one line), the skills you learned with skill points, your mastery choices and your socketed cards. Penalties are red. The **Active effects** button in the top bar shows or hides it, and the window remembers your choice.

### Race wagers in front of the outer keystones

The six keystones on the outer ring (Bulwark of Ages, Blood Pact, Gemless Grace, Gambler's Fallacy, Pyre Pact, Glass Cannon) now sit one step further out. Where each used to be there is a plain node, a **wager** on one race: **+5% damage to the race and +5% damage taken from it**. The ring runs through it and the keystone hangs off it, so you take the wager (which also links the two regions) to reach the keystone.

| Wager | Race | Keystone behind it |
|---|---|---|
| Undead Wager | Undead | Bulwark of Ages |
| Demon Wager | Demon | Blood Pact |
| Formless Wager | Formless | Gemless Grace |
| Insect Wager | Insect | Gambler's Fallacy |
| Plant Wager | Plant | Pyre Pact |
| Brute Wager | Brute | Glass Cannon |


### Teleport nodes

Four **Rift** nodes, two linked pairs, let you jump across the tree. Each hangs off an outer-ring node beside a rim keystone and is joined, straight across the tree, to its partner beside the opposite keystone:

| Rift (stat) | Beside | Linked to |
|---|---|---|
| Gemless Rift (+1 INT) | the crit node next to Gemless Grace | Glass Rift |
| Glass Rift (+1 STR) | the stun node next to Glass Cannon | Gemless Rift |
| Bulwark Rift (+1 VIT) | the node next to Bulwark of Ages | Gambler's Rift |
| Gambler's Rift (+1 DEX) | the node next to Gambler's Fallacy | Bulwark Rift |

A path through a pair costs 3 points (neighbour, Rift, Rift) and you keep both stat points. The dashed link between two Rifts only shows once you own it, hover one end, or it is part of the path being previewed; hovering a Rift circles its partner. Blood Pact and Pyre Pact have no Rift (a third pair is easy to add: the table is `PORTALS` in the generator).

### Rebirth branches

On the far outer side of every region, two more branches hang off the outer ring for **reborn** characters: Lord Knight, Paladin, High Priest, Champion, High Wizard, Professor, Sniper, Clown / Gypsy, Assassin Cross, Stalker, Whitesmith and Creator. Each has two skill nodes, a notable and a capstone. They require both the matching job line and being reborn (a High class, not just a second class); the tooltip says "Job line: Lord Knight (reborn Knight)". They concentrate on the skills those classes get and often leave unused (Head Crush, Joint Beat, Chain Crush Combo, Napalm Vulcan, Falcon Assault, Slim Potion Pitcher, Raid...).

### Job-line branches

Each start node grows a short stem with **two branches, one per second class** of that first class: Knight / Crusader, Priest / Monk, Wizard / Sage, Hunter / Bard-Dancer, Assassin / Rogue, Blacksmith / Alchemist. A branch only allocates for characters of that line (third and transcended classes count as their second class). Each has two skill nodes, a notable and a capstone, built around that job's skills.

### Skill points (Skills tab)

Nodes no longer teach skills. Instead:

- **Ten Skill Point nodes** (cyan, with a +) sit on a ring **outside the rest of the tree**, linked to each other. Only **four ways lead in**, at the **north, east, south and west**: a short chain from the outermost node of the tree in that direction. Allocating one costs a passive point like any node and gives **one skill point**.
- A point stays yours once collected, even if you refund the node, so the total can never go above 10 and learned skills are never at risk.
- The window has a second tab, **Skills**, next to **Passive Tree**. A point buys **one level** of **any skill of any class** (Heal, Teleport, Hiding, Bash, Fire Bolt, Sonic Blow ... every class from Novice to the third classes on a renewal server). The list has a class filter, a search box and a "Learned only" switch. **+1** learns the next level, **Max** spends all remaining points on that skill.
- What you learn is **permanent** and survives job changes (it is given with `skill <id>,<lv>,3`). There is no refund.
- A skill you already know at that level cannot be bought again; levels you already have from your class are not charged.
- Skills the tree used to teach from nodes in older versions are **taken back** the first time a character logs in with this version. The nodes keep their stat bonuses.
- The skill-level nodes (Blessing, Increase AGI and the other support clusters) only work for skills the character knows, so learn the skill on the Skills tab first.

## Settings

| Setting | Default |
|---|---|
| Most passive points a character can have | 50 |
| Passive points per job level | 1 |
| Refund price per node (zeny) | 10000 |
| Allow refunds | on |
| Bonus strength (%), scales every number on the tree including the keystone penalties (not the cards) | 100 |
| Most skill points (0-10, 0 = switched off) | 10 |
| Show the PT button in game | on |
| Most keystones a character can take (0 = no limit) | 2 |
| Most extra item drop rate the tree can give (%) | 2 |
| Saved builds per character (0-5) | 5 |
| Swapping to a saved build: price (zeny) | 50000 |
| Card sockets | on |
| Allow MVP cards in sockets | off |
| Socketing price (zeny) | 0 |

Press **Apply** after changing settings; the server restarts. Reload the client after changing the button setting.

## How it works

- Allocated node ids are kept in the permanent character array `PT_nodes`, the start node in `PT_start`, earned points in `PT_earned`, socketed cards in `PT_sn` (node) and `PT_sc` (card).
- The bonuses come from **one permanent `bonus_script`** that calls `F_PT_Bonus` on every stat recalculation. That function reads the character's nodes and runs each node's `bonus` line, then runs `F_PT_Card` for each socketed card. Nothing is cleared when you refund, so it cannot wipe other mods' buffs.
- The window (`client/index.js`) asks the server with `api.server.request('passive', ...)`; the server script (`npc/passive_tree.txt`) validates every allocation, socket and refund, so the window cannot cheat.

## Editing the tree

`tools/build-tree.js` holds the whole design: sector effect pools, the notables, the keystones, the rim clusters and the ring geometry. Edit it, then run `node tools/build-tree.js` from the mod folder. It rewrites `npc/passive_tree.txt`, `client/tree-data.js` and the two card files together (so they always agree), checks that every start can reach every node, and checks every skill name against rAthena's `skill_db.yml` of both eras. It downloads rAthena's item, mob and skill databases once into `tools/.cache` (needs internet; the cache is ignored by git). Never edit the generated files by hand. Ids of existing nodes never change when new nodes are added at the end, so characters keep their allocations; when you rearrange links or ids, bump `TREE_VERSION` (generator, near `KEY_R`) so characters are refunded once.

## Known limits (untested in game)

- The core (allocating, refunding, stats, skill damage boosts, free recasts) has been confirmed in game. Not yet confirmed: card sockets, masteries, job-line and rebirth branches, status-on-hit, drains, regeneration, weapon damage, gemstone-free, the hit cap, teleport rifts and the falcon grant. The script uses `bonus_script` + `callfunc` inside a `bonus_script`, `eaclass()` for the class, and the `@@reply` protocol of the other client-window mods; any of them failing shows in the map log.
- **Skill level nodes** (`addtoskill` from inside the bonus script) are the least certain part: they may not refresh the skill window until a relog, or may not apply at all.
- Card bonuses run through the same bonus script as everything else. A weapon card's effect is applied to the right hand; a second weapon in the left hand does not get it.
- A skill taught to a class that does not normally have it may not show in the browser client's skill window until a relog.
- `bonus bAtk` and `bonus bMatk` (flat ATK and MATK nodes) are read from rAthena's item bonus list; whether they show in the status window the same way in both eras is unchecked.
- Characters that were given passive bonuses and then reborn to a Novice keep the bonuses until they pick a first class again.
- Lowering the "Most passive points" setting below what a character has already spent leaves the allocated nodes in place; it just stops new ones.
- Class mapping for Taekwon, Summoner, Gangsi and Super Novice (centre start) and Gunslinger/Ninja is my choice, not something the game dictates. It is one `switch` in `L_Sync` of the template.
- **Auto-cast nodes** use rAthena's `bAutoSpell` from inside the same bonus script. It is the same command cards use, but it has not been tried from a bonus script here; if a chance never fires, tell me.
- Status-on-hit chances (`bAddEff`) only trigger on weapon attacks, not on spells.
- The "Hard Cap" keystone (`bAbsorbDmgMaxHP2`) uses the official behaviour: a hit above the cap is cut down to it.
- **Skill points** (1.2.0) are new and not yet confirmed in game: please test the outer ring, collecting, learning a skill of another class (it may need a relog before the skill window shows it), and Max.
- **Saved builds** are new in 1.1.0 and not yet confirmed in game. They are stored in character variables (`PT_b<slot>_...`). Loading a build is not atomic: if the server stops halfway the tree may be partly rebuilt (load the slot again).
- A mastery counts as allocated but gives nothing until an option is picked.

## Changelog

- **1.2.0** Nodes no longer teach skills permanently (taken back from existing characters). New **Skills tab**: 10 skill points collected on four-entrance outer ring of the tree, learn any skill of any class. Setting "Nodes can teach skills" replaced by "Most skill points".
- **1.1.0** Up to 5 saved builds per character with a swap price (new settings "Saved builds per character" and "Swapping to a saved build: price").
- **1.0.4** Release made from the final `main` (the 1.0.3 tag pointed at an earlier commit); keystone table rows checked again. No functional change.
- **1.0.3** README brought up to date with the current values (keystones, drop rate, recast and auto-cast chances, skill boost sizes).
- **1.0.2** Default keystone limit lowered from 3 to 2.
- **1.0.1** The README and mod description now say the mod is built mainly for pre-renewal.
- **1.0.0** First public release as Path of Ragnarok (renamed from the working name passive-tree; the mod name, settings and client window id changed, so remove any older passive-tree copy and re-enter your settings). The window now uses the game's own mouse pointer instead of the system one.
