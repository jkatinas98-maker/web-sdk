<script lang="ts">
	import sceneUrl from '../assets/chest_scene.webp';
	import closedBlue from '../assets/chests/closed_blue.webp';
	import closedRed from '../assets/chests/closed_red.webp';
	import closedGreen from '../assets/chests/closed_green.webp';
	import openBlue from '../assets/chests/open_blue.webp';
	import openRed from '../assets/chests/open_red.webp';
	import openGreen from '../assets/chests/open_green.webp';
	import { playSound } from '../game/sound';

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
		{ closed: closedBlue, open: openBlue, color: 'blue' },
		{ closed: closedRed, open: openRed, color: 'red' },
		{ closed: closedGreen, open: openGreen, color: 'green' },
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
		playSound('click');
		// Shake, then burst open.
		timers.push(
			setTimeout(() => {
				opened = opened.map((o, j) => o || j === i);
				playSound('chestOpen');
			}, 650),
			setTimeout(() => {
				stage = 'revealOthers';
				opened = [true, true, true];
				playSound('woodThunk');
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

	const fmt = (v: number) => `$${v.toFixed(2)}`;
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
	<div class="chest-pick-title feature-modal-title">
		{stage === 'pick' ? 'Pick a chest!' : stage === 'done' || stage === 'revealOthers' ? 'Treasure found!' : 'Opening...'}
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
					<span class="chest-pick-prize" class:win={picked === i}>
						<span class="chest-pick-prize-amt">{fmt(prizes[i])}</span>
						<span class="chest-pick-prize-mult">{mult(prizes[i])}</span>
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
