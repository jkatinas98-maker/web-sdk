<script lang="ts">
	import sceneUrl from '../assets/chest_scene.webp';
	import closedBlue from '../assets/chests/closed_blue.webp';
	import closedRed from '../assets/chests/closed_red.webp';
	import closedGreen from '../assets/chests/closed_green.webp';
	import openBlue from '../assets/chests/open_blue.webp';
	import openRed from '../assets/chests/open_red.webp';
	import openGreen from '../assets/chests/open_green.webp';
	import plaqueBlue from '../assets/chests/ui/plaque_blue.webp';
	import plaqueRed from '../assets/chests/ui/plaque_red.webp';
	import plaqueGreen from '../assets/chests/ui/plaque_green.webp';
	import treasureFoundUrl from '../assets/chests/ui/treasure_found.webp';
	import { playSound } from '../game/sound';
	import Sparkles from './Sparkles.svelte';

	// Key feature: full-screen ship deck, three chests. The player picks
	// one; it bursts open with the prize the book decided (`win`), then the
	// other two open, dimmed, showing what was missed. Tap to continue.
	type Props = {
		win: number; // dollars
		missed: [number, number]; // dollars
		betAmount: number;
		onDone: () => void;
	};

	const { win, missed, betAmount, onDone }: Props = $props();

	const CHESTS = [
		{ closed: closedBlue, open: openBlue, plaque: plaqueBlue, color: 'blue' },
		{ closed: closedRed, open: openRed, plaque: plaqueRed, color: 'red' },
		{ closed: closedGreen, open: openGreen, plaque: plaqueGreen, color: 'green' },
	];

	type Stage = 'pick' | 'opening' | 'revealOthers' | 'done';
	let stage: Stage = $state('pick');
	let picked = $state(-1);
	let prizes: number[] = $state([0, 0, 0]);
	let opened: boolean[] = $state([false, false, false]);

	const timers: ReturnType<typeof setTimeout>[] = [];
	$effect(() => () => timers.forEach(clearTimeout));

	function pick(i: number) {
		if (stage !== 'pick') return;
		picked = i;
		const others = [0, 1, 2].filter((j) => j !== i);
		const next = [0, 0, 0];
		next[i] = win;
		next[others[0]] = missed[0];
		next[others[1]] = missed[1];
		prizes = next;
		stage = 'opening';
		playSound('woodCrack');
		// Shake, then burst open.
		timers.push(
			setTimeout(() => {
				opened = opened.map((o, j) => o || j === i);
				playSound('chestOpen');
			}, 650),
			setTimeout(() => {
				stage = 'revealOthers';
				opened = [true, true, true];
				playSound('oldChestOpen');
			}, 2100),
			setTimeout(() => (stage = 'done'), 2700),
		);
	}

	function handleBackdrop() {
		if (stage === 'done') {
			playSound('click');
			onDone();
		}
	}

	const fmt = (v: number) => '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	// Amount font shrinks for long numbers so it stays on the cloth.
	const fit = (t: string) => `font-size:${(17 * Math.min(1, 6 / t.length)).toFixed(2)}cqw;`;
	const mult = (v: number) => (betAmount > 0 ? `×${+(v / betAmount).toFixed(2)}` : '');
</script>

<div
	class="chest-pick"
	style={`--chest-scene:url(${sceneUrl});`}
	role="button"
	tabindex="0"
	onclick={handleBackdrop}
	onkeydown={(e) => e.key === 'Enter' && handleBackdrop()}
>
	<div class="chest-pick-head">
		{#if stage === 'done' || stage === 'revealOthers'}
			<img class="chest-pick-banner" src={treasureFoundUrl} alt="Treasure found!" draggable="false" />
			<Sparkles count={16} coins={14} spread={55} loop={false} />
		{:else}
			<div class="chest-pick-title feature-modal-title">{stage === 'pick' ? 'Pick a chest!' : 'Opening...'}</div>
		{/if}
	</div>

	<div class="chest-pick-row">
		{#each CHESTS as chest, i (chest.color)}
			<button
				class={`chest-pick-chest chest-pick-chest--${chest.color}`}
				class:picked={picked === i}
				class:missed={picked !== -1 && picked !== i}
				class:shaking={stage === 'opening' && picked === i && !opened[i]}
				class:open={opened[i]}
				disabled={stage !== 'pick'}
				style={`animation-delay:${i * -0.7}s;`}
				aria-label={`Chest ${i + 1}`}
				onclick={(e) => {
					e.stopPropagation();
					pick(i);
				}}
			>
				<span class="chest-pick-glow"></span>
				<img src={opened[i] ? chest.open : chest.closed} alt="" draggable="false" />
				{#if opened[i]}
					<span class={`chest-pick-plaque chest-pick-plaque--${chest.color}`} class:win={picked === i}>
						<img src={chest.plaque} alt="" draggable="false" />
						{#if picked === i}<Sparkles count={8} coins={10} spread={50} />{/if}
						<span class="chest-pick-plaque-text">
							<span class="chest-pick-prize-amt" style={fit(fmt(prizes[i]))}>{fmt(prizes[i])}</span>
							<span class="chest-pick-prize-mult">{mult(prizes[i])}</span>
						</span>
					</span>
					{#if picked === i}
						<span class="chest-pick-burst"></span>
					{/if}
				{/if}
			</button>
		{/each}
	</div>

	<div class="kraken-card-hint chest-pick-hint">
		{#if stage === 'pick'}
			Choose one — the others reveal what you missed
		{:else if stage === 'done'}
			You won {fmt(win)} · tap to continue
		{:else}
			&nbsp;
		{/if}
	</div>
</div>
