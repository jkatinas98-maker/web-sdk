import type { RawSymbol } from './types';

// Scratch state is a flat list of panels (cols*rows for the active difficulty)
// plus which of them the player has scratched/revealed so far — there's no
// reel board, no cascading, no multiplier board to track.
//
// `revealed` is the set of panel indices scratched individually (order
// doesn't matter — the player can tap any cell in any order), not a count:
// an earlier version tracked a single `revealedCount` and treated it as
// "every index below this is revealed," which meant scratching the LAST
// cell instantly revealed the whole ticket. `revealedIndices` fixes that.
export const stateGame = $state({
	panels: [] as RawSymbol[],
	revealed: new Set<number>(),
	totalWin: 0,
});

const setPanels = (panels: RawSymbol[]) => {
	stateGame.panels = panels;
	stateGame.revealed = new Set();
};

const reveal = (index: number) => {
	if (stateGame.revealed.has(index)) return;
	// Reassign (not mutate-in-place) so Svelte 5's runes reactivity picks up
	// the change — a plain `.add()` on the existing Set wouldn't re-render.
	stateGame.revealed = new Set(stateGame.revealed).add(index);
};

const revealAll = () => {
	stateGame.revealed = new Set(stateGame.panels.map((_, index) => index));
};

const setTotalWin = (amount: number) => {
	stateGame.totalWin = amount;
};

const reset = () => {
	stateGame.panels = [];
	stateGame.revealed = new Set();
	stateGame.totalWin = 0;
};

export const stateGameDerived = {
	setPanels,
	reveal,
	revealAll,
	setTotalWin,
	reset,
};
