// Pirate Scratch -- the complete game rules, mirroring the certified math
// (math-sdk games/scratch/rules.py) rule for rule and number for number.
// The real game plays books generated from rules.py; this file drives the
// local demo (mockBet.ts) and the client-side displays (paytable, win
// tallies). If a rule or table changes on one side it must change on the
// other.
//
// One bet = one round = the base card plus, if the bonus triggers, every
// free-scratch card it awards -- all in the same book.

import config from './config';
import type { BetMode, SymbolName } from './types';
import type { BookEvent, SharkOutcome } from './typesBookEvent';

export const MAX_WIN: Record<BetMode, number> = { easy: 110, medium: 1000, hard: 2500 };

// Calibrated draw weights (math-sdk calibrate.py -> weights.json).
export const WEIGHTS: Record<BetMode, Partial<Record<SymbolName, number>>> = {
	easy: {
		skull: 105.8078,
		mult1_5: 14.1097,
		mult2: 8.4658,
		mult4: 5.6438,
		mult16: 2.3038,
		mult45: 0.9907,
		mult110: 0.3656,
		kraken: 1.7309,
		shark: 1.0028,
		key: 0.0479,
		bonus: 2.8033,
	},
	medium: {
		skull: 115.6729,
		mult1_5: 17.5225,
		mult2: 10.2215,
		mult5: 6.5709,
		mult41: 2.9922,
		mult110: 2.0769,
		mult1000: 0.6921,
		kraken: 2.4668,
		shark: 1.4301,
		key: 0.0683,
		bonus: 3.8804,
	},
	hard: {
		skull: 106.8569,
		mult2: 17.9649,
		mult6: 11.7362,
		mult9: 8.5658,
		mult36: 4.0919,
		mult130: 2.6814,
		mult1000: 1.0075,
		mult2500: 0.3699,
		kraken: 3.2822,
		shark: 1.9048,
		key: 0.0911,
		bonus: 5.1125,
	},
};

export const FREE_SCRATCHES_AWARDED = 10;
const BONUS_TRIGGER_COUNT = 3;
const MAX_FREE_CARDS = 100;
const FEATURE_SYMBOLS: SymbolName[] = ['bonus', 'key', 'kraken', 'shark'];
const ONE_PER_CARD: SymbolName[] = ['kraken', 'shark', 'key'];

// What the 4th, 5th, 6th ... copy of a winning symbol adds (last repeats).
export const EXTRA_MATCH_LADDER: Record<BetMode, number[]> = {
	easy: [0.25, 0.25, 0.5, 0.5, 1, 1, 1, 1, 1.5, 1.5, 2, 5],
	medium: [0.5, 0.5, 1, 1, 1.5, 1.5, 2, 3, 5],
	hard: [1, 1.5, 2, 2.5, 3, 5],
};
export const extraMatchBonus = (betMode: BetMode, k: number): number => {
	const l = EXTRA_MATCH_LADDER[betMode];
	return l[Math.min(k, l.length) - 1];
};
export const extraMatchTotal = (betMode: BetMode, extras: number): number => {
	let sum = 0;
	for (let k = 1; k <= extras; k++) sum += extraMatchBonus(betMode, k);
	return Math.round(sum * 100) / 100;
};

export const SKULL_GRID_PRIZE: Record<BetMode, number> = { easy: 5, medium: 5, hard: 2 };

export const KRAKEN_NUMBER_RANGE = 10;
export const KRAKEN_PRIZE_TABLE: Record<BetMode, Array<[mult: number, weight: number]>> = {
	easy: [[2, 4785.1], [3, 2830.7], [5, 1461.0], [10, 595.5], [20, 242.7], [45, 84.9]],
	medium: [[2, 4967.8], [3, 2845.1], [5, 1409.7], [10, 543.6], [25, 154.3], [50, 59.5], [110, 20.1]],
	hard: [[2, 4986.9], [3, 2859.3], [5, 1418.8], [10, 548.2], [25, 156.0], [100, 23.3], [250, 6.6], [1000, 1.0]],
};

export const SHARK_OUTCOMES: Record<BetMode, Array<[SharkOutcome, number]>> = {
	easy: [['kraken', 53], ['octopus', 25], ['pirate', 6], ['key', 12], ['bonus', 4]],
	medium: [['kraken', 57.5], ['octopus', 25], ['pirate', 1.5], ['key', 12], ['bonus', 4]],
	hard: [['kraken', 58], ['octopus', 25], ['pirate', 1], ['key', 12], ['bonus', 4]],
};
const OCTOPUS_EXTRA_CARDS = 3;

export const CHEST_PICK_TABLE: Record<BetMode, Array<[mult: number, weight: number]>> = {
	easy: [[1, 40], [2, 28], [3, 16], [5, 9], [10, 5], [20, 2]],
	medium: [[1, 40], [2, 28], [3, 15], [5, 9], [10, 5], [25, 2], [50, 1]],
	hard: [[1, 40], [2, 26], [4, 16], [8, 10], [15, 5], [40, 2], [100, 1]],
};

// ---------------------------------------------------------------------------

const roll = <T>(table: Array<[T, number]>, random = Math.random): T => {
	const total = table.reduce((s, [, w]) => s + w, 0);
	let r = random() * total;
	for (const [v, w] of table) {
		r -= w;
		if (r < 0) return v;
	}
	return table[table.length - 1][0];
};

const paying = (betMode: BetMode) => config.betModes[betMode].symbols as SymbolName[];
const multOf = (name: SymbolName) => config.symbols[name].mult;

