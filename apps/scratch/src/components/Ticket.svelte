<script lang="ts">
	import * as PIXI from 'pixi.js';
	import { Container, Circle, Graphics } from 'pixi-svelte';
	import { getContext } from '../game/context';
	import Cell from './Cell.svelte';
	import config from '../game/config';
	import type { BetMode, SymbolName } from '../game/types';

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
		// The symbol id that won this round (null before resolution / on a
		// loss) — cells matching it get the green pulsing "winning" treatment.
		winningSymbol?: SymbolName | null;
		onRevealIndex: (index: number) => void;
	};

	const {
		betMode,
		top,
		bottom,
		left = 0,
		right = 0,
		interactive,
		winningSymbol = null,
		onRevealIndex,
	}: Props = $props();

	const context = getContext();

	const cols = $derived(config.betModes[betMode].cols);
	const rows = $derived(config.betModes[betMode].rows);

	const canvas = $derived(context.stateLayoutDerived.canvasSizes());
	const availableWidth = $derived(canvas.width - left - right);
	const cardWidth = $derived(Math.min(availableWidth - 32, 340));
	const cardX = $derived(left + (availableWidth - cardWidth) / 2);
	const pad = 10;

	const gridWidth = $derived(cardWidth - pad * 2);
	const gap = 8;

	const availableHeight = $derived(Math.max(140, canvas.height - top - bottom - pad * 2));

	// The tile actually drawn can never be wider than the column slot or
	// taller than the row slot — take whichever constraint is tighter so
	// tiles never overlap in either direction, then center the (possibly
	// narrower) grid inside the card.
	const sizeByWidth = $derived((gridWidth - gap * (cols - 1)) / cols);
	const sizeByHeight = $derived((availableHeight - gap * (rows - 1)) / rows);
	const tileSize = $derived(Math.min(sizeByWidth, sizeByHeight));

	const gridActualWidth = $derived(tileSize * cols + gap * (cols - 1));
	const gridActualHeight = $derived(tileSize * rows + gap * (rows - 1));
	const gridOffsetX = $derived(pad + (gridWidth - gridActualWidth) / 2);

	const cardHeight = $derived(pad * 2 + gridActualHeight);

	// Dark glass board frame with a glowing purple border — matches the
	// reference's .board-frame treatment instead of a bright gradient fill.
	const drawCardBackground = (graphics: PIXI.Graphics, width: number, height: number) => {
		graphics.roundRect(0, 0, width, height, 18);
		graphics.fill({ color: 0x0a0d14, alpha: 0.88 });
		graphics.stroke({ color: 0x8b5cf6, width: 2, alpha: 0.8 });
	};

	const panels = $derived(context.stateGame.panels);
	const revealed = $derived(context.stateGame.revealed);

	const cellPositions = $derived(
		Array.from({ length: cols * rows }, (_, index) => {
			const col = index % cols;
			const row = Math.floor(index / cols);
			return {
				index,
				x: gridOffsetX + col * (tileSize + gap) + tileSize / 2,
				y: pad + row * (tileSize + gap) + tileSize / 2,
			};
		}),
	);
</script>

<Container x={cardX} y={top}>
	<!-- Soft ambient glow blob behind/around the card (layered low-alpha
	     circles fake a blur without a filter dependency), echoing the
	     reference's .glow-bg radial gradient. -->
	<Circle
		diameter={cardWidth * 1.2}
		anchor={0.5}
		x={cardWidth / 2}
		y={cardHeight * 0.25}
		backgroundColor={0x8b5cf6}
		backgroundAlpha={0.1}
	/>
	<Circle
		diameter={cardWidth * 0.8}
		anchor={0.5}
		x={cardWidth / 2}
		y={cardHeight * 0.25}
		backgroundColor={0x06b6d4}
		backgroundAlpha={0.08}
	/>

	<Graphics draw={(graphics) => drawCardBackground(graphics, cardWidth, cardHeight)} />

	{#each cellPositions as cell (cell.index)}
		<Cell
			x={cell.x}
			y={cell.y}
			size={tileSize}
			panel={panels[cell.index]}
			revealed={revealed.has(cell.index)}
			winning={revealed.has(cell.index) && panels[cell.index]?.name === winningSymbol}
			interactive={interactive && !revealed.has(cell.index)}
			onReveal={() => onRevealIndex(cell.index)}
		/>
	{/each}
</Container>
