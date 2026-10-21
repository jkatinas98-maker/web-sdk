import type { BetMode } from './types';

// Kraken feature tables -- mirror game_config.py (math-sdk) exactly.
// Landing >= 1 `kraken` symbol on a card opens the number match (player's
// number vs. the Kraken's, each 1..KRAKEN_NUMBER_RANGE); a match opens a
// CS2-style case reel that lands on one of these multipliers of the bet,
// 2x up to the mode's max win, big values rare (avg ~4x).
export const KRAKEN_NUMBER_RANGE = 10;

export const KRAKEN_PRIZE_TABLE: Record<BetMode, Array<[mult: number, weight: number]>> = {
	easy: [
		[2, 4785.1],
		[3, 2830.7],
		[5, 1461.0],
		[10, 595.5],
		[20, 242.7],
		[45, 84.9],
	],
	medium: [
		[2, 4967.8],
		[3, 2845.1],
		[5, 1409.7],
		[10, 543.6],
		[25, 154.3],
		[50, 59.5],
		[110, 20.1],
	],
	hard: [
		[2, 4986.9],
		[3, 2859.3],
		[5, 1418.8],
		[10, 548.2],
		[25, 156.0],
		[100, 23.3],
		[250, 6.6],
		[1000, 1.0],
	],
};

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
