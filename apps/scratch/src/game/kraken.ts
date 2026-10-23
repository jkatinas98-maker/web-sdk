import config from './config';
import type { BetMode, SymbolName } from './types';

// Kraken feature tables -- mirror game_config.py (math-sdk) exactly.
// Landing >= 1 `kraken` symbol on a card opens the number match (player's
// number vs. the Kraken's, each 1..KRAKEN_NUMBER_RANGE); a match opens a
// CS2-style case reel that lands on one of these multipliers of the bet,
// 2x up to the mode's max win, big values rare (avg ~4x).
// Tables live in rules.ts (mirrors the certified math); re-exported here.
import { KRAKEN_NUMBER_RANGE, KRAKEN_PRIZE_TABLE } from './rules';
export { KRAKEN_NUMBER_RANGE, KRAKEN_PRIZE_TABLE };

export const rollKrakenPrize = (betMode: BetMode, random = Math.random): number => {
	const table = KRAKEN_PRIZE_TABLE[betMode];
	const total = table.reduce((sum, [, w]) => sum + w, 0);
	let r = random() * total;
	for (const [mult, w] of table) {
		r -= w;
		if (r <= 0) return mult;
	}
	return table[table.length - 1][0];
};

// CS2-style rarity colour for a prize, by its tier within the mode's
// table: the top prize is gold, then red, pink, purple, and the common
// low tiers blue.
export type Rarity = 'blue' | 'purple' | 'pink' | 'red' | 'gold';

export const krakenPrizeRarity = (betMode: BetMode, mult: number): Rarity => {
	const table = KRAKEN_PRIZE_TABLE[betMode];
	const fromTop = table.length - 1 - table.findIndex(([m]) => m === mult);
	if (fromTop <= 0) return 'gold';
	if (fromTop === 1) return 'red';
	if (fromTop === 2) return 'pink';
	if (fromTop === 3) return 'purple';
	return 'blue';
};

// Symbol art shown on each case-reel tile: the mode's highest-paying symbol
// that doesn't exceed the prize (so a 1000x prize shows the 1000x symbol,
// a 250x prize the 130x one), falling back to the mode's lowest symbol.
export const krakenPrizeSymbol = (betMode: BetMode, mult: number): SymbolName => {
	const symbols = [...(config.betModes[betMode].symbols as SymbolName[])].sort(
		(a, b) => config.symbols[a].mult - config.symbols[b].mult,
	);
	let pick = symbols[0];
	for (const s of symbols) if (config.symbols[s].mult <= mult) pick = s;
	return pick;
};