/** Every paying symbol with 3+ pays its multiplier + its extra-match bonus. */
export const cardMatchWin = (betMode: BetMode, panels: SymbolName[]): number => {
	const counts = new Map<SymbolName, number>();
	for (const n of panels) if (multOf(n) > 0) counts.set(n, (counts.get(n) ?? 0) + 1);
	let total = 0;
	for (const [n, c] of counts) if (c >= 3) total += multOf(n) + extraMatchTotal(betMode, c - 3);
	return Math.round(total * 100) / 100;
};

const pick = (betMode: BetMode, plain: boolean): SymbolName => {
	const table = Object.entries(WEIGHTS[betMode]).filter(
		([n]) => !plain || !FEATURE_SYMBOLS.includes(n as SymbolName),
	) as Array<[SymbolName, number]>;
	return roll(table);
};

const deal = (betMode: BetMode, plain = false): SymbolName[] => {
	const { cols, rows } = config.betModes[betMode];
	const out: SymbolName[] = [];
	const dealt = new Set<SymbolName>();
	for (let i = 0; i < cols * rows; i++) {
		let n = pick(betMode, plain);
		while (ONE_PER_CARD.includes(n) && dealt.has(n)) n = pick(betMode, plain);
		dealt.add(n);
		out.push(n);
	}
	return out;
};

const krakenMatch = (betMode: BetMode) => {
	const playerNumber = 1 + Math.floor(Math.random() * KRAKEN_NUMBER_RANGE);
	const krakenNumber = 1 + Math.floor(Math.random() * KRAKEN_NUMBER_RANGE);
	const hit = playerNumber === krakenNumber;
	const prize = hit ? roll(KRAKEN_PRIZE_TABLE[betMode]) : 0;
	return { playerNumber, krakenNumber, hit, multiplier: prize, amount: prize };
};

const chestPick = (betMode: BetMode) => {
	const t = CHEST_PICK_TABLE[betMode];
	const win = roll(t);
	const missed: [number, number] = [
		t[Math.floor(Math.random() * t.length)][0],
		t[Math.floor(Math.random() * t.length)][0],
	];
	return { win, missed };
};

type Ev = Omit<BookEvent, 'index'> & Record<string, unknown>;

const playCard = (betMode: BetMode, gameType: 'basegame' | 'freegame') => {
	const panels = deal(betMode);
	const events: Ev[] = [{ type: 'revealPanels', panels: panels.map((name) => ({ name })), gameType } as Ev];
	let amount = cardMatchWin(betMode, panels);
	if (panels.every((n) => n === 'skull')) amount += SKULL_GRID_PRIZE[betMode];
	let free = panels.filter((n) => n === 'bonus').length >= BONUS_TRIGGER_COUNT ? FREE_SCRATCHES_AWARDED : 0;

	if (panels.includes('kraken')) {
		const k = krakenMatch(betMode);
		amount += k.amount;
		events.push({ type: 'krakenResult', ...k } as Ev);
	}
	let keyPicks = panels.includes('key') ? 1 : 0;

	if (panels.includes('shark')) {
		const outcome = roll(SHARK_OUTCOMES[betMode]);
		events.push({ type: 'sharkBite', outcome } as Ev);
		if (outcome === 'kraken') {
			const k = krakenMatch(betMode);
			amount += k.amount;
			events.push({ type: 'krakenResult', ...k } as Ev);
		} else if (outcome === 'octopus') {
			const cards = Array.from({ length: OCTOPUS_EXTRA_CARDS }, () => {
				const p = deal(betMode, true);
				return { panels: p.map((name) => ({ name })), win: cardMatchWin(betMode, p) };
			});
			amount += cards.reduce((s, c) => s + c.win, 0);
			events.push({ type: 'octopusCards', cards } as Ev);
		} else if (outcome === 'pirate') {
			const syms = paying(betMode);
			let best = syms.reduce((a, b) => (multOf(a) <= multOf(b) ? a : b));
			for (const n of panels) if (multOf(n) > multOf(best)) best = n;
			const m = multOf(best);
			amount += m;
			events.push({ type: 'pirateBounty', symbol: best, multiplier: m, amount: m } as Ev);
		} else if (outcome === 'key') {
			keyPicks += 1;
		} else if (outcome === 'bonus') {
			free += FREE_SCRATCHES_AWARDED;
		}
	}

	for (let i = 0; i < keyPicks; i++) {
		const { win, missed } = chestPick(betMode);
		amount += win;
		events.push({ type: 'chestPick', win, missed } as Ev);
	}
	if (free) events.push({ type: 'freeScratchesAwarded', count: free } as Ev);
	return { amount: Math.round(amount * 100) / 100, free, events };
};

/** A whole round as one book: base card, then every free card. */
export const playRound = (betMode: BetMode): { events: BookEvent[]; payout: number } => {
	const events: Ev[] = [];
	const base = playCard(betMode, 'basegame');
	events.push(...base.events);
	let total = base.amount;
	let queue = base.free;
	let bonusMult = 0;
	let played = 0;
	while (queue > 0 && played < MAX_FREE_CARDS) {
		queue -= 1;
		played += 1;
		const c = playCard(betMode, 'freegame');
		events.push(...c.events);
		queue += c.free;
		if (c.amount > 0) {
			bonusMult = Math.round((bonusMult + c.amount) * 100) / 100;
			events.push({ type: 'bonusMultiplier', added: c.amount, total: bonusMult } as Ev);
			total += bonusMult;
		}
	}
	const payout = Math.min(Math.round(total * 100) / 100, MAX_WIN[betMode]);
	events.push({ type: 'setTotalWin', amount: payout } as Ev);
	events.push({ type: 'finalWin', amount: payout } as Ev);
	return { events: events.map((e, index) => ({ ...e, index }) as BookEvent), payout };
};
