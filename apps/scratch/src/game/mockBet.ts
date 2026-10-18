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
import type { SymbolName, RawSymbol } from './types';
import type { BookEvent } from './typesBookEvent';
import config from './config';

const WEIGHTS: Array<{ name: SymbolName; weight: number }> = [
	{ name: 'skull', weight: 66.8504 },
	{ name: 'coin', weight: 14.1968 },
	{ name: 'wallet', weight: 8.5181 },
	{ name: 'chest', weight: 5.6787 },
	{ name: 'crown', weight: 2.8394 },
	{ name: 'star', weight: 1.4197 },
	{ name: 'diamond', weight: 0.4969 },
];

const weightedPick = (): SymbolName => {
	const total = WEIGHTS.reduce((sum, w) => sum + w.weight, 0);
	let r = Math.random() * total;
	for (const { name, weight } of WEIGHTS) {
		r -= weight;
		if (r <= 0) return name;
	}
	return WEIGHTS[WEIGHTS.length - 1].name;
};

export const createMockBet = (betMode: keyof typeof config.betModes): BookEvent[] => {
	const { cols, rows } = config.betModes[betMode];
	const panelCount = cols * rows;

	const panels: RawSymbol[] = [];
	const counts: Partial<Record<SymbolName, number>> = {};
	let winMult = 0;

	for (let i = 0; i < panelCount; i++) {
		const name = weightedPick();
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

	const amount = winMult * config.betModes[betMode].cost;

	return [
		{ index: 0, type: 'revealPanels', panels, gameType: 'basegame' },
		{ index: 1, type: 'setTotalWin', amount },
		{ index: 2, type: 'finalWin', amount },
	];
};
