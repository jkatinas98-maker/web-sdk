import type { RawSymbol } from './types';

// Scratch state is a flat list of panels (cols*rows for the active difficulty)
// plus how many of them the player has scratched/revealed so far — there's no
// reel board, no cascading, no multiplier board to track.
export const stateGame = $state({
	panels: [] as RawSymbol[],
	revealedCount: 0,
	totalWin: 0,
});

const setPanels = (panels: RawSymbol[]) => {
	stateGame.panels = panels;
	stateGame.revealedCount = 0;
};

const reveal = (index: number) => {
	if (index >= stateGame.revealedCount) stateGame.revealedCount = index + 1;
};

const revealAll = () => {
	stateGame.revealedCount = stateGame.panels.length;
};

const setTotalWin = (amount: number) => {
	stateGame.totalWin = amount;
};

const reset = () => {
	stateGame.panels = [];
	stateGame.revealedCount = 0;
	stateGame.totalWin = 0;
};

export const stateGameDerived = {
	setPanels,
	reveal,
	revealAll,
	setTotalWin,
	reset,
};
