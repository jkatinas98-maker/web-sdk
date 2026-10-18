import { stateBet } from 'state-shared';
import { createPlayBookUtils } from 'utils-book';

import { eventEmitter } from './eventEmitter';
import type { Bet } from './typesBookEvent';
import { bookEventHandlerMap } from './bookEventHandlerMap';

export const { playBookEvent, playBookEvents } = createPlayBookUtils({ bookEventHandlerMap });

export const playBet = async (bet: Bet) => {
	stateBet.winBookEventAmount = 0;
	await playBookEvents(bet.state);
	eventEmitter.broadcast({ type: 'stopButtonEnable' });
};
