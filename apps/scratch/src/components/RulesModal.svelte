<script lang="ts">
	import config from '../game/config';
	import { SYMBOL_IMAGE_URL } from '../game/assets';
	import { SYMBOL_LABEL } from '../game/symbolIcons';
	import { EXTRA_MATCH_LADDER, SKULL_GRID_PRIZE } from '../game/rules';
	import { KRAKEN_NUMBER_RANGE, KRAKEN_PRIZE_TABLE } from '../game/kraken';
	import octopusUrl from '../assets/symbols/octopus.png';
	import pirateUrl from '../assets/symbols/pirate.png';
	import type { BetMode, SymbolName } from '../game/types';

	// Game rules / info: Paytable, Features and General tabs. Numbers come
	// straight from the game tables, so they follow the selected mode.
	// TODO(math): once the math is final, the per-mode RTP / max win here
	// read from config and stay correct automatically.
	type Props = { betMode: BetMode; onClose: () => void };
	const { betMode, onClose }: Props = $props();

	type Tab = 'paytable' | 'features' | 'rules';
	let tab: Tab = $state('paytable');

	const MODES = Object.keys(config.betModes) as BetMode[];
	const mode = $derived(config.betModes[betMode]);
	const symbols = $derived(
		[...(mode.symbols as SymbolName[])].sort((a, b) => config.symbols[b].mult - config.symbols[a].mult),
	);
	const ladder = $derived(EXTRA_MATCH_LADDER[betMode]);
	const krakenRange = $derived.by(() => {
		const t = KRAKEN_PRIZE_TABLE[betMode];
		return `x${t[0][0]} – x${t[t.length - 1][0]}`;
	});
	const pct = (v: number) => `${(v * 100).toFixed(2)}%`;
</script>

<div
	class="paytable-backdrop"
	role="button"
	tabindex="0"
	onclick={onClose}
	onkeydown={(e) => e.key === 'Escape' && onClose()}
