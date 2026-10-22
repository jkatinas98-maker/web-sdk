import { stateBet } from 'state-shared';
import { createPlayBookUtils } from 'utils-book';

import { eventEmitter } from './eventEmitter';
import type { Bet } from './typesBookEvent';
import { bookEventHandlerMap } from './bookEventHandlerMap';

export const { playBookEvent, playBookEvents } = createPlayBookUtils({ bookEventHandlerMap });

// A bet's book is a whole round (base card + any free cards). Game.svelte
// plays it card by card (roundBook), so the events aren't run here.
export const playBet = async (bet: Bet) => {
	stateBet.winBookEventAmount = 0;
	eventEmitter.broadcast({ type: 'roundBook', data: bet.state });
};
