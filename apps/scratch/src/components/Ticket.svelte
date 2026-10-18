<script lang="ts">
	import * as PIXI from 'pixi.js';
	import { Container, Graphics, Text } from 'pixi-svelte';
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

	// Blue -> purple top-to-bottom gradient card background. PIXI v8's
	// FillGradient wasn't build-verified in an earlier pass, so this is
	// wrapped defensively: if the API shape is off for some reason, it falls
	// back to a flat indigo fill instead of throwing and blanking the card.
	const drawCardBackground = (graphics: PIXI.Graphics, width: number, height: number) => {
		graphics.roundRect(0, 0, width, height, 18);
		try {
			const gradient = new PIXI.FillGradient(0, 0, 0, 1);
			gradient.addColorStop(0, 0x3b82f6); // blue, top
			gradient.addColorStop(1, 0x7c3aed); // purple, bottom
			graphics.fill(gradient);
		} catch (error) {
			console.error('Ticket gradient fill failed, using flat fallback:', error);
			graphics.fill({ color: 0x4f46e5, alpha: 1 });
		}
	};

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
	<Graphics draw={(graphics) => drawCardBackground(graphics, cardWidth, cardHeight)} />

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
