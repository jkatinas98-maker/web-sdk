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
	const rowGap = 8;

	const availableHeight = $derived(Math.max(140, canvas.height - top - bottom - headerHeight - footerHeight - pad * 2));

	// The circle actually drawn can never be wider than the column slot or
	// taller than the row slot — take whichever constraint is tighter so
	// cells never overlap in either direction, then center the (possibly
	// narrower) grid inside the card.
	const diameterByWidth = $derived((gridWidth - colGap * (cols - 1)) / cols);
	const diameterByHeight = $derived((availableHeight - rowGap * (rows - 1)) / rows);
	const diameter = $derived(Math.min(diameterByWidth, diameterByHeight));

	const gridActualWidth = $derived(diameter * cols + colGap * (cols - 1));
	const gridActualHeight = $derived(diameter * rows + rowGap * (rows - 1));
	const gridOffsetX = $derived(pad + (gridWidth - gridActualWidth) / 2);

	const cardHeight = $derived(headerHeight + footerHeight + pad * 2 + gridActualHeight);

	const panels = $derived(context.stateGame.panels);
	const revealed = $derived(context.stateGame.revealed);

	const cellPositions = $derived(
		Array.from({ length: cols * rows }, (_, index) => {
			const col = index % cols;
			const row = Math.floor(index / cols);
			return {
				index,
				x: gridOffsetX + col * (diameter + colGap) + diameter / 2,
				y: headerHeight + row * (diameter + rowGap) + diameter / 2,
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
			revealed={revealed.has(cell.index)}
			interactive={interactive && !revealed.has(cell.index)}
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
