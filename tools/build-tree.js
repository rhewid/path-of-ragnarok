// Builds the passive tree and writes the two files that must agree with each other:
//   npc/passive_tree.txt     (server: adjacency, skill grants, the bonus function)
//   client/tree-data.js      (browser: layout, names, descriptions)
// Run from the mod folder:  node tools/build-tree.js
// Edit the tables below (sectors, notables, keystones), run it, copy the mod over. Never edit the two outputs by hand.

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

// ---------------------------------------------------------------- skill requirements --
// Auto-cast nodes should only fire when the skill could really be used: the weapon (and shield, falcon, cart, mount) the skill
// needs, read from rAthena's skill_db.yml (tools/.cache, downloaded by the first full run). Weapons are unioned over both eras.
const WEAPON_CONST = { fist: 'W_FIST', dagger: 'W_DAGGER', '1hsword': 'W_1HSWORD', '2hsword': 'W_2HSWORD', '1hspear': 'W_1HSPEAR', '2hspear': 'W_2HSPEAR',
	'1haxe': 'W_1HAXE', '2haxe': 'W_2HAXE', mace: 'W_MACE', '2hmace': 'W_2HMACE', staff: 'W_STAFF', '2hstaff': 'W_2HSTAFF', bow: 'W_BOW', knuckle: 'W_KNUCKLE',
	musical: 'W_MUSICAL', whip: 'W_WHIP', book: 'W_BOOK', katar: 'W_KATAR', revolver: 'W_REVOLVER', rifle: 'W_RIFLE', gatling: 'W_GATLING', shotgun: 'W_SHOTGUN', grenade: 'W_GRENADE', huuma: 'W_HUUMA' };
const WEAPON_LABEL = { fist: 'bare hands', dagger: 'Dagger', '1hsword': '1H Sword', '2hsword': '2H Sword', '1hspear': 'Spear', '2hspear': '2H Spear', '1haxe': 'Axe', '2haxe': '2H Axe', mace: 'Mace',
	'2hmace': '2H Mace', staff: 'Staff', '2hstaff': '2H Staff', bow: 'Bow', knuckle: 'Knuckle', musical: 'Instrument', whip: 'Whip', book: 'Book', katar: 'Katar' };
const STATE_CODE = { falcon: ['checkfalcon()', 'Falcon'], cart: ['checkcart()', 'Cart'], shield: ['.@shield', 'Shield'], riding: ['checkriding()', 'Mount'], peco: ['checkriding()', 'Mount'] };
const WEAPON_EXTRA = { AS_SONICBLOW: ['dagger'], AS_GRIMTOOTH: ['dagger'] };
const skillReqCache = new Map();
function skillReq(name) {
	if (skillReqCache.has(name)) return skillReqCache.get(name);
	const weapons = new Set();
	let state = '';
	for (const era of ['pre-re', 're']) {
		const file = path.join(__dirname, '.cache', `skill_db_${era}.yml`);
		if (!fs.existsSync(file)) throw new Error('tools/.cache is empty: run  node tools/build-tree.js  once with internet, or copy the cache');
		const text = fs.readFileSync(file, 'utf8');
		const at = text.indexOf(`\n    Name: ${name}\n`);
		if (at < 0) continue;
		const end = text.indexOf('\n  - Id: ', at);
		const block = text.slice(at, end < 0 ? undefined : end);
		const req = /\n    Requires:\n([\s\S]*?)(?=\n    \S|$)/.exec(block);
		if (!req) continue;
		const w = /\n      Weapon:\n((?:        \S.*\n?)+)/.exec(req[1] + '\n');
		if (w) for (const m of w[1].matchAll(/^        (\w+): true/gm)) weapons.add(m[1].toLowerCase());
		const st = /\n      State: (\w+)/.exec(req[1]);
		if (st && !state) state = st[1].toLowerCase();
	}
	// house rules: daggers can use Sonic Blow and Grimtooth; mage skills work with any weapon
	for (const w of WEAPON_EXTRA[name] || []) weapons.add(w);
	const free = /^(MG|WZ|SA)_/.test(name);
	const result = { weapons: weapons.has('all') || free ? [] : [...weapons], state: STATE_CODE[state] && !free ? state : '' };
	skillReqCache.set(name, result);
	return result;
}
/** "if (...) " for the skill's requirements, or "" when it has none. Needs .@w, .@shield set up by F_PT_Bonus. */
function gate(name) {
	const r = skillReq(name);
	const parts = [];
	if (r.weapons.length) parts.push('(' + r.weapons.map(w => `.@w == ${WEAPON_CONST[w]}`).join(' || ') + ')');
	if (r.state) parts.push(STATE_CODE[r.state][0]);
	return parts.length ? `if (${parts.join(' && ')}) ` : '';
}
/** " (needs a Bow, Falcon)" for the tooltip, or "". */
function gateText(name) {
	const r = skillReq(name);
	// a long list of weapons reads better as what is left out
	if (r.weapons.length > 8 && !r.state) {
		const missing = Object.keys(WEAPON_LABEL).filter(w => !r.weapons.includes(w) && w !== 'fist').map(w => WEAPON_LABEL[w]);
		return missing.length ? ` (not with ${[...new Set(missing)].join(', ')})` : '';
	}
	const bits = [...new Set(r.weapons.map(w => WEAPON_LABEL[w] || w))];
	if (r.state) bits.push(STATE_CODE[r.state][1]);
	return bits.length ? ` (needs ${bits.join(' or ')})` : '';
}

// rAthena stores skill data for levels 1-13 (MAX_SKILL_LEVEL) and extends linear tables (durations, effect sizes) past a skill's own
// maximum, so a +level node may carry a skill beyond its maximum up to this level.
const SKILL_LEVEL_CAP = 13;

// ---------------------------------------------------------------- effects --
// An effect is { name, text, v, mul, c(S) }.  `text` is shown in the tooltip ({s} = sign, {v} = scaled size).
// `c(S)` returns the rAthena bonus line; S(n) wraps a base number in the "value multiplier" setting.
// `mul` is the unit factor between the number shown and the number the server command takes
// (carry weight is in tenths, status resistance in hundredths of a percent).
const M = (name, text, fn, mul = 1) => (v, ...p) => ({
	name: typeof name === 'function' ? name(...p) : name,
	text: typeof text === 'function' ? text(...p) : text,
	v, mul, c: S => fn(S, v, ...p),
});
const FLAG = (name, text, code) => () => ({ name, text, v: 0, mul: 1, flag: true, c: () => code });

const C = {
	str: M('Strength', '{s}{v} STR', (S, v) => `bonus bStr,${S(v)};`),
	agi: M('Agility', '{s}{v} AGI', (S, v) => `bonus bAgi,${S(v)};`),
	vit: M('Vitality', '{s}{v} VIT', (S, v) => `bonus bVit,${S(v)};`),
	int: M('Intelligence', '{s}{v} INT', (S, v) => `bonus bInt,${S(v)};`),
	dex: M('Dexterity', '{s}{v} DEX', (S, v) => `bonus bDex,${S(v)};`),
	luk: M('Luck', '{s}{v} LUK', (S, v) => `bonus bLuk,${S(v)};`),
	all: M('All Stats', '{s}{v} to all stats', (S, v) => `bonus bAllStats,${S(v)};`),
	hp: M('Max HP', '{s}{v} Max HP', (S, v) => `bonus bMaxHP,${S(v)};`),
	hpp: M('Max HP', '{s}{v}% Max HP', (S, v) => `bonus bMaxHPrate,${S(v)};`),
	sp: M('Max SP', '{s}{v} Max SP', (S, v) => `bonus bMaxSP,${S(v)};`),
	spp: M('Max SP', '{s}{v}% Max SP', (S, v) => `bonus bMaxSPrate,${S(v)};`),
	atk: M('Attack', '{s}{v} ATK', (S, v) => `bonus bAtk,${S(v)};`),
	matk: M('Magic Attack', '{s}{v} MATK', (S, v) => `bonus bMatk,${S(v)};`),
	matkp: M('Magic Attack', '{s}{v}% MATK', (S, v) => `bonus bMatkRate,${S(v)};`),
	dmg: M('Damage', '{s}{v}% physical damage', (S, v) => `bonus2 bAddRace,RC_All,${S(v)};`),
	mdmg: M('Magic Damage', '{s}{v}% magic damage', (S, v) => `bonus2 bMagicAddRace,RC_All,${S(v)};`),
	ranged: M('Ranged Damage', '{s}{v}% ranged attack damage', (S, v) => `bonus bLongAtkRate,${S(v)};`),
	melee: M('Melee Damage', '{s}{v}% melee attack damage', (S, v) => `bonus bShortAtkRate,${S(v)};`),
	boss: M('Boss Slayer', '{s}{v}% damage to bosses', (S, v) => `bonus2 bAddClass,Class_Boss,${S(v)};`),
	critdmg: M('Critical Damage', '{s}{v}% critical damage', (S, v) => `bonus bCritAtkRate,${S(v)};`),
	ignoredef: M('Armor Piercing', 'Ignore {v}% of enemy DEF', (S, v) => `bonus2 bIgnoreDefRaceRate,RC_All,${S(v)};`),
	ignoremdef: M('Spell Piercing', 'Ignore {v}% of enemy MDEF', (S, v) => `bonus2 bIgnoreMdefRaceRate,RC_All,${S(v)};`),
	def: M('Defense', '{s}{v} DEF', (S, v) => `bonus bDef,${S(v)};`),
	mdef: M('Magic Defense', '{s}{v} MDEF', (S, v) => `bonus bMdef,${S(v)};`),
	hit: M('Accuracy', '{s}{v} HIT', (S, v) => `bonus bHit,${S(v)};`),
	flee: M('Evasion', '{s}{v} FLEE', (S, v) => `bonus bFlee,${S(v)};`),
	flee2: M('Perfect Dodge', '{s}{v} Perfect Dodge', (S, v) => `bonus bFlee2,${S(v * 10)};`, 10),
	crit: M('Critical', '{s}{v} CRIT', (S, v) => `bonus bCritical,${S(v)};`),
	aspd: M('Attack Speed', '{s}{v}% attack speed', (S, v) => `bonus bAspdRate,${S(v)};`),
	double: M('Double Attack', '{s}{v}% double attack chance', (S, v) => `bonus bDoubleAddRate,${S(v)};`),
	speed: M('Movement', '{s}{v}% movement speed', (S, v) => `bonus bSpeedAddRate,${S(v)};`),
	cast: M('Cast Time', '-{v}% cast time', (S, v) => `bonus bCastrate,${S(-v)};`),
	castup: M('Cast Time', '+{v}% cast time', (S, v) => `bonus bCastrate,${S(v)};`),
	delay: M('Skill Delay', '-{v}% after-cast delay', (S, v) => `bonus bDelayrate,${S(-v)};`),
	spcost: M('SP Cost', '-{v}% skill SP cost', (S, v) => `bonus bUseSPrate,${S(-v)};`),
	hpr: M('HP Recovery', '{s}{v}% natural HP recovery', (S, v) => `bonus bHPrecovRate,${S(v)};`),
	spr: M('SP Recovery', '{s}{v}% natural SP recovery', (S, v) => `bonus bSPrecovRate,${S(v)};`),
	heal: M('Healing Power', '{s}{v}% healing skill power', (S, v) => `bonus bHealPower,${S(v)};`),
	healin: M('Healing Received', '{s}{v}% healing received from skills', (S, v) => `bonus bHealPower2,${S(v)};`),
	potion: M('Potion Efficiency', '{s}{v}% HP restored by items', (S, v) => `bonus bAddItemHealRate,${S(v)};`),
	spotion: M('Potion Efficiency', '{s}{v}% SP restored by items', (S, v) => `bonus bAddItemSPHealRate,${S(v)};`),
	hpgain: M('Bloodlust', '+{v} HP when you kill with a melee attack', (S, v) => `bonus bHPGainValue,${S(v)};`),
	spgain: M('Mana Siphon', '+{v} SP when you kill with a melee attack', (S, v) => `bonus bSPGainValue,${S(v)};`),
	reduce: M('Damage Reduction', '-{v}% damage taken from everything', (S, v) => `bonus2 bSubRace,RC_All,${S(v)};`),
	reflect: M('Thorns', 'Reflect {v}% of melee damage taken', (S, v) => `bonus bShortWeaponDamageReturn,${S(v)};`),
	critdef: M('Critical Defense', '-{v}% chance to be critically hit', (S, v) => `bonus bCriticalDef,${S(v)};`),
	unbreak: M('Sturdy Gear', '-{v}% equipment break chance', (S, v) => `bonus bUnbreakable,${S(v)};`),
	steal: M('Light Fingers', '+{v}% steal success', (S, v) => `bonus bAddStealRate,${S(v * 100)};`, 100),
	weight: M('Carry Weight', '{s}{v} weight limit', (S, v) => `bonus bAddMaxWeight,${S(v * 10)};`, 10),
	exp: M('Experience', '{s}{v}% EXP from monsters', (S, v) => `bonus2 bExpAddRace,RC_All,${S(v)};`),
	// every drop bonus on the tree adds into one total (.@drop) that F_PT_Bonus caps once at the end (setting max_drop_bonus, 2% by default)
	drop: M('Drop Rate', '{s}{v}% monster item drop rate (all drop bonuses on the tree share one cap)', (S, v) => `.@drop += ${S(v * 100)};`, 100),
	// parametric: (v, constant, display name)
	rele: M((e, n) => n + ' Ward', (e, n) => '{s}{v}% ' + n + ' resistance', (S, v, e) => `bonus2 bSubEle,${e},${S(v)};`),
	takemorerace: M((e, n) => n + ' Wager', (e, n) => '+{v}% damage taken from ' + n, (S, v, e) => `bonus2 bSubRace,${e},${S(-v)};`),
	rrace: M((e, n) => n + ' Ward', (e, n) => '-{v}% damage from ' + n, (S, v, e) => `bonus2 bSubRace,${e},${S(v)};`),
	reff: M((e, n) => n + ' Ward', (e, n) => '+{v}% ' + n + ' resistance', (S, v, e) => `bonus2 bResEff,${e},${S(v * 100)};`, 100),
	vsrace: M((e, n) => n + ' Hunter', (e, n) => '+{v}% damage to ' + n, (S, v, e) => `bonus2 bAddRace,${e},${S(v)};`),
	vsele: M((e, n) => n + ' Hunter', (e, n) => '+{v}% damage to ' + n + ' element', (S, v, e) => `bonus2 bAddEle,${e},${S(v)};`),
	vssize: M((e, n) => n + ' Hunter', (e, n) => '+{v}% damage to ' + n + ' monsters', (S, v, e) => `bonus2 bAddSize,${e},${S(v)};`),
	mele: M((e, n) => n + ' Magic', (e, n) => '+{v}% ' + n + ' magic damage', (S, v, e) => `bonus2 bMagicAtkEle,${e},${S(v)};`),
	noflinch: FLAG('Unflinching', 'Cannot be flinched when hit (endless Endure)', 'bonus bNoWalkDelay;'),
	nocancel: FLAG('Unbroken Focus', 'Casting cannot be interrupted', 'bonus bNoCastCancel;'),
	mvsrace: M((e, n) => n + ' Magic', (e, n) => '+{v}% magic damage to ' + n, (S, v, e) => `bonus2 bMagicAddRace,${e},${S(v)};`),
	mvsize: M((e, n) => n + ' Magic', (e, n) => '+{v}% magic damage to ' + n + ' monsters', (S, v, e) => `bonus2 bMagicAddSize,${e},${S(v)};`),
	mvsele: M((e, n) => n + ' Magic', (e, n) => '+{v}% magic damage to ' + n + ' element', (S, v, e) => `bonus2 bMagicAddEle,${e},${S(v)};`),
	// skill specific: (v, AegisName, display name)
	skatk: M((e, n) => n, (e, n) => '+{v}% ' + n + ' damage', (S, v, e) => `bonus2 bSkillAtk,"${e}",${S(v)};`),
	skheal: M((e, n) => n, (e, n) => '+{v}% ' + n + ' healing', (S, v, e) => `bonus2 bSkillHeal,"${e}",${S(v)};`),
	sksp: M((e, n) => n, (e, n) => '-{v}% ' + n + ' SP cost', (S, v, e) => `bonus2 bSkillUseSPrate,"${e}",${S(v)};`),
	skcast: M((e, n) => n, (e, n) => '-{v}% ' + n + ' cast time', (S, v, e) => `bonus2 bCastrate,"${e}",${S(-v)};`),
	skcd: M((e, n) => n, (e, n) => '-{v}s ' + n + ' cooldown', (S, v, e) => `bonus2 bSkillCooldown,"${e}",${S(-v * 1000)};`, 1000),
	// skill level: (v, id, max level, display name). Only if the character already knows the skill.
	sklv: M((i, m, n) => n, (i, m, n) => '+{v} level to ' + n + ' (if learned; goes past the skill maximum, up to Lv 13; lasts longer)',
		(S, v, id) => `.@l = getskilllv(${id}); if (.@l > 0 && .@l < ${SKILL_LEVEL_CAP}) addtoskill ${id},min(${SKILL_LEVEL_CAP}-.@l,${S(v)});`),
	truesight: FLAG('True Sight', 'See hidden and cloaked units', 'bonus bIntravision;'),
	nogem: FLAG('Gemstone Free', 'Skills need no gemstones', 'bonus bNoGemStone;'),
	noknock: FLAG('Immovable', 'Cannot be knocked back', 'bonus bNoKnockback;'),
	nostrip: FLAG('Unstrippable', 'Equipment cannot be stripped', 'bonus bUnstripable;'),
	fullrevive: FLAG('Second Wind', 'Revive with full HP and SP', 'bonus bRestartFullRecover;'),
	// on hit / on being hit: chances are n/100 % in the server, shown as whole percent (mul 100)
	addeff: M((e, n) => n + ' Strike', (e, n) => '+{v}% chance to inflict ' + n + ' when attacking', (S, v, e) => `bonus2 bAddEff,${e},${S(v * 100)};`, 100),
	addeffhit: M((e, n) => n + ' Thorns', (e, n) => '+{v}% chance to inflict ' + n + ' on whoever hits you', (S, v, e) => `bonus2 bAddEffWhenHit,${e},${S(v * 100)};`, 100),
	// auto-cast: (v = % chance, skill AegisName, level, display name); the server takes tenths of a percent
	autospell: M((e, l, n) => n + ' Reflex', (e, l, n) => '{v}% chance to cast ' + n + ' Lv ' + l + ' when attacking' + gateText(e), (S, v, e, l) => `${gate(e)}bonus3 bAutoSpell,"${e}",${l},${S(v * 10)};`, 10),
	// free recast: (v = % chance, skill AegisName, level of the free cast, display name). Uses bAutoSpellOnSkill: when the skill is used, the same skill
	// is cast again on the same target with no SP, no cast time and no items.
	recast: M((e, l, n) => n + ' Echo', (e, l, n) => '{v}% chance to cast ' + n + ' again for free (Lv ' + l + ') on the same target', (S, v, e, l) => `bonus4 bAutoSpellOnSkill,"${e}","${e}",${l},${S(v * 10)};`, 10),
	autospellhit: M((e, l, n) => n + ' Reprisal', (e, l, n) => '{v}% chance to cast ' + n + ' Lv ' + l + ' on whoever hits you', (S, v, e, l) => `bonus3 bAutoSpellWhenHit,"${e}",${l},${S(v * 10)};`, 10),
	// drain: (v = % chance, drained percent of the damage)
	hpdrain: M('Life Drain', (p) => '{v}% chance to drain ' + p + '% of damage as HP', (S, v, p) => `bonus2 bHPDrainRate,${S(v * 10)},${p};`, 10),
	spdrain: M('Mana Drain', (p) => '{v}% chance to drain ' + p + '% of damage as SP', (S, v, p) => `bonus2 bSPDrainRate,${S(v * 10)},${p};`, 10),
	regenhp: M('Regeneration', (ms) => '+{v}% Max HP every ' + ms / 1000 + 's', (S, v, ms) => `bonus2 bRegenPercentHP,${S(v)},${ms};`),
	regensp: M('Meditation', (ms) => '+{v}% Max SP every ' + ms / 1000 + 's', (S, v, ms) => `bonus2 bRegenPercentSP,${S(v)},${ms};`),
	submelee: M('Melee Guard', '-{v}% damage from melee attacks', (S, v) => `bonus bNearAtkDef,${S(v)};`),
	subranged: M('Ranged Guard', '-{v}% damage from ranged attacks', (S, v) => `bonus bLongAtkDef,${S(v)};`),
	submagic: M('Spell Guard', '-{v}% damage from magic', (S, v) => `bonus bMagicAtkDef,${S(v)};`),
	critdefrate: M('Critical Guard', '-{v}% critical damage taken', (S, v) => `bonus bCritDefRate,${S(v)};`),
	reflectmagic: M('Spell Mirror', '{v}% chance to reflect spells aimed at you', (S, v) => `bonus bMagicDamageReturn,${S(v)};`),
	hitcap: M('Hard Cap', 'A single hit can take at most {v}% of your Max HP', (S, v) => `bonus bAbsorbDmgMaxHP2,${S(v)};`),
	takemore: M('Glass', '+{v}% damage taken from everything', (S, v) => `bonus2 bSubRace,RC_All,${S(-v)};`),
	zeny: M('Zeny on Kill', z => '{v}% chance of up to ' + z + ' zeny per kill', (S, v, z) => `bonus2 bGetZenyNum,${z},${S(v)};`),
	// weapon types: (v, W_ constant, display name)
	wdmg: M((e, n) => n + ' Mastery', (e, n) => '+{v}% damage with ' + n + ' (normal attacks)', (S, v, e) => `bonus2 bWeaponDamageRate,${e},${S(v)};`),
	watk: M((e, n) => n + ' Edge', (e, n) => '+{v} ATK with ' + n, (S, v, e) => `bonus2 bWeaponAtk,${e},${S(v)};`),
	atkele: M((e, n) => n + ' Weapon', (e, n) => 'Your attacks become ' + n + ' element', (S, v, e) => `bonus bAtkEle,${e};`),
};

