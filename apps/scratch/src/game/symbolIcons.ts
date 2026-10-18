import type { SymbolName } from './types';

// One emoji per distinct multiplier VALUE, shared across every difficulty
// — every "2x" is 🙂 whether it shows up in easy, medium, or hard, not a
// separate icon per mode. Picked by the user directly:
//   1.5x 💩   2x 🙂   4x 🍑   5x 😘   6x 🥵   9x ❤️   16x 🔥
//   36x 🙏   41x 🤑   45x 💎   110x 👽   130x 🚀   1000x 🛸
export const SYMBOL_EMOJI: Record<SymbolName, string> = {
	skull: '💀',
	bonus: '🎁',
	mult1_5: '💩',
	mult2: '🙂',
	mult4: '🍑',
	mult5: '😘',
	mult6: '🥵',
	mult9: '❤️',
	mult16: '🔥',
	mult36: '🙏',
	mult41: '🤑',
	mult45: '💎',
	mult110: '👽',
	mult130: '🚀',
	mult1000: '🛸',
};

// Human-readable label for the paytable modal — symbol ids (mult1_5,
// mult1000, ...) are just internal keys shared with config.ts, not
// something to show a player.
export const SYMBOL_LABEL: Record<SymbolName, string> = {
	skull: 'Bust',
	bonus: 'Bonus',
	mult1_5: 'Dookie',
	mult2: 'Smiley',
	mult4: 'Peach',
	mult5: 'Kiss',
	mult6: 'Hot Face',
	mult9: 'Heart',
	mult16: 'Blaze',
	mult36: 'Praying Hands',
	mult41: 'Money Face',
	mult45: 'Diamond',
	mult110: 'Alien',
	mult130: 'Rocket',
	mult1000: 'UFO',
};

// Accent colors: `fill` is the symbol's accent hue (used for the DOM
// paytable swatch and the cell's background glow), `glow` is a brighter
// variant used for the emoji's drop-shadow glow.
export const SYMBOL_COLORS: Record<SymbolName, { fill: number; glow: number }> = {
	skull: { fill: 0x64748b, glow: 0x94a3b8 },
	bonus: { fill: 0xfbbf24, glow: 0xfde68a },
	mult1_5: { fill: 0xa16207, glow: 0xd9b48f },
	mult2: { fill: 0xfacc15, glow: 0xfff3b0 },
	mult4: { fill: 0xfb923c, glow: 0xffd3a6 },
	mult5: { fill: 0x22c55e, glow: 0xbbf7d0 },
	mult6: { fill: 0xf97316, glow: 0xfed7aa },
	mult9: { fill: 0xf43f5e, glow: 0xfca5b1 },
	mult16: { fill: 0xef4444, glow: 0xfecaca },
	mult36: { fill: 0x64748b, glow: 0xcbd5e1 },
	mult41: { fill: 0xf59e0b, glow: 0xfde68a },
	mult45: { fill: 0xeab308, glow: 0xfef08a },
	mult110: { fill: 0x10b981, glow: 0x6ee7b7 },
	mult130: { fill: 0x22d3ee, glow: 0xa5f3fc },
	mult1000: { fill: 0x14b8a6, glow: 0x99f6e4 },
};
