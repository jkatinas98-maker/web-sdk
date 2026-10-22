// DEV-ONLY helper. When this app is opened without an `rgs_url`/`sessionID`
// query param (i.e. run standalone, not launched by Stake Engine's platform
// or a local math-sdk RGS mock server), there is no backend to ask for a
// real round. This generates a locally-faked book so the ticket can still
// be scratched and resolved end-to-end during front-end dev.
//
// The weights/logic here mirror games/scratch/scratch_sim.py and
// game_config.py (math-sdk repo) as closely as this file's different calling
// shape allows -- see the per-feature notes below for where they diverge.
// This is NOT the certified math; it exists only to drive the UI locally.
//
// Each difficulty still draws from its own pool of weights (see
// betModes[mode].symbols in config.ts for which ids belong to which mode —
// several ids are shared across modes, e.g. mult2/mult9 appear in all
// three, just drawn at different odds per mode). Medium and hard's weights
// are invented (skewed harder toward skull as the top payout climbs) to
// keep bigger wins feeling rare — same "not certified math" caveat applies
// to them as to easy's original numbers.
import type { SymbolName, RawSymbol, BetMode } from './types';
import type { BookEvent, ChestOutcome, ChestOutcomeKind, OctopusCard, SharkOutcome } from './typesBookEvent';
import config from './config';
import { KRAKEN_NUMBER_RANGE, rollKrakenPrize } from './kraken';

// `bonus`/`key` are folded in at a low weight — not rebalanced to an exact
// total, since weightedPick normalizes against the pool's actual total.
const WEIGHTS: Record<BetMode, Array<{ name: SymbolName; weight: number }>> = {
	// Identical to math-sdk game_config.py (calibrated by calibrate.py to
	// 96% total RTP, kraken weighted for ~1 in 5 cards).
	easy: [
		{ name: 'skull', weight: 70.8696 },
		{ name: 'bonus', weight: 0.8 },
		{ name: 'key', weight: 0.045 },
		{ name: 'kraken', weight: 1.5686 },
		{ name: 'shark', weight: 0.746 },
		{ name: 'mult1_5', weight: 14.1097 },
		{ name: 'mult2', weight: 8.4658 },
		{ name: 'mult4', weight: 5.6438 },
		{ name: 'mult9', weight: 2.822 },
		{ name: 'mult16', weight: 1.411 },
		{ name: 'mult45', weight: 0.4938 },
	],
	medium: [
		{ name: 'skull', weight: 72.3546 },
		{ name: 'bonus', weight: 0.6 },
		{ name: 'key', weight: 0.035 },
		{ name: 'kraken', weight: 2.1922 },
		{ name: 'shark', weight: 1.049 },
		{ name: 'mult1_5', weight: 17.5225 },
		{ name: 'mult2', weight: 10.2215 },
		{ name: 'mult5', weight: 6.5709 },
		{ name: 'mult9', weight: 5.1107 },
		{ name: 'mult41', weight: 2.9204 },
		{ name: 'mult110', weight: 1.4602 },
	],
	hard: [
		{ name: 'skull', weight: 75.6325 },
		{ name: 'bonus', weight: 0.4 },
		{ name: 'key', weight: 0.025 },
		{ name: 'kraken', weight: 3.0888 },
		{ name: 'shark', weight: 1.485 },
		{ name: 'mult2', weight: 20.6734 },
		{ name: 'mult6', weight: 11.2764 },
		{ name: 'mult9', weight: 7.5176 },
		{ name: 'mult36', weight: 4.6985 },
		{ name: 'mult130', weight: 2.2553 },
		{ name: 'mult1000', weight: 0.5638 },
	],
};

// Landing this many bonus scatters anywhere on the card awards free
// scratches, same "reach N occurrences" rule as every other symbol.
const BONUS_SCATTER_COUNT = 3;
const FREE_SCRATCHES_AWARDED = 10;

// --- Treasure Meter / Chest / Kraken -- mirrors game_config.py exactly ---
// (see that file's comments for why these numbers are what they are).
// Extra matching symbols (4th, 5th, ...) of the winning symbol each add
// this much to the win multiplier. PLACEHOLDER until the math is redone.
// Escalating: each list entry is what the 4th, 5th, 6th ... match adds;
// past the end of the list the last value repeats.
// Sized to each grid: the list covers every possible extra (easy 15 cells
// = 12 extras, medium 12 = 9, hard 9 = 6), escalating, with the last one
// (a whole grid of one symbol) a big jump.
export const EXTRA_MATCH_LADDER: Record<BetMode, number[]> = {
	easy: [0.25, 0.25, 0.5, 0.5, 1, 1, 1, 1, 1.5, 1.5, 2, 5],
	medium: [0.5, 0.5, 1, 1, 1.5, 1.5, 2, 3, 5],
	hard: [1, 1.5, 2, 2.5, 3, 5],
};