// ---------------------------------------------------------------- the tree --
const SECTORS = [
	{ name: 'Swordsman', stat: 'str', color: '#e0563f' },
	{ name: 'Acolyte', stat: 'vit', color: '#e6c14a' },
	{ name: 'Mage', stat: 'int', color: '#4aa3e6' },
	{ name: 'Archer', stat: 'dex', color: '#5fbf5f' },
	{ name: 'Thief', stat: 'agi', color: '#9a74e0' },
	{ name: 'Merchant', stat: 'luk', color: '#e08fd0' },
];

// small-node pools: sm(key, [tier0, tier1, tier2, tier3], ...params). Tier 0 is the outer ring, 3 the inner one.
const sm = (key, vals, ...p) => t => [key, vals[t], ...p];
const POOL = [
	[sm('str', [1, 1, 2, 2]), sm('hp', [40, 70, 100, 140]), sm('atk', [3, 5, 7, 10]), sm('def', [1, 2, 3, 4]),
		sm('hit', [3, 5, 7, 9]), sm('dmg', [1, 1, 2, 2]), sm('hpr', [3, 4, 6, 8]), sm('hpp', [1, 1, 2, 2])],
	[sm('vit', [1, 1, 2, 2]), sm('hpp', [1, 1, 2, 2]), sm('mdef', [1, 2, 3, 4]), sm('heal', [2, 3, 4, 6]),
		sm('spp', [1, 1, 2, 2]), sm('potion', [3, 4, 6, 8]), sm('reff', [2, 3, 4, 6], 'Eff_Stun', 'Stun'), sm('rrace', [1, 1, 2, 2], 'RC_Undead', 'Undead')],
	[sm('int', [1, 1, 2, 2]), sm('sp', [8, 12, 18, 25]), sm('matkp', [1, 1, 2, 2]), sm('matk', [3, 5, 7, 10]),
		sm('cast', [1, 1, 2, 2]), sm('spr', [3, 4, 6, 8]), sm('mdmg', [1, 1, 2, 2]), sm('spcost', [1, 1, 2, 2])],
	[sm('dex', [1, 1, 2, 2]), sm('hit', [4, 6, 8, 10]), sm('atk', [3, 5, 7, 10]), sm('crit', [1, 2, 3, 4]),
		sm('aspd', [1, 1, 1, 2]), sm('dmg', [1, 1, 2, 2]), sm('ranged', [1, 1, 2, 2]), sm('critdmg', [2, 3, 4, 6])],
	[sm('agi', [1, 1, 2, 2]), sm('flee', [3, 5, 7, 10]), sm('aspd', [1, 1, 1, 2]), sm('crit', [1, 2, 3, 4]),
		sm('flee2', [1, 1, 2, 2]), sm('speed', [1, 1, 2, 2]), sm('double', [1, 1, 2, 2]), sm('critdef', [2, 3, 4, 6])],
	[sm('luk', [1, 1, 2, 2]), sm('weight', [100, 150, 200, 300]), sm('exp', [1, 1, 1, 2]), sm('drop', [0.1, 0.1, 0.1, 0.1]),
		sm('hp', [40, 70, 100, 140]), sm('potion', [3, 4, 6, 8]), sm('steal', [2, 3, 4, 5]), sm('crit', [1, 2, 3, 4])],
];
// shared by sector s and s+1 (the first/last slot of every ring and the spokes next to them)
const BOUND = [
	[sm('hpp', [1, 1, 2, 2]), sm('def', [1, 2, 3, 4]), sm('hp', [40, 70, 100, 140]), sm('hpr', [3, 4, 6, 8])],
	[sm('sp', [8, 12, 18, 25]), sm('spp', [1, 1, 2, 2]), sm('heal', [2, 3, 4, 6]), sm('mdef', [1, 2, 3, 4])],
	[sm('matkp', [1, 1, 2, 2]), sm('dex', [1, 1, 2, 2]), sm('cast', [1, 1, 2, 2]), sm('hit', [4, 6, 8, 10])],
	[sm('crit', [1, 2, 3, 4]), sm('flee', [3, 5, 7, 10]), sm('aspd', [1, 1, 1, 2]), sm('hit', [4, 6, 8, 10])],
	[sm('flee', [3, 5, 7, 10]), sm('speed', [1, 1, 2, 2]), sm('drop', [0.1, 0.1, 0.1, 0.1]), sm('steal', [2, 3, 4, 5])],
	[sm('weight', [100, 150, 200, 300]), sm('atk', [3, 5, 7, 10]), sm('dmg', [1, 1, 2, 2]), sm('str', [1, 1, 2, 2])],
];

// notables, per sector, in ring order: ring 4 (outer) x2, ring 3 x2, ring 2 x2, ring 1 x2
// { n: name, fx: [[key, v, ...params]] }
const NOTABLE = [
	[ // Swordsman
		{ n: 'Sword Drills', fx: [['str', 3], ['atk', 8]] },
		{ n: 'Thick Hide', fx: [['hp', 150], ['def', 3]] },
		{ n: "Veteran's Stance", fx: [['hpp', 4], ['hpr', 8]] },
		{ n: 'Cleaving Blows', fx: [['dmg', 4], ['vssize', 6, 'Size_Large', 'Large']] },
		{ n: 'Giant Slayer', fx: [['boss', 8], ['ignoredef', 8]] },
		{ n: 'Unshakable', fx: [['reduce', 4], ['reff', 12, 'Eff_Stun', 'Stun']] },
		{ n: "Warlord's Might", fx: [['str', 4], ['vit', 2], ['dmg', 5]] },
		{ n: 'Bloodied, Unbowed', fx: [['hpp', 6], ['hpgain', 8]] },
	],
	[ // Acolyte
		{ n: 'Lay on Hands', fx: [['heal', 8], ['vit', 2]] },
		{ n: 'Pious Shield', fx: [['mdef', 4], ['hpp', 3]] },
		{ n: 'Blessed Warding', fx: [['rrace', 6, 'RC_Undead', 'Undead'], ['rrace', 6, 'RC_Demon', 'Demon']] },
		{ n: "Healer's Touch", fx: [['heal', 10], ['healin', 8]] },
		{ n: 'Cleansing Light', fx: [['reff', 20, 'Eff_Curse', 'Curse'], ['reff', 20, 'Eff_Silence', 'Silence']] },
		{ n: 'Angelic Boons', fx: [['spp', 4], ['spotion', 8]] },
		{ n: "Martyr's Resolve", fx: [['hpp', 6], ['reduce', 4]] },
		{ n: 'Sanctuary Keeper', fx: [['heal', 12], ['hpr', 12], ['potion', 10]] },
	],
	[ // Mage
		{ n: 'Arcane Studies', fx: [['int', 3], ['matk', 8]] },
		{ n: 'Mana Well', fx: [['sp', 40], ['spr', 8]] },
		{ n: 'Focused Mind', fx: [['cast', 5], ['matkp', 3]] },
		{ n: 'Elemental Affinity', fx: [['mele', 6, 'Ele_Fire', 'Fire'], ['mele', 6, 'Ele_Water', 'Water'], ['mele', 6, 'Ele_Wind', 'Wind'], ['mele', 6, 'Ele_Earth', 'Earth']] },
		{ n: 'Mind Over Matter', fx: [['spp', 5], ['spcost', 5]] },
		{ n: 'Third Eye', fx: [['truesight']] },
		{ n: "Archmage's Focus", fx: [['matkp', 6], ['int', 4], ['ignoremdef', 8]] },
		{ n: 'Blink', fx: [['cast', 4], ['spp', 3]] },
	],
	[ // Archer
		{ n: 'Steady Aim', fx: [['dex', 3], ['hit', 8]] },
		{ n: 'Quick Draw', fx: [['aspd', 2], ['crit', 3]] },
		{ n: "Hawk's Eye", fx: [['crit', 4], ['hit', 10]] },
		{ n: 'Marksman', fx: [['ranged', 6], ['dmg', 3]] },
		{ n: 'Beast Hunter', fx: [['vsrace', 6, 'RC_Brute', 'Brute'], ['vsrace', 6, 'RC_Insect', 'Insect'], ['vsrace', 6, 'RC_Plant', 'Plant']] },
		{ n: 'Piercing Arrows', fx: [['ignoredef', 8], ['critdmg', 8]] },
		{ n: 'Eagle Eye', fx: [['dex', 4], ['agi', 2], ['ranged', 8]] },
		{ n: 'Steady Hands', fx: [['aspd', 3], ['cast', 3]] },
	],
	[ // Thief
		{ n: 'Nimble Feet', fx: [['agi', 3], ['flee', 8]] },
		{ n: 'Light Fingers', fx: [['steal', 10], ['luk', 1]] },
		{ n: 'Veil of Shadows', fx: [['speed', 4], ['flee', 6]] },
		{ n: 'Venom Training', fx: [['reff', 30, 'Eff_Poison', 'Poison'], ['agi', 1]] },
		{ n: 'Deadly Edge', fx: [['crit', 6], ['critdmg', 10]] },
		{ n: 'Lightning Reflexes', fx: [['aspd', 4], ['flee', 10]] },
		{ n: 'Phantom Strikes', fx: [['double', 6], ['flee2', 3]] },
		{ n: 'Evasive Maneuvers', fx: [['flee2', 4], ['speed', 6], ['critdef', 10]] },
	],
	[ // Merchant
		{ n: 'Haggler', fx: [['luk', 3]] },
		{ n: "Appraiser's Eye", fx: [['luk', 2], ['weight', 200]] },
		{ n: 'Peddler', fx: [['weight', 300], ['potion', 6]] },
		{ n: 'Prospector', fx: [['drop', 0.05], ['exp', 3]] },
		{ n: 'Market Savvy', fx: [['potion', 15], ['spotion', 10], ['weight', 300]] },
		{ n: "Fortune's Favour", fx: [['luk', 4], ['flee2', 3], ['crit', 4]] },
		{ n: 'Tycoon', fx: [['exp', 4], ['drop', 0.05], ['luk', 3]] },
		{ n: "Mammon's Blessing", fx: [['exp', 5], ['drop', 0.05], ['weight', 400]] },
	],
];

