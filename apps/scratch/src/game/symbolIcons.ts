import type { SymbolName } from './types';

// Each symbol is rendered as a plain emoji glyph (matching the reference UI
// the user pointed at) rather than hand-drawn vector art — simpler, and
// reads as more "finished" at small cell sizes than custom shapes did.
export const SYMBOL_EMOJI: Record<SymbolName, string> = {
	skull: '💀',
	coin: '🪙',
	wallet: '👛',
	chest: '💰',
	crown: '👑',
	star: '⭐',
	diamond: '💎',
};

// Accent colors: `fill` is the symbol's accent hue (used for the DOM
// paytable swatch and the cell's background glow), `glow` is a brighter
// variant used for the emoji's drop-shadow glow.
export const SYMBOL_COLORS: Record<SymbolName, { fill: number; glow: number }> = {
	skull: { fill: 0x64748b, glow: 0x94a3b8 },
	coin: { fill: 0xf0b93a, glow: 0xffe08a },
	wallet: { fill: 0x38bdf8, glow: 0xbae6fd },
	chest: { fill: 0xf97316, glow: 0xfed7aa },
	crown: { fill: 0xfbbf24, glow: 0xfff3c4 },
	star: { fill: 0xf472b6, glow: 0xfbcfe8 },
	diamond: { fill: 0x22d3ee, glow: 0xcffafe },
};

// Payout-tier rank (0 = skull/no-win .. 6 = diamond/max-win), used to scale
// the glow behind the symbol so the eye is drawn toward rarer symbols as
// they're revealed.
export const SYMBOL_TIER: Record<SymbolName, number> = {
	skull: 0,
	coin: 1,
	wallet: 2,
	chest: 3,
	crown: 4,
	star: 5,
	diamond: 6,
};
