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
import type { BookEvent, ChestOutcome, ChestOutcomeKind } from './typesBookEvent';
import config from './config';
import { KRAKEN_NUMBER_RANGE, rollKrakenPrize } from './kraken';

// `bonus`/`key` are folded in at a low weight — not rebalanced to an exact
// total, since weightedPick normalizes against the pool's actual total.
const WEIGHTS: Record<BetMode, Array<{ name: SymbolName; weight: number }>> = {
	easy: [
		{ name: 'skull', weight: 66.8504 },
		{ name: 'bonus', weight: 0.8 },
		{ name: 'key', weight: 0.045 },
		{ name: 'kraken', weight: 1.5686 },
		{ name: 'mult1_5', weight: 14.1968 },
		{ name: 'mult2', weight: 8.5181 },
		{ name: 'mult4', weight: 5.6787 },
		{ name: 'mult9', weight: 2.8394 },
		{ name: 'mult16', weight: 1.4197 },
		{ name: 'mult45', weight: 0.4969 },
	],
	medium: [
		{ name: 'skull', weight: 70 },
		{ name: 'bonus', weight: 0.6 },
		{ name: 'key', weight: 0.035 },
		{ name: 'kraken', weight: 2.13 },
		{ name: 'mult1_5', weight: 12 },
		{ name: 'mult2', weight: 7 },
		{ name: 'mult5', weight: 4.5 },
		{ name: 'mult9', weight: 3.5 },
		{ name: 'mult41', weight: 2 },
		{ name: 'mult110', weight: 1 },
	],
	hard: [
		{ name: 'skull', weight: 75 },
		{ name: 'bonus', weight: 0.4 },
		{ name: 'key', weight: 0.025 },
		{ name: 'kraken', weight: 3.05 },
		{ name: 'mult2', weight: 11 },
		{ name: 'mult6', weight: 6 },
		{ name: 'mult9', weight: 4 },
		{ name: 'mult36', weight: 2.5 },
		{ name: 'mult130', weight: 1.2 },
		{ name: 'mult1000', weight: 0.3 },
	],
};

// Landing this many bonus scatters anywhere on the card awards free
// scratches, same "reach N occurrences" rule as every other symbol.
const BONUS_SCATTER_COUNT = 3;
const FREE_SCRATCHES_AWARDED = 10;

// --- Treasure Meter / Chest / Kraken -- mirrors game_config.py exactly ---
// (see that file's comments for why these numbers are what they are).
const TREASURE_METER_THRESHOLD: Record<BetMode, number> = { easy: 4, medium: 3, hard: 3 };
const TREASURE_METER_POINTS: Record<4 | 5, number> = { 4: 1, 5: 2 };

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


// The real math-sdk simulator bundles a whole round (base card + every
// free-scratch card it awards) into ONE book, so the Treasure Meter's
// points accumulate across all of them before being checked against the
// threshold. This front end's mock mode instead calls createMockBet once
// PER CARD (Game.svelte re-calls it for each free scratch the player taps
// through individually) -- so to approximate the same "accumulates across
// the round" behavior here, the running total lives in this module-level
// variable across calls, and is reset only when a fresh (non-free) round
// starts. This is a mock-mode-only approximation; the real book's totals
// come from scratch_sim.py's play_round, which has no such split.
let meterPointsAcc = 0;

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

	if (!isFreeRound) meterPointsAcc = 0;

	const panels: RawSymbol[] = [];
	const counts: Partial<Record<SymbolName, number>> = {};
	let winMult = 0;
	let bonusCount = 0;
	let keyCount = 0;
	let krakenCount = 0;

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
	let amount = winMult;
	const freeScratches = bonusCount >= BONUS_SCATTER_COUNT ? FREE_SCRATCHES_AWARDED : 0;

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

	let meterPoints = 0;
	for (const count of Object.values(counts)) {
		if (count! >= 5) meterPoints += TREASURE_METER_POINTS[5];
		else if (count === 4) meterPoints += TREASURE_METER_POINTS[4];
	}
	meterPointsAcc += meterPoints;

	let chestTriggers = keyCount;
	const threshold = TREASURE_METER_THRESHOLD[betMode];
	while (meterPointsAcc >= threshold) {
		meterPointsAcc -= threshold;
		chestTriggers += 1;
	}

	let chestOpensUsed = 0;
	for (let t = 0; t < chestTriggers; t++) {
		if (chestOpensUsed >= MAX_CHEST_OPENS_PER_ROUND) break;
		const { outcomes, total, opened } = resolveChestSequence(
			CHESTS_PER_TRIGGER,
			MAX_CHEST_OPENS_PER_ROUND - chestOpensUsed,
			amount,
		);
		chestOpensUsed += opened;
		amount = total;
		events.push({ index: idx, type: 'chestSequence', chests: outcomes });
		idx += 1;
	}

	// The mode's advertised max win caps the whole card (mirrors the sim).
	amount = Math.min(amount, config.betModes[betMode].max_win);

	events.push({ index: idx, type: 'setTotalWin', amount });
	idx += 1;
	events.push({ index: idx, type: 'finalWin', amount });

	return { events, freeScratches };
};