// keystones sit between sector s and s+1
const KEYSTONE = [
	{ n: 'Iron Vow', fx: [['noflinch'], ['reduce', 15], ['aspd', -15]] },
	{ n: 'Sanctified Mind', fx: [['nocancel'], ['heal', 30], ['dmg', -25]] },
	{ n: 'Overchannel', fx: [['matkp', 30], ['castup', 25], ['hpp', -20]] },
	{ n: 'Deadeye', fx: [['ranged', 25], ['hit', 30], ['melee', -30]] },
	{ n: 'Phantom Gambit', fx: [['aspd', 20], ['flee2', 4], ['hpp', -25]] },
	{ n: 'Golden Gamble', fx: [['exp', 20], ['drop', 1], ['dmg', -20]] },
];

const GATEWAY = [['hp', 100], ['sp', 20], ['hp', 100], ['sp', 20], ['hp', 100], ['sp', 20]];

// ring geometry: radius, slots per sector, degrees between slots, notable slots
const RING = [
	null,
	{ r: 210, n: 5, step: 10, notable: [1, 3] },   // ring 1 (inner)
	{ r: 340, n: 7, step: 7.5, notable: [1, 5] },
	{ r: 470, n: 9, step: 6, notable: [2, 6] },
	{ r: 600, n: 11, step: 5, notable: [2, 8] },   // ring 4 (outer)
];
// spokes: [slot in outer ring, slot in inner ring] between ring k and ring k-1
const SPOKES = { 4: [[2, 1], [5, 4], [8, 7]], 3: [[1, 0], [4, 3], [7, 6]], 2: [[1, 0], [5, 4]] };
const KEY_R = 125, GATE_R = 62;
// bump when node ids or links change: characters are refunded once (free) so no allocation is left dangling
const TREE_VERSION = 4;

// ---------------------------------------------------------------- satellite clusters --
// Each sector grows four clusters on the outer rim, hung off ring-4 slots 1, 3, 7 and 9.
//   skill  (slot 1): 3 skill nodes + a notable          diamond, 4 nodes
//   resist (slot 3): 4 resistance nodes + a notable     diamond, 5 nodes
//   vs     (slot 7): 4 "damage against" nodes + notable diamond, 5 nodes
//   socket (slot 9): 2 skill nodes + a CARD SOCKET      chain, 3 nodes
// Tokens are [effect key, value, ...params] like everywhere above. Skill tokens carry the AegisName from skill_db.yml.
const CLUSTER = [
	{ // Swordsman
		skill: { small: [['skatk', 4, 'SM_BASH', 'Bash'], ['skatk', 4, 'SM_MAGNUM', 'Magnum Break'], ['skatk', 4, 'KN_BOWLINGBASH', 'Bowling Bash']],
			end: { n: 'Heavy Strikes', fx: [['recast', 4, 'SM_BASH', 5, 'Bash'], ['skatk', 8, 'SM_BASH', 'Bash'], ['skatk', 8, 'SM_MAGNUM', 'Magnum Break'], ['sksp', 10, 'SM_BASH', 'Bash']] } },
		resist: { small: [['rele', 3, 'Ele_Fire', 'Fire'], ['rrace', 3, 'RC_DemiHuman', 'Demi-Human'], ['rele', 3, 'Ele_Earth', 'Earth'], ['rrace', 3, 'RC_Brute', 'Brute']],
			end: { n: "Veteran's Plate", fx: [['rele', 8, 'Ele_Neutral', 'Neutral'], ['rrace', 6, 'RC_Formless', 'Formless']] } },
		vs: { small: [['vsrace', 3, 'RC_DemiHuman', 'Demi-Human'], ['vsrace', 3, 'RC_Brute', 'Brute'], ['vsele', 3, 'Ele_Wind', 'Wind'], ['vsele', 3, 'Ele_Earth', 'Earth']],
			end: { n: 'Man-at-Arms', fx: [['vsrace', 6, 'RC_DemiHuman', 'Demi-Human'], ['vssize', 6, 'Size_Large', 'Large'], ['boss', 4]] } },
		socket: { small: [['skatk', 4, 'CR_HOLYCROSS', 'Holy Cross'], ['skatk', 4, 'CR_SHIELDCHARGE', 'Shield Charge']] },
	},
	{ // Acolyte
		skill: { small: [['skheal', 5, 'AL_HEAL', 'Heal'], ['skatk', 4, 'AL_HOLYLIGHT', 'Holy Light'], ['skatk', 4, 'MO_TRIPLEATTACK', 'Triple Attack']],
			end: { n: 'Merciful Prayer', fx: [['recast', 4, 'AL_HEAL', 5, 'Heal'], ['skheal', 12, 'AL_HEAL', 'Heal'], ['sksp', 10, 'AL_HEAL', 'Heal'], ['skatk', 8, 'AL_HOLYLIGHT', 'Holy Light']] } },
		resist: { small: [['rele', 3, 'Ele_Holy', 'Holy'], ['rele', 3, 'Ele_Dark', 'Shadow'], ['rrace', 3, 'RC_Undead', 'Undead'], ['rrace', 3, 'RC_Demon', 'Demon']],
			end: { n: 'Sanctified Aegis', fx: [['rele', 8, 'Ele_Undead', 'Undead'], ['rrace', 6, 'RC_Angel', 'Angel']] } },
		vs: { small: [['vsrace', 3, 'RC_Undead', 'Undead'], ['vsrace', 3, 'RC_Demon', 'Demon'], ['vsele', 3, 'Ele_Dark', 'Shadow'], ['vsele', 3, 'Ele_Undead', 'Undead']],
			end: { n: 'Exorcist', fx: [['vsrace', 7, 'RC_Undead', 'Undead'], ['vsrace', 7, 'RC_Demon', 'Demon']] } },
		socket: { small: [['sklv', 1, 34, 10, 'Blessing'], ['sklv', 1, 29, 10, 'Increase AGI']] },
	},
	{ // Mage
		skill: { small: [['skatk', 4, 'MG_FIREBOLT', 'Fire Bolt'], ['skatk', 4, 'MG_COLDBOLT', 'Cold Bolt'], ['skatk', 4, 'MG_LIGHTNINGBOLT', 'Lightning Bolt']],
			end: { n: 'Bolt Mastery', fx: [['recast', 3, 'MG_FIREBOLT', 5, 'Fire Bolt'], ['recast', 3, 'MG_COLDBOLT', 5, 'Cold Bolt'], ['recast', 3, 'MG_LIGHTNINGBOLT', 5, 'Lightning Bolt'], ['skatk', 8, 'MG_FIREBOLT', 'Fire Bolt'], ['skatk', 8, 'MG_COLDBOLT', 'Cold Bolt'], ['skatk', 8, 'MG_LIGHTNINGBOLT', 'Lightning Bolt']] } },
		resist: { small: [['rele', 3, 'Ele_Fire', 'Fire'], ['rele', 3, 'Ele_Water', 'Water'], ['rele', 3, 'Ele_Wind', 'Wind'], ['rele', 3, 'Ele_Earth', 'Earth']],
			end: { n: 'Elemental Ward', fx: [['rele', 5, 'Ele_Fire', 'Fire'], ['rele', 5, 'Ele_Water', 'Water'], ['rele', 5, 'Ele_Wind', 'Wind'], ['rele', 5, 'Ele_Earth', 'Earth']] } },
		vs: { small: [['mvsrace', 3, 'RC_Formless', 'Formless'], ['mvsrace', 3, 'RC_Undead', 'Undead'], ['mvsele', 3, 'Ele_Water', 'Water'], ['mvsele', 3, 'Ele_Fire', 'Fire']],
			end: { n: 'Spellbreaker', fx: [['mvsrace', 7, 'RC_Demon', 'Demon'], ['mvsrace', 7, 'RC_Dragon', 'Dragon'], ['mvsize', 5, 'Size_Large', 'Large']] } },
		socket: { small: [['skatk', 4, 'WZ_METEOR', 'Meteor Storm'], ['skatk', 4, 'WZ_JUPITEL', 'Jupitel Thunder']] },
	},
	{ // Archer
		skill: { small: [['skatk', 5, 'AC_DOUBLE', 'Double Strafe'], ['skatk', 5, 'AC_SHOWER', 'Arrow Shower'], ['skatk', 5, 'AC_CHARGEARROW', 'Arrow Repel']],
			end: { n: "Marksman's Art", fx: [['recast', 5, 'AC_DOUBLE', 5, 'Double Strafe'], ['skatk', 10, 'AC_DOUBLE', 'Double Strafe'], ['skatk', 8, 'AC_SHOWER', 'Arrow Shower'], ['sksp', 10, 'AC_DOUBLE', 'Double Strafe']] } },
		resist: { small: [['rrace', 3, 'RC_Brute', 'Brute'], ['rrace', 3, 'RC_Insect', 'Insect'], ['rrace', 3, 'RC_Plant', 'Plant'], ['rele', 3, 'Ele_Wind', 'Wind']],
			end: { n: 'Wildwalker', fx: [['rrace', 6, 'RC_Fish', 'Fish'], ['rrace', 6, 'RC_Dragon', 'Dragon']] } },
		vs: { small: [['vsrace', 3, 'RC_Insect', 'Insect'], ['vsrace', 3, 'RC_Plant', 'Plant'], ['vsele', 3, 'Ele_Fire', 'Fire'], ['vsele', 3, 'Ele_Water', 'Water']],
			end: { n: 'Master Huntsman', fx: [['vsrace', 6, 'RC_Brute', 'Brute'], ['vsrace', 6, 'RC_Fish', 'Fish'], ['vssize', 6, 'Size_Medium', 'Medium']] } },
		socket: { small: [['skatk', 5, 'HT_BLITZBEAT', 'Blitz Beat'], ['skatk', 5, 'SN_SHARPSHOOTING', 'Sharpshooting']] },
	},
	{ // Thief
		skill: { small: [['skatk', 5, 'AS_SONICBLOW', 'Sonic Blow'], ['skatk', 5, 'AS_GRIMTOOTH', 'Grimtooth'], ['skatk', 5, 'AS_SPLASHER', 'Venom Splasher']],
			end: { n: "Assassin's Art", fx: [['recast', 4, 'AS_SONICBLOW', 5, 'Sonic Blow'], ['skatk', 10, 'AS_SONICBLOW', 'Sonic Blow'], ['skatk', 8, 'AS_GRIMTOOTH', 'Grimtooth'], ['sksp', 10, 'AS_SONICBLOW', 'Sonic Blow']] } },
		resist: { small: [['rele', 3, 'Ele_Poison', 'Poison'], ['rele', 3, 'Ele_Ghost', 'Ghost'], ['rele', 3, 'Ele_Dark', 'Shadow'], ['rrace', 3, 'RC_DemiHuman', 'Demi-Human']],
			end: { n: "Shade's Cloak", fx: [['rele', 8, 'Ele_Poison', 'Poison'], ['rrace', 6, 'RC_Demon', 'Demon']] } },
		vs: { small: [['vsrace', 3, 'RC_DemiHuman', 'Demi-Human'], ['vsele', 3, 'Ele_Holy', 'Holy'], ['vsele', 3, 'Ele_Ghost', 'Ghost'], ['vsele', 3, 'Ele_Poison', 'Poison']],
			end: { n: 'Backstabber', fx: [['vsrace', 7, 'RC_DemiHuman', 'Demi-Human'], ['vssize', 6, 'Size_Small', 'Small'], ['critdmg', 6]] } },
		socket: { small: [['skatk', 5, 'RG_BACKSTAP', 'Back Stab'], ['skatk', 5, 'ASC_METEORASSAULT', 'Meteor Assault']] },
	},
	{ // Merchant
		skill: { small: [['skatk', 5, 'MC_MAMMONITE', 'Mammonite'], ['skatk', 5, 'BS_HAMMERFALL', 'Hammer Fall'], ['skatk', 5, 'MC_CARTREVOLUTION', 'Cart Revolution']],
			end: { n: "Mammon's Fist", fx: [['recast', 4, 'MC_MAMMONITE', 5, 'Mammonite'], ['skatk', 10, 'MC_MAMMONITE', 'Mammonite'], ['skatk', 8, 'MC_CARTREVOLUTION', 'Cart Revolution'], ['sksp', 10, 'MC_MAMMONITE', 'Mammonite']] } },
		resist: { small: [['rele', 3, 'Ele_Neutral', 'Neutral'], ['rele', 3, 'Ele_Water', 'Water'], ['rrace', 3, 'RC_Formless', 'Formless'], ['rrace', 3, 'RC_Dragon', 'Dragon']],
			end: { n: "Trader's Insurance", fx: [['reduce', 3], ['rele', 5, 'Ele_Neutral', 'Neutral']] } },
		vs: { small: [['vsrace', 3, 'RC_Formless', 'Formless'], ['vsrace', 3, 'RC_Fish', 'Fish'], ['vsele', 3, 'Ele_Neutral', 'Neutral'], ['vsele', 3, 'Ele_Earth', 'Earth']],
			end: { n: 'Pest Control', fx: [['vsrace', 7, 'RC_Insect', 'Insect'], ['vsrace', 7, 'RC_Plant', 'Plant']] } },
		socket: { small: [['skheal', 6, 'AM_POTIONPITCHER', 'Potion Pitcher'], ['skatk', 5, 'AM_DEMONSTRATION', 'Bomb']] },
	},
];
// local offsets (outward, sideways) in px from the anchor on ring 4, and which nodes are linked ('A' = the anchor)
const SHAPE = {
	diamond4: { at: [[80, 0], [150, -42], [150, 42], [225, 0]], links: [['A', 0], [0, 1], [0, 2], [1, 3], [2, 3]] },
	diamond5: { at: [[80, 0], [150, -45], [150, 45], [225, 0], [300, 0]], links: [['A', 0], [0, 1], [0, 2], [1, 3], [2, 3], [3, 4]] },
	chain3: { at: [[80, 0], [155, 0], [235, 0]], links: [['A', 0], [0, 1], [1, 2]] },
};
const SOCKET_INFO = 'Card socket. Put a card from your inventory in here and its bonuses apply to you as if you wore it. Weapon cards count for the weapon you hold. Each card can be socketed once.';

// ---------------------------------------------------------------- build --
const nodes = [];       // { id, key, type, x, y, name, fx[], info }
const edges = [];       // { a, b, arc? }
const byKey = new Map();
const rad = d => d * Math.PI / 180;
const secAngle = s => -90 + s * 60;
const pos = (r, deg) => [Math.round(r * Math.cos(rad(deg)) * 10) / 10, Math.round(r * Math.sin(rad(deg)) * 10) / 10];

function add(key, type, x, y, name, fx, info = '') {
	const node = { id: 0, key, type, x, y, name, fx, info };
	nodes.push(node);
	byKey.set(key, node);
	return node;
}
const link = (a, b, arc, portal) => edges.push({ a, b, arc: !!arc, portal: !!portal });
const effects = list => list.map(([k, ...rest]) => C[k](...rest));

// start nodes first so they get ids 1..6, the hub 7. The origins sit in the centre (ring KEY_R); the tree grows outward and the
// six keystones guard the borders between the regions on the rim.
SECTORS.forEach((s, i) => {
	const [x, y] = pos(KEY_R, secAngle(i));
	add(`S${i}`, 'start', x, y, `${s.name}'s Origin`, effects([[s.stat, 2]]));
});
add('HUB', 'start', 0, 0, "Wanderer's Crossing", effects([['all', 1]]));

