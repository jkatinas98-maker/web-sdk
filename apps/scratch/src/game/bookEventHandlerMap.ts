import type { BookEventHandlerMap } from 'utils-book';

import { eventEmitter } from './eventEmitter';
import { stateGameDerived } from './stateGame.svelte';
import type { BookEvent, BookEventOfType, BookEventContext } from './typesBookEvent';

// Matches the three events scratch_sim.py actually writes to the book: the
// whole ticket's panels arrive in one event (no reel-by-reel reveal), then
// the win is totalled and finalized. No bonus/freegame events apply.
export const bookEventHandlerMap: BookEventHandlerMap<BookEvent, BookEventContext> = {
	revealPanels: async (bookEvent: BookEventOfType<'revealPanels'>) => {
		stateGameDerived.setPanels(bookEvent.panels);
		await eventEmitter.broadcastAsync({ type: 'revealPanels', data: bookEvent });
	},
	setTotalWin: async (bookEvent: BookEventOfType<'setTotalWin'>) => {
		stateGameDerived.setTotalWin(bookEvent.amount);
		await eventEmitter.broadcastAsync({ type: 'setTotalWin', data: bookEvent });
	},
	finalWin: async (bookEvent: BookEventOfType<'finalWin'>) => {
		await eventEmitter.broadcastAsync({ type: 'finalWin', data: bookEvent });
	},
};
