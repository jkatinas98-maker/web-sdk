<script lang="ts">
	import * as PIXI from 'pixi.js';
	import { Container, Graphics, Text } from 'pixi-svelte';

	import SymbolIcon from './SymbolIcon.svelte';
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
		onReveal: () => void;
	};

	const { x, y, size, panel, revealed, winning, jackpot, interactive, onReveal }: Props = $props();

	const mult = $derived(panel ? config.symbols[panel.name].mult : 0);
	const isBonus = $derived(panel?.name === 'bonus');
	// Either kind of "special" tile gets the glow+blink treatment.
	const special = $derived(jackpot || isBonus);

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

	// Color priority: a confirmed win (green) beats the jackpot-symbol glow
	// (gold) beats the bonus-scatter glow (pink) beats a plain revealed tile
	// (cyan) beats the unrevealed default (purple). The special glow blinks
	// on top of whatever color won out — stacks with the winning-tile
	// breathing pulse rather than replacing it, so a jackpot/bonus symbol
	// that's ALSO part of the win still reads as a win first, just a
	// sparklier one.
	const specialColor = $derived(jackpot ? 0xfbbf24 : 0xec4899);
	const borderColor = $derived(winning ? 0x10b981 : special ? specialColor : revealed ? 0x06b6d4 : 0x8b5cf6);
	const baseBorderAlpha = $derived(winning ? 0.9 : special ? 0.95 : revealed ? 0.55 : 0.3);
	const borderWidth = $derived(winning ? 2.5 : special ? 2.5 : revealed ? 1.5 : 1);
	const fillColor = $derived(winning ? 0x10b981 : special ? specialColor : 0x0f172a);
	const baseFillAlpha = $derived(winning ? 0.22 : special ? 0.18 : 0.9);
	const radius = $derived(size * 0.18);

	const borderAlpha = $derived(special ? baseBorderAlpha * blinkAlpha : baseBorderAlpha);
	const fillAlpha = $derived(special ? baseFillAlpha * blinkAlpha : baseFillAlpha);

	const drawTile = (graphics: PIXI.Graphics) => {
		graphics.roundRect(-size / 2, -size / 2, size, size, radius);
		graphics.fill({ color: fillColor, alpha: fillAlpha });
		graphics.stroke({ color: borderColor, width: borderWidth, alpha: borderAlpha });
	};

	const drawFoil = (graphics: PIXI.Graphics) => {
		graphics.roundRect(-size / 2, -size / 2, size, size, radius);
		graphics.fill({ color: 0x1e293b, alpha: 1 });
		graphics.stroke({ color: 0x8b5cf6, width: 1, alpha: 0.3 });
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
			// Landing the mode's top symbol or a 🎁 scatter each get their own
			// distinct chime instead of the plain reveal blip.
			playSound(jackpot ? 'jackpot' : isBonus ? 'scatterLand' : 'reveal');
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
		<Container scale={displayScale}>
			<Container y={-size * 0.1}>
				<SymbolIcon name={panel.name} size={size * 0.42} />
			</Container>

			<Text
				y={size * 0.3}
				anchor={0.5}
				text={mult > 0 ? `×${mult}` : panel.name === 'bonus' ? 'BONUS' : '—'}
				style={{
					fontFamily: 'Outfit, sans-serif',
					fontWeight: '800',
					fontSize: panel.name === 'bonus' ? size * 0.1 : size * 0.14,
					fill: mult > 0 ? 0x06b6d4 : panel.name === 'bonus' ? 0xec4899 : 0x64748b,
				}}
			/>
		</Container>
	{:else}
		<Container
			eventMode={interactive ? 'static' : 'none'}
			cursor={interactive ? 'pointer' : 'default'}
			onpointerup={interactive ? handleReveal : undefined}
		>
			<Graphics draw={drawHitArea} />
			<Text
				anchor={0.5}
				text="SCRATCH"
				style={{
					fontFamily: 'Outfit, sans-serif',
					fontWeight: '700',
					fontSize: size * 0.1,
					letterSpacing: 1,
					fill: 0x475569,
				}}
			/>
		</Container>
	{/if}
</Container>