for (let s = 0; s < 6; s++) {
	for (let k = 4; k >= 1; k--) {
		const g = RING[k];
		for (let j = 0; j < g.n; j++) {
			const deg = secAngle(s) + (j - (g.n - 1) / 2) * g.step;
			const [x, y] = pos(g.r, deg);
			const ni = g.notable.indexOf(j);
			// ring 1 slot 2 (right next to the origin) is left out on purpose: no node there, and the ring is cut at that spot
			if (k === 1 && j === 2) continue;
			if (ni >= 0) {
				const def = NOTABLE[s][(4 - k) * 2 + ni];
				add(`R${k}.${s}.${j}`, 'notable', x, y, def.n, effects(def.fx));
			} else {
				const edge = j === 0 || j === g.n - 1;
				const pool = edge ? BOUND[j === 0 ? (s + 5) % 6 : s] : POOL[s];
				const pick = pool[(k * 3 + j) % pool.length](4 - k);
				add(`R${k}.${s}.${j}`, 'small', x, y, null, effects([pick]));
			}
		}
	}
}
for (let s = 0; s < 6; s++) {
	const [x, y] = pos(RING[4].r, secAngle(s) + 30);
	const def = KEYSTONE[s];
	add(`K${s}`, 'key', x, y, def.n, effects(def.fx));
	const [gx, gy] = pos(GATE_R, secAngle(s));
	add(`G${s}`, 'small', gx, gy, null, effects([GATEWAY[s]])).wand = true;
}

// spoke bridge nodes
for (let s = 0; s < 6; s++) {
	for (const k of [4, 3, 2]) {
		SPOKES[k].forEach(([jo, ji], n) => {
			const a = byKey.get(`R${k}.${s}.${jo}`), b = byKey.get(`R${k - 1}.${s}.${ji}`);
			const mid = [Math.round((a.x + b.x) / 2 * 10) / 10, Math.round((a.y + b.y) / 2 * 10) / 10];
			const last = SPOKES[k].length - 1;
			const pool = n === 0 ? BOUND[(s + 5) % 6] : n === last ? BOUND[s] : POOL[s];
			const pick = pool[(k + n * 2) % pool.length](4 - k);
			add(`B${k}.${s}.${n}`, 'small', mid[0], mid[1], null, effects([pick]));
		});
	}
}

// ---------------------------------------------------------------- outer ring, ascendancy branches, masteries --
// Ring 5 (r 1020) runs around the whole tree, 17 slots per region. Rim clusters hook into it, six more keystones sit on
// the region borders, and each start node grows two job-line branches (second class) outward.
const RING5 = { r: 1020, n: 17, step: 3.2, notable: [2, 7, 9, 14], mastery: [5, 11] };
const RING5_SPOKE = { 1: 2, 3: 5, 7: 11, 9: 14 };      // rim cluster anchor slot -> ring 5 slot it connects to

const POOL5 = [
	[['addeff', 3, 'Eff_Stun', 'Stun'], ['submelee', 2], ['hpgain', 5], ['wdmg', 3, 'W_1HSWORD', '1H Sword'], ['wdmg', 3, 'W_2HSWORD', '2H Sword'], ['wdmg', 3, 'W_1HSPEAR', 'Spear'], ['wdmg', 3, 'W_1HAXE', 'Axe'], ['critdefrate', 4]],
	[['regenhp', 1, 12000], ['healin', 4], ['reduce', 1], ['submagic', 2], ['wdmg', 3, 'W_MACE', 'Mace'], ['wdmg', 3, 'W_KNUCKLE', 'Knuckle'], ['spotion', 5], ['reff', 4, 'Eff_Sleep', 'Sleep']],
	[['regensp', 1, 12000], ['spgain', 3], ['submagic', 2], ['mdmg', 1], ['wdmg', 3, 'W_STAFF', 'Staff'], ['wdmg', 3, 'W_BOOK', 'Book'], ['cast', 1], ['spcost', 1]],
	[['wdmg', 3, 'W_BOW', 'Bow'], ['subranged', 2], ['addeff', 3, 'Eff_Blind', 'Blind'], ['crit', 2], ['aspd', 1], ['ranged', 2], ['hit', 5], ['reff', 4, 'Eff_Blind', 'Blind']],
	[['wdmg', 3, 'W_DAGGER', 'Dagger'], ['wdmg', 3, 'W_KATAR', 'Katar'], ['addeff', 3, 'Eff_Bleeding', 'Bleeding'], ['addeff', 3, 'Eff_Poison', 'Poison'], ['flee', 5], ['critdmg', 3], ['subranged', 2], ['double', 2]],
	[['zeny', 5, 300], ['steal', 3], ['wdmg', 3, 'W_1HAXE', 'Axe'], ['wdmg', 3, 'W_2HAXE', 'Two-handed Axe'], ['weight', 150], ['drop', 0.1], ['exp', 1], ['potion', 4]],
];
// four notables per region, in ring order; rs = the skill (AegisName in SKREQ) and level a character must know to take it
const NOTABLE5 = [
	[ // Swordsman
		{ n: 'Concussive Blows', fx: [['addeff', 6, 'Eff_Stun', 'Stun'], ['wdmg', 6, 'W_2HSWORD', '2H Sword']] },
		{ n: 'Spearwall', fx: [['wdmg', 8, 'W_1HSPEAR', 'Spear'], ['submelee', 5], ['noknock']] },
		{ n: 'Berserk Instinct', fx: [['autospell', 3, 'SM_MAGNUM', 5, 'Magnum Break'], ['hpgain', 6]], rs: ['SM_MAGNUM', 3] },
		{ n: 'Executioner', fx: [['critdmg', 10], ['ignoredef', 6], ['boss', 4]] },
	],
	[ // Acolyte
		{ n: 'Soothing Aura', fx: [['regenhp', 1, 8000], ['heal', 8]] },
		{ n: 'Divine Wrath', fx: [['autospell', 3, 'AL_HOLYLIGHT', 3, 'Holy Light'], ['vsrace', 5, 'RC_Undead', 'Undead']], rs: ['AL_HOLYLIGHT', 1] },
		{ n: 'Purifier', fx: [['reff', 20, 'Eff_Stone', 'Stone'], ['reff', 20, 'Eff_Confusion', 'Confusion'], ['reff', 20, 'Eff_Sleep', 'Sleep']] },
		{ n: "Martyr's Grace", fx: [['submagic', 8], ['subranged', 6], ['potion', 10]] },
	],
	[ // Mage
		{ n: 'Arcane Siphon', fx: [['spgain', 6], ['regensp', 1, 8000]] },
		{ n: 'Frostbite', fx: [['addeff', 5, 'Eff_Freeze', 'Freeze'], ['mele', 8, 'Ele_Water', 'Water']] },
		{ n: 'Storm Caller', fx: [['autospell', 2, 'MG_THUNDERSTORM', 3, 'Thunder Storm'], ['mele', 8, 'Ele_Wind', 'Wind']], rs: ['MG_THUNDERSTORM', 3] },
		{ n: 'Gemstone Mastery', fx: [['nogem'], ['matk', 12]] },
	],
	[ // Archer
		{ n: 'Crippling Shot', fx: [['addeff', 6, 'Eff_Blind', 'Blind'], ['ranged', 5]] },
		{ n: 'Falconry', fx: [['autospell', 4, 'HT_BLITZBEAT', 3, 'Blitz Beat'], ['skatk', 8, 'HT_BLITZBEAT', 'Blitz Beat']], falcon: true },
		{ n: 'Trapper', fx: [['skatk', 8, 'HT_BLASTMINE', 'Blast Mine'], ['skatk', 8, 'HT_CLAYMORETRAP', 'Claymore Trap'], ['skatk', 8, 'HT_LANDMINE', 'Land Mine']] },
		{ n: 'Dead Eye', fx: [['hit', 15], ['crit', 8], ['critdmg', 10]] },
	],
	[ // Thief
		{ n: 'Open Wounds', fx: [['addeff', 8, 'Eff_Bleeding', 'Bleeding'], ['critdmg', 8]], rs: ['TF_POISON', 1] },
		{ n: 'Envenom', fx: [['addeff', 10, 'Eff_Poison', 'Poison'], ['rele', 10, 'Ele_Poison', 'Poison']] },
		{ n: 'Smoke and Mirrors', fx: [['flee2', 4], ['subranged', 8], ['speed', 6]] },
		{ n: 'Cutthroat', fx: [['wdmg', 8, 'W_DAGGER', 'Dagger'], ['wdmg', 8, 'W_KATAR', 'Katar'], ['hpdrain', 8, 5]] },
	],
	[ // Merchant
		{ n: "Pickpocket's Purse", fx: [['zeny', 10, 800], ['steal', 8]] },
		{ n: 'Merchant Prince', fx: [['drop', 0.05], ['exp', 4], ['weight', 300]] },
		{ n: 'Bulk Discount', fx: [['potion', 12], ['spotion', 12]] },
		{ n: 'Golden Hammer', fx: [['wdmg', 8, 'W_1HAXE', 'Axe'], ['wdmg', 8, 'W_2HAXE', 'Two-handed Axe'], ['skatk', 10, 'BS_HAMMERFALL', 'Hammer Fall']], rs: ['MC_MAMMONITE', 3] },
	],
];
const SKREQ = { SM_MAGNUM: 'Magnum Break', AL_HOLYLIGHT: 'Holy Light', MG_THUNDERSTORM: 'Thunder Storm', HT_BLITZBEAT: 'Blitz Beat', TF_POISON: 'Envenom', MC_MAMMONITE: 'Mammonite' };

// masteries: pick ONE of the options after allocating the node (changing is free)
const MASTERY5 = [
	[ // Swordsman
		{ n: 'Weapon Doctrine', opts: [{ n: 'Swords', fx: [['wdmg', 10, 'W_1HSWORD', '1H Sword'], ['wdmg', 10, 'W_2HSWORD', '2H Sword']] }, { n: 'Spears', fx: [['wdmg', 12, 'W_1HSPEAR', 'Spear'], ['wdmg', 12, 'W_2HSPEAR', '2H Spear']] }, { n: 'Axes and Maces', fx: [['wdmg', 10, 'W_1HAXE', 'Axe'], ['wdmg', 10, 'W_2HAXE', 'Two-handed Axe'], ['wdmg', 10, 'W_MACE', 'Mace']] }] },
		{ n: 'Battle Doctrine', opts: [{ n: 'Offence', fx: [['dmg', 5]] }, { n: 'Vitality', fx: [['hpp', 8]] }, { n: 'Guard', fx: [['reduce', 5]] }] },
	],
	[ // Acolyte
		{ n: 'Divine Doctrine', opts: [{ n: 'Healing', fx: [['heal', 12]] }, { n: 'Mending', fx: [['healin', 10], ['hpr', 8]] }, { n: 'Smiting', fx: [['vsrace', 7, 'RC_Undead', 'Undead'], ['vsrace', 7, 'RC_Demon', 'Demon']] }] },
		{ n: 'Warding Doctrine', opts: [{ n: 'Holy', fx: [['rele', 15, 'Ele_Holy', 'Holy']] }, { n: 'Shadow', fx: [['rele', 15, 'Ele_Dark', 'Shadow']] }, { n: 'Undead', fx: [['rele', 15, 'Ele_Undead', 'Undead']] }, { n: 'Ghost', fx: [['rele', 15, 'Ele_Ghost', 'Ghost']] }] },
	],
	[ // Mage
		{ n: 'Elemental Doctrine', opts: [{ n: 'Fire', fx: [['mele', 12, 'Ele_Fire', 'Fire']] }, { n: 'Water', fx: [['mele', 12, 'Ele_Water', 'Water']] }, { n: 'Wind', fx: [['mele', 12, 'Ele_Wind', 'Wind']] }, { n: 'Earth', fx: [['mele', 12, 'Ele_Earth', 'Earth']] }] },
		{ n: 'Arcane Doctrine', opts: [{ n: 'Swiftness', fx: [['cast', 6]] }, { n: 'Thrift', fx: [['spcost', 6], ['spp', 3]] }, { n: 'Power', fx: [['matkp', 5]] }] },
	],
	[ // Archer
		{ n: 'Hunting Doctrine', opts: [{ n: 'Beasts', fx: [['vsrace', 8, 'RC_Brute', 'Brute']] }, { n: 'Insects', fx: [['vsrace', 8, 'RC_Insect', 'Insect']] }, { n: 'Plants', fx: [['vsrace', 8, 'RC_Plant', 'Plant']] }, { n: 'Fish and Dragons', fx: [['vsrace', 6, 'RC_Fish', 'Fish'], ['vsrace', 6, 'RC_Dragon', 'Dragon']] }] },
		{ n: 'Marksman Doctrine', opts: [{ n: 'Reach', fx: [['ranged', 8]] }, { n: 'Precision', fx: [['crit', 8], ['hit', 8]] }, { n: 'Tempo', fx: [['aspd', 4]] }] },
	],
	[ // Thief
		{ n: 'Venom Doctrine', opts: [{ n: 'Poison', fx: [['addeff', 8, 'Eff_Poison', 'Poison']] }, { n: 'Bleeding', fx: [['addeff', 8, 'Eff_Bleeding', 'Bleeding']] }, { n: 'Blindness', fx: [['addeff', 8, 'Eff_Blind', 'Blind']] }, { n: 'Stun', fx: [['addeff', 6, 'Eff_Stun', 'Stun']] }] },
		{ n: 'Shadow Doctrine', opts: [{ n: 'Evasion', fx: [['flee', 12]] }, { n: 'Perfect Dodge', fx: [['flee2', 5]] }, { n: 'Haste', fx: [['speed', 8]] }] },
	],
	[ // Merchant
		{ n: 'Trade Doctrine', opts: [{ n: 'Experience', fx: [['exp', 6]] }, { n: 'Plunder', fx: [['drop', 0.05]] }, { n: 'Cargo', fx: [['weight', 500]] }, { n: 'Gold', fx: [['zeny', 12, 1000]] }] },
		{ n: 'Craft Doctrine', opts: [{ n: 'Medicine', fx: [['potion', 15]] }, { n: 'Pilfering', fx: [['steal', 10]] }, { n: 'Fortune', fx: [['luk', 4]] }] },
	],
];

// six keystones on the region borders of ring 5
const KEYSTONE5 = [
	{ n: 'Bulwark of Ages', fx: [['hitcap', 25], ['noknock'], ['dmg', -20]] },
	{ n: 'Blood Pact', fx: [['hpdrain', 20, 10], ['healin', -30], ['potion', -30]] },
	{ n: 'Gemless Grace', fx: [['nogem'], ['mdmg', 10], ['spp', -25]] },
	{ n: "Gambler's Fallacy", fx: [['critdmg', 30], ['crit', 20], ['hit', -20]] },
	{ n: 'Pyre Pact', fx: [['atkele', 0, 'Ele_Fire', 'Fire'], ['mele', 25, 'Ele_Fire', 'Fire'], ['rele', -25, 'Ele_Water', 'Water']] },
	{ n: 'Glass Cannon', fx: [['dmg', 40], ['mdmg', 40], ['takemore', 40]] },
];

