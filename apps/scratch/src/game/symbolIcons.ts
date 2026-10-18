import type * as PIXI from 'pixi.js';

import type { SymbolName } from './types';

// Neon line-art palette: `fill` is the symbol's accent hue (used for the
// low-alpha fill, the background glow, and the DOM paytable swatch — the
// contract other files rely on), `glow` is a brighter variant of the same
// hue used for the icon's outline stroke. Icons are drawn mostly as outline
// + soft fill rather than solid cartoon shapes, to sit cleanly against the
// cyan/purple/pink neon theme instead of clashing with it.
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

// Each icon is drawn in a 100x100 local box so a single `scale` on the
// parent Container sizes it for any cell diameter.
export function drawSymbolIcon(graphics: PIXI.Graphics, name: SymbolName) {
	const colors = SYMBOL_COLORS[name];

	if (name === 'skull') {
		graphics.moveTo(50, 10);
		graphics.bezierCurveTo(30, 10, 18, 24, 18, 44);
		graphics.bezierCurveTo(18, 56, 26, 66, 35, 70);
		graphics.lineTo(35, 85);
		graphics.bezierCurveTo(35, 89, 38, 92, 42, 92);
		graphics.lineTo(58, 92);
		graphics.bezierCurveTo(62, 92, 65, 89, 65, 85);
		graphics.lineTo(65, 70);
		graphics.bezierCurveTo(74, 66, 82, 56, 82, 44);
		graphics.bezierCurveTo(82, 24, 70, 10, 50, 10);
		graphics.closePath();
		graphics.fill({ color: colors.fill, alpha: 0.16 });
		graphics.stroke({ color: colors.glow, width: 2.5, alpha: 0.8 });
		graphics.circle(37, 45, 7);
		graphics.stroke({ color: colors.glow, width: 1.5, alpha: 0.6 });
		graphics.circle(63, 45, 7);
		graphics.stroke({ color: colors.glow, width: 1.5, alpha: 0.6 });
		return;
	}

	if (name === 'coin') {
		graphics.circle(50, 50, 38);
		graphics.fill({ color: colors.fill, alpha: 0.18 });
		graphics.stroke({ color: colors.glow, width: 3, alpha: 0.95 });
		graphics.circle(50, 50, 27);
		graphics.stroke({ color: colors.glow, width: 1.5, alpha: 0.5 });
		return;
	}

	if (name === 'wallet') {
		graphics.roundRect(15, 30, 70, 50, 10);
		graphics.fill({ color: colors.fill, alpha: 0.16 });
		graphics.stroke({ color: colors.glow, width: 2.5, alpha: 0.9 });
		graphics.moveTo(15, 46);
		graphics.lineTo(85, 46);
		graphics.stroke({ color: colors.glow, width: 1.5, alpha: 0.5 });
		graphics.circle(68, 62, 4);
		graphics.stroke({ color: colors.glow, width: 1.5, alpha: 0.7 });
		return;
	}

	if (name === 'chest') {
		graphics.poly([18, 40, 82, 40, 82, 46, 18, 46]);
		graphics.stroke({ color: colors.glow, width: 2, alpha: 0.7 });
		graphics.roundRect(15, 46, 70, 36, 6);
		graphics.fill({ color: colors.fill, alpha: 0.16 });
		graphics.stroke({ color: colors.glow, width: 2.5, alpha: 0.9 });
		graphics.circle(50, 56, 5);
		graphics.stroke({ color: colors.glow, width: 1.5, alpha: 0.7 });
		return;
	}

	if (name === 'crown') {
		graphics.poly([15, 42, 30, 65, 70, 65, 85, 42, 65, 54, 50, 24, 35, 54]);
		graphics.fill({ color: colors.fill, alpha: 0.18 });
		graphics.stroke({ color: colors.glow, width: 2.5, alpha: 0.9 });
		graphics.roundRect(20, 70, 60, 7, 3);
		graphics.stroke({ color: colors.glow, width: 1.5, alpha: 0.6 });
		return;
	}

	if (name === 'star') {
		graphics.poly([50, 10, 61, 36, 89, 36, 66, 53, 75, 79, 50, 63, 25, 79, 34, 53, 11, 36, 39, 36]);
		graphics.fill({ color: colors.fill, alpha: 0.22 });
		graphics.stroke({ color: colors.glow, width: 2.5, alpha: 0.95 });
		return;
	}

	if (name === 'diamond') {
		graphics.poly([30, 15, 70, 15, 88, 38, 50, 88, 12, 38]);
		graphics.fill({ color: colors.fill, alpha: 0.2 });
		graphics.stroke({ color: colors.glow, width: 2.5, alpha: 0.95 });
		graphics.moveTo(12, 38);
		graphics.lineTo(88, 38);
		graphics.stroke({ color: colors.glow, width: 1, alpha: 0.5 });
		return;
	}
}
