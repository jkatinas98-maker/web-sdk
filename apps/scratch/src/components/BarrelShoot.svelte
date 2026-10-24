<script lang="ts">
	import dockUrl from '../assets/barrels/dock.webp';
	import barrelUrl from '../assets/barrels/barrel.webp';
	import explodingUrl from '../assets/barrels/exploding.webp';
	import explodedUrl from '../assets/barrels/exploded.webp';
	import goldUrl from '../assets/barrels/gold.webp';
	import plaqueBlue from '../assets/chests/ui/plaque_blue.webp';
	import plaqueRed from '../assets/chests/ui/plaque_red.webp';
	import plaqueGreen from '../assets/chests/ui/plaque_green.webp';
	import treasureFoundUrl from '../assets/chests/ui/treasure_found.webp';
	import tapContinueUrl from '../assets/ui/tap_continue.webp';
	import { playSound } from '../game/sound';
	import { money } from '../game/money';
	import Sparkles from './Sparkles.svelte';

	// Key feature: three powder kegs on the dock. The player shoots two;
	// each one blows apart and shows what it held. The last barrel standing
	// bursts open with the prize the book decided (`win`). Autoplay shoots
	// by itself after a second.
	type Props = {
		win: number; // dollars
		missed: [number, number]; // dollars
		betAmount: number;
		auto?: boolean;
		onDone: () => void;
	};
	const { win, missed, betAmount, auto = false, onDone }: Props = $props();

	const PLAQUES = [plaqueBlue, plaqueRed, plaqueGreen];
	type BarrelState = 'idle' | 'exploding' | 'exploded' | 'shaking' | 'gold';
	let barrels: BarrelState[] = $state(['idle', 'idle', 'idle']);
	let prizes: (number | null)[] = $state([null, null, null]);
	let shots = $state(0);
	let busy = $state(false);
	let stage: 'shoot' | 'final' | 'done' = $state('shoot');
	let winner = $state(-1);

	const timers: ReturnType<typeof setTimeout>[] = [];
	const later = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
	$effect(() => () => timers.forEach(clearTimeout));

	function shoot(i: number) {
		if (stage !== 'shoot' || busy || barrels[i] !== 'idle') return;
		busy = true;
		const value = missed[shots];
		shots += 1;
		playSound('matchExtra'); // pistol crack
		later(120, () => {
			barrels[i] = 'exploding';
			playSound('cannon');
		});
		later(650, () => {
			barrels[i] = 'exploded';
			prizes[i] = value;
			playSound('woodCrack');
		});
		later(1000, () => {
			busy = false;
			if (shots >= 2) openLast();
		});
	}

	function openLast() {
		stage = 'final';
		const i = barrels.findIndex((b) => b === 'idle');
		winner = i;
		barrels[i] = 'shaking';
		playSound('woodTick');
		later(900, () => {
			barrels[i] = 'gold';
			prizes[i] = win;
			playSound('chestOpen');
			playSound('jackpot');
		});
		later(1700, () => (stage = 'done'));
	}

	// Autoplay: shoot the next barrel (left to right) after a second.
	$effect(() => {
		if (!auto || stage !== 'shoot' || busy) return;
		const next = barrels.findIndex((b) => b === 'idle');
		const t = setTimeout(() => shoot(next), 1000);
		return () => clearTimeout(t);
	});
	// ...and continue after the result.
	$effect(() => {
		if (!auto || stage !== 'done') return;
		const t = setTimeout(() => onDone(), 2200);
		return () => clearTimeout(t);
	});

	function handleBackdrop() {
		if (stage === 'done') {
			playSound('click');
			onDone();
		}
	}

	const mult = (v: number) => (betAmount > 0 ? `×${+(v / betAmount).toFixed(2)}` : '');
	const fit = (t: string) => `font-size:${(17 * Math.min(1, 6 / t.length)).toFixed(2)}cqw;`;
	const IMG: Record<BarrelState, string> = {
		idle: barrelUrl,
		shaking: barrelUrl,
		exploding: explodingUrl,
		exploded: explodedUrl,
		gold: goldUrl,
	};
</script>

<div
	class="chest-pick barrel-shoot"
	style={`--chest-scene:url(${dockUrl});`}
	role="button"
	tabindex="0"
	onclick={handleBackdrop}
	onkeydown={(e) => e.key === 'Enter' && handleBackdrop()}
>
	<div class="chest-pick-head">
		{#if stage === 'done'}
			<img class="chest-pick-banner" src={treasureFoundUrl} alt="Treasure found!" draggable="false" />
			<Sparkles count={16} coins={14} spread={55} loop={false} />
		{:else}
			<div class="chest-pick-title feature-modal-title">
				{stage === 'final' ? 'Your barrel…' : shots === 0 ? 'Shoot 2 barrels!' : 'One more shot!'}
			</div>
		{/if}
	</div>

	<div class="chest-pick-row barrel-row">
		{#each barrels as b, i (i)}
			<button
				class={`barrel barrel--${b}`}
				class:missed={prizes[i] !== null && i !== winner}
				class:won={i === winner && b === 'gold'}
				disabled={stage !== 'shoot' || b !== 'idle' || busy}
				aria-label={`Shoot barrel ${i + 1}`}
				onclick={(e) => {
					e.stopPropagation();
					shoot(i);
				}}
			>
				{#if b === 'gold'}<span class="chest-pick-burst"></span>{/if}
				<img src={IMG[b]} alt="" draggable="false" />
				{#if prizes[i] !== null}
					{@const v = prizes[i]!}
					<span class="chest-pick-plaque" class:win={i === winner}>
						<img src={PLAQUES[i]} alt="" draggable="false" />
						<span class="chest-pick-plaque-text">
							<span class="chest-pick-prize-amt" style={fit(money(v))}>{money(v)}</span>
							<span class="chest-pick-prize-mult">{mult(v)}</span>
						</span>
					</span>
				{/if}
			</button>
		{/each}
	</div>

	<div class="kraken-card-hint chest-pick-hint">
		{#if stage === 'shoot'}
			Shoot two barrels — the last one standing is your prize
		{:else if stage === 'done'}
			You won {money(win)}
		{:else}
			&nbsp;
		{/if}
	</div>
	{#if stage === 'done'}
		<img class="tap-continue" src={tapContinueUrl} alt="Tap to continue" draggable="false" />
	{/if}
</div>