// job-line branches (second class) growing outward from each start node; code = base | 0x100 (2-1) or 0x200 (2-2)
const ASCEND = [
	[ // Swordsman
		{ line: 'Knight', code: 0x101, small: [['skatk', 5, 'KN_PIERCE', 'Pierce'], ['skatk', 5, 'KN_BRANDISHSPEAR', 'Brandish Spear']],
			mid: { n: "Lancer's Discipline", fx: [['skatk', 8, 'KN_SPEARBOOMERANG', 'Spear Boomerang'], ['wdmg', 6, 'W_1HSPEAR', 'Spear'], ['aspd', 3]] },
			cap: { n: "Knight's Honor", fx: [['recast', 4, 'KN_PIERCE', 5, 'Pierce'], ['hpp', 8], ['dmg', 5], ['autospell', 3, 'KN_BOWLINGBASH', 5, 'Bowling Bash']] } },
		{ line: 'Crusader', code: 0x201, small: [['skatk', 5, 'CR_SHIELDBOOMERANG', 'Shield Boomerang'], ['skatk', 5, 'CR_HOLYCROSS', 'Holy Cross']],
			mid: { n: 'Faith Shield', fx: [['reflect', 6], ['rele', 10, 'Ele_Holy', 'Holy'], ['submagic', 4]] },
			cap: { n: "Paladin's Oath", fx: [['reduce', 5], ['hpp', 8], ['skatk', 10, 'CR_GRANDCROSS', 'Grand Cross']] } },
	],
	[ // Acolyte
		{ line: 'Priest', code: 0x104, small: [['skheal', 8, 'PR_SANCTUARY', 'Sanctuary'], ['skatk', 6, 'PR_MAGNUS', 'Magnus Exorcismus']],
			mid: { n: "Clergy's Mercy", fx: [['heal', 12], ['healin', 8], ['regenhp', 1, 8000]] },
			cap: { n: "High Priest's Light", fx: [['skheal', 15, 'AL_HEAL', 'Heal'], ['skatk', 10, 'PR_TURNUNDEAD', 'Turn Undead'], ['sksp', 10, 'PR_SANCTUARY', 'Sanctuary']] } },
		{ line: 'Monk', code: 0x204, small: [['skatk', 6, 'MO_TRIPLEATTACK', 'Triple Attack'], ['skatk', 6, 'MO_CHAINCOMBO', 'Chain Combo']],
			mid: { n: 'Spirit Fists', fx: [['skatk', 8, 'MO_COMBOFINISH', 'Combo Finish'], ['skatk', 8, 'MO_INVESTIGATE', 'Investigate'], ['aspd', 3]] },
			cap: { n: 'Asura', fx: [['skatk', 12, 'MO_EXTREMITYFIST', 'Asura Strike'], ['sksp', 10, 'MO_EXTREMITYFIST', 'Asura Strike'], ['hpp', 6]] } },
	],
	[ // Mage
		{ line: 'Wizard', code: 0x102, small: [['skatk', 5, 'WZ_STORMGUST', 'Storm Gust'], ['skatk', 5, 'WZ_VERMILION', 'Lord of Vermilion']],
			mid: { n: 'Storm Mastery', fx: [['skatk', 8, 'WZ_STORMGUST', 'Storm Gust'], ['skatk', 8, 'WZ_METEOR', 'Meteor Storm'], ['cast', 5]] },
			cap: { n: 'Archwizard', fx: [['matkp', 8], ['mdmg', 6], ['autospell', 2, 'WZ_VERMILION', 3, 'Lord of Vermilion']] } },
		{ line: 'Sage', code: 0x202, small: [['skatk', 5, 'MG_FIREBALL', 'Fire Ball'], ['skatk', 5, 'MG_THUNDERSTORM', 'Thunder Storm']],
			mid: { n: "Scholar's Insight", fx: [['spp', 6], ['spr', 10], ['mele', 4, 'Ele_Earth', 'Earth']] },
			cap: { n: "Professor's Wit", fx: [['autospell', 5, 'MG_SOULSTRIKE', 5, 'Soul Strike'], ['cast', 6], ['matk', 15]] } },
	],
	[ // Archer
		{ line: 'Hunter', code: 0x103, small: [['skatk', 6, 'HT_LANDMINE', 'Land Mine'], ['skatk', 6, 'HT_FREEZINGTRAP', 'Freezing Trap']],
			mid: { n: 'Trapmaster', fx: [['skatk', 8, 'HT_BLASTMINE', 'Blast Mine'], ['skatk', 8, 'HT_CLAYMORETRAP', 'Claymore Trap'], ['double', 4]] },
			cap: { n: "Sniper's Patience", fx: [['recast', 3, 'SN_SHARPSHOOTING', 3, 'Sharpshooting'], ['skatk', 10, 'SN_SHARPSHOOTING', 'Sharpshooting'], ['crit', 8], ['critdmg', 10]] } },
		{ line: 'Bard / Dancer', code: 0x203, small: [['skatk', 6, 'BA_MUSICALSTRIKE', 'Melody Strike'], ['skatk', 6, 'DC_THROWARROW', 'Slinging Arrow']],
			mid: { n: 'Performer', fx: [['spp', 6], ['spr', 8], ['aspd', 3]] },
			cap: { n: 'Maestro', fx: [['skatk', 10, 'BA_MUSICALSTRIKE', 'Melody Strike'], ['skatk', 10, 'DC_THROWARROW', 'Slinging Arrow'], ['flee', 10]] } },
	],
	[ // Thief
		{ line: 'Assassin', code: 0x106, small: [['skatk', 5, 'AS_VENOMKNIFE', 'Venom Knife'], ['skatk', 5, 'ASC_BREAKER', 'Soul Destroyer']],
			mid: { n: 'Lethal Edge', fx: [['skatk', 8, 'AS_SONICBLOW', 'Sonic Blow'], ['skatk', 8, 'AS_GRIMTOOTH', 'Grimtooth'], ['wdmg', 6, 'W_KATAR', 'Katar']] },
			cap: { n: 'Cross Strike', fx: [['recast', 3, 'ASC_METEORASSAULT', 3, 'Meteor Assault'], ['skatk', 10, 'ASC_METEORASSAULT', 'Meteor Assault'], ['critdmg', 10], ['addeff', 8, 'Eff_Poison', 'Poison']] } },
		{ line: 'Rogue', code: 0x206, small: [['skatk', 6, 'RG_BACKSTAP', 'Back Stab'], ['skatk', 6, 'RG_RAID', 'Raid']],
			mid: { n: 'Plunder', fx: [['steal', 10], ['zeny', 8, 600], ['flee', 8]] },
			cap: { n: 'Master Thief', fx: [['skatk', 10, 'RG_BACKSTAP', 'Back Stab'], ['flee', 10], ['steal', 10]] } },
	],
	[ // Merchant
		{ line: 'Blacksmith', code: 0x105, small: [['skatk', 6, 'BS_HAMMERFALL', 'Hammer Fall'], ['skatk', 6, 'WS_CARTTERMINATION', 'Cart Termination']],
			mid: { n: 'Forgemaster', fx: [['wdmg', 8, 'W_1HAXE', 'Axe'], ['atk', 10], ['unbreak', 20]] },
			cap: { n: 'Mastersmith', fx: [['recast', 3, 'WS_CARTTERMINATION', 5, 'Cart Termination'], ['skatk', 10, 'WS_CARTTERMINATION', 'Cart Termination'], ['dmg', 6], ['hpp', 6]] } },
		{ line: 'Alchemist', code: 0x205, small: [['skatk', 6, 'AM_ACIDTERROR', 'Acid Terror'], ['skatk', 6, 'AM_DEMONSTRATION', 'Bomb']],
			mid: { n: 'Potion Lore', fx: [['skheal', 10, 'AM_POTIONPITCHER', 'Potion Pitcher'], ['potion', 12], ['spotion', 10]] },
			cap: { n: 'Biochemist', fx: [['skatk', 10, 'AM_ACIDTERROR', 'Acid Terror'], ['hp', 200], ['potion', 15]] } },
	],
];

// ring 5
const clusterEndOf = new Map();           // filled by the rim cluster loop: `${region}.${anchor slot}` -> end node
const extraLinks = [];                    // [nodeA, nodeB, arc]
const SKREQ_ID = { SM_MAGNUM: 7, AL_HOLYLIGHT: 156, MG_THUNDERSTORM: 21, HT_BLITZBEAT: 129, TF_POISON: 52, MC_MAMMONITE: 42 };

// rim clusters (added last so the ids of everything above never change)
const clusterLinks = [];
for (let s = 0; s < 6; s++) {
	const def = CLUSTER[s];
	const plan = [
		[1, 'diamond4', def.skill.small, def.skill.end, 'notable'],
		[3, 'diamond5', def.resist.small, def.resist.end, 'notable'],
		[7, 'diamond5', def.vs.small, def.vs.end, 'notable'],
		[9, 'chain3', def.socket.small, { n: `${SECTORS[s].name} Jewel Socket`, fx: [] }, 'socket'],
	];
	for (const [j, shape, smalls, end, endType] of plan) {
		const anchor = byKey.get(`R4.${s}.${j}`);
		const deg = secAngle(s) + (j - 5) * 5;
		const u = [Math.cos(rad(deg)), Math.sin(rad(deg))], t = [-u[1], u[0]];
		const sh = SHAPE[shape];
		const made = sh.at.map(([d, l], i) => {
			const x = Math.round((anchor.x + d * u[0] + l * t[0]) * 10) / 10, y = Math.round((anchor.y + d * u[1] + l * t[1]) * 10) / 10;
			const key = `C${s}.${j}.${i}`;
			if (i === sh.at.length - 1) {
				return endType === 'socket' ? add(key, 'socket', x, y, end.n, [], SOCKET_INFO) : add(key, 'notable', x, y, end.n, effects(end.fx));
			}
			return add(key, 'small', x, y, null, effects([smalls[i]]));
		});
		clusterEndOf.set(`${s}.${j}`, made[made.length - 1]);
		for (const [a, b] of sh.links) clusterLinks.push([a === 'A' ? anchor : made[a], made[b]]);
	}
}

// ring 5, its keystones, the rim-cluster spokes and the job-line branches (added after the rim clusters: ids stay stable)
for (let s = 0; s < 6; s++) {
	for (let j = 0; j < RING5.n; j++) {
		const [x, y] = pos(RING5.r, secAngle(s) + (j - (RING5.n - 1) / 2) * RING5.step);
		const key = `V${s}.${j}`;
		const ni = RING5.notable.indexOf(j), mi = RING5.mastery.indexOf(j);
		if (ni >= 0) {
			const def = NOTABLE5[s][ni];
			const node = add(key, 'notable', x, y, def.n, effects(def.fx));
			if (def.falcon) { node.falcon = true; node.info = 'Gives you a falcon, so the Blitz Beat nodes work for any class.'; }
			if (def.rs) node.rs = { id: SKREQ_ID[def.rs[0]], lv: def.rs[1], name: SKREQ[def.rs[0]] };
		} else if (mi >= 0) {
			const def = MASTERY5[s][mi];
			const node = add(key, 'mastery', x, y, def.n, []);
			node.opts = def.opts.map(o => ({ n: o.n, fx: effects(o.fx) }));
		} else {
			add(key, 'small', x, y, null, effects([POOL5[s][(j * 3 + s) % POOL5[s].length]]));
		}
	}
}
for (let s = 0; s < 6; s++) {
	const [x, y] = pos(RING5.r + 90, secAngle(s) + 30);
	add(`KK${s}`, 'key', x, y, KEYSTONE5[s].n, effects(KEYSTONE5[s].fx));
}
// ring chains and keystone links
for (let s = 0; s < 6; s++) {
	for (let j = 0; j < RING5.n - 1; j++) extraLinks.push([byKey.get(`V${s}.${j}`), byKey.get(`V${s}.${j + 1}`), true]);
	// (the ring is closed across the region border by the race node below, added last so no node id moves)
}
// rim clusters hook into ring 5 (a bridge node when the gap is long)
for (let s = 0; s < 6; s++) {
	for (const [anchor, slot] of Object.entries(RING5_SPOKE)) {
		const end = clusterEndOf.get(`${s}.${anchor}`), target = byKey.get(`V${s}.${slot}`);
		if (Math.hypot(end.x, end.y) < 880) {
			const mid = add(`W${s}.${anchor}`, 'small', Math.round((end.x + target.x) / 2 * 10) / 10, Math.round((end.y + target.y) / 2 * 10) / 10, null, effects([POOL5[s][(Number(anchor) * 5 + s) % POOL5[s].length]]));
			extraLinks.push([end, mid, false], [mid, target, false]);
		} else extraLinks.push([end, target, false]);
	}
}
// job-line branches
for (let s = 0; s < 6; s++) {
	const start = byKey.get(`R4.${s}.5`);
	const deg = secAngle(s), u = [Math.cos(rad(deg)), Math.sin(rad(deg))], t = [-u[1], u[0]];
	const at = (d, l) => [Math.round((start.x + d * u[0] + l * t[0]) * 10) / 10, Math.round((start.y + d * u[1] + l * t[1]) * 10) / 10];
	const hub = add(`H${s}`, 'small', ...at(90, 0), null, effects([['hp', 120]]));
	extraLinks.push([start, hub, false]);
	ASCEND[s].forEach((b, bi) => {
		const lateral = bi ? 30 : -30;
		const defs = [
			{ type: 'small', fx: [b.small[0]] }, { type: 'small', fx: [b.small[1]] },
			{ type: 'notable', n: b.mid.n, fx: b.mid.fx }, { type: 'notable', n: b.cap.n, fx: b.cap.fx },
		];
		let prev = hub;
		defs.forEach((d, i) => {
			const [x, y] = at(150 + i * 70, lateral);
			const node = add(`A${s}.${bi}.${i}`, d.type, x, y, d.n || null, effects(d.fx));
			node.req = { name: b.line, code: b.code };
			extraLinks.push([prev, node, false]);
			prev = node;
		});
	});
}