// A whole grid of skulls pays this (PLACEHOLDER -- math later). Odds at
// the current weights: about 1 in 450 cards on easy and medium, 1 in 110
// on hard, hence the smaller hard value.
export const SKULL_GRID_PRIZE: Record<BetMode, number> = { easy: 5, medium: 5, hard: 2 };
// What the k-th extra (1 = the 4th match) adds.
export const extraMatchBonus = (betMode: BetMode, k: number): number => {
	const l = EXTRA_MATCH_LADDER[betMode];
	return l[Math.min(k, l.length) - 1];
};
// Total added by the first `extras` extras.
export const extraMatchTotal = (betMode: BetMode, extras: number): number => {
	let sum = 0;
	for (let k = 1; k <= extras; k++) sum += extraMatchBonus(betMode, k);
	return Math.round(sum * 100) / 100;
};

const CHESTS_PER_TRIGGER = 3;
const CHEST_PRIZE_TABLE: Array<{ id: string; kind: ChestOutcomeKind; value: number; weight: number }> = [
	{ id: 'cash_small', kind: 'cash', value: 0.5, weight: 38 },
	{ id: 'cash_medium', kind: 'cash', value: 1.5, weight: 22 },
	{ id: 'cash_large', kind: 'cash', value: 4.0, weight: 7 },
	{ id: 'multiplier_boost', kind: 'multiplier', value: 1.5, weight: 6 },
	{ id: 'retrigger', kind: 'retrigger', value: 2, weight: 3 },
	{ id: 'key', kind: 'key', value: 1, weight: 1 },
];
const MAX_CHEST_OPENS_PER_ROUND = 60;

// Key feature (key symbol or Shark Bite -> Key): pick 1 of 3 chests.
// PLACEHOLDER prize tables (multiplier of the bet, weight) -- real math later.
const CHEST_PICK_TABLE: Record<BetMode, Array<[mult: number, weight: number]>> = {
	easy: [[1, 40], [2, 28], [3, 16], [5, 9], [10, 5], [20, 2]],
	medium: [[1, 38], [2, 27], [4, 16], [8, 10], [15, 5], [30, 3], [50, 1]],
	hard: [[2, 38], [4, 26], [8, 16], [15, 10], [30, 6], [75, 3], [150, 1]],
};
const rollChestPick = (betMode: BetMode): number => {
	const table = CHEST_PICK_TABLE[betMode];
	const total = table.reduce((s, [, w]) => s + w, 0);
	let r = Math.random() * total;
	for (const [m, w] of table) {
		r -= w;
		if (r <= 0) return m;
	}
	return table[0][0];
};
// "Missed" chests lean toward bigger prizes so the reveal teases.
const rollMissed = (betMode: BetMode): number => {
	const table = CHEST_PICK_TABLE[betMode];
	return table[Math.floor(Math.random() * table.length)][0];
};


// Free-scratch bonus multiplier, carried across the free cards of a bonus
// (createMockBet runs once per card, so this module-level value is what
// carries it from one free card to the next; reset on a paid round).
let bonusMultAcc = 0;

// --- Shark Bite (PLACEHOLDER numbers -- the real math comes later) ---
// `shark` weights above are set for ~1 in 10 cards showing at least one
// (q = 1 - 0.9^(1/panels), weight = q * total / (1 - q)). One roll per
// card no matter how many sharks landed.
const SHARK_OUTCOMES: Array<{ outcome: SharkOutcome; weight: number }> = [
	{ outcome: 'kraken', weight: 40 },
	{ outcome: 'octopus', weight: 20 },
	{ outcome: 'pirate', weight: 15 },
	{ outcome: 'key', weight: 15 },
	{ outcome: 'bonus', weight: 10 },
];
const OCTOPUS_EXTRA_CARDS = 3;

const rollSharkOutcome = (): SharkOutcome => {
	const total = SHARK_OUTCOMES.reduce((s, o) => s + o.weight, 0);
	let r = Math.random() * total;
	for (const { outcome, weight } of SHARK_OUTCOMES) {
		r -= weight;
		if (r <= 0) return outcome;
	}
	return SHARK_OUTCOMES[0].outcome;
};

// First paying symbol to reach 3 on the card, same rule as the main card.
const cardWinMult = (panels: RawSymbol[]): number => {
	const counts: Partial<Record<SymbolName, number>> = {};
	for (const { name } of panels) {
		const mult = config.symbols[name].mult;
		if (mult <= 0) continue;
		counts[name] = (counts[name] ?? 0) + 1;
		if (counts[name] === 3) return mult;
	}
	return 0;
};

