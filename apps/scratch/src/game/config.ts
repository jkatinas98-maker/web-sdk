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
		},
		medium: {
			cost: 1.0,
			feature: false,
			buyBonus: false,
			rtp: 0.96,
			max_win: 110,
			cols: 3,
			rows: 4,
		},
		hard: {
			cost: 1.0,
			feature: false,
			buyBonus: false,
			rtp: 0.96,
			max_win: 1000,
			cols: 3,
			rows: 3,
		},
	},
	// Payouts differ slightly per difficulty (see game_config.py); this is
	// the easy-mode paytable for display purposes (prize strip, win modal).
	// The authoritative per-round multiplier always comes from the RGS book.
	symbols: {
		skull: { paytable: null, mult: 0 },
		coin: { paytable: [{ '3': 1.5 }], mult: 1.5 },
		wallet: { paytable: [{ '3': 2 }], mult: 2 },
		chest: { paytable: [{ '3': 4 }], mult: 4 },
		crown: { paytable: [{ '3': 9 }], mult: 9 },
		star: { paytable: [{ '3': 16 }], mult: 16 },
		diamond: { paytable: [{ '3': 45 }], mult: 45 },
	},
	paddingReels: {
		basegame: '',
		freegame: '',
		superspingame: '',
	},
};
