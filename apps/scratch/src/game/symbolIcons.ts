import type { SymbolName } from './types';

// Each symbol is rendered as a plain emoji glyph rather than hand-drawn
// vector art — simpler, and reads as more "finished" at small cell sizes
// than custom shapes did. Every difficulty has its own fully distinct set
// of 6 paying emoji (see betModes[mode].symbols in config.ts) instead of
// one shared paytable reused with different numbers per mode, so nothing
// here is money-themed and nothing repeats across difficulties:
//   Easy   (1.5x-45x):   playful, low-key   — 💩 🙂 🍑 ❤️ 🔥 🤑
//   Medium (1.5x-110x):  creatures, scaling — 🐸 🦊 🐺 🦁 🐉 👽
//   Hard   (2x-1000x):   dangerous/cosmic   — 🎲 🦂 🐙 🧿 👹 🛸
export const SYMBOL_EMOJI: Record<SymbolName, string> = {
	skull: '💀',
	// Easy
	easy1: '💩',
	easy2: '🙂',
	easy3: '🍑',
	easy4: '❤️',
	easy5: '🔥',
	easy6: '🤑',
	// Medium
	medium1: '🐸',
	medium2: '🦊',
	medium3: '🐺',
	medium4: '🦁',
	medium5: '🐉',
	medium6: '👽',
	// Hard
	hard1: '🎲',
	hard2: '🦂',
	hard3: '🐙',
	hard4: '🧿',
	hard5: '👹',
	hard6: '🛸',
};

// Human-readable label for the paytable modal — symbol ids (easy1, hard6,
// ...) are just internal keys shared with config.ts/game_config.py, not
// something to show a player.
export const SYMBOL_LABEL: Record<SymbolName, string> = {
	skull: 'Bust',
	easy1: 'Dookie',
	easy2: 'Smiley',
	easy3: 'Peach',
	easy4: 'Heart',
	easy5: 'Blaze',
	easy6: 'Jackpot Face',
	medium1: 'Frog',
	medium2: 'Fox',
	medium3: 'Wolf',
	medium4: 'Lion',
	medium5: 'Dragon',
	medium6: 'Alien',
	hard1: 'Dice',
	hard2: 'Scorpion',
	hard3: 'Kraken',
	hard4: 'Evil Eye',
	hard5: 'Oni',
	hard6: 'UFO',
};

// Accent colors: `fill` is the symbol's accent hue (used for the DOM
// paytable swatch and the cell's background glow), `glow` is a brighter
// variant used for the emoji's drop-shadow glow. Each difficulty leans on
// its own palette family so the three sets also read as visually distinct.
export const SYMBOL_COLORS: Record<SymbolName, { fill: number; glow: number }> = {
	skull: { fill: 0x64748b, glow: 0x94a3b8 },
	// Easy — warm, playful
	easy1: { fill: 0xa16207, glow: 0xd9b48f },
	easy2: { fill: 0xfacc15, glow: 0xfff3b0 },
	easy3: { fill: 0xfb923c, glow: 0xffd3a6 },
	easy4: { fill: 0xf43f5e, glow: 0xfca5b1 },
	easy5: { fill: 0xef4444, glow: 0xfecaca },
	easy6: { fill: 0xeab308, glow: 0xfef08a },
	// Medium — nature/creature tones
	medium1: { fill: 0x22c55e, glow: 0xbbf7d0 },
	medium2: { fill: 0xf97316, glow: 0xfed7aa },
	medium3: { fill: 0x64748b, glow: 0xcbd5e1 },
	medium4: { fill: 0xf59e0b, glow: 0xfde68a },
	medium5: { fill: 0x10b981, glow: 0x6ee7b7 },
	medium6: { fill: 0x22d3ee, glow: 0xa5f3fc },
	// Hard — deeper, more dangerous
	hard1: { fill: 0xef4444, glow: 0xfca5a5 },
	hard2: { fill: 0xf59e0b, glow: 0xfde68a },
	hard3: { fill: 0x8b5cf6, glow: 0xd8b4fe },
	hard4: { fill: 0x3b82f6, glow: 0xbfdbfe },
	hard5: { fill: 0xdc2626, glow: 0xfecaca },
	hard6: { fill: 0x14b8a6, glow: 0x99f6e4 },
};
