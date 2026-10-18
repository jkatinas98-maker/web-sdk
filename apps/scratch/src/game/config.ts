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
			max_win: 45,
			cols: 3,
			rows: 5,
			// This difficulty's own 6 paying symbols, low to high payout —
			// each difficulty gets a fully distinct symbol/emoji set (see
			// symbolIcons.ts) rather than reusing one shared paytable with
			// different numbers per mode.
			symbols: ['easy1', 'easy2', 'easy3', 'easy4', 'easy5', 'easy6'],
		},
		medium: {
			cost: 1.0,
			feature: false,
			buyBonus: false,
			rtp: 0.96,
			max_win: 110,
			cols: 3,
			rows: 4,
			symbols: ['medium1', 'medium2', 'medium3', 'medium4', 'medium5', 'medium6'],
		},
		hard: {
			cost: 1.0,
			feature: false,
			buyBonus: false,
			rtp: 0.96,
			max_win: 1000,
			cols: 3,
			rows: 3,
			symbols: ['hard1', 'hard2', 'hard3', 'hard4', 'hard5', 'hard6'],
		},
	},
	// The authoritative per-round multiplier always comes from the RGS book;
	// these are the display/mock values. `skull` (mult 0, "bust") is shared
	// across every difficulty. Each difficulty's 6 paying symbols are their
	// own distinct ids/mults — see betModes[mode].symbols above for which
	// ones belong to which mode.
	symbols: {
		skull: { paytable: null, mult: 0 },
		// Easy (3x5 = 15 cells)
		easy1: { paytable: [{ '3': 1.5 }], mult: 1.5 },
		easy2: { paytable: [{ '3': 2 }], mult: 2 },
		easy3: { paytable: [{ '3': 4 }], mult: 4 },
		easy4: { paytable: [{ '3': 9 }], mult: 9 },
		easy5: { paytable: [{ '3': 16 }], mult: 16 },
		easy6: { paytable: [{ '3': 45 }], mult: 45 },
		// Medium (3x4 = 12 cells)
		medium1: { paytable: [{ '3': 1.5 }], mult: 1.5 },
		medium2: { paytable: [{ '3': 2 }], mult: 2 },
		medium3: { paytable: [{ '3': 5 }], mult: 5 },
		medium4: { paytable: [{ '3': 9 }], mult: 9 },
		medium5: { paytable: [{ '3': 41 }], mult: 41 },
		medium6: { paytable: [{ '3': 110 }], mult: 110 },
		// Hard (3x3 = 9 cells)
		hard1: { paytable: [{ '3': 2 }], mult: 2 },
		hard2: { paytable: [{ '3': 6 }], mult: 6 },
		hard3: { paytable: [{ '3': 9 }], mult: 9 },
		hard4: { paytable: [{ '3': 36 }], mult: 36 },
		hard5: { paytable: [{ '3': 130 }], mult: 130 },
		hard6: { paytable: [{ '3': 1000 }], mult: 1000 },
	},
	paddingReels: {
		basegame: '',
		freegame: '',
		superspingame: '',
	},
};
