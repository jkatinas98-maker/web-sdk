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
		// Desktop layout reserves fixed side panels (controls / paytable)
		// either side of the canvas — 0 on mobile, where everything is
		// stacked instead. The card centers itself in whatever width is left.
		left?: number;
		right?: number;
		interactive: boolean;
		onRevealIndex: (index: number) => void;
	};

	const { betMode, top, bottom, left = 0, right = 0, interactive, onRevealIndex }: Props = $props();

	const context = getContext();

	const cols = $derived(config.betModes[betMode].cols);
	const rows = $derived(config.betModes[betMode].rows);

	const canvas = $derived(context.stateLayoutDerived.canvasSizes());
	const availableWidth = $derived(canvas.width - left - right);
	const cardWidth = $derived(Math.min(availableWidth - 32, 340));
	const cardX = $derived(left + (availableWidth - cardWidth) / 2);
	// Small internal top margin only — the card no longer carries its own
	// logo text, that moved to the external header bar in Game.svelte.
	const headerHeight = 18;
	const footerHeight = 22;
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

	// Neon cyan -> purple -> pink top-to-bottom gradient card background.
	// Wrapped defensively: if PIXI's FillGradient API ever throws for some
	// reason, it falls back to a flat purple fill instead of blanking the
	// card.
	const drawCardBackground = (graphics: PIXI.Graphics, width: number, height: number) => {
		graphics.roundRect(0, 0, width, height, 18);
		try {
			const gradient = new PIXI.FillGradient(0, 0, 0, 1);
			gradient.addColorStop(0, 0x06b6d4); // cyan, top
			gradient.addColorStop(0.55, 0x8b5cf6); // purple, mid
			gradient.addColorStop(1, 0xec4899); // pink, bottom
			graphics.fill(gradient);
		} catch (error) {
			console.error('Ticket gradient fill failed, using flat fallback:', error);
			graphics.fill({ color: 0x8b5cf6, alpha: 1 });
		}
		graphics.stroke({ color: 0x0a0c10, width: 2, alpha: 0.5 });
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
			fill: 0xf5f3ff,
		}}
	/>
</Container>
