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
		interactive: boolean;
		onReveal: () => void;
	};

	const { x, y, size, panel, revealed, winning, interactive, onReveal }: Props = $props();

	const mult = $derived(panel ? config.symbols[panel.name].mult : 0);

	const borderColor = $derived(winning ? 0x10b981 : revealed ? 0x06b6d4 : 0x8b5cf6);
	const borderAlpha = $derived(winning ? 0.9 : revealed ? 0.55 : 0.3);
	const borderWidth = $derived(winning ? 2.5 : revealed ? 1.5 : 1);
	const fillColor = $derived(winning ? 0x10b981 : 0x0f172a);
	const fillAlpha = $derived(winning ? 0.22 : 0.9);
	const radius = $derived(size * 0.18);

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

	// Winning tiles breathe slowly (matches the reference's pulseWin
	// keyframe: scale 0.97 <-> 1.03).
	let pulseScale = $state(1);
	$effect(() => {
		if (!winning) {
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
			playSound('reveal');
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
				text={mult > 0 ? `×${mult}` : '—'}
				style={{
					fontFamily: 'Outfit, sans-serif',
					fontWeight: '800',
					fontSize: size * 0.14,
					fill: mult > 0 ? 0x06b6d4 : 0x64748b,
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