>
	<div class="paytable-modal rules-modal" role="dialog" aria-label="Game rules" onclick={(e) => e.stopPropagation()}>
		<div class="paytable-modal-header">
			<span class="paytable-modal-title">Pirate Scratch</span>
			<button class="close-btn" onclick={onClose} aria-label="Close">✕</button>
		</div>

		<div class="rules-tabs" role="tablist">
			<button class="rules-tab" class:active={tab === 'paytable'} role="tab" onclick={() => (tab = 'paytable')}>Paytable</button>
			<button class="rules-tab" class:active={tab === 'features'} role="tab" onclick={() => (tab = 'features')}>Features</button>
			<button class="rules-tab" class:active={tab === 'rules'} role="tab" onclick={() => (tab = 'rules')}>Rules</button>
		</div>

		<div class="rules-body">
			{#if tab === 'paytable'}
				<p class="rules-mode">
					<b>{betMode}</b> · {mode.rows}×{mode.cols} card · win up to <b>{mode.max_win}x</b> bet
				</p>
				<p>Match 3 of the same symbol anywhere on the card to win its multiplier of your bet.</p>
				<div class="paytable-modal-list">
					{#each symbols as name (name)}
						<div class="pay-item">
							<img class="pay-item-icon" src={SYMBOL_IMAGE_URL[name]} alt="" />
							<span class="pay-item-name">{SYMBOL_LABEL[name]}</span>
							<span class="pay-item-mult">×{config.symbols[name].mult}</span>
						</div>
					{/each}
					<div class="pay-item">
						<img class="pay-item-icon" src={SYMBOL_IMAGE_URL.skull} alt="" />
						<span class="pay-item-name">{SYMBOL_LABEL.skull} — no win<br /><small>Whole card of skulls: <b>+{SKULL_GRID_PRIZE[betMode]}x</b></small></span>
					</div>
				</div>

				<h4>Extra matches</h4>
				<p>Every extra matching symbol beyond the 3rd adds more to that win:</p>
				<div class="rules-ladder">
					{#each ladder as v, i (i)}
						<span><small>{i + 4}th</small>+{v}x</span>
					{/each}
				</div>
				<p class="rules-note">
					{#if ladder.length < mode.rows * mode.cols - 3}Further extras add +{ladder[ladder.length - 1]}x each.{/if}
					Several different symbols with 3+ on one card all pay, added together.
				</p>
			{:else if tab === 'features'}
				<div class="rules-feature">
					<img src={SYMBOL_IMAGE_URL.shark} alt="" />
					<div>
						<h4>Shark Bite</h4>
						<p>Land a <b>Shark</b> and the Shark Bite bar rolls, landing on one of five rewards:</p>
					</div>
				</div>
				<div class="rules-feature sub">
					<img src={SYMBOL_IMAGE_URL.kraken} alt="" />
					<div><h5>Kraken</h5><p>Opens the Kraken number match (below).</p></div>
				</div>
				<div class="rules-feature sub">
					<img src={octopusUrl} alt="" />
					<div><h5>Octopus</h5><p>3 bonus cards are dealt. Scratch them — every win on all of them is added to this round.</p></div>
				</div>
				<div class="rules-feature sub">
					<img src={pirateUrl} alt="" />
					<div><h5>Pirate</h5><p>Plunders the highest-paying symbol showing on the card and pays its multiplier, even if there's only one of it.</p></div>
				</div>
				<div class="rules-feature sub">
					<img src={SYMBOL_IMAGE_URL.key} alt="" />
					<div><h5>Key</h5><p>Opens the treasure chest pick (below).</p></div>
				</div>
				<div class="rules-feature sub">
					<img src={SYMBOL_IMAGE_URL.bonus} alt="" />
					<div><h5>Bonus</h5><p>Awards 10 Free Scratches (below).</p></div>
				</div>

				<div class="rules-feature">
					<img src={SYMBOL_IMAGE_URL.kraken} alt="" />
					<div>
						<h4>The Kraken</h4>
						<p>
							Land a <b>Kraken</b> (or get it from Shark Bite): you get a number from 1 to {KRAKEN_NUMBER_RANGE}, and so
							does the Kraken. If they match, the Kraken's Treasure reel spins for a prize of <b>{krakenRange}</b> your bet.
						</p>
					</div>
				</div>

				<div class="rules-feature">
					<img src={SYMBOL_IMAGE_URL.key} alt="" />
					<div>
						<h4>Treasure Chests</h4>
						<p>Land a <b>Key</b> (or get it from Shark Bite): pick one of three chests to win its prize. The other two then open to show what they held.</p>
					</div>
				</div>

				<div class="rules-feature">
					<img src={SYMBOL_IMAGE_URL.bonus} alt="" />
					<div>
						<h4>Free Scratches Bonus</h4>
						<p>
							Land <b>3 Bonus</b> symbols (or get it from Shark Bite) for <b>10 Free Scratches</b>, played at the same bet.
							Each winning free card adds its win multiplier — including anything its features win — to the
							<b>bonus multiplier</b>, and pays your bet × the whole bonus multiplier so far.
						</p>
						<p class="rules-note">Example: bonus multiplier x10, next card wins x2 → multiplier x12, that card pays x12.</p>
						<p>Landing the bonus again during free scratches adds 10 more.</p>
					</div>
				</div>
			{:else}
				<h4>How to play</h4>
				<ul>
					<li>Choose a mode — Easy, Medium or Hard — and your bet with − / +.</li>
					<li>Press the anchor to buy a card, then scratch the tiles (or press the anchor again to reveal all).</li>
					<li>Wins and features are shown once every tile is revealed; the outcome of the card is decided when it is bought.</li>
					<li>The circular-arrows button turns <b>Autoplay</b> on or off. Feature choices (Kraken, chests) still wait for you.</li>
				</ul>

				<h4>Modes</h4>
				<table class="rules-table">
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

				<h4>General</h4>
				<ul>
					<li>Total win on a card (including its features) is capped at the mode's max win.</li>
					<li>Free scratches are played at the bet and mode that triggered them; mode and bet are locked until they're finished.</li>
					<li>The theoretical return to player (RTP) is the long-term average; individual results vary.</li>
					<li>Malfunction voids all pays and plays.</li>
				</ul>
			{/if}
		</div>
	</div>
</div>
