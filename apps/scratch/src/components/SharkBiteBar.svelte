<script lang="ts">
	import barUrl from '../assets/shark_bite_bar.webp';
	import octopusUrl from '../assets/symbols/octopus.png';
	import pirateUrl from '../assets/symbols/pirate.png';
	import { SYMBOL_IMAGE_URL } from '../game/assets';
	import { playSound, stopSound } from '../game/sound';
	import type { SharkOutcome } from '../game/typesBookEvent';

	// The "Shark Bite" bar under the difficulty tabs. Idle, its five glass
	// windows show the five possible outcomes. When a shark lands on the
	// card, a strip of outcome icons rolls through the tube (CS2-reel style)
	// and settles on the book's outcome in the center window.
	type Props = {
		width: number;
		// Bumped by the parent to start a roll; `outcome` is where it lands.
		rollId: number;
		outcome: SharkOutcome | null;
		onLanded: (outcome: SharkOutcome) => void;
	};

	const { width, rollId, outcome, onLanded }: Props = $props();

	// Bar art geometry, in its source pixels (1983x793; the export is
	// smaller but the same proportions). y0..y1 is the painted part
	// (rest is transparent padding, cropped off by the container).
	const BAR = { w: 1983, h: 793, y0: 80, y1: 745 };
	const TUBE = { x0: 318, x1: 1668, y0: 450, y1: 650 };
	const WINDOW_CENTERS = [455, 737, 990, 1245, 1526];
	const DIVIDERS = [614, 860, 1120, 1368];
	const CENTER_X = 990;
	const PITCH = 254;
	const ICON = 178;

	const TILE_COUNT = 40;
	const WIN_INDEX = 34;
	const SPIN_MS = 4200;

	const ICON_URL: Record<SharkOutcome, string> = {
		kraken: SYMBOL_IMAGE_URL.kraken,
		octopus: octopusUrl,
		pirate: pirateUrl,
		key: SYMBOL_IMAGE_URL.key,
		bonus: SYMBOL_IMAGE_URL.bonus,
	};
	const ORDER: SharkOutcome[] = ['kraken', 'octopus', 'pirate', 'key', 'bonus'];
	// (The landed label is shown by Game.svelte, above the frame's crest.)

	const k = $derived(width / BAR.w);
	const tubeW = TUBE.x1 - TUBE.x0;
	const centerInTube = CENTER_X - TUBE.x0;

	let tiles: SharkOutcome[] = $state([]);
	let spinning = $state(false);
	let landed = $state(false);
	let offset = $state(0); // strip x in source px, relative to the tube
	let strip: HTMLDivElement | undefined = $state();
	let raf = 0;

	const offsetFor = (index: number, jitter = 0) => centerInTube - (index * PITCH + PITCH / 2) + jitter;

	const rolling = $derived(outcome !== null && tiles.length > 0);

	// Start a roll whenever rollId changes with an outcome to land on.
	let lastRollId = 0;
	$effect(() => {
		const id = rollId;
		const target = outcome;
		if (!target || id === lastRollId) {
			if (!target) {
				tiles = [];
				spinning = false;
				landed = false;
			}
			return;
		}
		lastRollId = id;
		startRoll(target);
	});

	function startRoll(target: SharkOutcome) {
		cancelAnimationFrame(raf);
		const others = ORDER.filter((o) => o !== target);
		const next: SharkOutcome[] = Array.from({ length: TILE_COUNT }, () => ORDER[Math.floor(Math.random() * ORDER.length)]);
		next[WIN_INDEX] = target;
		// Tease: something different on both sides of the winner.
		next[WIN_INDEX - 1] = others[Math.floor(Math.random() * others.length)];
		next[WIN_INDEX + 1] = others[Math.floor(Math.random() * others.length)];
		tiles = next;
		landed = false;
		spinning = false;
		offset = offsetFor(2);
		const jitter = 0; // land dead-center in the window
		requestAnimationFrame(() =>
			requestAnimationFrame(() => {
				spinning = true;
				playSound('wheelSpin', 0.93); // ~4.2s, matches SPIN_MS
				offset = offsetFor(WIN_INDEX, jitter);
				watchTicks();
			}),
		);
	}

	// Click each time a tile crosses the center window.
	function watchTicks() {
		let lastTile = -1;
		const tick = () => {
			if (strip && k > 0) {
				const m = new DOMMatrixReadOnly(getComputedStyle(strip).transform);
				const x = (centerInTube - m.m41 / k) / PITCH;
				const tile = Math.floor(x);
				if (tile !== lastTile) {
					// (ticks now come from the ship's-wheel sound)
					lastTile = tile;
				}
			}
			if (!landed && spinning) raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
	}

	function handleEnd(e: TransitionEvent) {
		if (e.propertyName !== 'transform' || landed || !outcome) return;
		landed = true;
		cancelAnimationFrame(raf);
		stopSound('wheelSpin');
		playSound('woodThunk');
		const landed_ = outcome;
		setTimeout(() => playSound('scatterLand'), 60);
		setTimeout(() => playSound(landed_ === 'pirate' ? 'pirateArr' : 'jackpot'), 350);
		onLanded(outcome);
	}

	$effect(() => () => cancelAnimationFrame(raf));

	const px = (v: number) => `${v * k}px`;
</script>

<div
	class="shark-bar"
	class:rolling
	class:landed
	style={`width:${width}px;height:${(BAR.y1 - BAR.y0) * k}px;`}
>
	<img class="shark-bar-img" src={barUrl} alt="Shark Bite" draggable="false" style={`top:${px(-BAR.y0)};width:${width}px;`} />

	<div
		class="shark-tube"
		style={`left:${px(TUBE.x0)};top:${px(TUBE.y0 - BAR.y0)};width:${px(tubeW)};height:${px(TUBE.y1 - TUBE.y0)};`}
	>
		{#if rolling}
			<div
				class="shark-strip"
				bind:this={strip}
				style={`transform:translateX(${px(offset)});transition:${spinning ? `transform ${SPIN_MS}ms cubic-bezier(0.1, 0.6, 0.12, 1)` : 'none'};`}
				ontransitionend={handleEnd}
			>
				{#each tiles as t, i (i)}
					<div class="shark-tile" class:won={landed && i === WIN_INDEX} style={`width:${px(PITCH)};`}>
						<img src={ICON_URL[t]} alt="" draggable="false" style={`width:${px(ICON)};height:${px(ICON)};`} />
					</div>
				{/each}
			</div>
		{:else}
			{#each ORDER as o, i (o)}
				<img
					class="shark-idle-icon"
					src={ICON_URL[o]}
					alt={o}
					draggable="false"
					style={`left:${px(WINDOW_CENTERS[i] - TUBE.x0 - ICON / 2)};top:${px((TUBE.y1 - TUBE.y0 - ICON) / 2)};width:${px(ICON)};height:${px(ICON)};animation-delay:${i * -0.6}s;`}
				/>
			{/each}
		{/if}
		{#each DIVIDERS as d (d)}
			<div class="shark-divider" style={`left:${px(d - TUBE.x0 - 8)};width:${px(16)};`}></div>
		{/each}
		<div class="shark-center-mark" style={`left:${px(centerInTube - PITCH / 2)};width:${px(PITCH)};`}></div>
	</div>
</div>
