import type { BetType } from 'rgs-requests';

import type { SymbolName, RawSymbol, GameType } from './types';

// Matches the book shape written by games/scratch/scratch_sim.py in the
// math-sdk repo: one revealPanels event carrying every panel drawn for the
// ticket (in reveal order, flat — not a reel board), followed by
// setTotalWin/finalWin. Scratch is a single-round, no-freegame game, so
// that's the whole event set; no reel/freespin event types apply here.
type BookEventRevealPanels = {
	index: number;
	type: 'revealPanels';
	panels: RawSymbol[];
	gameType: GameType;
};

type BookEventSetTotalWin = {
	index: number;
	type: 'setTotalWin';
	amount: number;
};

type BookEventFinalWin = {
	index: number;
	type: 'finalWin';
	amount: number;
};

export type BookEvent = BookEventRevealPanels | BookEventSetTotalWin | BookEventFinalWin;

export type Bet = BetType<BookEvent>;
export type BookEventOfType<T> = Extract<BookEvent, { type: T }>;
export type BookEventContext = { bookEvents: BookEvent[] };

// Re-exported so components can import symbol typing from one place.
export type { SymbolName, RawSymbol };
