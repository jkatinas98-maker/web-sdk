import type { BookEvent, BookEventOfType } from './typesBookEvent';

// Scratch has no reel board, free-spin intro/counter/outro, or win-celebration
// pixi components (yet) — those component-typed emitter events from the reel
// game template don't apply here. The events below are the ones Game.svelte
// (and the actor/bookEventHandlerMap wiring) actually broadcast.
export type EmitterEventGame =
	| { type: 'bet' }
	| { type: 'autoBet' }
	| { type: 'resumeBet' }
	| { type: 'revealPanels'; data: BookEventOfType<'revealPanels'> }
	| { type: 'setTotalWin'; data: BookEventOfType<'setTotalWin'> }
	| { type: 'finalWin'; data: BookEventOfType<'finalWin'> }
	| { type: 'chestSequence'; data: BookEventOfType<'chestSequence'> }
	| { type: 'krakenResult'; data: BookEventOfType<'krakenResult'> }
	| { type: 'sharkBite'; data: BookEventOfType<'sharkBite'> }
	| { type: 'octopusCards'; data: BookEventOfType<'octopusCards'> }
	| { type: 'chestPick'; data: BookEventOfType<'chestPick'> }
	| { type: 'bonusMultiplier'; data: BookEventOfType<'bonusMultiplier'> }
	| { type: 'bonusMinimum'; data: BookEventOfType<'bonusMinimum'> }
	| { type: 'pirateBounty'; data: BookEventOfType<'pirateBounty'> }
	| { type: 'freeScratchesAwarded'; data: BookEventOfType<'freeScratchesAwarded'> }
	// A whole round's book from the RGS, played card by card by Game.svelte.
	| { type: 'roundBook'; data: BookEvent[] };