// Octopus bonus card: plain skull + multiplier symbols only (no features
// inside a feature).
const FEATURE_SYMBOLS: SymbolName[] = ['bonus', 'key', 'kraken', 'shark'];
const dealPlainCard = (betMode: BetMode): OctopusCard => {
	const { cols, rows } = config.betModes[betMode];
	const panels: RawSymbol[] = [];
	for (let i = 0; i < cols * rows; i++) {
		let name = weightedPick(betMode);
		while (FEATURE_SYMBOLS.includes(name)) name = weightedPick(betMode);
		panels.push({ name });
	}
	return { panels, win: cardWinMult(panels) };
};

const weightedPick = (betMode: BetMode): SymbolName => {
	const pool = WEIGHTS[betMode];
	const total = pool.reduce((sum, w) => sum + w.weight, 0);
	let r = Math.random() * total;
	for (const { name, weight } of pool) {
		r -= weight;
		if (r <= 0) return name;
	}
	return pool[pool.length - 1].name;
};

const rollChestPrize = () => {
	const total = CHEST_PRIZE_TABLE.reduce((sum, row) => sum + row.weight, 0);
	let r = Math.random() * total;
	for (const row of CHEST_PRIZE_TABLE) {
		r -= row.weight;
		if (r <= 0) return row;
	}
	return CHEST_PRIZE_TABLE[CHEST_PRIZE_TABLE.length - 1];
};

// Mirrors scratch_sim.py's resolve_chest_sequence exactly: cash adds to the
// running total immediately, multiplier multiplies it, retrigger/key queue
// more opens (key = a whole extra sequence), all interleaved in resolution
// order rather than scored as three independent pulls.
const resolveChestSequence = (
	numOpens: number,
	opensBudget: number,
	currentTotal: number,
): { outcomes: ChestOutcome[]; total: number; opened: number } => {
	const outcomes: ChestOutcome[] = [];
	let total = currentTotal;
	let queue = numOpens;
	let opened = 0;
	while (queue > 0 && opened < opensBudget) {
		queue -= 1;
		opened += 1;
		const { id, kind, value } = rollChestPrize();
		outcomes.push({ id, kind, value });
		if (kind === 'cash') total += value;
		else if (kind === 'multiplier') total *= value;
		else if (kind === 'retrigger') queue += value;
		else if (kind === 'key') queue += value * CHESTS_PER_TRIGGER;
	}
	return { outcomes, total, opened };
};

