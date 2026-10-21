import type { BookEventHandlerMap } from 'utils-book';
import { stateBet } from 'state-shared';

import { eventEmitter } from './eventEmitter';
import { stateGameDerived } from './stateGame.svelte';
import type { BookEvent, BookEventOfType, BookEventContext } from './typesBookEvent';

// Matches the three events scratch_sim.py actually writes to the book: the
// whole ticket's panels arrive in one event (no reel-by-reel reveal), then
// the win is totalled and finalized. No bonus/freegame events apply.
//
// bookEvent.amount on setTotalWin/finalWin is a plain per-$1 multiplier (same
// units as the top-level payoutMultiplier), from both the real uploaded math
// (a static, pre-simulated book can't know a future bet size, so it can only
// ever send the multiplier) and the local mock generator (mockBet.ts, kept
// in the same units on purpose). stateBet.betAmount is the real amount
// staked on this round, set by Game.svelte's playGame() right before this
// bet fires and locked for the round's duration -- multiplying here, once,
// is what turns that multiplier into the actual dollar amount for both
// paths, instead of passing the raw multiplier through as if it already
// were dollars (which only ever looked right at a $1 bet, by coincidence).
export const bookEventHandlerMap: BookEventHandlerMap<BookEvent, BookEventContext> = {
	revealPanels: async (bookEvent: BookEventOfType<'revealPanels'>) => {
		stateGameDerived.setPanels(bookEvent.panels);
		await eventEmitter.broadcastAsync({ type: 'revealPanels', data: bookEvent });
	},
	setTotalWin: async (bookEvent: BookEventOfType<'setTotalWin'>) => {
		const dollarAmount = bookEvent.amount * stateBet.betAmount;
		stateGameDerived.setTotalWin(dollarAmount);
		await eventEmitter.broadcastAsync({
			type: 'setTotalWin',
			data: { ...bookEvent, amount: dollarAmount },
		});
	},
	finalWin: async (bookEvent: BookEventOfType<'finalWin'>) => {
		const dollarAmount = bookEvent.amount * stateBet.betAmount;
		stateBet.winBookEventAmount = dollarAmount;
		await eventEmitter.broadcastAsync({
			type: 'finalWin',
			data: { ...bookEvent, amount: dollarAmount },
		});
	},
	// A `key` symbol landed, or the Treasure Meter popped. Only 'cash'
	// chests are a per-$1 multiplier needing the same betAmount scaling as
	// setTotalWin/finalWin above -- 'multiplier' is a multiply-the-running-
	// total factor (not a dollar amount) and 'retrigger'/'key' are just
	// counts of extra chest opens queued, so those three pass through as-is.
	chestSequence: async (bookEvent: BookEventOfType<'chestSequence'>) => {
		const chests = bookEvent.chests.map((chest) =>
			chest.kind === 'cash' ? { ...chest, value: chest.value * stateBet.betAmount } : chest,
		);
		await eventEmitter.broadcastAsync({ type: 'chestSequence', data: { ...bookEvent, chests } });
	},
	sharkBite: async (bookEvent: BookEventOfType<'sharkBite'>) => {
		await eventEmitter.broadcastAsync({ type: 'sharkBite', data: bookEvent });
	},
	octopusCards: async (bookEvent: BookEventOfType<'octopusCards'>) => {
		const cards = bookEvent.cards.map((card) => ({ ...card, win: card.win * stateBet.betAmount }));
		await eventEmitter.broadcastAsync({ type: 'octopusCards', data: { ...bookEvent, cards } });
	},
	krakenResult: async (bookEvent: BookEventOfType<'krakenResult'>) => {
		const dollarAmount = bookEvent.amount * stateBet.betAmount;
		await eventEmitter.broadcastAsync({
			type: 'krakenResult',
			data: { ...bookEvent, amount: dollarAmount },
		});
	},
};
