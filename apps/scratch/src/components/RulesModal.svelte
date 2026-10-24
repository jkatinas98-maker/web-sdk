<script lang="ts">
	import config from '../game/config';
	import { stateConfig } from 'state-shared';
	import { SYMBOL_IMAGE_URL } from '../game/assets';
	import { SYMBOL_LABEL } from '../game/symbolIcons';
	import { BONUS_MINIMUM, EXTRA_MATCH_LADDER, SKULL_GRID_PRIZE } from '../game/rules';
	import { KRAKEN_NUMBER_RANGE, KRAKEN_PRIZE_TABLE } from '../game/kraken';
	import octopusUrl from '../assets/symbols/octopus.png';
	import pirateUrl from '../assets/symbols/pirate.png';
	import bgUrl from '../assets/rules/rules_bg.webp';
	import headerUrl from '../assets/rules/rules_header.webp';
	import { playSound } from '../game/sound';
	import type { BetMode, SymbolName } from '../game/types';

	// Game info: Paytable / Features / Rules, in the illustrated pirate
	// board. Every number comes from the live game tables, so it follows the
	// selected mode. Wide screens: the board art with a wooden panel (left)
	// and a parchment panel (right) laid over it. Phones: the crest on top,
	// tabs, then both panels stacked and scrolling.
	type Props = { betMode: BetMode; onClose: () => void };
	const { betMode, onClose }: Props = $props();

	type Tab = 'paytable' | 'features' | 'rules';
	let tab: Tab = $state('paytable');
	const setTab = (t: Tab) => {
		if (t !== tab) playSound('click');
		tab = t;
	};

	const MODES = Object.keys(config.betModes) as BetMode[];
	const mode = $derived(config.betModes[betMode]);
	const symbols = $derived(
		[...(mode.symbols as SymbolName[])].sort((a, b) => config.symbols[b].mult - config.symbols[a].mult),
	);
	const ladder = $derived(EXTRA_MATCH_LADDER[betMode]);
	const cells = $derived(mode.rows * mode.cols);
	const krakenRange = $derived.by(() => {
		const t = KRAKEN_PRIZE_TABLE[betMode];
		return `x${t[0][0]} – x${t[t.length - 1][0]}`;
	});
	const pct = (v: number) => `${(v * 100).toFixed(2)}%`;
	const autoplayOff = $derived(!!stateConfig.jurisdiction?.disabledAutoplay);

	const SHARK_ITEMS = [
		{ img: SYMBOL_IMAGE_URL.kraken, name: 'Kraken', text: 'Opens the Kraken number match.' },
		{ img: octopusUrl, name: 'Octopus', text: '3 bonus cards — every win on them is added.' },
		{ img: pirateUrl, name: 'Pirate', text: 'Plunders the best symbol on the card and pays it, even a single one.' },
		{ img: SYMBOL_IMAGE_URL.key, name: 'Key', text: 'Opens Barrel Blast.' },
		{ img: SYMBOL_IMAGE_URL.bonus, name: 'Bonus', text: 'Awards 10 Free Scratches.' },
	];
</script>

<div
	class="rx-backdrop"
	role="button"
	tabindex="0"
	onclick={onClose}
	onkeydown={(e) => e.key === 'Escape' && onClose()}
