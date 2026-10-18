import { stateBet } from 'state-shared';
import { createPrimaryMachines, createIntermediateMachines, createGameActor } from 'utils-xstate';

import type { Bet } from './typesBookEvent';
import { playBet } from './utils';
import { stateGameDerived } from './stateGame.svelte';

// Scratch is a single-round, no-freegame game: there's no bonus to resume
// mid-way through and no "spin" to pre-animate before the result lands, so
// these hooks are much thinner than the reel-game template's.
const primaryMachines = createPrimaryMachines<Bet>({
	onResumeGameActive: (betToResume) => playBet(betToResume),
	onResumeGameInactive: (betToResume) => {
		const lastPanelsEvent = [...betToResume.state]
			.reverse()
			.find((bookEvent) => bookEvent.type === 'revealPanels');

		if (lastPanelsEvent && lastPanelsEvent.type === 'revealPanels') {
			stateGameDerived.setPanels(lastPanelsEvent.panels);
			stateGameDerived.revealAll();
		}
	},
	onNewGameStart: async () => {
		stateBet.winBookEventAmount = 0;
		stateGameDerived.reset();
	},
	onNewGameError: () => stateGameDerived.reset(),
	onPlayGame: async (bet) => await playBet(bet),
	checkIsBonusGame: () => false,
});

const intermediateMachines = createIntermediateMachines(primaryMachines);

export const gameActor = createGameActor(intermediateMachines);
