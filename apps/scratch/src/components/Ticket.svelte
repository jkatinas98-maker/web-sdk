<script lang="ts">
	import { buildWinSchedule } from '../game/winTiming';
	import type * as PIXI from 'pixi.js';
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
		// Illustrated frame mode: the DOM frame art supplies the border, so
		// skip the drawn wood card/glows, fill the frame's window with a dark
		// backing, and center the grid inside it (no 400px width cap).
		frameless?: boolean;
		// The symbol id that won this round (null before resolution / on a
		// loss) — cells matching it get the green pulsing "winning" treatment.
		winningSymbols?: SymbolName[];
		onRevealIndex: (index: number) => void;
	};

	const {
		betMode,
		top,
		bottom,
		left = 0,
		right = 0,
		interactive,
		frameless = false,
		winningSymbols = [],
		onRevealIndex,
	}: Props = $props();

	const context = getContext();

	// cols/rows are the real simulation grid (cols fixed at 3, rows 3-5 by
	// difficulty per game_config.py) — win logic only counts symbol
	// occurrences, it never cares about on-screen position, so it's safe to
	// lay cells out in whichever visual shape looks best. A bigger grid
	// (more cells) should get WIDER, not taller — displayCols/displayRows
	// just swap whichever of cols/rows is larger into the horizontal axis,
	// so "easy" (3x5 = 15 cells) renders as 5 wide x 3 tall instead of 3
	// wide x 5 tall.
	const cols = $derived(config.betModes[betMode].cols);
	const rows = $derived(config.betModes[betMode].rows);
	const displayCols = $derived(Math.max(cols, rows));
	const displayRows = $derived(Math.min(cols, rows));

	// This difficulty's own top-paying symbol — landing it gets a gold
	// glow+blink the instant it's revealed, regardless of whether it ends
	// up part of a win (anticipation, like a real scratcher's jackpot icon).
	const jackpotSymbol = $derived(
		(config.betModes[betMode].symbols as SymbolName[]).reduce((best, name) =>
			config.symbols[name].mult > config.symbols[best].mult ? name : best,
		),
	);

	const canvas = $derived(context.stateLayoutDerived.canvasSizes());
	const availableWidth = $derived(canvas.width - left - right);
	const cardWidth = $derived(frameless ? availableWidth - 8 : Math.min(availableWidth - 24, 400));
	const cardX = $derived(left + (availableWidth - cardWidth) / 2);
	const pad = 12;

	const gridWidth = $derived(cardWidth - pad * 2);
	const gap = 8;

	const availableHeight = $derived(Math.max(140, canvas.height - top - bottom - pad * 2));

	// The tile actually drawn can never be wider than the column slot or
	// taller than the row slot — take whichever constraint is tighter so
	// tiles never overlap in either direction, then center the (possibly
	// narrower) grid inside the card.
	const sizeByWidth = $derived((gridWidth - gap * (displayCols - 1)) / displayCols);
	const sizeByHeight = $derived((availableHeight - gap * (displayRows - 1)) / displayRows);
	const tileSize = $derived(Math.min(sizeByWidth, sizeByHeight));

	const gridActualWidth = $derived(tileSize * displayCols + gap * (displayCols - 1));
	const gridActualHeight = $derived(tileSize * displayRows + gap * (displayRows - 1));
	const gridOffsetX = $derived(pad + (gridWidth - gridActualWidth) / 2);

	const cardHeight = $derived(pad * 2 + gridActualHeight);
	const windowHeight = $derived(canvas.height - top - bottom);
	const cardY = $derived(frameless ? top + Math.max(0, (windowHeight - cardHeight) / 2) : top);

	// Dark sea-wood backing for the frame's (transparent) window so the
	// tiles don't float over the background painting.
	const drawWindowBacking = (graphics: PIXI.Graphics, width: number, height: number) => {
		graphics.rect(0, 0, width, height);
		graphics.fill({ color: 0x0c0905, alpha: 0.86 });
	};

	// Carved wooden frame: dark plank fill, near-black outer edge, an inset
	// brass trim line, a lighter plank edge inside that, and brass rivets in
	// each corner.
	const drawCardBackground = (graphics: PIXI.Graphics, width: number, height: number) => {
		graphics.roundRect(-6, -6, width + 12, height + 12, 22);
		graphics.fill({ color: 0x2a1a0e, alpha: 0.97 });
		graphics.stroke({ color: 0x1a0f07, width: 4 });

		graphics.roundRect(-2, -2, width + 4, height + 4, 19);
		graphics.stroke({ color: 0xc9a227, width: 2, alpha: 0.85 });

		graphics.roundRect(3, 3, width - 6, height - 6, 15);
		graphics.fill({ color: 0x1a110a, alpha: 0.85 });
		graphics.stroke({ color: 0x7a4f2d, width: 1.5, alpha: 0.9 });

		const rivet = (cx: number, cy: number) => {
			graphics.circle(cx, cy, 5);
			graphics.fill({ color: 0xc9a227 });
			graphics.stroke({ color: 0x5c4310, width: 1.5 });
			graphics.circle(cx - 1.4, cy - 1.4, 1.8);
			graphics.fill({ color: 0xf6e2a0, alpha: 0.9 });
		};
		rivet(4, 4);
		rivet(width - 4, 4);
		rivet(4, height - 4);
		rivet(width - 4, height - 4);
	};

	const panels = $derived(context.stateGame.panels);
	const revealed = $derived(context.stateGame.revealed);

	// Per-tile win animation info (which match/extra it is and when it
	// plays) for every winning symbol, played one after another.
	const winCells = $derived(buildWinSchedule(panels, winningSymbols, betMode).cells);

	const cellPositions = $derived(
		Array.from({ length: cols * rows }, (_, index) => {
			const col = index % displayCols;
			const row = Math.floor(index / displayCols);
			return {
				index,
				x: gridOffsetX + col * (tileSize + gap) + tileSize / 2,
				y: pad + row * (tileSize + gap) + tileSize / 2,
			};
		}),
	);
