<script lang="ts">
	import type * as PIXI from 'pixi.js';
	import { Container, Graphics } from 'pixi-svelte';

	import SymbolIcon from './SymbolIcon.svelte';
	import type { SymbolName } from '../game/types';

	// Code-driven symbol animation around the sharp static icon:
	//  - reveal (once, ~0.6s): elastic pop with a wobble, white-gold flash,
	//    expanding shockwave ring, spinning light rays and a spark burst.
	//  - idle (loop): gentle float + breathing, with a periodic star glint.
	//  - win (loop): rotating gold sunburst and pulsing glow behind, the
	//    symbol bouncing, embers/coins rising, plus a fresh burst on entry.
	type Props = {
		name: SymbolName;
		// Edge length the symbol art occupies.
		size: number;
		winning: boolean;
	};

	const { name, size, winning }: Props = $props();

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
	const EMBERS = Array.from({ length: 9 }, (_, i) => ({
		x: (rand(i + 80) - 0.5) * 0.9,
		phase: rand(i + 100),
		speed: 0.55 + rand(i + 120) * 0.45,
		r: 0.018 + rand(i + 140) * 0.022,
		sway: 0.03 + rand(i + 160) * 0.05,
		coin: rand(i + 180) > 0.55,
	}));

	// Seconds since this symbol appeared (tw below: since it started winning).
	let t = $state(0);

	$effect(() => {
		const start = performance.now();
		let raf: number;
		const loop = (now: number) => {
			t = (now - start) / 1000;
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	});

	let winStart = -1;
	$effect(() => {
		if (winning) {
			if (winStart < 0) winStart = t;
		} else {
			winStart = -1;
		}
	});
	const tw = $derived(winning && winStart >= 0 ? t - winStart : -1);

	const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
	// Overshooting elastic ease-out: 0 -> ~1.2 -> ~0.93 -> 1.
	const elastic = (p: number) =>
		p >= 1 ? 1 : 1 - Math.pow(2, -9 * p) * Math.cos(p * Math.PI * 3.2);

	const revealP = $derived(clamp01(t / REVEAL_S));
	const revealing = $derived(revealP < 1);
	const isWin = $derived(tw >= 0);

	const symbolScale = $derived.by(() => {
		if (revealing) return Math.max(0.01, elastic(revealP));
		if (isWin) return 1.04 + 0.09 * Math.abs(Math.sin(tw * 4.2));
		return 1 + 0.025 * Math.sin(t * 2.3 + seed);
	});
	const symbolRotation = $derived.by(() => {
		if (revealing) return 0.22 * (1 - revealP) * Math.sin(revealP * 16);
		if (isWin) return 0.05 * Math.sin(tw * 8.4);
		return 0.025 * Math.sin(t * 1.4 + seed);
	});
	const symbolY = $derived.by(() => {
		if (revealing) return 0;
		if (isWin) return -Math.abs(Math.sin(tw * 4.2)) * size * 0.06;
		return Math.sin(t * 2 + seed) * size * 0.025;
	});

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

	const star = (g: PIXI.Graphics, x: number, y: number, r: number, alpha: number) => {
		const k = r * 0.22;
		g.poly([x, y - r, x + k, y - k, x + r, y, x + k, y + k, x, y + r, x - k, y + k, x - r, y, x - k, y - k]);
		g.fill({ color: 0xfff6d8, alpha });
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

	// Behind the symbol: reveal rays, win sunburst + glow.
	const drawBack = (g: PIXI.Graphics) => {
		if (revealing) {
			rays(g, 10, size * 0.15, size * (0.55 + 0.25 * revealP), t * 2.5, 0xffe08a, 0.55 * (1 - revealP));
		}
		if (isWin) {
			const pulse = 0.5 + 0.5 * Math.sin(tw * 4.2);
			g.circle(0, 0, size * (0.5 + 0.06 * pulse));
			g.fill({ color: 0xff9a1f, alpha: 0.28 + 0.18 * pulse });
			rays(g, 12, size * 0.2, size * 0.78, tw * 0.9, 0xffd75e, 0.32 + 0.15 * pulse);
			rays(g, 12, size * 0.15, size * 0.6, -tw * 0.6 + 0.26, 0xfff1c2, 0.18);
		}
	};

	// In front: bursts, idle glints, win embers.
	const drawFront = (g: PIXI.Graphics) => {
		burst(g, revealP < 1 ? revealP : 0);
		if (isWin) {
			burst(g, tw / 0.7);
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
</script>

<Graphics draw={drawBack} blendMode="add" />
<Container y={symbolY} scale={symbolScale} rotation={symbolRotation}>
	<SymbolIcon {name} {size} />
</Container>
<Graphics draw={drawFront} blendMode="add" />