>
	<div
		class="rx-board"
		style={`--rx-bg:url(${bgUrl});`}
		role="dialog"
		aria-label="Game info"
		tabindex="-1"
		onclick={(e) => e.stopPropagation()}
		onkeydown={(e) => e.stopPropagation()}
	>
		<img class="rx-header" src={headerUrl} alt="Pirate Scratch" draggable="false" />
		<button class="rx-close" onclick={onClose} aria-label="Close"><span>✕</span></button>

		<div class="rx-tabs" role="tablist">
			<button class="rx-tab" class:active={tab === 'paytable'} role="tab" onclick={() => setTab('paytable')}>Paytable</button>
			<button class="rx-tab" class:active={tab === 'features'} role="tab" onclick={() => setTab('features')}>Features</button>
			<button class="rx-tab" class:active={tab === 'rules'} role="tab" onclick={() => setTab('rules')}>Rules</button>
		</div>

		<div class="rx-content">
			<!-- Wooden panel -->
			<section class="rx-left">
				{#if tab === 'paytable'}
					<h3 class="rx-title">{betMode} · {mode.rows}×{mode.cols} card · win up to {mode.max_win}x bet</h3>
					<p class="rx-text">Match 3 of the same symbol anywhere on the card to win its multiplier of your bet.</p>
					<div class="rx-grid">
						{#each symbols as name (name)}
							<div class="rx-card">
								<img src={SYMBOL_IMAGE_URL[name]} alt="" />
								<span class="rx-card-name">{SYMBOL_LABEL[name]}</span>
								<span class="rx-card-mult">x{config.symbols[name].mult}</span>
							</div>
						{/each}
						<div class="rx-card rx-card--skull">
							<img src={SYMBOL_IMAGE_URL.skull} alt="" />
							<span class="rx-card-name">Skull · no win</span>
							<span class="rx-card-sub">Full card of skulls</span>
							<span class="rx-card-mult">+{SKULL_GRID_PRIZE[betMode]}x</span>
						</div>
					</div>
				{:else if tab === 'features'}
					<h3 class="rx-title">Shark Bite</h3>
					<div class="rx-row">
						<img class="rx-row-icon" src={SYMBOL_IMAGE_URL.shark} alt="" />
						<p class="rx-text">Land a <b>Shark</b> and the Shark Bite bar rolls, landing on one of five rewards:</p>
					</div>
					<div class="rx-grid rx-grid--features">
						{#each SHARK_ITEMS as it (it.name)}
							<div class="rx-card rx-card--feature">
								<img src={it.img} alt="" />
								<span class="rx-card-name">{it.name}</span>
								<span class="rx-card-sub">{it.text}</span>
							</div>
						{/each}
					</div>
				{:else}
					<h3 class="rx-title">How to play</h3>
					<ul class="rx-list">
						<li>Choose a mode — Easy, Medium or Hard — and your bet with − / +.</li>
						<li>Press the anchor to buy a card, then scratch the tiles, or press the anchor again to reveal all.</li>
						<li>The outcome of each card is decided when it is bought; wins and features show once every tile is revealed.</li>
						{#if autoplayOff}
							<li>The circular-arrows button reveals every tile at once.</li>
						{:else}
							<li>The circular-arrows button turns <b>Autoplay</b> on or off. During autoplay the Kraken and Barrel Blast carry on by themselves after 1 second if you don't tap.</li>
						{/if}
					</ul>
					<h3 class="rx-title">General</h3>
					<ul class="rx-list">
						<li>Total win on a card, including its features and any free scratches, is capped at the mode's max win.</li>
						<li>Free scratches play at the bet and mode that triggered them; mode and bet are locked until they finish.</li>
						<li>The return to player (RTP) is the long-term theoretical average; individual results vary.</li>
						<li>Malfunction voids all pays and plays.</li>
					</ul>
				{/if}
			</section>

			<!-- Parchment panel -->
			<section class="rx-right">
				{#if tab === 'paytable'}
					<h3 class="rx-parch-title">Extra matches</h3>
					<p class="rx-parch-text">Every extra matching symbol beyond the 3rd adds more to that win:</p>
					<div class="rx-chips">
						{#each ladder as v, i (i)}
							<span class="rx-chip"><small>{i + 4}th</small>+{v}x</span>
						{/each}
					</div>
					<p class="rx-parch-text small">
						{#if ladder.length < cells - 3}Further extras add +{ladder[ladder.length - 1]}x each.{/if}
						Several different symbols with 3+ on one card all pay, added together.
					</p>
				{:else if tab === 'features'}
					<div class="rx-feature">
						<img src={SYMBOL_IMAGE_URL.kraken} alt="" />
						<div>
							<h4>The Kraken</h4>
							<p>You and the Kraken each get a number from 1 to {KRAKEN_NUMBER_RANGE}. If they match, the Kraken's Treasure reel spins for <b>{krakenRange}</b> your bet.</p>
						</div>
					</div>
					<div class="rx-feature">
						<img src={SYMBOL_IMAGE_URL.key} alt="" />
						<div>
							<h4>Barrel Blast</h4>
							<p>A <b>Key</b> opens Barrel Blast: shoot two of the three barrels — each shows what it held — and the last barrel standing is your prize.</p>
						</div>
					</div>
					<div class="rx-feature">
						<img src={SYMBOL_IMAGE_URL.bonus} alt="" />
						<div>
							<h4>Free Scratches</h4>
							<p>3 <b>Bonus</b> symbols award <b>10 Free Scratches</b> at the same bet. Each winning free card adds its win to the <b>bonus multiplier</b> and pays your bet × the whole multiplier so far. Landing the bonus again adds 10 more. A bonus always pays at least <b>{BONUS_MINIMUM[betMode]}x</b> your bet in total.</p>
						</div>
					</div>
				{:else}
					<h3 class="rx-parch-title">Modes</h3>
					<table class="rx-table">
						<thead><tr><th>Mode</th><th>Card</th><th>Max win</th><th>RTP</th></tr></thead>
						<tbody>
							{#each MODES as m (m)}
								{@const bm = config.betModes[m]}
								<tr class:current={m === betMode}>
									<td>{m}</td><td>{bm.rows}×{bm.cols}</td><td>{bm.max_win}x</td><td>{pct(bm.rtp)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
					<p class="rx-parch-text small">Higher modes have fewer tiles and bigger prizes: wins come less often but pay more.</p>
				{/if}
			</section>
		</div>
	</div>
</div>