// "Weak skill" clusters: three more per region hung off ring 5 (slots 3, 8 and 13), outward to radius ~1250.
//   basic       the low-damage starter skills that fall behind: bigger damage, cheaper SP
//   support     buffs and heals: more power, cheaper, and +levels (a higher level lasts longer)
//   situational skills that are rarely worth using: large damage and cost boosts
// Tokens: ['skatk', %, AegisName, name] damage, ['sksp', %, ...] SP cost, ['skheal', %, ...] healing,
//         ['skcast', %, ...] cast time, ['sklv', levels, skill id, max level, name] skill level.
const WEAK = [
	{ // Swordsman
		basic: { small: [['skatk', 6, 'SM_BASH', 'Bash'], ['skatk', 6, 'SM_MAGNUM', 'Magnum Break'], ['sksp', 8, 'SM_MAGNUM', 'Magnum Break']],
			end: { n: 'Hammer of the Basics', fx: [['recast', 4, 'SM_MAGNUM', 5, 'Magnum Break'], ['skatk', 12, 'SM_BASH', 'Bash'], ['skatk', 12, 'SM_MAGNUM', 'Magnum Break'], ['skatk', 10, 'KN_BOWLINGBASH', 'Bowling Bash']] } },
		support: { small: [['sklv', 1, 8, 10, 'Endure'], ['sklv', 1, 6, 10, 'Provoke'], ['sksp', 10, 'SM_PROVOKE', 'Provoke']],
			end: { n: 'Steadfast', fx: [['sklv', 2, 8, 10, 'Endure'], ['hpr', 10], ['reduce', 3]] } },
		situational: { small: [['skatk', 10, 'KN_SPEARSTAB', 'Spear Stab'], ['skatk', 10, 'KN_SPEARBOOMERANG', 'Spear Boomerang'], ['skatk', 10, 'CR_SHIELDCHARGE', 'Shield Charge']],
			end: { n: 'Lance Specialist', fx: [['skatk', 18, 'KN_SPEARSTAB', 'Spear Stab'], ['skatk', 18, 'KN_SPEARBOOMERANG', 'Spear Boomerang'], ['sksp', 15, 'KN_SPEARSTAB', 'Spear Stab']] } },
	},
	{ // Acolyte
		basic: { small: [['skatk', 6, 'AL_HOLYLIGHT', 'Holy Light'], ['skatk', 6, 'MO_TRIPLEATTACK', 'Triple Attack'], ['skatk', 6, 'MO_FINGEROFFENSIVE', 'Finger Offensive']],
			end: { n: 'Smite', fx: [['recast', 5, 'AL_HOLYLIGHT', 1, 'Holy Light'], ['skatk', 12, 'AL_HOLYLIGHT', 'Holy Light'], ['sksp', 12, 'AL_HOLYLIGHT', 'Holy Light'], ['skatk', 12, 'MO_FINGEROFFENSIVE', 'Finger Offensive']] } },
		support: { small: [['skheal', 8, 'AL_HEAL', 'Heal'], ['sklv', 1, 33, 10, 'Angelus'], ['sksp', 10, 'AL_BLESSING', 'Blessing']],
			end: { n: "Chaplain's Gift", fx: [['sklv', 1, 34, 10, 'Blessing'], ['sklv', 1, 29, 10, 'Increase AGI'], ['skheal', 10, 'AL_HEAL', 'Heal'], ['sksp', 8, 'AL_HEAL', 'Heal']] } },
		situational: { small: [['skatk', 10, 'PR_TURNUNDEAD', 'Turn Undead'], ['sksp', 15, 'AL_CRUCIS', 'Signum Crucis'], ['sklv', 1, 30, 10, 'Decrease AGI']],
			end: { n: 'Inquisitor', fx: [['skatk', 18, 'PR_TURNUNDEAD', 'Turn Undead'], ['skatk', 15, 'MO_FINGEROFFENSIVE', 'Finger Offensive'], ['sksp', 10, 'AL_CRUCIS', 'Signum Crucis']] } },
	},
	{ // Mage
		basic: { small: [['skatk', 6, 'MG_NAPALMBEAT', 'Napalm Beat'], ['skatk', 6, 'MG_SOULSTRIKE', 'Soul Strike'], ['skcast', 6, 'MG_SOULSTRIKE', 'Soul Strike']],
			end: { n: 'Cantrip Mastery', fx: [['recast', 5, 'MG_NAPALMBEAT', 5, 'Napalm Beat'], ['recast', 5, 'MG_SOULSTRIKE', 5, 'Soul Strike'], ['skatk', 12, 'MG_NAPALMBEAT', 'Napalm Beat'], ['skatk', 12, 'MG_SOULSTRIKE', 'Soul Strike'], ['sksp', 10, 'MG_NAPALMBEAT', 'Napalm Beat']] } },
		support: { small: [['sksp', 10, 'MG_SAFETYWALL', 'Safety Wall'], ['sklv', 1, 12, 10, 'Safety Wall'], ['spr', 8]],
			end: { n: 'Warding Arts', fx: [['sklv', 2, 12, 10, 'Safety Wall'], ['spcost', 4], ['spp', 3]] } },
		situational: { small: [['skatk', 10, 'MG_FROSTDIVER', 'Frost Diver'], ['skatk', 10, 'MG_FIREWALL', 'Fire Wall'], ['skatk', 10, 'WZ_FROSTNOVA', 'Frost Nova']],
			end: { n: 'Neglected Arts', fx: [['skatk', 18, 'MG_FROSTDIVER', 'Frost Diver'], ['skatk', 18, 'MG_FIREWALL', 'Fire Wall'], ['skatk', 15, 'WZ_FROSTNOVA', 'Frost Nova']] } },
	},
	{ // Archer
		basic: { small: [['skatk', 6, 'AC_SHOWER', 'Arrow Shower'], ['skatk', 6, 'AC_CHARGEARROW', 'Arrow Repel'], ['sksp', 8, 'AC_SHOWER', 'Arrow Shower']],
			end: { n: 'Volley Mastery', fx: [['recast', 5, 'AC_SHOWER', 5, 'Arrow Shower'], ['skatk', 12, 'AC_SHOWER', 'Arrow Shower'], ['skatk', 12, 'AC_CHARGEARROW', 'Arrow Repel'], ['aspd', 2]] } },
		support: { small: [['sklv', 1, 45, 10, 'Improve Concentration'], ['sksp', 10, 'AC_CONCENTRATION', 'Improve Concentration'], ['hit', 6]],
			end: { n: 'Steady Focus', fx: [['sklv', 2, 45, 10, 'Improve Concentration'], ['hit', 10], ['crit', 4]] } },
		situational: { small: [['skatk', 10, 'HT_SKIDTRAP', 'Skid Trap'], ['skatk', 10, 'HT_SANDMAN', 'Sandman'], ['skatk', 10, 'HT_SHOCKWAVE', 'Shockwave Trap']],
			end: { n: 'Trap Savant', fx: [['skatk', 18, 'HT_SKIDTRAP', 'Skid Trap'], ['skatk', 18, 'HT_SANDMAN', 'Sandman'], ['skatk', 18, 'HT_FLASHER', 'Flasher']] } },
	},
	{ // Thief
		basic: { small: [['skatk', 6, 'TF_THROWSTONE', 'Stone Fling'], ['skatk', 6, 'TF_POISON', 'Envenom'], ['skatk', 6, 'AS_GRIMTOOTH', 'Grimtooth']],
			end: { n: 'Dirty Tricks', fx: [['recast', 4, 'TF_POISON', 5, 'Envenom'], ['skatk', 14, 'TF_THROWSTONE', 'Stone Fling'], ['skatk', 12, 'TF_POISON', 'Envenom'], ['sksp', 10, 'TF_POISON', 'Envenom']] } },
		support: { small: [['sklv', 1, 135, 10, 'Cloaking'], ['sksp', 10, 'AS_CLOAKING', 'Cloaking'], ['sklv', 1, 138, 10, 'Enchant Poison']],
			end: { n: 'Shadow Arts', fx: [['sklv', 2, 135, 10, 'Cloaking'], ['flee', 8], ['speed', 4]] } },
		situational: { small: [['skatk', 10, 'TF_SPRINKLESAND', 'Sand Attack'], ['skatk', 10, 'RG_INTIMIDATE', 'Intimidate'], ['skatk', 10, 'AS_SPLASHER', 'Venom Splasher']],
			end: { n: 'Cheap Shots', fx: [['skatk', 20, 'TF_SPRINKLESAND', 'Sand Attack'], ['skatk', 18, 'RG_INTIMIDATE', 'Intimidate'], ['skatk', 15, 'AS_SPLASHER', 'Venom Splasher']] } },
	},
	{ // Merchant
		basic: { small: [['skatk', 6, 'MC_MAMMONITE', 'Mammonite'], ['skatk', 6, 'MC_CARTREVOLUTION', 'Cart Revolution'], ['sksp', 8, 'MC_MAMMONITE', 'Mammonite']],
			end: { n: 'Haggling Fists', fx: [['recast', 5, 'MC_CARTREVOLUTION', 1, 'Cart Revolution'], ['skatk', 12, 'MC_MAMMONITE', 'Mammonite'], ['skatk', 12, 'MC_CARTREVOLUTION', 'Cart Revolution'], ['zeny', 6, 400]] } },
		support: { small: [['sklv', 1, 111, 5, 'Adrenaline Rush'], ['sklv', 1, 113, 5, 'Over Thrust'], ['sksp', 10, 'BS_OVERTHRUST', 'Over Thrust']],
			end: { n: 'Workshop Buffs', fx: [['sklv', 1, 112, 5, 'Weapon Perfection'], ['sksp', 10, 'BS_ADRENALINE', 'Adrenaline Rush'], ['sksp', 10, 'BS_WEAPONPERFECT', 'Weapon Perfection']] } },
		situational: { small: [['skatk', 10, 'AM_DEMONSTRATION', 'Bomb'], ['skatk', 10, 'AM_ACIDTERROR', 'Acid Terror'], ['skatk', 10, 'AM_SPHEREMINE', 'Marine Sphere']],
			end: { n: 'Alchemical Oddities', fx: [['skatk', 18, 'AM_SPHEREMINE', 'Marine Sphere'], ['skatk', 18, 'AM_DEMONSTRATION', 'Bomb'], ['skheal', 12, 'AM_POTIONPITCHER', 'Potion Pitcher']] } },
	},
];
for (let s = 0; s < 6; s++) {
	[[3, 'basic'], [8, 'support'], [13, 'situational']].forEach(([slot, kind]) => {
		const anchor = byKey.get(`V${s}.${slot}`);
		const deg = secAngle(s) + (slot - (RING5.n - 1) / 2) * RING5.step;
		const u = [Math.cos(rad(deg)), Math.sin(rad(deg))], t = [-u[1], u[0]];
		const sh = SHAPE.diamond4, def = WEAK[s][kind];
		const made = sh.at.map(([d, l], i) => {
			const x = Math.round((anchor.x + d * u[0] + l * t[0]) * 10) / 10, y = Math.round((anchor.y + d * u[1] + l * t[1]) * 10) / 10;
			const key = `X${s}.${kind}.${i}`;
			return i === sh.at.length - 1 ? add(key, 'notable', x, y, def.end.n, effects(def.end.fx)) : add(key, 'small', x, y, null, effects([def.small[i]]));
		});
		for (const [a, b] of sh.links) extraLinks.push([a === 'A' ? anchor : made[a], made[b], false]);
	});
}

// "Reflex" clusters: two short chains per region (ring 5 slots 1 and 15) whose nodes cast LOW-LEVEL skills on your attacks.
// ['autospell', % chance, AegisName, skill level, name]. The casts are free (no SP, no cast time, no items).
const REFLEX = [
	[ // Swordsman
		{ small: [['autospell', 3, 'SM_BASH', 2, 'Bash'], ['autospell', 3, 'SM_MAGNUM', 2, 'Magnum Break']],
			end: { n: 'Reckless Reflexes', fx: [['autospell', 3, 'KN_BOWLINGBASH', 3, 'Bowling Bash'], ['autospell', 3, 'KN_PIERCE', 3, 'Pierce'], ['autospell', 2, 'SM_BASH', 5, 'Bash']] } },
		{ small: [['autospell', 3, 'KN_SPEARSTAB', 2, 'Spear Stab'], ['autospell', 3, 'CR_SHIELDBOOMERANG', 2, 'Shield Boomerang']],
			end: { n: 'Quick Lance', fx: [['autospell', 3, 'KN_SPEARBOOMERANG', 3, 'Spear Boomerang'], ['autospell', 2, 'CR_HOLYCROSS', 3, 'Holy Cross'], ['autospell', 2, 'SM_MAGNUM', 5, 'Magnum Break']] } },
	],
	[ // Acolyte
		{ small: [['autospell', 4, 'AL_HOLYLIGHT', 1, 'Holy Light'], ['autospell', 3, 'MO_FINGEROFFENSIVE', 1, 'Finger Offensive']],
			end: { n: 'Blessed Reflexes', fx: [['autospell', 3, 'PR_TURNUNDEAD', 3, 'Turn Undead'], ['autospell', 3, 'MO_INVESTIGATE', 3, 'Investigate'], ['autospell', 3, 'AL_HOLYLIGHT', 3, 'Holy Light']] } },
		{ small: [['autospell', 3, 'MO_INVESTIGATE', 1, 'Investigate'], ['autospell', 3, 'PR_TURNUNDEAD', 1, 'Turn Undead']],
			end: { n: 'Zealous Hands', fx: [['autospell', 3, 'MO_FINGEROFFENSIVE', 3, 'Finger Offensive'], ['autospell', 2, 'AL_HOLYLIGHT', 5, 'Holy Light']] } },
	],
	[ // Mage
		{ small: [['autospell', 4, 'MG_FIREBOLT', 1, 'Fire Bolt'], ['autospell', 4, 'MG_COLDBOLT', 1, 'Cold Bolt']],
			end: { n: 'Spark Reflexes', fx: [['autospell', 3, 'MG_LIGHTNINGBOLT', 3, 'Lightning Bolt'], ['autospell', 3, 'MG_FIREBOLT', 3, 'Fire Bolt'], ['autospell', 3, 'MG_COLDBOLT', 3, 'Cold Bolt']] } },
		{ small: [['autospell', 4, 'MG_NAPALMBEAT', 1, 'Napalm Beat'], ['autospell', 3, 'MG_SOULSTRIKE', 1, 'Soul Strike']],
			end: { n: 'Quickened Spells', fx: [['autospell', 3, 'MG_FIREBALL', 3, 'Fire Ball'], ['autospell', 3, 'MG_FROSTDIVER', 3, 'Frost Diver'], ['autospell', 2, 'MG_THUNDERSTORM', 2, 'Thunder Storm']] } },
	],
	[ // Archer
		{ small: [['autospell', 4, 'AC_DOUBLE', 1, 'Double Strafe'], ['autospell', 3, 'AC_CHARGEARROW', 1, 'Arrow Repel']],
			end: { n: 'Hair Trigger', fx: [['autospell', 3, 'AC_DOUBLE', 3, 'Double Strafe'], ['autospell', 3, 'HT_BLITZBEAT', 1, 'Blitz Beat'], ['autospell', 2, 'AC_SHOWER', 2, 'Arrow Shower']] } },
		{ small: [['autospell', 2, 'SN_SHARPSHOOTING', 1, 'Sharpshooting'], ['autospell', 3, 'HT_BLITZBEAT', 2, 'Blitz Beat']],
			end: { n: 'Rapid Volley', fx: [['autospell', 3, 'AC_DOUBLE', 4, 'Double Strafe'], ['autospell', 3, 'AC_CHARGEARROW', 2, 'Arrow Repel'], ['autospell', 2, 'SN_SHARPSHOOTING', 2, 'Sharpshooting']] } },
	],
	[ // Thief
		{ small: [['autospell', 4, 'TF_POISON', 1, 'Envenom'], ['autospell', 3, 'AS_SONICBLOW', 1, 'Sonic Blow']],
			end: { n: 'Cutpurse Reflexes', fx: [['autospell', 3, 'AS_GRIMTOOTH', 2, 'Grimtooth'], ['autospell', 3, 'TF_SPRINKLESAND', 1, 'Sand Attack'], ['autospell', 3, 'TF_POISON', 3, 'Envenom']] } },
		{ small: [['autospell', 3, 'RG_BACKSTAP', 1, 'Back Stab'], ['autospell', 4, 'TF_THROWSTONE', 1, 'Stone Fling']],
			end: { n: 'Flicker Strikes', fx: [['autospell', 2, 'AS_SONICBLOW', 3, 'Sonic Blow'], ['autospell', 3, 'RG_RAID', 1, 'Raid'], ['autospell', 3, 'RG_INTIMIDATE', 1, 'Intimidate']] } },
	],
	[ // Merchant
		{ small: [['autospell', 4, 'MC_MAMMONITE', 1, 'Mammonite'], ['autospell', 3, 'MC_CARTREVOLUTION', 1, 'Cart Revolution']],
			end: { n: 'Pocket Knuckles', fx: [['autospell', 3, 'MC_MAMMONITE', 3, 'Mammonite'], ['autospell', 2, 'BS_HAMMERFALL', 1, 'Hammer Fall'], ['autospell', 4, 'MC_CARTREVOLUTION', 1, 'Cart Revolution']] } },
		{ small: [['autospell', 3, 'AM_DEMONSTRATION', 1, 'Bomb'], ['autospell', 2, 'AM_ACIDTERROR', 1, 'Acid Terror']],
			end: { n: 'Back-Alley Chemistry', fx: [['autospell', 3, 'AM_SPHEREMINE', 1, 'Marine Sphere'], ['autospell', 2, 'MC_MAMMONITE', 5, 'Mammonite'], ['autospell', 2, 'WS_CARTTERMINATION', 1, 'Cart Termination']] } },
	],
];
for (let s = 0; s < 6; s++) {
	[1, 15].forEach((slot, k) => {
		const anchor = byKey.get(`V${s}.${slot}`);
		const deg = secAngle(s) + (slot - (RING5.n - 1) / 2) * RING5.step;
		const u = [Math.cos(rad(deg)), Math.sin(rad(deg))];
		const def = REFLEX[s][k], sh = SHAPE.chain3;
		const made = sh.at.map(([d, l], i) => {
			const x = Math.round((anchor.x + d * u[0] - l * u[1]) * 10) / 10, y = Math.round((anchor.y + d * u[1] + l * u[0]) * 10) / 10;
			const key = `Y${s}.${slot}.${i}`;
			return i === sh.at.length - 1 ? add(key, 'notable', x, y, def.end.n, effects(def.end.fx)) : add(key, 'small', x, y, null, effects([def.small[i]]));
		});
		for (const [a, b] of sh.links) extraLinks.push([a === 'A' ? anchor : made[a], made[b], false]);
	});
}

