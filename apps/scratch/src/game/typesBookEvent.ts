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

// One `key` symbol landed, or the Treasure Meter popped -- both fire one of
// these. Each entry is one chest's outcome, always chests_per_trigger (3)
// of them minimum, more if a 'retrigger'/'key' outcome queued extra opens
// (matches games/scratch/scratch_sim.py's resolve_chest_sequence exactly).
// `value` units match config.ts's symbol mults: 'cash' is a flat per-$1
// multiplier added to the round, 'multiplier' multiplies the round's
// running total so far, 'retrigger'/'key' are counts of extra opens queued.
export type ChestOutcomeKind = 'cash' | 'multiplier' | 'retrigger' | 'key';
export type ChestOutcome = { id: string; kind: ChestOutcomeKind; value: number };

type BookEventChestSequence = {
	index: number;
	type: 'chestSequence';
	chests: ChestOutcome[];
};

// Hidden 1-10 vs hidden 1-10; a match pays a flat multiplier (same per-$1
// units as everything else) regardless of whatever else happened on this
// card. `amount` is 0 when `hit` is false.
type BookEventKrakenResult = {
	index: number;
	type: 'krakenResult';
	playerNumber: number;
	krakenNumber: number;
	hit: boolean;
	// Prize multiplier of the bet the case reel lands on (0 on a miss).
	multiplier: number;
	// Same value as a per-$1 amount, like every other event (scaled to
	// dollars in bookEventHandlerMap).
	amount: number;
};

// A `shark` symbol landed: the Shark Bite bar rolls and lands on one
// outcome. What it leads to arrives as its own event right after:
//   kraken  -> krakenResult (number match -> case reel)
//   octopus -> octopusCards (3 bonus cards, all wins summed)
//   key     -> chestSequence
//   bonus   -> free scratches (counted like the 3-scatter award)
//   pirate  -> nothing yet (placeholder, "coming soon")
export type SharkOutcome = 'kraken' | 'octopus' | 'pirate' | 'key' | 'bonus';

type BookEventSharkBite = {
	index: number;
	type: 'sharkBite';
	outcome: SharkOutcome;
};

// Octopus outcome: three extra cards dealt in the same round. `win` is each
// card's per-$1 multiplier (scaled to dollars in bookEventHandlerMap); the
// round total already includes them.
export type OctopusCard = { panels: RawSymbol[]; win: number };

type BookEventOctopusCards = {
	index: number;
	type: 'octopusCards';
	cards: OctopusCard[];
};

// Key feature: pick 1 of 3 chests. The book decides the prize (`win`);
// whichever chest the player taps gets it, and the other two open to show
// `missed`. Per-$1 multipliers like everything else.
type BookEventChestPick = {
	index: number;
	type: 'chestPick';
	win: number;
	missed: [number, number];
};

// Free-scratch bonus: a winning free card adds its multiplier to the
// bonus multiplier (`added`), and that card pays bet x the new `total`.
type BookEventBonusMultiplier = {
	index: number;
	type: 'bonusMultiplier';
	added: number;
	total: number;
};

export type BookEvent =
	| BookEventRevealPanels
	| BookEventSetTotalWin
	| BookEventFinalWin
	| BookEventChestSequence
	| BookEventKrakenResult
	| BookEventSharkBite
	| BookEventOctopusCards
	| BookEventChestPick
	| BookEventBonusMultiplier;

export type Bet = BetType<BookEvent>;
export type BookEventOfType<T> = Extract<BookEvent, { type: T }>;
export type BookEventContext = { bookEvents: BookEvent[] };

// Re-exported so components can import symbol typing from one place.
export type { SymbolName, RawSymbol };