export const createMockBet = (
	betMode: BetMode,
	betAmount: number,
	isFreeRound = false,
): { events: BookEvent[]; freeScratches: number } => {
	const { cols, rows } = config.betModes[betMode];
	const panelCount = cols * rows;

	if (!isFreeRound) {
		bonusMultAcc = 0;
	}

	const panels: RawSymbol[] = [];
	const counts: Partial<Record<SymbolName, number>> = {};
	let winMult = 0;
	let bonusCount = 0;
	let keyCount = 0;
	let krakenCount = 0;
	let sharkCount = 0;

	for (let i = 0; i < panelCount; i++) {
		const name = weightedPick(betMode);
		panels.push({ name });

		// Bonus is a scatter: it counts toward its own 3-of-a-kind trigger
		// but never toward (or against) the regular cash-win matching above.
		if (name === 'bonus') {
			bonusCount += 1;
			continue;
		}
		if (name === 'key') {
			keyCount += 1;
			continue;
		}
		if (name === 'kraken') {
			krakenCount += 1;
			continue;
		}
		if (name === 'shark') {
			sharkCount += 1;
			continue;
		}

		const mult = config.symbols[name].mult;
		if (mult > 0) {
			counts[name] = (counts[name] ?? 0) + 1;
			if (counts[name] === 3 && winMult === 0) {
				winMult = mult;
			}
		}
	}

	// Plain per-$1 multiplier, NOT pre-multiplied by betAmount -- this has to
	// match what the real uploaded math can actually send. A static,
	// pre-simulated book is bet-size-agnostic (it's generated once, long
	// before any player picks a bet), so it can only ever encode the
	// multiplier, same as the top-level payoutMultiplier. The real dollar
	// scaling happens in bookEventHandlerMap.ts, in one place, for both this
	// mock path and the real RGS path -- baking the multiply in here too
	// used to double it for mock mode once that fix landed.
	let winSymbol: SymbolName | null = null;
	for (const [name, c] of Object.entries(counts) as Array<[SymbolName, number]>) {
		if (c >= 3 && config.symbols[name].mult === winMult) winSymbol = name;
	}
	// Each matching symbol beyond the 3rd adds a flat bonus to the win
	// (+0.25x easy, +0.5x medium, +1x hard). Replaces the Treasure Meter.
	const extras = winSymbol ? Math.max(0, counts[winSymbol]! - 3) : 0;
	let amount = winMult + extraMatchTotal(betMode, extras);
	if (panels.every((p) => p.name === 'skull')) amount += SKULL_GRID_PRIZE[betMode];
	let freeScratches = bonusCount >= BONUS_SCATTER_COUNT ? FREE_SCRATCHES_AWARDED : 0;

	const events: BookEvent[] = [{ index: 0, type: 'revealPanels', panels, gameType: 'basegame' }];
	let idx = 1;

	// Landing >= 1 kraken symbol opens the number match; a match wins a
	// case-reel multiplier from the mode's prize table (see kraken.ts).
	if (krakenCount > 0) {
		const playerNumber = 1 + Math.floor(Math.random() * KRAKEN_NUMBER_RANGE);
		const krakenNumber = 1 + Math.floor(Math.random() * KRAKEN_NUMBER_RANGE);
		const hit = playerNumber === krakenNumber;
		const prize = hit ? rollKrakenPrize(betMode) : 0;
		amount += prize;
		events.push({
			index: idx,
			type: 'krakenResult',
			playerNumber,
			krakenNumber,
			hit,
			multiplier: prize,
			amount: prize,
		});
		idx += 1;
	}

	// Landing >= 1 shark rolls the Shark Bite bar once.
	let keyPicks = keyCount > 0 ? 1 : 0;
	if (sharkCount > 0) {
		const outcome = rollSharkOutcome();
		events.push({ index: idx, type: 'sharkBite', outcome });
		idx += 1;
		if (outcome === 'kraken') {
			const playerNumber = 1 + Math.floor(Math.random() * KRAKEN_NUMBER_RANGE);
			const krakenNumber = 1 + Math.floor(Math.random() * KRAKEN_NUMBER_RANGE);
			const hit = playerNumber === krakenNumber;
			const prize = hit ? rollKrakenPrize(betMode) : 0;
			amount += prize;
			events.push({ index: idx, type: 'krakenResult', playerNumber, krakenNumber, hit, multiplier: prize, amount: prize });
			idx += 1;
		} else if (outcome === 'octopus') {
			const cards = Array.from({ length: OCTOPUS_EXTRA_CARDS }, () => dealPlainCard(betMode));
			for (const card of cards) amount += card.win;
			events.push({ index: idx, type: 'octopusCards', cards });
			idx += 1;
		} else if (outcome === 'key') {
			keyPicks += 1;
		} else if (outcome === 'bonus') {
			freeScratches += FREE_SCRATCHES_AWARDED;
		} else if (outcome === 'pirate') {
			// Plunder the best multiplier symbol on the card (any count); if
			// there's none, the mode's lowest symbol.
			const modeSyms = config.betModes[betMode].symbols as SymbolName[];
			let best: SymbolName = modeSyms.reduce((a, b) => (config.symbols[a].mult <= config.symbols[b].mult ? a : b));
			for (const { name } of panels) {
				if (config.symbols[name].mult > config.symbols[best].mult) best = name;
			}
			const multiplier = config.symbols[best].mult;
			amount += multiplier;
			events.push({ index: idx, type: 'pirateBounty', symbol: best, multiplier, amount: multiplier });
			idx += 1;
		}
	}

	for (let p = 0; p < keyPicks; p++) {
		const win = rollChestPick(betMode);
		amount += win;
		events.push({ index: idx, type: 'chestPick', win, missed: [rollMissed(betMode), rollMissed(betMode)] });
		idx += 1;
	}

	// Bonus: a winning free card adds its multiplier to the running bonus
	// multiplier and pays bet x that total instead (x10 so far + a x2 card
	// -> this card pays x12; another x2 -> x14, ...).
	if (isFreeRound && amount > 0) {
		const added = Math.round(amount * 100) / 100;
		bonusMultAcc = Math.round((bonusMultAcc + added) * 100) / 100;
		amount = bonusMultAcc;
		events.push({ index: idx, type: 'bonusMultiplier', added, total: bonusMultAcc });
		idx += 1;
	}

	// The mode's advertised max win caps the whole card (mirrors the sim).
	amount = Math.min(amount, config.betModes[betMode].max_win);

	events.push({ index: idx, type: 'setTotalWin', amount });
	idx += 1;
	events.push({ index: idx, type: 'finalWin', amount });

	return { events, freeScratches };
};