// Rebirth (transcended) job-line branches on the far outer side: two per region, hung off ring 5 (slots 6 and 10), only for characters of
// that line who are reborn (High / Lord / Champion ...). Same codes as ASCEND; `label` is the rebirth class name.
const ASCEND_UP = [
	[ // Swordsman
		{ line: 'Knight', label: 'Lord Knight', code: 0x101, small: [['skatk', 6, 'LK_SPIRALPIERCE', 'Spiral Pierce'], ['skatk', 6, 'LK_HEADCRUSH', 'Head Crush']],
			mid: { n: "Berserker's Edge", fx: [['skatk', 8, 'LK_JOINTBEAT', 'Joint Beat'], ['hpp', 6], ['aspd', 3]] },
			cap: { n: 'Lord of the Blade', fx: [['skatk', 12, 'LK_SPIRALPIERCE', 'Spiral Pierce'], ['dmg', 6], ['hpr', 10]] } },
		{ line: 'Crusader', label: 'Paladin', code: 0x201, small: [['skatk', 6, 'PA_PRESSURE', 'Gloria Domini'], ['skatk', 6, 'PA_SHIELDCHAIN', 'Rapid Smiting']],
			mid: { n: 'Divine Bulwark', fx: [['reduce', 4], ['reflect', 8], ['rele', 10, 'Ele_Holy', 'Holy']] },
			cap: { n: 'Holy Knight', fx: [['skatk', 12, 'PA_PRESSURE', 'Gloria Domini'], ['hpp', 8], ['submagic', 6]] } },
	],
	[ // Acolyte
		{ line: 'Priest', label: 'High Priest', code: 0x104, small: [['skheal', 8, 'PR_SANCTUARY', 'Sanctuary'], ['skatk', 8, 'PR_TURNUNDEAD', 'Turn Undead']],
			mid: { n: 'Assumptio', fx: [['reduce', 5], ['spp', 5], ['regenhp', 1, 8000]] },
			cap: { n: "Archbishop's Grace", fx: [['skheal', 18, 'AL_HEAL', 'Heal'], ['sksp', 15, 'AL_HEAL', 'Heal'], ['healin', 10]] } },
		{ line: 'Monk', label: 'Champion', code: 0x204, small: [['skatk', 6, 'CH_PALMSTRIKE', 'Palm Strike'], ['skatk', 6, 'CH_TIGERFIST', 'Tiger Knuckle Fist']],
			mid: { n: 'Iron Fist', fx: [['skatk', 8, 'CH_CHAINCRUSH', 'Chain Crush Combo'], ['aspd', 4], ['hpr', 10]] },
			cap: { n: 'Fist of Asura', fx: [['skatk', 12, 'CH_PALMSTRIKE', 'Palm Strike'], ['skatk', 10, 'MO_EXTREMITYFIST', 'Asura Strike'], ['hpp', 8]] } },
	],
	[ // Mage
		{ line: 'Wizard', label: 'High Wizard', code: 0x102, small: [['skatk', 6, 'HW_NAPALMVULCAN', 'Napalm Vulcan'], ['skatk', 6, 'HW_MAGICCRASHER', 'Magic Crasher']],
			mid: { n: 'Arcane Overflow', fx: [['matkp', 8], ['spp', 6], ['ignoremdef', 8]] },
			cap: { n: 'Spell Sovereign', fx: [['skatk', 12, 'HW_NAPALMVULCAN', 'Napalm Vulcan'], ['mdmg', 8], ['cast', 6]] } },
		{ line: 'Sage', label: 'Professor', code: 0x202, small: [['mele', 8, 'Ele_Fire', 'Fire'], ['mele', 8, 'Ele_Water', 'Water']],
			mid: { n: 'Erudite', fx: [['spp', 8], ['spr', 12], ['spcost', 6]] },
			cap: { n: 'Lord of Lore', fx: [['matkp', 10], ['cast', 8], ['autospell', 3, 'WZ_JUPITEL', 3, 'Jupitel Thunder']] } },
	],
	[ // Archer
		{ line: 'Hunter', label: 'Sniper', code: 0x103, small: [['skatk', 6, 'SN_FALCONASSAULT', 'Falcon Assault'], ['skatk', 6, 'SN_SHARPSHOOTING', 'Sharpshooting']],
			mid: { n: 'Falcon Eyes', fx: [['ranged', 8], ['crit', 6], ['hit', 12]] },
			cap: { n: 'Wind Walker', fx: [['skatk', 12, 'SN_FALCONASSAULT', 'Falcon Assault'], ['critdmg', 12], ['speed', 4]] } },
		{ line: 'Bard / Dancer', label: 'Clown / Gypsy', code: 0x203, small: [['skatk', 6, 'CG_ARROWVULCAN', 'Arrow Vulcan'], ['skatk', 6, 'DC_THROWARROW', 'Slinging Arrow']],
			mid: { n: 'Showstopper', fx: [['spp', 8], ['aspd', 4], ['flee', 10]] },
			cap: { n: 'Headliner', fx: [['skatk', 12, 'CG_ARROWVULCAN', 'Arrow Vulcan'], ['ranged', 10], ['crit', 6]] } },
	],
	[ // Thief
		{ line: 'Assassin', label: 'Assassin Cross', code: 0x106, small: [['skatk', 6, 'ASC_BREAKER', 'Soul Destroyer'], ['skatk', 6, 'ASC_METEORASSAULT', 'Meteor Assault']],
			mid: { n: 'Poison Mastery', fx: [['addeff', 10, 'Eff_Poison', 'Poison'], ['critdmg', 12], ['crit', 8]] },
			cap: { n: 'Cross Impact', fx: [['skatk', 12, 'AS_SONICBLOW', 'Sonic Blow'], ['recast', 3, 'AS_SONICBLOW', 5, 'Sonic Blow'], ['aspd', 4]] } },
		{ line: 'Rogue', label: 'Stalker', code: 0x206, small: [['skatk', 6, 'RG_RAID', 'Raid'], ['skatk', 6, 'RG_BACKSTAP', 'Back Stab']],
			mid: { n: 'Shadow Stalking', fx: [['flee', 12], ['subranged', 8], ['speed', 6]] },
			cap: { n: 'Phantom Thief', fx: [['skatk', 12, 'RG_RAID', 'Raid'], ['flee2', 5], ['steal', 12]] } },
	],
	[ // Merchant
		{ line: 'Blacksmith', label: 'Whitesmith', code: 0x105, small: [['skatk', 6, 'WS_CARTTERMINATION', 'Cart Termination'], ['skatk', 6, 'BS_HAMMERFALL', 'Hammer Fall']],
			mid: { n: 'Overforge', fx: [['sklv', 1, 113, 5, 'Over Thrust'], ['atk', 12], ['unbreak', 30]] },
			cap: { n: 'Master Whitesmith', fx: [['skatk', 12, 'MC_CARTREVOLUTION', 'Cart Revolution'], ['dmg', 8], ['weight', 500]] } },
		{ line: 'Alchemist', label: 'Creator', code: 0x205, small: [['skatk', 6, 'CR_ACIDDEMONSTRATION', 'Acid Demonstration'], ['skheal', 8, 'CR_SLIMPITCHER', 'Slim Potion Pitcher']],
			mid: { n: 'Lab Rat', fx: [['potion', 15], ['spotion', 12], ['hpr', 8]] },
			cap: { n: 'Grand Alchemist', fx: [['skatk', 12, 'AM_ACIDTERROR', 'Acid Terror'], ['skatk', 12, 'AM_DEMONSTRATION', 'Bomb'], ['hp', 300]] } },
	],
];
for (let s = 0; s < 6; s++) {
	ASCEND_UP[s].forEach((b, bi) => {
		const slot = bi ? 10 : 6;
		const anchor = byKey.get(`V${s}.${slot}`);
		const deg = secAngle(s) + (slot - (RING5.n - 1) / 2) * RING5.step;
		const u = [Math.cos(rad(deg)), Math.sin(rad(deg))];
		const defs = [
			{ type: 'small', fx: [b.small[0]] }, { type: 'small', fx: [b.small[1]] },
			{ type: 'notable', n: b.mid.n, fx: b.mid.fx }, { type: 'notable', n: b.cap.n, fx: b.cap.fx },
		];
		let prev = anchor;
		defs.forEach((d, i) => {
			const dist = 75 + i * 70;
			const node = add(`U${s}.${bi}.${i}`, d.type, Math.round((anchor.x + dist * u[0]) * 10) / 10, Math.round((anchor.y + dist * u[1]) * 10) / 10, d.n || null, effects(d.fx));
			node.req = { name: b.line, code: b.code, up: true, label: b.label };
			extraLinks.push([prev, node, false]);
			prev = node;
		});
	});
}

// Teleport (portal) nodes: two pairs. A portal node hangs off a ring-5 node next to a rim keystone and is linked, across the whole tree,
// to its partner beside the opposite keystone, so allocating both carries you from one side of the tree to the other.
// Each gives +1 to one stat. [region of the ring-5 neighbour, slot, name, stat, partner index]
const PORTALS = [
	{ at: 'V3.0', stat: 'int', n: 'Gemless Rift', to: 1 },    // beside Gemless Grace (crit node)
	{ at: 'V0.0', stat: 'str', n: 'Glass Rift', to: 0 },       // beside Glass Cannon (stun node)
	{ at: 'V1.0', stat: 'vit', n: 'Bulwark Rift', to: 3 },    // beside Bulwark of Ages
	{ at: 'V3.16', stat: 'dex', n: "Gambler's Rift", to: 2 }, // beside Gambler's Fallacy
];
const portalNodes = PORTALS.map(p => {
	const anchor = byKey.get(p.at);
	const dist = Math.hypot(anchor.x, anchor.y);
	const k = (dist + 70) / dist;
	const x = Math.round(anchor.x * k * 10) / 10, y = Math.round(anchor.y * k * 10) / 10;
	const node = add(`P.${p.stat}`, 'portal', x, y, p.n, effects([[p.stat, 1]]));
	extraLinks.push([anchor, node, false]);
	return node;
});
PORTALS.forEach((p, i) => {
	const partner = portalNodes[p.to];
	portalNodes[i].info = `Teleport: leads across the tree to the ${PORTALS[p.to].n}. Take both ends to cross.`;
	portalNodes[i].partner = partner;
	if (i < p.to) extraLinks.push([portalNodes[i], partner, false, true]);
});

// race wagers: a plain node where each outer-ring keystone used to sit (ring 5 on the region border). More damage against a race,
// more damage taken from it; the ring runs through it and the keystone hangs off it one step further out.
const WAGER = [
	{ n: 'Undead Wager', race: 'RC_Undead', name: 'Undead' },       // Bulwark of Ages (Swordsman | Acolyte)
	{ n: 'Demon Wager', race: 'RC_Demon', name: 'Demon' },         // Blood Pact (Acolyte | Mage)
	{ n: 'Formless Wager', race: 'RC_Formless', name: 'Formless' }, // Gemless Grace (Mage | Archer)
	{ n: 'Insect Wager', race: 'RC_Insect', name: 'Insect' },      // Gambler's Fallacy (Archer | Thief)
	{ n: 'Plant Wager', race: 'RC_Plant', name: 'Plant' },         // Pyre Pact (Thief | Merchant)
	{ n: 'Brute Wager', race: 'RC_Brute', name: 'Brute' },         // Glass Cannon (Merchant | Swordsman)
];
for (let s = 0; s < 6; s++) {
	const [x, y] = pos(RING5.r, secAngle(s) + 30);
	const w = WAGER[s];
	const node = add(`KR${s}`, 'small', x, y, w.n, effects([['vsrace', 5, w.race, w.name], ['takemorerace', 5, w.race, w.name]]));
	extraLinks.push([byKey.get(`V${s}.${RING5.n - 1}`), node, true], [node, byKey.get(`V${(s + 1) % 6}.0`), true], [node, byKey.get(`KK${s}`), false]);
}

nodes.forEach((n, i) => { n.id = i + 1; });
for (const n of nodes) if (n.partner) n.partnerId = n.partner.id;
for (const n of nodes) if (n.type === 'mastery' && n.id < 100) throw new Error('mastery node ids must be 100 or more');
const id = key => { const n = byKey.get(key); if (!n) throw new Error('no node ' + key); return n.id; };

// edges: chains inside each ring slice, bridges across sector gaps on rings 4 and 2
for (let s = 0; s < 6; s++) {
	for (let k = 1; k <= 4; k++) {
		const g = RING[k];
		for (let j = 0; j < g.n - 1; j++) {
			if (!byKey.has(`R${k}.${s}.${j}`) || !byKey.has(`R${k}.${s}.${j + 1}`)) continue;
			link(id(`R${k}.${s}.${j}`), id(`R${k}.${s}.${j + 1}`), true);
		}
	}
	for (const k of [4, 3, 2]) {
		SPOKES[k].forEach(([jo, ji], n) => {
			const outer = `R${k}.${s}.${jo}`;
			const bridge = `B${k}.${s}.${n}`;
			link(id(outer), id(bridge));
			link(id(bridge), id(`R${k - 1}.${s}.${ji}`));
		});
	}
	// the regions only meet at the keystones on the rim (no direct bridge between neighbouring rings any more)
	link(id(`R4.${s}.${RING[4].n - 1}`), id(`K${s}`), true);
	link(id(`K${s}`), id(`R4.${(s + 1) % 6}.0`), true);
	// the origin opens the region at its inner notables; the gateway to the centre is for the Wanderer start only
	link(id(`S${s}`), id(`R1.${s}.1`));
	link(id(`S${s}`), id(`R1.${s}.3`));
	link(id(`S${s}`), id(`G${s}`));
	link(id(`G${s}`), id('HUB'));
}
for (const [a, b] of clusterLinks) link(a.id, b.id);
for (const [a, b, arc, portal] of extraLinks) link(a.id, b.id, arc, portal);

// ---------------------------------------------------------------- checks --
const adj = nodes.map(() => []);
for (const e of edges) { adj[e.a - 1].push(e.b); adj[e.b - 1].push(e.a); }
const seen = new Set(edges.map(e => `${Math.min(e.a, e.b)}-${Math.max(e.a, e.b)}`));
if (seen.size !== edges.length) throw new Error('duplicate edge');
for (const start of [1, 2, 3, 4, 5, 6, 7]) {
	const dist = new Map([[start, 0]]);
	const q = [start];
	while (q.length) { const c = q.shift(); for (const n of adj[c - 1]) if (!dist.has(n)) { dist.set(n, dist.get(c) + 1); q.push(n); } }
	if (dist.size !== nodes.length) throw new Error(`start ${start} reaches only ${dist.size}/${nodes.length}`);
	if (start === 1) console.log('swordsman start: nearest keystone', Math.min(...nodes.filter(n => n.type === 'key').map(n => dist.get(n.id))), 'steps, farthest node', Math.max(...dist.values()));
}
const bad = nodes.filter(n => !n.fx.length && n.type !== 'socket' && n.type !== 'mastery');
if (bad.length) throw new Error('node without effect ' + bad[0].key);
const kinds = t => nodes.filter(n => n.type === t).length;
console.log(`${nodes.length} nodes, ${edges.length} edges, ${kinds('notable')} notables, ${kinds('key')} keystones, ${kinds('socket')} card sockets, ${kinds('mastery')} masteries`);