</script>

{#if frameless}
	<Container x={left} y={top}>
		<Graphics draw={(graphics) => drawWindowBacking(graphics, availableWidth, windowHeight)} />
	</Container>
{/if}

<Container x={cardX} y={cardY}>
	{#if !frameless}
	<!-- Soft ambient glow blob behind/around the card (layered low-alpha
	     circles fake a blur without a filter dependency), echoing the
	     reference's .glow-bg radial gradient. -->
	<Circle
		diameter={cardWidth * 1.2}
		anchor={0.5}
		x={cardWidth / 2}
		y={cardHeight * 0.25}
		backgroundColor={0xe8a33d}
		backgroundAlpha={0.1}
	/>
	<Circle
		diameter={cardWidth * 0.8}
		anchor={0.5}
		x={cardWidth / 2}
		y={cardHeight * 0.25}
		backgroundColor={0x0e7490}
		backgroundAlpha={0.12}
	/>

	<Graphics draw={(graphics) => drawCardBackground(graphics, cardWidth, cardHeight)} />
	{/if}

	{#each cellPositions as cell (cell.index)}
		<Cell
			x={cell.x}
			y={cell.y}
			size={tileSize}
			panel={panels[cell.index]}
			revealed={revealed.has(cell.index)}
			winning={revealed.has(cell.index) && !!panels[cell.index] && winningSymbols.includes(panels[cell.index]!.name)}
			jackpot={revealed.has(cell.index) && panels[cell.index]?.name === jackpotSymbol}
			interactive={interactive && !revealed.has(cell.index)}
			win={winCells.get(cell.index)}
			onReveal={() => onRevealIndex(cell.index)}
		/>
	{/each}
</Container>
