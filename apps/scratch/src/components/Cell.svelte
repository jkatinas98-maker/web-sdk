<script lang="ts">
	import { Container, Circle, Text } from 'pixi-svelte';

	import SymbolIcon from './SymbolIcon.svelte';
	import { SYMBOL_TIER, SYMBOL_COLORS } from '../game/symbolIcons';
	import config from '../game/config';
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
	// Glow radius escalates with payout tier (0 = skull/no glow, 6 = diamond,
	// the biggest) so the eye is drawn toward rarer symbols once revealed —
	// mirrors the CSS drop-shadow ladder in gem-scratch.html.
	const glowRadius = $derived(diameter * (0.5 + tier * 0.045));
	const glowAlpha = $derived(tier === 0 ? 0 : 0.12 + tier * 0.04);
	const glowColor = $derived(panel ? SYMBOL_COLORS[panel.name].fill : 0xffffff);
	// The book only ever sends `{ name }` for a panel (see scratch_sim.py) —
	// the display multiplier always comes from the local paytable, matched
	// by symbol id, never from a `multiplier` field on the panel itself.
	const mult = $derived(panel ? config.symbols[panel.name].mult : 0);
</script>

<Container {x} {y}>
	{#if revealed && panel}
		<Circle diameter={diameter} anchor={0.5} backgroundColor={0x0f172a} backgroundAlpha={0.92} />

		{#if glowAlpha > 0}
			<Circle
				diameter={glowRadius * 2}
				anchor={0.5}
				backgroundColor={glowColor}
				backgroundAlpha={glowAlpha}
			/>
		{/if}

		<SymbolIcon name={panel.name} size={diameter * 1.05} />

		<Text
			y={diameter * 0.42}
			anchor={0.5}
			text={mult > 0 ? `×${mult}` : '—'}
			style={{
				fontFamily: 'Outfit, sans-serif',
				fontWeight: '800',
				fontSize: diameter * 0.16,
				fill: mult > 0 ? 0xffffff : 0x7d97ad,
			}}
		/>
	{:else}
		<Container
			eventMode={interactive ? 'static' : 'none'}
			cursor={interactive ? 'pointer' : 'default'}
			onpointerup={interactive ? onReveal : undefined}
		>
			<Circle diameter={diameter} anchor={0.5} backgroundColor={0x94a3b8} backgroundAlpha={1} />
			<Circle
				diameter={diameter * 0.85}
				anchor={0.5}
				x={-diameter * 0.12}
				y={-diameter * 0.12}
				backgroundColor={0xe2e8f0}
				backgroundAlpha={0.35}
			/>
			<Circle
				diameter={diameter}
				anchor={0.5}
				backgroundAlpha={0}
				borderColor={0x1e293b}
				borderWidth={2}
				borderAlpha={0.4}
			/>
		</Container>
	{/if}
</Container>
