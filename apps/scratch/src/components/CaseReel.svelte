<script lang="ts">
	import { onMount } from 'svelte';

	import reelFrameUrl from '../assets/reel_frame.webp';
	import { KRAKEN_PRIZE_TABLE, krakenPrizeRarity, krakenPrizeSymbol } from '../game/kraken';
	import { SYMBOL_IMAGE_URL } from '../game/assets';
	import { playSound } from '../game/sound';
	import type { BetMode } from '../game/types';

	// CS2-style case opening inside the illustrated 5-window reel frame: a
	// long strip of multiplier tiles scrolls behind the frame, decelerates,
	// and settles with the prize (decided by the book, `mult`) in the
	// highlighted center window. Purely presentational.
	type Props = {
		betMode: BetMode;
		mult: number;
		onLanded: () => void;
	};

	const { betMode, mult, onLanded }: Props = $props();

	// Reel-frame geometry in its source pixels (1782x321): window pitch,
	// tile size/offset fitting the windows, and the center window's x.
	const FRAME_W = 1782;
	const FRAME_H = 321;
	const PITCH = 296;
	const TILE_W = 236;
	const TILE_H = 166;
	const TILE_Y = 64;
	const CENTER_X = 893;

	const TILE_COUNT = 50;
	const WIN_INDEX = 42;
	const SPIN_MS = 5600;

	// Filler tiles from the same table with flattened weights, so the rare
	// exciting tiles actually scroll past (pure odds = a wall of 2x).
	const table = KRAKEN_PRIZE_TABLE[betMode];
	const filler = table.map(([m, w]) => [m, Math.sqrt(w)] as [number, number]);
	const fillerTotal = filler.reduce((s, [, w]) => s + w, 0);
	const drawFiller = () => {
		let r = Math.random() * fillerTotal;
		for (const [m, w] of filler) {
			r -= w;
			if (r <= 0) return m;
		}
		return filler[0][0];
	};
	const tiles = Array.from({ length: TILE_COUNT }, (_, i) => (i === WIN_INDEX ? mult : drawFiller()));
	// Near-miss tease: the top prize right next to the winner.
	const top = table[table.length - 1][0];
	if (mult !== top) tiles[WIN_INDEX + (Math.random() < 0.5 ? -1 : 1)] = top;

	let width = $state(0);
	const k = $derived(width / FRAME_W);
	let progress = $state(0); // 0 -> 1 strip travel, driven by CSS transition
	let spinning = $state(false);
	let landed = $state(false);
	let strip: HTMLDivElement;

	// Settle somewhere inside the winning tile, not dead-center every time.
	const jitter = (Math.random() - 0.5) * 0.55;

	// Strip x offset (frame px) that puts tile i's center under the center
	// window, plus the jitter.
	const finalOffset = -(WIN_INDEX * PITCH + TILE_W / 2 - CENTER_X + jitter * TILE_W);
	const startOffset = CENTER_X - TILE_W / 2 - PITCH * 2;

	onMount(() => {
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				spinning = true;
				progress = 1;
			});
		});

		// Tick sound each time a tile crosses the center window.
		let lastTile = -1;
		let raf: number;
		const tick = () => {
			if (strip && k > 0) {
				const m = new DOMMatrixReadOnly(getComputedStyle(strip).transform);
				const centerFramePx = (-m.m41) / k + CENTER_X;
				const tile = Math.floor(centerFramePx / PITCH);
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

	const offsetPx = $derived((progress ? finalOffset : startOffset) * k);
</script>

<div class="case-reel" bind:clientWidth={width} style={`height:${FRAME_H * k}px;`}>
	<div
		class="case-strip"
		bind:this={strip}
		style={`top:${TILE_Y * k}px; gap:${(PITCH - TILE_W) * k}px; transform: translateX(${offsetPx}px); transition: ${spinning ? `transform ${SPIN_MS}ms cubic-bezier(0.08, 0.62, 0.1, 1)` : 'none'};`}
		ontransitionend={handleEnd}
	>
		{#each tiles as m, i (i)}
			<div
				class={`case-tile case-tile--${krakenPrizeRarity(betMode, m)}`}
				class:won={landed && i === WIN_INDEX}
				style={`width:${TILE_W * k}px; height:${TILE_H * k}px; font-size:${TILE_H * k * 0.22}px;`}
			>
				<img class="case-tile-icon" src={SYMBOL_IMAGE_URL[krakenPrizeSymbol(betMode, m)]} alt="" draggable="false" />
				<span class="case-tile-mult">×{m}</span>
			</div>
		{/each}
	</div>
	<img class="case-frame" src={reelFrameUrl} alt="" draggable="false" />
</div>
