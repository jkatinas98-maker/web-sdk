<script lang="ts">
	import * as PIXI from 'pixi.js';
	import { onMount, onDestroy } from 'svelte';
	import { getContextParent } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { symbolAssetKey } from '../game/assets';
	import type { SymbolName } from '../game/types';

	// Code-driven symbol animation around the sharp static icon:
	//  - reveal (once, ~0.6s): elastic pop with a wobble, white-gold flash,
	//    expanding shockwave ring, spinning light rays and a spark burst.
	//  - idle (loop): gentle float + breathing, with a periodic star glint.
	//  - win (loop): layered fire ringing the symbol, glow, sunburst, splash
	//    rings, twinkles, rising embers/coins, and a bouncing symbol.
	//
	// Runs IMPERATIVELY on Pixi's own ticker: the Pixi objects are created
	// here and mutated every frame directly. Driving 60fps transforms and
	// redraws through Svelte reactive props per cell was unreliable (frames
	// only flushed on re-layout, and transforms went wrong), and is far
	// heavier than this.
	type Props = {
		name: SymbolName;
		// Edge length the symbol art occupies.
		size: number;
		winning: boolean;
	};

	const props: Props = $props();
	const context = getContext();
	const parent = getContextParent();

	const REVEAL_S = 0.6;
	const TAU = Math.PI * 2;

	// Per-cell randomness so a grid of the same symbol doesn't move in sync.
	const seed = Math.random() * 1000;
	const rand = (i: number) => {
		const x = Math.sin(seed + i * 12.9898) * 43758.5453;
		return x - Math.floor(x);
	};
	const SPARKS = Array.from({ length: 12 }, (_, i) => ({
		angle: (i / 12) * TAU + rand(i) * 0.4,
		speed: 0.75 + rand(i + 20) * 0.5,
		len: 0.06 + rand(i + 40) * 0.06,
		white: rand(i + 60) > 0.6,
	}));
	const EMBERS = Array.from({ length: 16 }, (_, i) => ({
		x: (rand(i + 80) - 0.5) * 0.9,
		phase: rand(i + 100),
		speed: 0.55 + rand(i + 120) * 0.45,
		r: 0.018 + rand(i + 140) * 0.022,
		sway: 0.03 + rand(i + 160) * 0.05,
		coin: rand(i + 180) > 0.55,
	}));

	// Win fire: flame tongues ringed around the symbol, biased upward.
	const FLAMES = Array.from({ length: 16 }, (_, i) => ({
		angle: (i / 16) * TAU + (rand(i + 200) - 0.5) * 0.2,
		phase: rand(i + 220) * TAU,
		len: 0.75 + rand(i + 240) * 0.5,
	}));
	// Multicolor twinkles scattered around a winning symbol.
	const TWINKLE_COLORS = [0xffd75e, 0xff4fd8, 0x5ee7ff, 0xffffff, 0x9cff5e, 0xff6a3d];
	const TWINKLES = Array.from({ length: 14 }, (_, i) => ({
		a: rand(i + 300) * TAU,
		r: 0.35 + rand(i + 320) * 0.45,
		phase: rand(i + 340),
		speed: 0.9 + rand(i + 360) * 0.9,
		color: TWINKLE_COLORS[i % TWINKLE_COLORS.length],
	}));

	// Animation state, advanced in update() below (plain variables: never
	// reactive, only read by the per-frame draw code).
	let size = props.size;
	let winning = props.winning;
	let t = 0;
	let tw = -1;
	let revealP = 0;
	let revealing = true;
	let isWin = false;
	let winSplash = 0;
	let winStart = -1;

	$effect(() => {
		size = props.size;
		winning = props.winning;
	});

	const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
	// Overshooting elastic ease-out: 0 -> ~1.2 -> ~0.93 -> 1.
	const elastic = (p: number) =>
		p >= 1 ? 1 : 1 - Math.pow(2, -9 * p) * Math.cos(p * Math.PI * 3.2);

	const rays = (g: PIXI.Graphics, count: number, inner: number, outer: number, rot: number, color: number, alpha: number) => {
		for (let i = 0; i < count; i++) {
			const a = rot + (i / count) * TAU;
			const w = (TAU / count) * 0.28;
			g.poly([
				Math.cos(a - w) * inner, Math.sin(a - w) * inner,
				Math.cos(a) * outer, Math.sin(a) * outer,
				Math.cos(a + w) * inner, Math.sin(a + w) * inner,
			]);
			g.fill({ color, alpha });
		}
	};

	const star = (g: PIXI.Graphics, x: number, y: number, r: number, alpha: number, color = 0xfff6d8) => {
		if (r <= 0.2) return;
		const k = r * 0.22;
		g.poly([x, y - r, x + k, y - k, x + r, y, x + k, y + k, x, y + r, x - k, y + k, x - r, y, x - k, y - k]);
		g.fill({ color, alpha });
	};

	// One shared burst (reveal, and again when a win starts), p in 0..1.
	const burst = (g: PIXI.Graphics, p: number) => {
		if (p <= 0 || p >= 1) return;
		// flash
		const fp = clamp01(p / 0.45);
		if (fp < 1) {
			g.circle(0, 0, size * (0.25 + 0.45 * fp));
			g.fill({ color: 0xfff1c2, alpha: 0.85 * (1 - fp) });
		}
		// shockwave
		g.circle(0, 0, size * (0.3 + 0.75 * p));
		g.stroke({ color: 0xffd75e, width: Math.max(1, size * 0.05 * (1 - p)), alpha: 1 - p });
		// sparks
		for (const s of SPARKS) {
			const d0 = size * (0.2 + s.speed * 0.7 * p);
			const d1 = d0 + size * s.len * (1 - p * 0.6);
			g.moveTo(Math.cos(s.angle) * d0, Math.sin(s.angle) * d0);
			g.lineTo(Math.cos(s.angle) * d1, Math.sin(s.angle) * d1);
			g.stroke({ color: s.white ? 0xffffff : 0xffc23d, width: Math.max(1, size * 0.025), alpha: 1 - p });
		}
	};

	// One flame tongue: a teardrop from a base arc on a ring of radius r0
	// out to a tip, curling upward like fire.
	const tongue = (
		g: PIXI.Graphics,
		angle: number,
		r0: number,
		length: number,
		halfW: number,
		color: number,
		alpha: number,
		sway: number,
	) => {
		const dx = Math.cos(angle);
		const dy = Math.sin(angle);
		// tip direction: outward, bent strongly toward "up" (fire rises)
		let tx = dx * 0.85 + sway;
		let ty = dy * 0.85 - 0.55;
		const n = Math.hypot(tx, ty) || 1;
		tx /= n;
		ty /= n;
		const bx = dx * r0;
		const by = dy * r0;
		const px = -dy * halfW;
		const py = dx * halfW;
		const tipX = bx + tx * length;
		const tipY = by + ty * length;
		g.moveTo(bx + px, by + py);
		g.quadraticCurveTo(bx + px * 1.6 + tx * length * 0.45, by + py * 1.6 + ty * length * 0.45, tipX, tipY);
		g.quadraticCurveTo(bx - px * 1.6 + tx * length * 0.45, by - py * 1.6 + ty * length * 0.45, bx - px, by - py);
		g.closePath();
		g.fill({ color, alpha });
	};

	// Layered fire: red outer, orange middle, yellow-white core.
	const FIRE_LAYERS = [
		{ color: 0xd81408, scale: 1, width: 1.05, alpha: 0.92 },
		{ color: 0xff6a00, scale: 0.74, width: 0.75, alpha: 0.92 },
		{ color: 0xffc21f, scale: 0.5, width: 0.5, alpha: 0.95 },
		{ color: 0xfff6c8, scale: 0.26, width: 0.28, alpha: 0.9 },
	];

	const fire = (g: PIXI.Graphics) => {
		const splashBoost = 1 + winSplash * 1.4;
		for (const layer of FIRE_LAYERS) {
			for (let i = 0; i < FLAMES.length; i++) {
				const f = FLAMES[i];
				const flicker =
					0.72 + 0.22 * Math.sin(tw * 13 + f.phase) + 0.12 * Math.sin(tw * 23 + f.phase * 2.3);
				// taller where the flame faces up/out the top
				const upBias = 1 + 0.55 * Math.max(0, -Math.sin(f.angle));
				const length = size * 0.5 * f.len * flicker * upBias * layer.scale * splashBoost;
				tongue(
					g,
					f.angle,
					size * 0.3,
					length,
					size * 0.07 * layer.width,
					layer.color,
					layer.alpha,
					0.25 * Math.sin(tw * 3 + f.phase),
				);
			}
		}
	};

	// Behind the symbol: reveal rays; on a win, glow, sunburst and fire.
	const drawBack = (g: PIXI.Graphics) => {
		if (revealing) {
			rays(g, 10, size * 0.15, size * (0.55 + 0.25 * revealP), t * 2.5, 0xffe08a, 0.55 * (1 - revealP));
		}
		if (isWin) {
			const pulse = 0.5 + 0.5 * Math.sin(tw * 5);
			// hot core glow, cycling red -> orange -> gold
			// layered hot glow (red rim -> orange -> gold core), breathing
			const grow = 0.06 * pulse + winSplash * 0.4;
			g.circle(0, 0, size * (0.95 + grow));
			g.fill({ color: 0xc8160a, alpha: 0.14 });
			g.circle(0, 0, size * (0.72 + grow));
			g.fill({ color: 0xff5a00, alpha: 0.2 + 0.08 * pulse });
			g.circle(0, 0, size * (0.48 + grow));
			g.fill({ color: 0xffb21f, alpha: 0.22 + 0.1 * pulse });
			rays(g, 14, size * 0.25, size * (1.0 + winSplash * 0.5), tw * 1.2, 0xffc21f, 0.22 + 0.12 * pulse);
			rays(g, 14, size * 0.2, size * 0.75, -tw * 0.8 + 0.22, 0xff4a1a, 0.2);
			fire(g);
		}
	};

	// In front: bursts, idle glints, win embers.
	const drawFront = (g: PIXI.Graphics) => {
		burst(g, revealP < 1 ? revealP : 0);
		if (isWin) {
			burst(g, tw / 0.7);
			// second, wider fire-colored splash ring
			const sp = tw / 0.9;
			if (sp < 1) {
				g.circle(0, 0, size * (0.4 + 1.1 * sp));
				g.stroke({ color: 0xff6a1a, width: Math.max(1, size * 0.08 * (1 - sp)), alpha: 1 - sp });
			}
			for (const tk of TWINKLES) {
				const p = (tw * tk.speed + tk.phase) % 1;
				const a = Math.sin(p * Math.PI);
				const ang = tk.a + tw * 0.4;
				star(g, Math.cos(ang) * tk.r * size, Math.sin(ang) * tk.r * size, size * 0.075 * a, a, tk.color);
			}
			for (const e of EMBERS) {
				const p = (tw * e.speed + e.phase) % 1;
				const x = (e.x + Math.sin((p + e.phase) * TAU) * e.sway) * size;
				const y = size * (0.45 - 1.05 * p);
				const a = Math.sin(p * Math.PI);
				if (e.coin) {
					g.ellipse(x, y, size * e.r * 1.4 * Math.abs(Math.cos(tw * 6 + e.phase * 9)) + 0.5, size * e.r * 1.4);
					g.fill({ color: 0xf2c744, alpha: a });
				} else {
					g.circle(x, y, size * e.r);
					g.fill({ color: 0xff7a1a, alpha: a * 0.9 });
				}
			}
		} else if (!revealing) {
			// a glint every ~2.6s at a seeded corner-ish spot
			const cycle = 2.6;
			const k = Math.floor((t + seed) / cycle);
			const p = ((t + seed) % cycle) / 0.45;
			if (p < 1) {
				const a = rand(k) * TAU;
				const r = size * 0.33;
				star(g, Math.cos(a) * r, Math.sin(a) * r - size * 0.05, size * 0.11 * Math.sin(p * Math.PI), Math.sin(p * Math.PI));
			}
		}
	};

	// ---------- Pixi objects ----------
	const root = new PIXI.Container();
	const back = new PIXI.Graphics();
	const iconHolder = new PIXI.Container();
	const icon = new PIXI.Sprite(
		(context.stateApp.loadedAssets?.[symbolAssetKey(props.name)] as PIXI.Texture) ?? PIXI.Texture.EMPTY,
	);
	icon.anchor.set(0.5);
	const front = new PIXI.Graphics();
	iconHolder.addChild(icon);
	root.addChild(back, iconHolder, front);
	parent.addToParent(root);

	let reported = false;

	const update = (ticker: PIXI.Ticker) => {
		try {
			t += ticker.deltaMS / 1000;
			if (winning) {
				if (winStart < 0) winStart = t;
			} else {
				winStart = -1;
			}
			tw = winStart >= 0 ? t - winStart : -1;
			revealP = clamp01(t / REVEAL_S);
			revealing = revealP < 1;
			isWin = tw >= 0;
			winSplash = isWin ? Math.max(0, 1 - tw / 0.5) : 0;

			let scale: number;
			let rotation: number;
			let y: number;
			if (revealing) {
				scale = Math.max(0.01, elastic(revealP));
				rotation = 0.22 * (1 - revealP) * Math.sin(revealP * 16);
				y = 0;
			} else if (isWin) {
				scale = winSplash * 0.25 + 1.08 + 0.12 * Math.abs(Math.sin(tw * 5));
				rotation = 0.035 * Math.sin(tw * 9);
				y = -Math.abs(Math.sin(tw * 5)) * size * 0.08;
			} else {
				scale = 1 + 0.025 * Math.sin(t * 2.3 + seed);
				rotation = 0.025 * Math.sin(t * 1.4 + seed);
				y = Math.sin(t * 2 + seed) * size * 0.025;
			}

			// Icon PNGs are square-padded, so one uniform factor fits the art
			// into `size` without distortion.
			const texW = icon.texture.orig.width || 1;
			icon.scale.set(size / texW);
			iconHolder.scale.set(scale);
			iconHolder.rotation = rotation;
			iconHolder.y = y;

			back.clear();
			drawBack(back);
			front.clear();
			drawFront(front);
		} catch (error) {
			if (!reported) {
				reported = true;
				console.error('AnimatedSymbol update failed:', error);
			}
		}
	};

	onMount(() => {
		context.stateApp.pixiApplication?.ticker.add(update);
	});

	onDestroy(() => {
		context.stateApp.pixiApplication?.ticker.remove(update);
		// root itself is destroyed by addToParent's cleanup; take its
		// children (graphics/sprite holders) down too.
		for (const child of [back, iconHolder, front]) child.destroy({ children: true });
	});
</script>
