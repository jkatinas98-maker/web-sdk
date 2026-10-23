// Mirrors games/scratch/game_config.py in the math-sdk repo. Keep the symbol
// ids, mults and weights in sync with that file — it's the source of truth
// for RTP; this is just the front-end's view of the same paytable.
export default {
	providerName: 'sample_provider',
	gameName: 'scratch',
	gameID: 'scratch',
	rtp: 0.96,
	// Not a reel game: cols is fixed at 3, rows vary by difficulty bet mode
	// (easy 3x5, medium 3x4, hard 3x3). numReels/numRows kept for shared
	// package compatibility but unused by the scratch reveal logic.
	numReels: 3,
	numRows: [5, 5, 5],
	betModes: {
		easy: {
			cost: 1.0,
			feature: false,
			buyBonus: false,
			rtp: 0.96,
			max_win: 110,
			cols: 3,
			rows: 5,
			// Which shared symbols (see `symbols` below) this difficulty draws
			// from, low to high payout. Multiplier VALUES that also appear in
			// other difficulties reuse the same id/emoji (mult2 and mult9 are
			// every mode's "2x" and "9x", not a separate icon per mode).
			symbols: ['mult1_5', 'mult2', 'mult4', 'mult16', 'mult45', 'mult110'],
		},
		medium: {
			cost: 1.0,
			feature: false,
			buyBonus: false,
			rtp: 0.96,
			max_win: 1000,
			cols: 3,
			rows: 4,
			symbols: ['mult1_5', 'mult2', 'mult5', 'mult41', 'mult110', 'mult1000'],
		},
		hard: {
			cost: 1.0,
			feature: false,
			buyBonus: false,
			rtp: 0.96,
			max_win: 2500,
			cols: 3,
			rows: 3,
			symbols: ['mult2', 'mult6', 'mult9', 'mult36', 'mult130', 'mult1000', 'mult2500'],
		},
	},
	// The authoritative per-round multiplier always comes from the RGS book;
	// these are the display/mock values. One shared symbol per distinct
	// multiplier VALUE across every difficulty (13 total, plus `skull` the
	// shared bust symbol) — every "2x" is the same icon everywhere it shows
	// up, rather than each difficulty having its own "2x" icon. See
	// betModes[mode].symbols above for which of these each mode actually
	// draws from.
	symbols: {
		skull: { paytable: null, mult: 0 },
		// Scatter — doesn't pay on its own; landing 3 anywhere on the card
		// (same "reach 3 occurrences" rule as every other symbol) awards 10
		// free scratches instead of a cash multiplier. Shared across every
		// difficulty, same as skull.
		bonus: { paytable: null, mult: 0 },
		// New feature symbol (not yet wired to a feature -- see
		// stake-scratch-game notes). Doesn't pay cash and doesn't count
		// toward the bonus scatter trigger; it's meant to drop on its own and
		// launch the Treasure Chest pick bonus directly, same as landing the
		// Treasure Meter's pop threshold. That trigger logic isn't built yet
		// -- this entry just reserves the id/weight/art slot so the symbol is
		// drawable and visible end-to-end while the feature gets built.
		key: { paytable: null, mult: 0 },
		// Feature symbol: landing one opens the Kraken number match.
		kraken: { paytable: null, mult: 0 },
		// Feature symbol: landing one rolls the Shark Bite bar (Kraken /
		// Octopus / Pirate / Key / Bonus).
		shark: { paytable: null, mult: 0 },
		mult1_5: { paytable: [{ '3': 1.5 }], mult: 1.5 },
		mult2: { paytable: [{ '3': 2 }], mult: 2 },
		mult4: { paytable: [{ '3': 4 }], mult: 4 },
		mult5: { paytable: [{ '3': 5 }], mult: 5 },
		mult6: { paytable: [{ '3': 6 }], mult: 6 },
		mult9: { paytable: [{ '3': 9 }], mult: 9 },
		mult16: { paytable: [{ '3': 16 }], mult: 16 },
		mult36: { paytable: [{ '3': 36 }], mult: 36 },
		mult41: { paytable: [{ '3': 41 }], mult: 41 },
		mult45: { paytable: [{ '3': 45 }], mult: 45 },
		mult110: { paytable: [{ '3': 110 }], mult: 110 },
		mult130: { paytable: [{ '3': 130 }], mult: 130 },
		mult1000: { paytable: [{ '3': 1000 }], mult: 1000 },
		mult2500: { paytable: [{ '3': 2500 }], mult: 2500 },
	},
	paddingReels: {
		basegame: '',
		freegame: '',
		superspingame: '',
	},
};
