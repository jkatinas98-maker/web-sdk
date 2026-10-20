<script lang="ts">
	import { Container, Circle, Text } from 'pixi-svelte';

	import SymbolIcon from './SymbolIcon.svelte';
	import config from '../game/config';
	import type { SymbolName } from '../game/types';

	type Props = {
		x: number;
		y: number;
	};

	const { x, y }: Props = $props();

	// Every symbol that actually pays (skull excluded), smallest multiplier
	// first — shown as a horizontal strip above the ticket so the player
	// knows what they're scratching for before they commit a bet. (Desktop's
	// side-panel paytable is a plain DOM list instead — it sits behind an
	// opaque glass panel, where a pixi-rendered strip would be invisible.)
	const entries = Object.entries(config.symbols)
		.filter(([, sym]) => sym.mult > 0)
		.sort((a, b) => a[1].mult - b[1].mult) as [SymbolName, { mult: number }][];

	const itemWidth = 46;
</script>

<Container {x} {y}>
	{#each entries as [name, sym], i (name)}
		<Container x={(i - (entries.length - 1) / 2) * itemWidth}>
			<Circle diameter={34} anchor={0.5} backgroundColor={0x1e1b4b} backgroundAlpha={0.55} />
			<Container y={-4}>
				<SymbolIcon {name} size={28} />
			</Container>
			<Text
				y={17}
				anchor={0.5}
				text={`×${sym.mult}`}
				style={{
					fontFamily: 'Outfit, sans-serif',
					fontWeight: '700',
					fontSize: 9,
					fill: 0xcbd5f5,
				}}
			/>
		</Container>
	{/each}
</Container>
