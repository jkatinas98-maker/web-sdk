<script lang="ts">
	import { Container, Rectangle, Text } from 'pixi-svelte';
	import { getContext } from '../game/context';
	import Cell from './Cell.svelte';
	import config from '../game/config';
	import type { BetMode } from '../game/types';

	type Props = {
		betMode: BetMode;
		top: number;
		bottom: number;
		interactive: boolean;
		onRevealIndex: (index: number) => void;
	};

	const { betMode, top, bottom, interactive, onRevealIndex }: Props = $props();

	const context = getContext();

	const cols = $derived(config.betModes[betMode].cols);
	const rows = $derived(config.betModes[betMode].rows);

	const canvas = $derived(context.stateLayoutDerived.canvasSizes());
	const cardWidth = $derived(Math.min(canvas.width - 32, 320));
	const cardX = $derived((canvas.width - cardWidth) / 2);
	const headerHeight = 46;
	const footerHeight = 24;
	const pad = 14;

	const gridWidth = $derived(cardWidth - pad * 2);
	const colGap = 8;
	const diameter = $derived((gridWidth - colGap * (cols - 1)) / cols);

	const availableHeight = $derived(Math.max(140, canvas.height - top - bottom - headerHeight - footerHeight - pad * 2));
	const rowPitch = $derived(Math.min(diameter * 1.12, availableHeight / rows));
	const gridHeight = $derived(rowPitch * rows);
	const cardHeight = $derived(headerHeight + footerHeight + pad * 2 + gridHeight);

	const panels = $derived(context.stateGame.panels);
	const revealedCount = $derived(context.stateGame.revealedCount);

	const cellPositions = $derived(
		Array.from({ length: cols * rows }, (_, index) => {
			const col = index % cols;
			const row = Math.floor(index / cols);
			return {
				index,
				x: pad + col * (diameter + colGap) + diameter / 2,
				y: headerHeight + row * rowPitch + rowPitch / 2,
			};
		}),
	);
</script>

<Container x={cardX} y={top}>
	<!-- Ticket card background: solid indigo stand-in for the
	     gem-scratch.html purple/blue gradient (PIXI.FillGradient's exact v8.8
	     API isn't confirmed from this sandbox, so this stays solid until a
	     gradient pass can be build-verified). -->
	<Rectangle width={cardWidth} height={cardHeight} borderRadius={18} backgroundColor={0x4f46e5} />

	<Text
		x={pad}
		y={pad}
		text="Stake"
		style={{ fontFamily: 'Outfit, sans-serif', fontWeight: '800', fontSize: 20, fill: 0xffffff }}
	/>

	{#each cellPositions as cell (cell.index)}
		<Cell
			x={cell.x}
			y={cell.y}
			{diameter}
			panel={panels[cell.index]}
			revealed={cell.index < revealedCount}
			interactive={interactive && cell.index >= revealedCount}
			onReveal={() => onRevealIndex(cell.index)}
		/>
	{/each}

	<Text
		x={cardWidth / 2}
		y={cardHeight - footerHeight / 2}
		anchor={0.5}
		text="SCRATCH & WIN"
		style={{
			fontFamily: 'Outfit, sans-serif',
			fontWeight: '700',
			fontSize: 9,
			letterSpacing: 2,
			fill: 0xe0e7ff,
		}}
	/>
</Container>
