import type { SymbolName } from './types';

// PLACEHOLDER ART. Each symbol gets a distinct geometric glyph + accent color
// so the game is visually legible and testable before the commissioned
// pirate-theme art lands. This is deliberately NOT emoji (that was the
// feedback that got the last Stake Engine submission rejected) and
// deliberately not an attempt to fake finished art either -- a plain shape
// signals "art goes here" honestly. Swap SYMBOL_PLACEHOLDER_GLYPH (and
// eventually this whole file) for the artist's Spine/PNG assets; nothing
// else in the component tree needs to change, since SymbolIcon.svelte is the
// only consumer.
export const SYMBOL_PLACEHOLDER_GLYPH: Record<SymbolName, string> = {
	skull: '☠',
	bonus: '▣', // scatter -- small closed treasure chest
	key: '◈', // feature symbol -- ornate key
	mult1_5: '●', // flintlock pistol
	mult2: '◆', // crab
	mult4: '▲', // rum barrel
	mult5: '■', // parrot
	mult6: '▼', // crossed cutlasses
	mult9: '★', // ship's wheel
	mult16: '⬟', // spyglass & compass
	mult36: '✦', // anchor
	mult41: '✚', // treasure map
	mult45: '◉', // Jolly Roger flag
	mult110: '❖', // jeweled crown / gem cluster
	mult130: '✧', // stacked gold bars
	mult1000: '✪', // overflowing treasure hoard (open chest, highest tier)
};

// Human-readable label for the paytable modal -- symbol ids (mult1_5,
// mult1000, ...) are just internal keys shared with config.ts, not
// something to show a player. Pirate theme names, matching the artist brief.
export const SYMBOL_LABEL: Record<SymbolName, string> = {
	skull: 'Skull & Crossbones',
	bonus: 'Treasure Chest',
	key: 'Golden Key',
	mult1_5: 'Flintlock Pistol',
	mult2: 'Crab',
	mult4: 'Rum Barrel',
	mult5: 'Parrot',
	mult6: 'Crossed Cutlasses',
	mult9: "Ship's Wheel",
	mult16: 'Spyglass & Compass',
	mult36: 'Anchor',
	mult41: 'Treasure Map',
	mult45: 'Jolly Roger Flag',
	mult110: 'Jeweled Crown',
	mult130: 'Gold Bars',
	mult1000: 'Overflowing Hoard',
};

// Accent colors: `fill` is the symbol's accent hue (used for the DOM
// paytable swatch and the cell's background glow), `glow` is a brighter
// variant used for the glyph's drop-shadow glow. Deliberately NOT a
// monotone gold ladder -- only the top two tiers (mult130, mult1000) lean
// gold; everything below breaks color on purpose (red crab, amber rum,
// green parrot, steel cutlasses, jewel tones) so the mid-ladder doesn't
// read as "more yellow coins" at a glance.
export const SYMBOL_COLORS: Record<SymbolName, { fill: number; glow: number }> = {
	skull: { fill: 0x64748b, glow: 0x94a3b8 },
	bonus: { fill: 0x8b5a2b, glow: 0xd2a679 }, // wood/iron scatter chest
	key: { fill: 0xca8a04, glow: 0xfde68a },
	mult1_5: { fill: 0x475569, glow: 0xcbd5e1 }, // gunmetal pistol
	mult2: { fill: 0xea580c, glow: 0xfdba74 }, // crab
	mult4: { fill: 0x92400e, glow: 0xd97706 }, // rum barrel
	mult5: { fill: 0x16a34a, glow: 0x86efac }, // parrot
	mult6: { fill: 0x94a3b8, glow: 0xe2e8f0 }, // steel cutlasses
	mult9: { fill: 0x78350f, glow: 0xd4a373 }, // ship's wheel wood+brass
	mult16: { fill: 0xb45309, glow: 0xfbbf24 }, // brass spyglass
	mult36: { fill: 0x475569, glow: 0x94a3b8 }, // iron anchor
	mult41: { fill: 0xb91c1c, glow: 0xf87171 }, // treasure map's red X
	mult45: { fill: 0x1e293b, glow: 0xcbd5e1 }, // black/white Jolly Roger
	mult110: { fill: 0x7e22ce, glow: 0xd8b4fe }, // jeweled crown
	mult130: { fill: 0xeab308, glow: 0xfef08a }, // gold bars
	mult1000: { fill: 0xf59e0b, glow: 0xfde68a }, // overflowing hoard -- richest, biggest glow
};
