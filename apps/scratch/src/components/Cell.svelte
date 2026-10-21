<script lang="ts">
	import type * as PIXI from 'pixi.js';
	import { Container, Graphics, Text } from 'pixi-svelte';

	import AnimatedSymbol from './AnimatedSymbol.svelte';
	import { MATCH_GAP_MS, EXTRA_START_MS, EXTRA_GAP_MS } from '../game/winTiming';
	import config from '../game/config';
	import { playSound } from '../game/sound';
	import type { RawSymbol } from '../game/types';

	type Props = {
		x: number;
		y: number;
		size: number;
		panel: RawSymbol | undefined;
		revealed: boolean;
		winning: boolean;
		// This difficulty's top-paying symbol — glows gold and blinks the
		// instant it's revealed, win or not (an anticipation cue, like
		// landing a scratcher's jackpot icon before you know if it's a win).
		jackpot: boolean;
		interactive: boolean;
		// 1, 2, ... if this tile is the 4th, 5th, ... of the winning symbol
		// (0 otherwise); extraStep is the bonus it adds (+0.25x etc).
		extraIndex?: number;
		extraStep?: number;
		// 1..3 for the three tiles that make the match; matchMult is the
		// symbol's multiplier (shown off the 3rd).
		matchIndex?: number;
		matchMult?: number;
		onReveal: () => void;
	};

	const { x, y, size, panel, revealed, winning, jackpot, interactive, extraIndex = 0, extraStep = 0, matchIndex = 0, matchMult = 0, onReveal }: Props = $props();

	// Extra-match animation: each extra tile, in turn, bursts a gold ring
	// and fires a "+0.25x" that floats up and away, then keeps a small
	// "+0.25x" badge. Timed to match the win-tally pill in Game.svelte.
	let extraT = $state(-1);
	$effect(() => {
		if (!(winning && extraIndex > 0)) {
			extraT = -1;
			return;
		}
		const start = performance.now() + EXTRA_START_MS + (extraIndex - 1) * EXTRA_GAP_MS;
		let sounded = false;
		let raf = 0;
		const loop = (now: number) => {
			const t = (now - start) / 1300;
			if (t >= 0 && !sounded) {
				sounded = true;
				playSound('scatterLand');
			}
			extraT = t < 0 ? -1 : Math.min(1, t);
			if (t < 1) raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	});
	// Regular match (the 3 tiles that win): quicker, cool silver-blue
	// "ting" chain -- ring + numbered seal (1, 2, 3), the 3rd also lifts the
	// symbol's "x2". Extras (gold "+0.25x") follow after it.
	let matchT = $state(-1);
	$effect(() => {
		if (!(winning && matchIndex > 0)) {
			matchT = -1;
			return;
		}
		const start = performance.now() + 150 + (matchIndex - 1) * MATCH_GAP_MS;
		let sounded = false;
		let raf = 0;
		const loop = (now: number) => {
			const t = (now - start) / 1100;
			if (t >= 0 && !sounded) {
				sounded = true;
				playSound('match', 1 + (matchIndex - 1) * 0.26);
			}
			matchT = t < 0 ? -1 : Math.min(1, t);
			if (t < 1) raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	});

	const extraLabel = $derived(`+${+extraStep.toFixed(2)}x`);
	const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

	const mult = $derived(panel ? config.symbols[panel.name].mult : 0);
	const isBonus = $derived(panel?.name === 'bonus');
	const isKey = $derived(panel?.name === 'key');
	const isKraken = $derived(panel?.name === 'kraken');
	const isShark = $derived(panel?.name === 'shark');
	// Every "special" tile kind gets the glow+blink treatment.
	const special = $derived(jackpot || isBonus || isKey || isKraken || isShark);

	// Fast alpha flicker, special tiles only — the "blink" half of "glow and
	// blink" (declared before the color derivations below so they can use
	// it directly).
	let blinkAlpha = $state(1);
	$effect(() => {
		if (!special) {
			blinkAlpha = 1;
			return;
		}
		let raf: number;
		const start = performance.now();
		const loop = (now: number) => {
			const elapsed = (now - start) / 220;
			blinkAlpha = 0.45 + Math.abs(Math.sin(elapsed * Math.PI)) * 0.55;
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	});

	// Color priority: a confirmed win (gold) beats the jackpot-symbol glow
	// (bright gold) beats the key (brass) beats the bonus scatter (blood red)
	// beats a plain revealed tile (dim brass edge) beats the unrevealed
	// parchment foil. The special glow blinks on top of whatever color won
	// out — stacks with the winning-tile breathing pulse rather than
	// replacing it, so a jackpot/bonus symbol that's ALSO part of the win
	// still reads as a win first, just a sparklier one.
	const specialColor = $derived(jackpot ? 0xffd75e : isKey ? 0xe0b13a : isKraken ? 0x22d3ee : isShark ? 0x3b82f6 : 0xd23a2a);
	const borderColor = $derived(winning ? 0xf2c744 : special ? specialColor : revealed ? 0x8a6a3e : 0x5c3a21);
	const baseBorderAlpha = $derived(winning ? 1 : special ? 0.95 : revealed ? 0.8 : 1);
	const borderWidth = $derived(winning ? 3 : special ? 2.5 : revealed ? 1.5 : 2);
	const fillColor = $derived(winning ? 0xf2c744 : special ? specialColor : 0x120c07);
	const baseFillAlpha = $derived(winning ? 0.24 : special ? 0.18 : 0.92);
	const radius = $derived(size * 0.14);

	const borderAlpha = $derived(special ? baseBorderAlpha * blinkAlpha : baseBorderAlpha);
	const fillAlpha = $derived(special ? baseFillAlpha * blinkAlpha : baseFillAlpha);

	// Revealed slot: dark recessed wood with a soft warm center so the art
	// pops, then the state-colored edge on top.
	const drawTile = (graphics: PIXI.Graphics) => {
		graphics.roundRect(-size / 2, -size / 2, size, size, radius);
		graphics.fill({ color: fillColor, alpha: fillAlpha });
		graphics.circle(0, -size * 0.06, size * 0.36);
		graphics.fill({ color: 0xe8a33d, alpha: winning ? 0.16 : 0.07 });
		graphics.roundRect(-size / 2, -size / 2, size, size, radius);
		graphics.stroke({ color: borderColor, width: borderWidth, alpha: borderAlpha });
	};

	// Unscratched: aged, tea-stained parchment — warm tan with a burnt edge,
	// a darker inset border and a compass-rose mark, like a sealed map
	// square.
	const drawFoil = (graphics: PIXI.Graphics) => {
		const h = size / 2;
		const cy = -size * 0.06;
		graphics.roundRect(-h, -h, size, size, radius);
		graphics.fill({ color: 0xc09a62 });
		// soft lighter center
		graphics.circle(0, cy, size * 0.42);
		graphics.fill({ color: 0xd9bb84, alpha: 0.55 });
		// burnt edge
		graphics.roundRect(-h + 2, -h + 2, size - 4, size - 4, radius);
		graphics.stroke({ color: 0x6b4524, width: 5, alpha: 0.35 });
		graphics.roundRect(-h + 6, -h + 6, size - 12, size - 12, radius * 0.7);
		graphics.stroke({ color: 0x6b4524, width: 1.4, alpha: 0.75 });

		const r = size * 0.2;
		graphics.circle(0, cy, r);
		graphics.stroke({ color: 0x5c3a1c, width: 1.6, alpha: 0.8 });
		graphics.poly([0, cy - r * 1.3, r * 0.24, cy, 0, cy + r * 1.3, -r * 0.24, cy]);
		graphics.fill({ color: 0x5c3a1c, alpha: 0.8 });
		graphics.poly([-r * 1.3, cy, 0, cy - r * 0.24, r * 1.3, cy, 0, cy + r * 0.24]);
		graphics.fill({ color: 0x5c3a1c, alpha: 0.6 });
		graphics.circle(0, cy - r * 1.3, size * 0.018);
		graphics.fill({ color: 0x9a2a1a, alpha: 0.85 });

		graphics.roundRect(-h, -h, size, size, radius);
		graphics.stroke({ color: 0x3d2614, width: 2 });
	};

	// Invisible but hit-testable — keeps the tap target the full tile even
	// though the visible foil is drawn by the sibling Graphics above it.
	const drawHitArea = (graphics: PIXI.Graphics) => {
		graphics.rect(-size / 2, -size / 2, size, size);
		graphics.fill({ color: 0x000000, alpha: 0.001 });
	};

	// Winning AND special (jackpot/bonus) tiles breathe slowly (matches the
	// reference's pulseWin keyframe: scale 0.97 <-> 1.03).
	let pulseScale = $state(1);
	$effect(() => {
		if (!winning && !special) {
			pulseScale = 1;
			return;
		}
		let raf: number;
		const start = performance.now();
		const loop = (now: number) => {
			const elapsed = (now - start) / 800;
			pulseScale = 1 + Math.sin(elapsed * Math.PI) * 0.03;
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	});

	// Pop the symbol in with a little overshoot when first revealed.
	let displayScale = $state(1);
	let wasRevealed = false;

	$effect(() => {
		if (revealed && !wasRevealed) {
			// Landing the mode's top symbol, the scatter, or a key each get
			// their own distinct chime instead of the plain reveal blip. Key
			// reuses the scatter chime for now (TODO: a dedicated "keyLand"
			// synth once the feature it triggers is built).
			playSound(jackpot ? 'jackpot' : isBonus || isKey || isKraken || isShark ? 'scatterLand' : 'reveal');
			const start = performance.now();
			const duration = 280;

			const tick = (now: number) => {
				const t = Math.min(1, (now - start) / duration);
				const eased = 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2);
				displayScale = t < 1 ? Math.max(0, eased) : 1;
				if (t < 1) requestAnimationFrame(tick);
			};

			displayScale = 0.3;
			requestAnimationFrame(tick);
		}
		wasRevealed = revealed;
	});

	function handleReveal() {
		playSound('scratch');
		onReveal();
	}
</script>

<Container {x} {y} scale={pulseScale}>
	<Graphics draw={revealed ? drawTile : drawFoil} />

	{#if revealed && panel}
		<!-- The artist's reveal frames do their own pop-in, so the symbol
		     isn't code-scaled; only the multiplier label below pops. -->
		<Container y={-size * 0.08}>
			<AnimatedSymbol name={panel.name} size={size * 0.62} {winning} />
		</Container>
		<Container scale={displayScale}>

			<Text
				y={size * 0.36}
				anchor={0.5}
				text={mult > 0 ? `×${mult}` : isBonus ? 'BONUS' : isKey ? 'KEY' : isKraken ? 'KRAKEN' : isShark ? 'SHARK' : '—'}
				style={{
					fontFamily: 'Cinzel, Georgia, serif',
					fontWeight: '700',
					fontSize: isBonus || isKey || isKraken || isShark ? size * 0.1 : size * 0.13,
					fill: mult > 0 ? 0xf2c744 : isBonus ? 0xff8a7a : isKey ? 0xf2c744 : isKraken ? 0x67e8f9 : isShark ? 0x93c5fd : 0x8a7a66,
					dropShadow: { color: 0x000000, alpha: 0.8, blur: 2, distance: 1 },
				}}
			/>
		</Container>
		{#if matchT >= 0}
			{@const mRing = Math.min(1, matchT / 0.4)}
			<Graphics
				draw={(g) => {
					g.clear();
					if (mRing < 1) {
						g.circle(0, -size * 0.06, size * (0.2 + 0.42 * easeOut(mRing)));
						g.stroke({ color: 0x9be7ff, width: size * 0.05 * (1 - mRing), alpha: 1 - mRing });
					}
					// numbered seal, top-left corner
					const sx = -size * 0.33;
					const sy = -size * 0.33;
					const pop = Math.min(1, matchT / 0.2);
					g.circle(sx, sy, size * 0.11 * (0.5 + 0.5 * easeOut(pop)));
					g.fill({ color: 0x0c4a6e, alpha: 0.95 });
					g.circle(sx, sy, size * 0.11 * (0.5 + 0.5 * easeOut(pop)));
					g.stroke({ color: 0xbfefff, width: 2 });
				}}
			/>
			<Text
				anchor={0.5}
				x={-size * 0.33}
				y={-size * 0.33}
				alpha={Math.min(1, matchT / 0.2)}
				text={`${matchIndex}`}
				style={{ fontFamily: 'Cinzel, Georgia, serif', fontWeight: '900', fontSize: size * 0.13, fill: 0xe0f7ff }}
			/>
			{#if matchIndex === 3}
				<Text
					anchor={0.5}
					y={-size * 0.05 - size * 0.6 * easeOut(matchT)}
					alpha={matchT < 0.6 ? 1 : 1 - (matchT - 0.6) / 0.4}
					scale={0.6 + 0.7 * easeOut(Math.min(1, matchT / 0.25)) - 0.15 * matchT}
					text={`x${matchMult}`}
					style={{
						fontFamily: 'Pirata One, Cinzel, serif',
						fontSize: size * 0.32,
						fill: 0xf0fbff,
						stroke: { color: 0x0c3a5a, width: 4 },
						dropShadow: { color: 0x38bdf8, alpha: 0.9, blur: 6, distance: 0 },
					}}
				/>
			{/if}
		{/if}
		{#if extraT >= 0}
			{@const ringT = Math.min(1, extraT / 0.45)}
			<Graphics
				draw={(g) => {
					g.clear();
					if (ringT < 1) {
						g.circle(0, -size * 0.06, size * (0.25 + 0.5 * easeOut(ringT)));
						g.stroke({ color: 0xffd75e, width: size * 0.06 * (1 - ringT), alpha: 1 - ringT });
						g.roundRect(-size / 2, -size / 2, size, size, radius);
						g.stroke({ color: 0xfff1b8, width: 3, alpha: 0.9 * (1 - ringT) });
					}
				}}
			/>
			<!-- floating "+0.25x" -->
			<Text
				anchor={0.5}
				y={-size * 0.05 - size * 0.75 * easeOut(extraT)}
				alpha={extraT < 0.6 ? 1 : 1 - (extraT - 0.6) / 0.4}
				scale={0.6 + 0.8 * easeOut(Math.min(1, extraT / 0.25)) - 0.2 * extraT}
				text={extraLabel}
				style={{
					fontFamily: 'Pirata One, Cinzel, serif',
					fontSize: size * 0.3,
					fill: 0xffd75e,
					stroke: { color: 0x3a1f08, width: 4 },
					dropShadow: { color: 0xff8a00, alpha: 0.9, blur: 6, distance: 0 },
				}}
			/>
			<!-- badge that stays in the tile's corner -->
			<Text
				anchor={0.5}
				x={size * 0.3}
				y={-size * 0.4}
				alpha={Math.min(1, extraT / 0.3)}
				text={extraLabel}
				style={{
					fontFamily: 'Cinzel, Georgia, serif',
					fontWeight: '900',
					fontSize: size * 0.13,
					fill: 0xffd75e,
					stroke: { color: 0x2a1505, width: 3 },
				}}
			/>
		{/if}
	{:else}
		<Container
			eventMode={interactive ? 'static' : 'none'}
			cursor={interactive ? 'pointer' : 'default'}
			onpointerup={interactive ? handleReveal : undefined}
		>
			<Graphics draw={drawHitArea} />
			<Text
				anchor={0.5}
				y={size * 0.34}
				text="SCRATCH"
				style={{
					fontFamily: 'Cinzel, Georgia, serif',
					fontWeight: '900',
					fontSize: size * 0.095,
					letterSpacing: 1.5,
					fill: 0x3d2614,
				}}
			/>
		</Container>
	{/if}
</Container>
