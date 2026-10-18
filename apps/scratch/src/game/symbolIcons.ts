import type * as PIXI from 'pixi.js';

import type { SymbolName } from './types';

// Flat-color approximations of the gem-scratch.html SVG gradients (fill ->
// gradient midpoint, dark -> the darker gradient stop / ink color used for
// details). PIXI.Graphics fills here are solid, not gradients, to keep this
// first pixi pass on confirmed-working Graphics APIs; a gradient pass is a
// follow-up once this is build-verified.
export const SYMBOL_COLORS: Record<SymbolName, { fill: number; dark: number }> = {
	skull: { fill: 0x6d7986, dark: 0x1b2024 },
	coin: { fill: 0xf0b93a, dark: 0x8a5a12 },
	wallet: { fill: 0x3a95ea, dark: 0xf3f6f7 },
	chest: { fill: 0xeb9142, dark: 0x7a3d0c },
	crown: { fill: 0xf3c96c, dark: 0xffffff },
	star: { fill: 0xef5a81, dark: 0xffffff },
	diamond: { fill: 0xb7eeff, dark: 0xffffff },
};

// Payout-tier rank (0 = skull/no-win .. 6 = diamond/max-win), used to scale
// the glow behind the symbol so the eye is drawn toward rarer symbols as
// they're revealed. Mirrors the CSS glow ladder in gem-scratch.html.
export const SYMBOL_TIER: Record<SymbolName, number> = {
	skull: 0,
	coin: 1,
	wallet: 2,
	chest: 3,
	crown: 4,
	star: 5,
	diamond: 6,
};

// Each icon is drawn in a 100x100 local box (matches the gem-scratch.html
// SVG viewBox) so a single `scale` on the parent Container sizes it for any
// cell diameter.
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
		graphics.fill({ color: colors.fill, alpha: 1 });
		graphics.stroke({ color: 0xffffff, width: 2, alpha: 0.3 });
		graphics.circle(37, 45, 10);
		graphics.fill({ color: colors.dark });
		graphics.circle(63, 45, 10);
		graphics.fill({ color: colors.dark });
		graphics.poly([50, 55, 45, 68, 55, 68]);
		graphics.fill({ color: colors.dark });
		graphics.roundRect(40, 76, 20, 10, 3);
		graphics.fill({ color: colors.dark });
		return;
	}

	if (name === 'coin') {
		graphics.circle(50, 50, 40);
		graphics.fill({ color: colors.fill });
		graphics.stroke({ color: 0xffffff, width: 3, alpha: 0.4 });
		graphics.circle(50, 50, 30);
		graphics.stroke({ color: 0x000000, width: 2, alpha: 0.18 });
		return;
	}

	if (name === 'wallet') {
		graphics.roundRect(15, 30, 70, 52, 10);
		graphics.fill({ color: colors.fill });
		graphics.stroke({ color: 0xffffff, width: 2, alpha: 0.35 });
		graphics.moveTo(15, 45);
		graphics.lineTo(85, 45);
		graphics.stroke({ color: 0x000000, width: 3, alpha: 0.2 });
		graphics.circle(68, 62, 7);
		graphics.fill({ color: colors.dark });
		return;
	}

	if (name === 'chest') {
		graphics.poly([20, 38, 80, 38, 80, 44, 20, 44]);
		graphics.fill({ color: colors.fill });
		graphics.roundRect(15, 44, 70, 38, 6);
		graphics.fill({ color: colors.fill });
		graphics.stroke({ color: 0xffffff, width: 2, alpha: 0.35 });
		graphics.roundRect(42, 44, 16, 14, 3);
		graphics.fill({ color: colors.dark });
		return;
	}

	if (name === 'crown') {
		graphics.poly([15, 40, 30, 65, 70, 65, 85, 40, 65, 52, 50, 22, 35, 52]);
		graphics.fill({ color: colors.fill });
		graphics.stroke({ color: 0xffffff, width: 2, alpha: 0.35 });
		graphics.roundRect(20, 70, 60, 8, 3);
		graphics.fill({ color: colors.fill });
		return;
	}

	if (name === 'star') {
		graphics.poly([50, 10, 61, 36, 89, 36, 66, 53, 75, 79, 50, 63, 25, 79, 34, 53, 11, 36, 39, 36]);
		graphics.fill({ color: colors.fill });
		graphics.stroke({ color: 0xffffff, width: 2, alpha: 0.35 });
		return;
	}

	if (name === 'diamond') {
		graphics.poly([30, 15, 70, 15, 88, 38, 50, 88, 12, 38]);
		graphics.fill({ color: colors.fill });
		graphics.stroke({ color: 0xffffff, width: 2, alpha: 0.45 });
		graphics.moveTo(12, 38);
		graphics.lineTo(88, 38);
		graphics.stroke({ color: 0xffffff, width: 1.5, alpha: 0.4 });
		return;
	}
}
