import config from './config';
import { extraMatchBonus, extraMatchTotal } from './rules';
import type { BetMode, SymbolName } from './types';

// Shared timing for the win reveal so the tiles (Cell.svelte) and the tally
// pills (Game.svelte) stay in step. Every winning symbol (3+ on the card)
// plays its own segment, one after another, biggest multiplier first:
//   its 3 matching tiles tick in MATCH_GAP_MS apart (dark green),
//   then each extra tile (4th, 5th, ...) bursts EXTRA_GAP_MS apart (gold).
export const MATCH_GAP_MS = 260;
const MATCH_LEAD_MS = 150;
const MATCH_TAIL_MS = 200;
const EXTRA_LEAD_MS = 450;
export const EXTRA_GAP_MS = 550;
const SEGMENT_GAP_MS = 350;

export type CellWinInfo = {
	matchIndex: number; // 1..3, or 0
	matchDelay: number; // ms from reveal
	matchMult: number;
	extraIndex: number; // 1.. for 4th, 5th, ..., or 0
	extraDelay: number;
	extraStep: number;
};

export type WinSegment = {
	symbol: SymbolName;
	mult: number;
	extras: number;
	showAt: number; // tally pill appears (after the 3rd match tile)
	bumps: Array<{ at: number; value: number; step: number }>;
};

// Winning symbols (3+ of a paying symbol), biggest multiplier first.
export const findWinningSymbols = (panels: Array<{ name: SymbolName } | undefined>): SymbolName[] => {
	const counts = new Map<SymbolName, number>();
	for (const p of panels) {
		if (!p || config.symbols[p.name].mult <= 0) continue;
		counts.set(p.name, (counts.get(p.name) ?? 0) + 1);
	}
	return [...counts.entries()]
		.filter(([, c]) => c >= 3)
		.map(([n]) => n)
		.sort((a, b) => config.symbols[b].mult - config.symbols[a].mult);
};

export const buildWinSchedule = (
	panels: Array<{ name: SymbolName } | undefined>,
	winners: SymbolName[],
	betMode: BetMode,
): { cells: Map<number, CellWinInfo>; segments: WinSegment[]; total: number } => {
	const cells = new Map<number, CellWinInfo>();
	const segments: WinSegment[] = [];
	let t = 0;
	for (const symbol of winners) {
		const mult = config.symbols[symbol].mult;
		const tiles: number[] = [];
		panels.forEach((p, i) => p?.name === symbol && tiles.push(i));
		const extras = Math.max(0, tiles.length - 3);
		const matchDone = t + MATCH_LEAD_MS + 2 * MATCH_GAP_MS + MATCH_TAIL_MS;
		const extraStart = matchDone + EXTRA_LEAD_MS;
		tiles.forEach((idx, n) => {
			const info: CellWinInfo = {
				matchIndex: 0,
				matchDelay: 0,
				matchMult: mult,
				extraIndex: 0,
				extraDelay: 0,
				extraStep: 0,
			};
			if (n < 3) {
				info.matchIndex = n + 1;
				info.matchDelay = t + MATCH_LEAD_MS + n * MATCH_GAP_MS;
			} else {
				const k = n - 2;
				info.extraIndex = k;
				info.extraDelay = extraStart + (k - 1) * EXTRA_GAP_MS;
				info.extraStep = extraMatchBonus(betMode, k);
			}
			cells.set(idx, info);
		});
		const bumps = Array.from({ length: extras }, (_, j) => ({
			at: extraStart + j * EXTRA_GAP_MS + 150,
			value: Math.round((mult + extraMatchTotal(betMode, j + 1)) * 100) / 100,
			step: j + 1,
		}));
		segments.push({ symbol, mult, extras, showAt: matchDone, bumps });
		t = (extras > 0 ? extraStart + (extras - 1) * EXTRA_GAP_MS + 700 : matchDone) + SEGMENT_GAP_MS;
	}
	// total: when the last segment has finished playing (ms from reveal).
	return { cells, segments, total: segments.length ? t - SEGMENT_GAP_MS : 0 };
};
