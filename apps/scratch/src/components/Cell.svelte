<script lang="ts">
	import * as PIXI from 'pixi.js';
	import { Container, Circle, Graphics, Text } from 'pixi-svelte';

	import SymbolIcon from './SymbolIcon.svelte';
	import { SYMBOL_TIER, SYMBOL_COLORS } from '../game/symbolIcons';
	import config from '../game/config';
	import { playSound } from '../game/sound';
	import type { RawSymbol } from '../game/types';

	type Props = {
		x: number;
		y: number;
		diameter: number;
		panel: RawSymbol | undefined;
		revealed: boolean;
		interactive: boolean;
		onReveal: () => void;
	};

	const { x, y, diameter, panel, revealed, interactive, onReveal }: Props = $props();

	const tier = $derived(panel ? SYMBOL_TIER[panel.name] : 0);
	const glowAlpha = $derived(tier === 0 ? 0 : 0.1 + tier * 0.035);
	const glowColor = $derived(panel ? SYMBOL_COLORS[panel.name].glow : 0xffffff);
	const ringColor = $derived(panel ? SYMBOL_COLORS[panel.name].fill : 0x334155);
	// The book only ever sends `{ name }` for a panel (see scratch_sim.py) —
	// the display multiplier always comes from the local paytable, matched
	// by symbol id, never from a `multiplier` field on the panel itself.
	const mult = $derived(panel ? config.symbols[panel.name].mult : 0);

	// Soft layered glow behind the icon: several concentric, decreasing-alpha
	// circles fake a blur without needing a filter dependency.
	const glowLayers = $derived(
		glowAlpha > 0
			? [
					{ scale: 1.65, alpha: glowAlpha * 0.35 },
					{ scale: 1.35, alpha: glowAlpha * 0.6 },
					{ scale: 1.1, alpha: glowAlpha },
				]
			: [],
	);

	// Diagonal holographic foil cover, in the same cyan/purple/pink family as
	// the ticket card, instead of a flat grey coin — wrapped defensively like
	// the card's own gradient fill.
	const drawFoil = (graphics: PIXI.Graphics, size: number) => {
		const r = size / 2;
		graphics.circle(r, r, r);
		try {
			const gradient = new PIXI.FillGradient(0, 0, 1, 1);
			gradient.addColorStop(0, 0x1e1b4b);
			gradient.addColorStop(0.5, 0x3730a3);
			gradient.addColorStop(1, 0x0f172a);
			graphics.fill(gradient);
		} catch (error) {
			console.error('Foil gradient fill failed, using flat fallback:', error);
			graphics.fill({ color: 0x334155, alpha: 1 });
		}
		graphics.stroke({ color: 0x8b5cf6, width: 1.5, alpha: 0.45 });
	};

	// Pop the symbol in with a little overshoot when a panel is first
	// revealed, instead of it just instantly appearing.
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

<Container {x} {y}>
	{#if revealed && panel}
		<Container scale={displayScale}>
			<Circle diameter={diameter} anchor={0.5} backgroundColor={0x0b0e17} backgroundAlpha={0.9} />
			<Circle
				diameter={diameter}
				anchor={0.5}
				backgroundAlpha={0}
				borderColor={ringColor}
				borderWidth={2}
				borderAlpha={0.55}
			/>

			{#each glowLayers as layer (layer.scale)}
				<Circle
					diameter={diameter * layer.scale}
					anchor={0.5}
					backgroundColor={glowColor}
					backgroundAlpha={layer.alpha}
				/>
			{/each}

			<Container y={-diameter * 0.08}>
				<SymbolIcon name={panel.name} size={diameter * 0.6} />
			</Container>

			<Text
				y={diameter * 0.32}
				anchor={0.5}
				text={mult > 0 ? `×${mult}` : '—'}
				style={{
					fontFamily: 'Outfit, sans-serif',
					fontWeight: '800',
					fontSize: diameter * 0.15,
					fill: mult > 0 ? 0xffffff : 0x64748b,
				}}
			/>
		</Container>
	{:else}
		<Container
			eventMode={interactive ? 'static' : 'none'}
			cursor={interactive ? 'pointer' : 'default'}
			onpointerup={interactive ? handleReveal : undefined}
		>
			<Graphics draw={(graphics) => drawFoil(graphics, diameter)} />
			<Circle
				diameter={diameter * 0.8}
				anchor={0.5}
				x={-diameter * 0.14}
				y={-diameter * 0.14}
				backgroundColor={0xffffff}
				backgroundAlpha={0.08}
			/>
		</Container>
	{/if}
</Container>
