// DEV-ONLY helper. When this app is opened without an `rgs_url`/`sessionID`
// query param (i.e. run standalone, not launched by Stake Engine's platform
// or a local math-sdk RGS mock server), there is no backend to ask for a
// real round. This generates a locally-faked book so the ticket can still
// be scratched and resolved end-to-end during front-end dev.
//
// The weights/logic here mirror games/scratch/scratch_sim.py's easy-mode
// symbol distribution and its sequential "stop at first symbol to reach 3
// countable matches, skull (mult 0) never counts" rule — see the earlier
// sketch3.py simulation. This is NOT the certified math; it exists only to
// drive the UI during local development.
//
// Each difficulty still draws from its own pool of weights (see
// betModes[mode].symbols in config.ts for which ids belong to which mode —
// several ids are shared across modes, e.g. mult2/mult9 appear in all
// three, just drawn at different odds per mode). Medium and hard's weights
// are invented (skewed harder toward skull as the top payout climbs) to
// keep bigger wins feeling rare — same "not certified math" caveat applies
// to them as to easy's original numbers.
import type { SymbolName, RawSymbol, BetMode } from './types';
import type { BookEvent } from './typesBookEvent';
import config from './config';

// `bonus` (🎁) is folded into each pool at a low weight — it dilutes the
// other odds slightly rather than being re-balanced to an exact 100, which
// is fine since weightedPick normalizes against the pool's actual total.
const WEIGHTS: Record<BetMode, Array<{ name: SymbolName; weight: number }>> = {
	easy: [
		{ name: 'skull', weight: 66.8504 },
		{ name: 'bonus', weight: 0.8 },
		{ name: 'mult1_5', weight: 14.1968 },
		{ name: 'mult2', weight: 8.5181 },
		{ name: 'mult4', weight: 5.6787 },
		{ name: 'mult9', weight: 2.8394 },
		{ name: 'mult16', weight: 1.4197 },
		{ name: 'mult45', weight: 0.4969 },
	],
	medium: [
		{ name: 'skull', weight: 70 },
		{ name: 'bonus', weight: 0.6 },
		{ name: 'mult1_5', weight: 12 },
		{ name: 'mult2', weight: 7 },
		{ name: 'mult5', weight: 4.5 },
		{ name: 'mult9', weight: 3.5 },
		{ name: 'mult41', weight: 2 },
		{ name: 'mult110', weight: 1 },
	],
	hard: [
		{ name: 'skull', weight: 75 },
		{ name: 'bonus', weight: 0.4 },
		{ name: 'mult2', weight: 11 },
		{ name: 'mult6', weight: 6 },
		{ name: 'mult9', weight: 4 },
		{ name: 'mult36', weight: 2.5 },
		{ name: 'mult130', weight: 1.2 },
		{ name: 'mult1000', weight: 0.3 },
	],
};

// Landing this many bonus scatters anywhere on the card awards free
// scratches, same "reach N occurrences" rule as every other symbol.
const BONUS_SCATTER_COUNT = 3;
const FREE_SCRATCHES_AWARDED = 10;

const weightedPick = (betMode: BetMode): SymbolName => {
	const pool = WEIGHTS[betMode];
	const total = pool.reduce((sum, w) => sum + w.weight, 0);
	let r = Math.random() * total;
	for (const { name, weight } of pool) {
		r -= weight;
		if (r <= 0) return name;
	}
	return pool[pool.length - 1].name;
};

export const createMockBet = (
	betMode: BetMode,
	betAmount: number,
): { events: BookEvent[]; freeScratches: number } => {
	const { cols, rows } = config.betModes[betMode];
	const panelCount = cols * rows;

	const panels: RawSymbol[] = [];
	const counts: Partial<Record<SymbolName, number>> = {};
	let winMult = 0;
	let bonusCount = 0;

	for (let i = 0; i < panelCount; i++) {
		const name = weightedPick(betMode);
		panels.push({ name });

		// Bonus is a scatter: it counts toward its own 3-of-a-kind trigger
		// but never toward (or against) the regular cash-win matching above.
		if (name === 'bonus') {
			bonusCount += 1;
			continue;
		}

		const mult = config.symbols[name].mult;
		if (mult > 0) {
			counts[name] = (counts[name] ?? 0) + 1;
			if (counts[name] === 3 && winMult === 0) {
				winMult = mult;
			}
		}
	}

	// Plain per-$1 multiplier, NOT pre-multiplied by betAmount -- this has to
	// match what the real uploaded math can actually send. A static,
	// pre-simulated book is bet-size-agnostic (it's generated once, long
	// before any player picks a bet), so it can only ever encode the
	// multiplier, same as the top-level payoutMultiplier. The real dollar
	// scaling happens in bookEventHandlerMap.ts, in one place, for both this
	// mock path and the real RGS path -- baking the multiply in here too
	// used to double it for mock mode once that fix landed.
	const amount = winMult;
	const freeScratches = bonusCount >= BONUS_SCATTER_COUNT ? FREE_SCRATCHES_AWARDED : 0;

	return {
		events: [
			{ index: 0, type: 'revealPanels', panels, gameType: 'basegame' },
			{ index: 1, type: 'setTotalWin', amount },
			{ index: 2, type: 'finalWin', amount },
		],
		freeScratches,
	};
};
