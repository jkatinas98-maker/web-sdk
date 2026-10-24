import { stateBet } from 'state-shared';
import { createPlayBookUtils } from 'utils-book';

import { eventEmitter } from './eventEmitter';
import type { Bet } from './typesBookEvent';
import { bookEventHandlerMap } from './bookEventHandlerMap';

export const { playBookEvent, playBookEvents } = createPlayBookUtils({ bookEventHandlerMap });

// A bet's book is a whole round (base card + any free cards). Game.svelte
// plays it card by card (roundBook), so the events aren't run here.
//
// The SDK credits the win to the balance as soon as playBet resolves, so
// playBet waits until Game.svelte has shown the whole round (every card
// and feature). Otherwise the balance jumps up before the player has even
// scratched the card.
let finishRound: (() => void) | null = null;
export const roundPresented = () => {
	const done = finishRound;
	finishRound = null;
	done?.();
};
export const playBet = async (bet: Bet) => {
	stateBet.winBookEventAmount = 0;
	roundPresented(); // never leave an older round hanging
	const shown = new Promise<void>((resolve) => (finishRound = resolve));
	eventEmitter.broadcast({ type: 'roundBook', data: bet.state });
	await shown;
};
