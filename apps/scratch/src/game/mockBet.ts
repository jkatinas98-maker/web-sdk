// DEV-ONLY helper. When this app is opened without an `rgs_url`/`sessionID`
// query param (i.e. run standalone, not launched by Stake Engine's platform
// or a local math-sdk RGS mock server), there is no backend to ask for a
// real round. This generates a locally-faked book so the ticket can still
// be scratched and resolved end-to-end during front-end dev.
//
// The weights/logic here mirror games/scratch/scratch_sim.py's easy-mode
// symbol distribution and its sequential "stop at first symbol to reach 3
// countable matches, skull (mult 0) never counts" rule — see the earlier
// sketch3.py simulation. This is NOT the certified math; it exists only to
// drive the UI during local development.
//
// Each difficulty draws from its own symbol pool now (see
// betModes[mode].symbols in config.ts) since every mode has a fully
// distinct set of paying symbols rather than one shared paytable. Medium
// and hard's weights are invented (skewed harder toward skull as the top
// payout climbs) to keep bigger wins feeling rare — same "not certified
// math" caveat applies to them as to easy's original numbers.
import type { SymbolName, RawSymbol, BetMode } from './types';
import type { BookEvent } from './typesBookEvent';
import config from './config';

const WEIGHTS: Record<BetMode, Array<{ name: SymbolName; weight: number }>> = {
	easy: [
		{ name: 'skull', weight: 66.8504 },
		{ name: 'easy1', weight: 14.1968 },
		{ name: 'easy2', weight: 8.5181 },
		{ name: 'easy3', weight: 5.6787 },
		{ name: 'easy4', weight: 2.8394 },
		{ name: 'easy5', weight: 1.4197 },
		{ name: 'easy6', weight: 0.4969 },
	],
	medium: [
		{ name: 'skull', weight: 70 },
		{ name: 'medium1', weight: 12 },
		{ name: 'medium2', weight: 7 },
		{ name: 'medium3', weight: 4.5 },
		{ name: 'medium4', weight: 3.5 },
		{ name: 'medium5', weight: 2 },
		{ name: 'medium6', weight: 1 },
	],
	hard: [
		{ name: 'skull', weight: 75 },
		{ name: 'hard1', weight: 11 },
		{ name: 'hard2', weight: 6 },
		{ name: 'hard3', weight: 4 },
		{ name: 'hard4', weight: 2.5 },
		{ name: 'hard5', weight: 1.2 },
		{ name: 'hard6', weight: 0.3 },
	],
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

export const createMockBet = (
	betMode: keyof typeof config.betModes,
	betAmount: number,
): BookEvent[] => {
	const { cols, rows } = config.betModes[betMode];
	const panelCount = cols * rows;

	const panels: RawSymbol[] = [];
	const counts: Partial<Record<SymbolName, number>> = {};
	let winMult = 0;

	for (let i = 0; i < panelCount; i++) {
		const name = weightedPick(betMode);
		panels.push({ name });

		const mult = config.symbols[name].mult;
		if (mult > 0) {
			counts[name] = (counts[name] ?? 0) + 1;
			if (counts[name] === 3 && winMult === 0) {
				winMult = mult;
			}
		}
	}

	// Pad the rest of the ticket with non-matching filler so the grid is
	// always full-size even after an early stop (the real sim does the
	// same — a resolved ticket still shows every panel, just un-animated).
	while (panels.length < panelCount) {
		panels.push({ name: 'skull' });
	}

	const amount = winMult * betAmount;

	return [
		{ index: 0, type: 'revealPanels', panels, gameType: 'basegame' },
		{ index: 1, type: 'setTotalWin', amount },
		{ index: 2, type: 'finalWin', amount },
	];
};