async function fetchCached(file, url) {
	const dir = path.join(__dirname, '.cache');
	fs.mkdirSync(dir, { recursive: true });
	const f = path.join(dir, file);
	if (!fs.existsSync(f)) {
		const res = await fetch(url);
		if (!res.ok) throw new Error(`${url}: ${res.status}`);
		fs.writeFileSync(f, await res.text());
	}
	return fs.readFileSync(f, 'utf8');
}
const RA = 'https://raw.githubusercontent.com/rathena/rathena/master/db/';

// A long switch costs one comparison per case on every stat recalculation and hit rAthena's script instruction
// limit ("infinity loop"). This emits a binary search of if/else instead: about ten comparisons whatever the size.
// entries: [{ id, label, lines }] sorted by id; the generated code reads the id from .@id.
function dispatch(entries, ind) {
	const out = [];
	const emit = (list, pad) => {
		if (list.length <= 3) {
			list.forEach((e, i) => {
				out.push(`${pad}${i ? '} else ' : ''}if (.@id == ${e.id}) {\t// ${e.label}`);
				for (const l of e.lines) out.push(`${pad}\t${l}`);
			});
			out.push(`${pad}}`);
			return;
		}
		const mid = list.length >> 1;
		out.push(`${pad}if (.@id <= ${list[mid - 1].id}) {`);
		emit(list.slice(0, mid), pad + '\t');
		out.push(`${pad}} else {`);
		emit(list.slice(mid), pad + '\t');
		out.push(`${pad}}`);
	};
	emit(entries.slice().sort((a, b) => a.id - b.id), ind);
	return out.join('\n');
}

// ---------------------------------------------------------------- server output --
const S = n => (n > 0 ? `max(1,(.@m*${n}+50)/100)` : `min(-1,(.@m*(${n})-50)/100)`);
function writeServer() {
	let data = '';
	for (const n of nodes) {
		data += `\t.adj$[${n.id}] = "${adj[n.id - 1].sort((a, b) => a - b).join(',')}";\n`;
		if (n.type === 'socket') data += `\t.sock[${n.id}] = 1;\n`;
		if (n.type === 'key') data += `\t.key[${n.id}] = 1;\n`;
		if (n.wand) data += `\t.wand[${n.id}] = 1;\n`;
		if (n.falcon) data += `\t.fal[${n.id}] = 1;\n`;
		if (n.type === 'mastery') data += `\t.mast[${n.id}] = ${n.opts.length};\n`;
		if (n.req) {
			data += `\t.req[${n.id}] = ${n.req.code};\n\t.reqn$[${n.id}] = "${n.req.up ? n.req.label : n.req.name}";\n`;
			if (n.req.up) data += `\t.requp[${n.id}] = 1;\n`;
		}
		if (n.rs) data += `\t.rs[${n.id}] = ${n.rs.id * 1000 + n.rs.lv};\n\t.rsn$[${n.id}] = "${n.rs.name} level ${n.rs.lv}";\n`;
	}
	const entries = nodes.filter(n => n.fx.length).map(n => ({ id: n.id, label: n.name || n.fx[0].name, lines: n.fx.map(f => f.c(S)) }));
	for (const n of nodes.filter(n => n.type === 'mastery')) n.opts.forEach((o, i) => entries.push({ id: n.id * 10 + i + 1, label: `${n.name}: ${o.n}`, lines: o.fx.map(f => f.c(S)) }));
	const cases = dispatch(entries, '\t\t');
	const tpl = fs.readFileSync(path.join(__dirname, 'passive_tree.template.txt'), 'utf8');
	const out = tpl.replace('//@@DATA@@', `\t.N = ${nodes.length};\n\t.ver = ${TREE_VERSION};\n${data}`.replace(/\n$/, '')).replace('//@@CASES@@', cases);
	fs.writeFileSync(path.join(root, 'npc', 'passive_tree.txt'), out);
}

// ---------------------------------------------------------------- client output --
function writeClient() {
	const client = {
		lines: Object.fromEntries(ASCEND.flat().map(b => [b.code, b.line])),
		sectors: SECTORS.map((s, i) => ({ name: s.name, stat: s.stat.toUpperCase(), color: s.color, start: i + 1 })),
		nodes: nodes.map(n => ({
			id: n.id, t: { start: 'o', small: 's', notable: 'n', key: 'k', socket: 'j', mastery: 'm', portal: 'p' }[n.type], x: n.x, y: n.y,
			n: n.name || n.fx[0].name,
			fx: n.fx.map(f => ({ t: f.text, v: f.v, m: f.mul })),
			...(n.info ? { info: n.info } : {}),
			...(n.wand ? { w: 1 } : {}),
			...(n.partner ? { pt: n.partner.id } : {}),
			...(n.req ? { req: n.req.name, ...(n.req.up ? { up: 1, ul: n.req.label } : {}) } : {}),
			...(n.rs ? { rs: `${n.rs.name} Lv ${n.rs.lv}` } : {}),
			...(n.opts ? { opts: n.opts.map(o => ({ n: o.n, fx: o.fx.map(f => ({ t: f.text, v: f.v, m: f.mul })) })) } : {}),
		})),
		edges: edges.map(e => (e.portal ? [e.a, e.b, 2] : e.arc ? [e.a, e.b, 1] : [e.a, e.b])),
	};
	fs.writeFileSync(path.join(root, 'client', 'tree-data.js'), `// Generated by tools/build-tree.js. Do not edit by hand.\nexport const TREE = ${JSON.stringify(client)};\n`);
}

// ---------------------------------------------------------------- cards --
// Every plain card (4001-4999) whose script is only "bonus ..." lines can be socketed. The script is copied as is
// into F_PT_Card, one case per card, once for renewal and once for pre-renewal.
function parseCards(yml) {
	const cards = [];
	let cur = null, inScript = false;
	const flush = () => { if (cur && cur.type === 'Card' && cur.script !== null) cards.push(cur); };
	for (const line of yml.split('\n')) {
		let m;
		if ((m = /^  - Id: (\d+)/.exec(line))) { flush(); cur = { id: Number(m[1]), aegis: '', name: '', type: '', script: null }; inScript = false; continue; }
		if (!cur) continue;
		if (inScript) {
			if (/^      /.test(line) || line.trim() === '') { cur.script += line.replace(/^      /, '') + '\n'; continue; }
			inScript = false;
		}
		if ((m = /^    AegisName: (\S+)/.exec(line))) cur.aegis = m[1];
		else if ((m = /^    Name: (.*)$/.exec(line))) cur.name = m[1].trim();
		else if ((m = /^    Type: (\w+)/.exec(line))) cur.type = m[1];
		else if (/^    Script: \|/.test(line)) { cur.script = ''; inScript = true; }
		else if ((m = /^    Script: (.+)$/.exec(line))) cur.script = m[1] + '\n';
	}
	flush();
	return cards;
}
function plainBonus(script) {
	const text = script.replace(/\/\/.*$/gm, '').trim();
	if (!text) return null;
	const stmts = text.split(/;\s*/).map(t => t.trim()).filter(Boolean);
	if (!stmts.length || !stmts.every(t => /^bonus[2-5]?\s+b\w+/.test(t))) return null;
	if (/bAutoSpell|bonus_script|autobonus|getrefine|readparam|BaseLevel|JobLevel|Class\b|Job_|\bif\b|[{}]/.test(text.replace(/Class_\w+/g, ''))) return null;
	return stmts.map(t => t + ';');
}
// Cards that drop from an MVP (a monster with an MVP reward) are flagged 2: the "mvp_cards" setting decides if they may be socketed.
function mvpCardNames(mobYml) {
	const out = new Set();
	for (const block of mobYml.split(/^  - Id: /m).slice(1)) {
		if (!/^    (MvpExp|MvpDrops):/m.test(block)) continue;
		for (const m of block.matchAll(/Item: (\w+_Card)\b/g)) out.add(m[1]);
	}
	return out;
}
async function writeCards() {
	for (const [dir, era] of [['', 're'], ['pre-renewal', 'pre-re']]) {
		const cards = parseCards(await fetchCached(`item_db_etc_${era}.yml`, `${RA}${era}/item_db_etc.yml`)).filter(c => c.id >= 4001 && c.id <= 4999);
		const mvp = mvpCardNames(await fetchCached(`mob_db_${era}.yml`, `${RA}${era}/mob_db.yml`));
		const usable = cards.map(c => ({ ...c, lines: plainBonus(c.script) })).filter(c => c.lines);
		let ok = '';
		for (const c of usable) {
			ok += `\t$@PT_cardok[${c.id}] = ${mvp.has(c.aegis) ? 2 : 1};\n`;
		}
		const cases = dispatch(usable.map(c => ({ id: c.id, label: c.name, lines: c.lines })), '\t');
		const tpl = fs.readFileSync(path.join(__dirname, 'passive_tree_cards.template.txt'), 'utf8');
		const out = tpl.replace('//@@OK@@', ok.replace(/\n$/, '')).replace('//@@CASES@@', cases);
		const target = path.join(root, dir, 'npc', 'passive_tree_cards.txt');
		fs.mkdirSync(path.dirname(target), { recursive: true });
		fs.writeFileSync(target, out);
		console.log(`${era}: ${usable.length} of ${cards.length} cards can be socketed, ${usable.filter(c => mvp.has(c.aegis)).length} of them MVP cards`);
	}
}

// ---------------------------------------------------------------- learnable skills --
// The skill points on the ETC tab can learn any player skill of any class. The groups below name the skill-name prefixes
// (rAthena AegisName, "AL_HEAL" -> AL) that belong to each class; 'only: re' groups only exist on a renewal server.
// Written as client/skill-data.js (union of both eras, the window picks by the era the server reports) and
// as npc/passive_tree_skills.txt, once per era (the server only accepts what its own skill_db has).
const SKILL_GROUPS = [
	['Novice', ['NV']],
	['Swordman', ['SM']], ['Mage', ['MG']], ['Archer', ['AC']], ['Acolyte', ['AL']], ['Merchant', ['MC']], ['Thief', ['TF']],
	['Knight', ['KN']], ['Crusader', ['CR']], ['Priest', ['PR']], ['Monk', ['MO']], ['Wizard', ['WZ']], ['Sage', ['SA']],
	['Hunter', ['HT']], ['Bard / Dancer', ['BA', 'DC', 'BD']], ['Assassin', ['AS']], ['Rogue', ['RG']], ['Blacksmith', ['BS']], ['Alchemist', ['AM']],
	['Lord Knight', ['LK']], ['Paladin', ['PA']], ['High Priest', ['HP']], ['Champion', ['CH']], ['High Wizard', ['HW']], ['Professor', ['PF']],
	['Sniper', ['SN']], ['Clown / Gypsy', ['CG']], ['Assassin Cross', ['ASC']], ['Stalker', ['ST']], ['Whitesmith', ['WS']],
	['Taekwon', ['TK']], ['Star Gladiator', ['SG']], ['Soul Linker', ['SL']], ['Gunslinger', ['GS']], ['Ninja', ['NJ']],
	['Rune Knight', ['RK'], 're'], ['Warlock', ['WL'], 're'], ['Guillotine Cross', ['GC'], 're'], ['Arch Bishop', ['AB'], 're'], ['Ranger', ['RA'], 're'],
	['Mechanic', ['NC'], 're'], ['Shadow Chaser', ['SC'], 're'], ['Royal Guard', ['LG'], 're'], ['Sura', ['SR'], 're'],
	['Minstrel / Wanderer', ['MI', 'WA', 'WM'], 're'], ['Sorcerer', ['SO'], 're'], ['Genetic', ['GN'], 're'], ['Rebellion', ['RL'], 're'],
	['Star Emperor', ['SJ'], 're'], ['Soul Reaper', ['SP'], 're'], ['Kagerou / Oboro', ['KO', 'KG', 'OB'], 're'], ['Summoner', ['SU'], 're'],
	['4th class', ['DK', 'AG', 'IQ', 'IG', 'CD', 'SHC', 'MT', 'BO', 'ABC', 'WH', 'TR', 'EM', 'SH', 'NW', 'SOA', 'HN', 'SKE', 'SS'], 're'],
];
const SKILL_SKIP = new Set(['NV_BASIC']);
function parseSkills(yml) {
	const out = new Map();
	for (const block of yml.split(/^  - Id: /m).slice(1)) {
		const id = Number(/^(\d+)/.exec(block)[1]);
		const name = /^    Name: (\w+)/m.exec(block)?.[1];
		const desc = /^    Description: (.*)$/m.exec(block)?.[1]?.trim();
		const max = Number(/^    MaxLevel: (\d+)/m.exec(block)?.[1] || 0);
		if (!name || !desc || !max || SKILL_SKIP.has(name)) continue;
		const prefix = name.split('_')[0];
		const gi = SKILL_GROUPS.findIndex(g => g[1].includes(prefix));
		if (gi >= 0) out.set(id, { id, name, desc: desc.replace(/^"|"$/g, ''), max, group: gi });
	}
	return out;
}
async function writeSkills() {
	const eras = {};
	for (const era of ['pre-re', 're']) eras[era] = parseSkills(await fetchCached(`skill_db_${era}.yml`, `${RA}${era}/skill_db.yml`));
	// the window's catalogue: [id, name, max level in pre-renewal (0 = not there), max level in renewal, group]
	const ids = [...new Set([...eras['pre-re'].keys(), ...eras.re.keys()])].sort((a, b) => a - b);
	const rows = [];
	for (const id of ids) {
		const pre = eras['pre-re'].get(id), re = eras.re.get(id);
		const e = re || pre;
		const preOk = pre && !SKILL_GROUPS[pre.group][2];
		const reOk = !!re;
		if (!preOk && !reOk) continue;
		rows.push([id, e.desc, preOk ? pre.max : 0, reOk ? re.max : 0, e.group]);
	}
	const groups = SKILL_GROUPS.map(g => ({ n: g[0], re: g[2] === 're' ? 1 : 0 }));
	fs.writeFileSync(path.join(root, 'client', 'skill-data.js'), `// Generated by tools/build-tree.js. Do not edit by hand.
// SKILLS rows: [id, name, max level pre-renewal (0 = none), max level renewal (0 = none), group]
export const SKILL_GROUPS = ${JSON.stringify(groups)};
export const SKILLS = ${JSON.stringify(rows)};
`);
	const tpl = fs.readFileSync(path.join(__dirname, 'passive_tree_skills.template.txt'), 'utf8');
	for (const [dir, era] of [['', 're'], ['pre-renewal', 'pre-re']]) {
		const list = rows.filter(r => r[era === 're' ? 3 : 2] > 0);
		const ok = list.map(r => `\t$@PT_skok[${r[0]}] = ${r[era === 're' ? 3 : 2]};`).join('\n');
		const out = tpl.replace('//@@ERA@@', () => `\t$@PT_re = ${era === 're' ? 1 : 0};`).replace('//@@OK@@', () => ok);
		const target = path.join(root, dir, 'npc', 'passive_tree_skills.txt');
		fs.mkdirSync(path.dirname(target), { recursive: true });
		fs.writeFileSync(target, out);
		console.log(`${era}: ${list.length} learnable skills`);
	}
}

(async () => {
	// every skill the nodes name must exist in both eras' skill_db.yml
	const used = new Set();
	for (const m of fs.readFileSync(__filename, 'utf8').matchAll(/'(?:skatk|skheal|sksp|skcast|skcd|autospell|autospellhit|recast)',\s*\d+,\s*'([A-Z_]+)'/g)) used.add(m[1]);
	for (const k of Object.keys(SKREQ)) used.add(k);
	for (const era of ['re', 'pre-re']) {
		const db = await fetchCached(`skill_db_${era}.yml`, `${RA}${era}/skill_db.yml`);
		const names = new Set([...db.matchAll(/^    Name: (\w+)/gm)].map(m => m[1]));
		const missing = [...used].filter(n => !names.has(n));
		if (missing.length) throw new Error(`${era} skill_db has no ${missing.join(', ')}`);
	}
	writeServer();
	writeClient();
	await writeCards();
	await writeSkills();
})().catch(e => { console.error(e); process.exit(1); });
