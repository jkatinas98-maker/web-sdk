<script lang="ts">
	import { onMount } from 'svelte';

	import { KRAKEN_PRIZE_TABLE, krakenPrizeRarity } from '../game/kraken';
	import { playSound } from '../game/sound';
	import type { BetMode } from '../game/types';

	// CS2-style case opening: a long strip of multiplier tiles scrolls past
	// a fixed center marker, decelerates, and settles on the prize already
	// decided by the book (`mult`). Purely presentational -- the outcome
	// never depends on where the strip stops.
	type Props = {
		betMode: BetMode;
		mult: number;
		onLanded: () => void;
	};

	const { betMode, mult, onLanded }: Props = $props();

	const TILE_W = 86;
	const GAP = 6;
	const TILE_COUNT = 50;
	const WIN_INDEX = 42;
	const SPIN_MS = 5400;

	// Filler tiles: drawn from the same table but with flattened weights so
	// the rare, exciting tiles actually scroll past (pure odds would be a
	// wall of 2x).
	const table = KRAKEN_PRIZE_TABLE[betMode];
	const fillerWeights = table.map(([m, w]) => [m, Math.sqrt(w)] as [number, number]);
	const fillerTotal = fillerWeights.reduce((s, [, w]) => s + w, 0);
	const drawFiller = () => {
		let r = Math.random() * fillerTotal;
		for (const [m, w] of fillerWeights) {
			r -= w;
			if (r <= 0) return m;
		}
		return fillerWeights[0][0];
	};

	const tiles = Array.from({ length: TILE_COUNT }, (_, i) => (i === WIN_INDEX ? mult : drawFiller()));
	// Near-miss tease: a top-tier tile right next to the winner.
	const top = table[table.length - 1][0];
	if (mult !== top) tiles[WIN_INDEX + (Math.random() < 0.5 ? -1 : 1)] = top;

	let width = $state(0);
	let offset = $state(0);
	let spinning = $state(false);
	let landed = $state(false);
	let strip: HTMLDivElement;

	// Settle somewhere inside the winning tile, not dead-center every time.
	const jitter = (Math.random() - 0.5) * TILE_W * 0.6;

	onMount(() => {
		// Wait a frame for the container width, then start the spin.
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				spinning = true;
				offset = -(WIN_INDEX * (TILE_W + GAP) + TILE_W / 2 - width / 2 + jitter);
			});
		});

		// Tick sound each time a tile edge crosses the marker.
		let lastTile = -1;
		let raf: number;
		const tick = () => {
			if (strip && width) {
				const m = new DOMMatrixReadOnly(getComputedStyle(strip).transform);
				const center = -m.m41 + width / 2;
				const tile = Math.floor(center / (TILE_W + GAP));
				if (tile !== lastTile) {
					if (lastTile >= 0) playSound('click');
					lastTile = tile;
				}
			}
			if (!landed) raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	});

	function handleEnd(e: TransitionEvent) {
		if (e.propertyName !== 'transform' || landed) return;
		landed = true;
		playSound('jackpot');
		onLanded();
	}
</script>

<div class="case-reel" bind:clientWidth={width}>
	<div
		class="case-strip"
		bind:this={strip}
		style={`transform: translateX(${offset}px); transition: ${spinning ? `transform ${SPIN_MS}ms cubic-bezier(0.08, 0.62, 0.1, 1)` : 'none'};`}
		ontransitionend={handleEnd}
	>
		{#each tiles as m, i (i)}
			<div
				class={`case-tile case-tile--${krakenPrizeRarity(betMode, m)}`}
				class:won={landed && i === WIN_INDEX}
				style={`width:${TILE_W}px;`}
			>
				<span class="case-tile-mult">×{m}</span>
			</div>
		{/each}
	</div>
	<div class="case-marker" aria-hidden="true"></div>
	<div class="case-fade case-fade--left" aria-hidden="true"></div>
	<div class="case-fade case-fade--right" aria-hidden="true"></div>
</div>
