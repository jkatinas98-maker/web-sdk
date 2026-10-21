<script lang="ts">
	import './app.css';
	import { App } from 'pixi-svelte';
	import { getContext } from '../game/context';
	import { stateBet, stateUrlDerived } from 'state-shared';
	import config from '../game/config';
	import type { BetMode } from '../game/types';
	import type { BookEventOfType, ChestOutcome } from '../game/typesBookEvent';
	import { createMockBet } from '../game/mockBet';
	import { playBookEvents } from '../game/utils';
	import { playSound, setVolume, startMusic } from '../game/sound';
	import musicUrl from '../assets/music.mp3';
	import { SYMBOL_LABEL } from '../game/symbolIcons';
	import { SYMBOL_IMAGE_URL } from '../game/assets';
	import logoUrl from '../assets/logo.png';
	import frameUrl from '../assets/frame.webp';
	import type { SymbolName } from '../game/types';
	import EnableGameActor from './EnableGameActor.svelte';
	import Ticket from './Ticket.svelte';

	const context = getContext();

	type ViewState = 'start' | 'playing' | 'revealed';

	let viewState: ViewState = $state('start');
	let isProcessing = $state(false);
	let betMode: BetMode = $state('easy');
	let betAmount = $state(1);
	let totalWin: number = $state(0);
	let showWinModal = $state(false);
	let showPaytable = $state(false);
	let winningSymbol: SymbolName | null = $state(null);
	// The RGS result (including the win amount) arrives the instant the bet
	// resolves, but the player hasn't scratched anything yet — hold it here
	// and only surface it once they've revealed every panel themselves.
	let pendingWin: number | null = $state(null);

	// 3+ 🎁 scatters award free scratches — pendingFreeScratches holds this
	// round's award until the reveal-everything effect below surfaces it,
	// the same way pendingWin does; freeScratchesRemaining is the player's
	// actual free-scratch balance; awardedFreeScratches is just what the win
	// modal shows for the round that just resolved.
	let pendingFreeScratches = 0;
	let freeScratchesRemaining = $state(0);
	let awardedFreeScratches = $state(0);

	// Treasure Chest / Kraken results: PLACEHOLDER overlays (reused win-modal
	// styling, no real art/animation yet -- see the artist brief for what
	// these should actually become). The book events arrive (and this gets
	// populated) the instant the bet resolves -- same moment pendingWin
	// does, well before the player has scratched anything -- so, same as
	// pendingWin/pendingFreeScratches above, this is a plain (non-reactive)
	// buffer during event processing. It's only copied into the reactive
	// featureOverlayQueue below once the reveal-complete effect fires
	// (player has scratched every panel), which is what actually makes the
	// overlay appear; showing it straight off this buffer would pop it up
	// before the player had scratched a single cell.
	let pendingFeatureEvents: Array<
		{ kind: 'kraken'; data: BookEventOfType<'krakenResult'> } | { kind: 'chest'; data: ChestOutcome[] }
	> = [];
	let featureOverlayQueue: typeof pendingFeatureEvents = $state([]);
	const activeFeatureOverlay = $derived(featureOverlayQueue[0] ?? null);

	// Kraken is shown in-card (over the ticket), not as a full-screen modal,
	// and reveals in two taps: the player's own number is visible the moment
	// it appears, the Kraken's number stays face-down behind a "?" token
	// until the first tap, which flips it and shows hit/miss. A second tap
	// (handleCardOverlayTap again, now revealed) advances the queue same as
	// every other feature overlay. Reset whenever a *new* kraken entry
	// becomes the active one (covers the back-to-back-krakens edge case,
	// where the queue advances from one kraken straight into another).
	let krakenRevealed = $state(false);
	$effect(() => {
		if (activeFeatureOverlay?.kind === 'kraken') krakenRevealed = false;
	});

	function advanceFeatureOverlay() {
		playSound('click');
		featureOverlayQueue = featureOverlayQueue.slice(1);
		if (featureOverlayQueue.length === 0 && (totalWin > 0 || awardedFreeScratches > 0)) {
			showWinModal = true;
			playSound(awardedFreeScratches > 0 ? 'bonus' : 'win');
		}
	}

	// Kraken's own tap handler: first tap flips the hidden number face-up,
	// second tap dismisses it like any other overlay. Chests (and anything
	// else) keep using advanceFeatureOverlay directly, single-tap.
	function handleKrakenTap() {
		if (!krakenRevealed) {
			krakenRevealed = true;
			playSound('click');
		} else {
			advanceFeatureOverlay();
		}
	}

	// Local demo wallet, used only while there's no RGS backend to talk to
	// (see playGame below) so the footer stat bar has something real to show
	// during dev. Once rgs_url is present, the real balance from stateBet
	// (populated by the actual wallet/play + wallet/end-round responses)
	// is shown instead.
	let mockBalance = $state(1000);
	let mockLastWin = $state(0);

	const isMockMode = !stateUrlDerived.rgsUrl();
	const displayBalance = $derived(isMockMode ? mockBalance : stateBet.balanceAmount);
	const displayLastWin = $derived(isMockMode ? mockLastWin : stateBet.winBookEventAmount);

	const MIN_BET = 0.5;
	const BET_STEP = 0.5;

	// Cycle through 4 volume steps on each tap (mute / low / mid / full)
	// instead of a plain on-off mute — "max" alone was still too quiet, so
	// this also doubles as the way to actually turn it up.
	const VOLUME_LEVELS = [0, 0.4, 0.7, 1];
	let volumeLevel = $state(VOLUME_LEVELS.length - 1);
	function cycleVolume() {
		volumeLevel = (volumeLevel + 1) % VOLUME_LEVELS.length;
		setVolume(VOLUME_LEVELS[volumeLevel]);
		if (VOLUME_LEVELS[volumeLevel] > 0) playSound('click');
	}

	function setBetAmount(value: number) {
		const maxBet = Math.min(100, displayBalance || 100);
		betAmount = Math.min(maxBet, Math.max(MIN_BET, Math.round(value * 100) / 100));
		playSound('click');
	}

	function selectMode(mode: BetMode) {
		if (mode === betMode || freeScratchesRemaining > 0) return;
		betMode = mode;
		playSound('click');
		// Clear the previous round's panels — otherwise the last mode's
		// (wrong-sized, wrong-symbol-set) grid stays on screen, stale, until
		// the next bet is placed. The difficulty buttons are disabled while
		// viewState === 'playing' so this never interrupts a live round.
		viewState = 'start';
		totalWin = 0;
		showWinModal = false;
		winningSymbol = null;
		pendingWin = null;
		pendingFeatureEvents = [];
		featureOverlayQueue = [];
		context.stateGameDerived.reset();
	}

	function togglePaytable() {
		playSound('click');
		showPaytable = !showPaytable;
	}

	// Layout: the illustrated frame (grid window + its own control bar) sits
	// centered vertically on screen; the logo header and difficulty tabs
	// stack in the space above it. The frame art's coordinates below are in
	// its source-image pixels (1536x1024); everything is placed
	// proportionally from them, so any export size of the same art lines up.
	// Logo + max-win ribbon.
	const HEADER_H = 150;
	const DIFF_H = 34;
	const FRAME = {
		w: 1536,
		h: 1024,
		// Horizontal span that must stay on screen: both wooden pillars and
		// every baked button. Lanterns/cannons/palms outside it may crop on
		// narrow (portrait phone) screens.
		viewX0: 140,
		viewX1: 1396,
		// Vertical extent of the actual art (rest is transparent padding).
		contentY0: 5,
		contentY1: 984,
		// The transparent window the scratch grid shows through.
		win: { x0: 264, y0: 205, x1: 1271, y1: 757 },
	};

	let vw = $state(typeof window === 'undefined' ? 390 : window.innerWidth);
	let vh = $state(typeof window === 'undefined' ? 844 : window.innerHeight);

	// Everything above the frame (logo, ribbon, tabs) plus a little air.
	const TOP_AREA = HEADER_H + DIFF_H + 6;
	const contentH = FRAME.contentY1 - FRAME.contentY0;
	const widthScale = $derived(vw / (FRAME.viewX1 - FRAME.viewX0));
	// Truly centered needs the same free band below as the header takes
	// above. On short screens (landscape phones) that would shrink the frame
	// too far, so there it falls back to simply filling the space under the
	// tabs.
	const centeredScale = $derived(Math.min(widthScale, (vh - 2 * TOP_AREA) / contentH, 0.8));
	const fillScale = $derived(Math.min(widthScale, (vh - TOP_AREA - 8) / contentH, 0.8));
	const centered = $derived(centeredScale >= fillScale * 0.6);
	const frameScale = $derived(Math.max(0.12, centered ? centeredScale : fillScale));
	const frameLeft = $derived(vw / 2 - (FRAME.w / 2) * frameScale);
	const frameTop = $derived(
		Math.max(
			TOP_AREA - FRAME.contentY0 * frameScale,
			vh / 2 - ((FRAME.contentY0 + FRAME.contentY1) / 2) * frameScale,
		),
	);
	// The frame window in screen pixels, as insets from each viewport edge —
	// the pixi grid and the in-card Kraken overlay both fill exactly this.
	const gridRect = $derived({
		top: frameTop + FRAME.win.y0 * frameScale,
		bottom: vh - (frameTop + FRAME.win.y1 * frameScale),
		left: frameLeft + FRAME.win.x0 * frameScale,
		right: vw - (frameLeft + FRAME.win.x1 * frameScale),
	});

	// Absolutely position an overlay (hit area / text) on the frame art by
	// its center + size in source-image pixels.
	const at = (cx: number, cy: number, w: number, h: number) =>
		`left:${((cx - w / 2) / FRAME.w) * 100}%;top:${((cy - h / 2) / FRAME.h) * 100}%;` +
		`width:${(w / FRAME.w) * 100}%;height:${(h / FRAME.h) * 100}%;`;

	// Difficulty and bet amount lock while a round is live AND while free
	// scratches are owed — a free scratch replays at whatever mode/bet
	// triggered it, so they have to be used up before either can change.
	const locked = $derived(viewState === 'playing' || freeScratchesRemaining > 0);

	const maxWin = $derived(config.betModes[betMode].max_win);

	// Paytable modal list for the CURRENT difficulty only — each mode has
	// its own fully distinct 6 symbols/mults now, so this can't be a single
	// shared list anymore, it has to follow betMode.
	const payEntries = $derived(
		(config.betModes[betMode].symbols as SymbolName[])
			.map((name) => [name, config.symbols[name]] as [SymbolName, { mult: number }])
			.sort((a, b) => b[1].mult - a[1].mult),
	);

	function playGame() {
		if (isProcessing) return;
		const isFreeRound = freeScratchesRemaining > 0;
		if (!isFreeRound && isMockMode && mockBalance < betAmount) return;

		playSound('click');
		isProcessing = true;
		viewState = 'playing';
		totalWin = 0;
		showWinModal = false;
		winningSymbol = null;
		pendingWin = null;
		pendingFreeScratches = 0;
		awardedFreeScratches = 0;
		pendingFeatureEvents = [];
		featureOverlayQueue = [];
		context.stateGameDerived.reset();

		stateBet.activeBetModeKey = betMode;
		stateBet.betAmount = betAmount;

		if (isMockMode) {
			if (isFreeRound) {
				freeScratchesRemaining -= 1;
			} else {
				mockBalance = Math.round((mockBalance - betAmount) * 100) / 100;
			}
			const { events, freeScratches } = createMockBet(betMode, betAmount, isFreeRound);
			pendingFreeScratches = freeScratches;
			playBookEvents(events);
			return;
		}

		context.eventEmitter.broadcast({ type: 'bet' });
	}

	function revealPanel(index: number) {
		context.stateGameDerived.reveal(index);
	}

	function revealEverything() {
		playSound('click');
		// Stagger each panel's reveal instead of flipping them all in the same
		// frame — reuses the same per-index reveal() action a manual tap
		// uses, so each tile still gets its own pop-in + reveal sound, just
		// cascading left-to-right/top-to-bottom instead of all at once.
		const { panels, revealed } = context.stateGame;
		let delay = 0;
		for (let i = 0; i < panels.length; i++) {
			if (revealed.has(i)) continue;
			setTimeout(() => context.stateGameDerived.reveal(i), delay);
			delay += 45;
		}
	}

	// One main action button, like the reference: it plays a round while
	// idle/done, and becomes "Reveal all" while a round is in progress.
	function handleMainAction() {
		if (viewState === 'playing') {
			revealEverything();
		} else {
			playGame();
		}
	}

	// Once the player has scratched every panel, surface the result that was
	// already sitting in pendingWin.
	$effect(() => {
		const { panels, revealed } = context.stateGame;
		if (
			viewState === 'playing' &&
			pendingWin !== null &&
			panels.length > 0 &&
			revealed.size >= panels.length
		) {
			totalWin = pendingWin;
			viewState = 'revealed';
			isProcessing = false;
			if (isMockMode) {
				mockBalance = Math.round((mockBalance + totalWin) * 100) / 100;
				mockLastWin = totalWin;
			}
			if (pendingFreeScratches > 0) {
				freeScratchesRemaining += pendingFreeScratches;
				awardedFreeScratches = pendingFreeScratches;
			}
			if (totalWin > 0) {
				// Re-derive which symbol actually won by scanning the resolved
				// panels for the first paying symbol to reach 3 occurrences —
				// the same rule the book itself resolves by. (Matching
				// totalWin back against a paytable entry instead would be
				// ambiguous: several ids are shared across difficulties, e.g.
				// mult2 is "2x" in every mode, so a win amount alone can't
				// tell you which actual symbol hit.)
				const counts: Partial<Record<SymbolName, number>> = {};
				let winner: SymbolName | null = null;
				for (const panel of panels) {
					if (!panel || config.symbols[panel.name].mult <= 0) continue;
					counts[panel.name] = (counts[panel.name] ?? 0) + 1;
					if (!winner && counts[panel.name]! >= 3) winner = panel.name;
				}
				winningSymbol = winner;
			}
			// Surface whatever chest/kraken events this round's bet produced
			// NOW (reveal just completed) rather than when they arrived
			// (bet resolution, before any scratching) -- see the buffer's
			// own comment above.
			featureOverlayQueue = pendingFeatureEvents;
			if (totalWin > 0 || awardedFreeScratches > 0) {
				// Feature overlays (if any landed this round) play first; the
				// win modal follows once the player taps through them --
				// advanceFeatureOverlay() shows it once the queue is empty.
				if (featureOverlayQueue.length === 0) {
					showWinModal = true;
					// Bonus gets its own fanfare instead of the regular win jingle,
					// even when it lands alongside a cash win the same round.
					playSound(awardedFreeScratches > 0 ? 'bonus' : 'win');
				}
			}
		}
	});

	context.eventEmitter.subscribeOnMount({
		finalWin: ({ data }: { data: BookEventOfType<'finalWin'> }) => {
			pendingWin = data.amount;
		},
		chestSequence: ({ data }: { data: BookEventOfType<'chestSequence'> }) => {
			pendingFeatureEvents = [...pendingFeatureEvents, { kind: 'chest', data: data.chests }];
		},
		krakenResult: ({ data }: { data: BookEventOfType<'krakenResult'> }) => {
			pendingFeatureEvents = [...pendingFeatureEvents, { kind: 'kraken', data }];
		},
	});
</script>

<svelte:window
	bind:innerWidth={vw}
	bind:innerHeight={vh}
	onpointerdown={() => startMusic(musicUrl)}
	onkeydown={() => startMusic(musicUrl)}
/>

<div class="pixi-layer">
	<App>
		<EnableGameActor />
		<Ticket
			{betMode}
			top={gridRect.top}
			bottom={gridRect.bottom}
			left={gridRect.left}
			right={gridRect.right}
			frameless
			interactive={viewState === 'playing'}
			{winningSymbol}
			onRevealIndex={revealPanel}
		/>
	</App>
</div>

<!-- Illustrated frame: the art itself plus invisible hit areas / text laid
     over its baked-in controls (bet -/+ and readout, balance/win plaque,
     anchor = play / reveal all, refresh = reveal all, menu = paytable). The
     window is transparent, so the pixi grid underneath shows through. -->
<div
	class="frame-layer"
	style={`left:${frameLeft}px;top:${frameTop}px;width:${FRAME.w * frameScale}px;height:${FRAME.h * frameScale}px;font-size:${Math.max(13, frameScale * 44)}px;`}
>
	<img class="frame-img" src={frameUrl} alt="" draggable="false" />

	<button
		class="frame-btn"
		style={at(222, 880, 88, 88)}
		disabled={locked}
		aria-label="Decrease bet"
		onclick={() => setBetAmount(betAmount - BET_STEP)}
	></button>
	<div class="frame-text frame-bet" style={at(356, 884, 172, 76)}>
		<span class="frame-label">Bet</span>
		<span class="frame-value">${betAmount.toFixed(2)}</span>
	</div>
	<button
		class="frame-btn"
		style={at(490, 878, 88, 88)}
		disabled={locked}
		aria-label="Increase bet"
		onclick={() => setBetAmount(betAmount + BET_STEP)}
	></button>

	<div class="frame-text frame-plaque" style={at(768, 818, 290, 104)}>
		<div class="frame-plaque-row">
			<span class="frame-label">Balance</span>
			<span class="frame-value">${displayBalance.toFixed(2)}</span>
		</div>
		<div class="frame-plaque-row">
			<span class="frame-label">Win</span>
			<span class="frame-value win">${displayLastWin.toFixed(2)}</span>
		</div>
	</div>

	<button
		class="frame-btn frame-btn--anchor"
		class:ready={viewState !== 'playing' && !isProcessing && freeScratchesRemaining === 0}
		class:free={viewState !== 'playing' && freeScratchesRemaining > 0}
		style={at(1041, 875, 184, 184)}
		disabled={viewState !== 'playing' && isProcessing}
		aria-label={viewState === 'playing'
			? 'Reveal all'
			: freeScratchesRemaining > 0
				? 'Free scratch'
				: 'Play card'}
		onclick={handleMainAction}
	></button>

	<button
		class="frame-btn"
		style={at(1210, 875, 100, 100)}
		disabled={viewState !== 'playing'}
		aria-label="Reveal all"
		onclick={revealEverything}
	></button>
	<button
		class="frame-btn"
		style={at(1334, 875, 100, 100)}
		aria-label="Paytable"
		onclick={togglePaytable}
	></button>
</div>

<div class="ui-layer">
	<!-- HEADER: logo pill + max-win banner, centered -->
	<header class="header-bar">
		<img class="logo" src={logoUrl} alt="Pirate Scratch" />
		<div class="max-win-banner" class:free={freeScratchesRemaining > 0}>
			{freeScratchesRemaining > 0
				? `${freeScratchesRemaining} free scratch${freeScratchesRemaining === 1 ? '' : 'es'} left`
				: `Win up to ${maxWin}x bet`}
		</div>
		<button class="sound-toggle" onclick={cycleVolume} aria-label="Change volume">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
				<path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" stroke="none" />
				{#if volumeLevel === 0}
					<path d="M17 9l5 6M22 9l-5 6" />
				{/if}
				{#if volumeLevel >= 1}
					<path d="M16 10a3 3 0 0 1 0 4" />
				{/if}
				{#if volumeLevel >= 2}
					<path d="M18.5 7.5a6.5 6.5 0 0 1 0 9" />
				{/if}
				{#if volumeLevel >= 3}
					<path d="M21 5a10 10 0 0 1 0 14" />
				{/if}
			</svg>
		</button>
	</header>

	<!-- DIFFICULTY TABS (between logo and frame) -->
	<div class="diff-bar">
		<div class="diff-row">
			{#each Object.keys(config.betModes) as mode}
				{@const m = config.betModes[mode as BetMode]}
				<button
					class="diff-btn"
					class:active={betMode === mode}
					disabled={locked}
					onclick={() => selectMode(mode as BetMode)}
				>
					{mode} {m.rows}×{m.cols}
				</button>
			{/each}
		</div>
	</div>
</div>

{#if showPaytable}
	<div
		class="paytable-backdrop"
		role="button"
		tabindex="0"
		onclick={togglePaytable}
		onkeydown={(e) => e.key === 'Enter' && togglePaytable()}
	>
		<div class="paytable-modal" role="dialog" onclick={(e) => e.stopPropagation()}>
			<div class="paytable-modal-header">
				<span class="paytable-modal-title">Paytable</span>
				<button class="close-btn" onclick={togglePaytable} aria-label="Close">✕</button>
			</div>
			<div class="paytable-modal-list">
				<div class="pay-item bonus-item">
					<img class="pay-item-icon" src={SYMBOL_IMAGE_URL.bonus} alt={SYMBOL_LABEL.bonus} />
					<span class="pay-item-name">{SYMBOL_LABEL.bonus} (land 3)</span>
					<span class="pay-item-mult">10 Free Scratches</span>
				</div>
				{#each payEntries as [name, sym] (name)}
					<div class="pay-item">
						<img class="pay-item-icon" src={SYMBOL_IMAGE_URL[name]} alt={SYMBOL_LABEL[name]} />
						<span class="pay-item-name">{SYMBOL_LABEL[name]}</span>
						<span class="pay-item-mult">×{sym.mult}</span>
					</div>
				{/each}
			</div>
		</div>
	</div>
{/if}

{#if activeFeatureOverlay?.kind === 'kraken'}
	{@const k = activeFeatureOverlay.data}
	<!-- In-card, not a full-screen modal: sits over the ticket itself (same
	     window rect as <Ticket>, see gridRect above)
	     so the header/footer/controls stay visible and undimmed behind it.
	     Player's number is visible immediately; the Kraken's stays a "?"
	     until the first tap (handleKrakenTap), which flips it face-up and
	     shows hit/miss -- a second tap then advances like any other
	     overlay. -->
	<div
		class="kraken-card-overlay"
		style={`top:${gridRect.top}px; bottom:${gridRect.bottom}px; left:${gridRect.left}px; right:${gridRect.right}px;`}
		role="button"
		tabindex="0"
		onclick={handleKrakenTap}
		onkeydown={(e) => e.key === 'Enter' && handleKrakenTap()}
	>
		<div class="feature-modal-title">The Kraken Rises</div>
		<div class="kraken-numbers">
			<div class="kraken-number">{k.playerNumber}</div>
			<div class="kraken-vs">vs</div>
			<div class="kraken-number" class:kraken-number--hidden={!krakenRevealed}>
				{krakenRevealed ? k.krakenNumber : '?'}
			</div>
		</div>
		{#if krakenRevealed}
			<div class={k.hit ? 'kraken-result kraken-result-hit' : 'kraken-result kraken-result-miss'}>
				{k.hit ? `MATCH! +$${k.amount.toFixed(2)}` : 'No match'}
			</div>
			<div class="kraken-card-hint">Tap to continue</div>
		{:else}
			<div class="kraken-card-hint">Tap to reveal the Kraken's number</div>
		{/if}
	</div>
{/if}

{#if activeFeatureOverlay?.kind === 'chest'}
	{@const chests = activeFeatureOverlay.data}
	<div
		class="win-backdrop"
		role="button"
		tabindex="0"
		onclick={advanceFeatureOverlay}
		onkeydown={(e) => e.key === 'Enter' && advanceFeatureOverlay()}
	>
		<div class="feature-modal feature-modal--chest">
			<div class="feature-modal-title">Treasure Chests</div>
			<div class="chest-row">
				{#each chests as chest, i (i)}
					<div class={`chest-pill chest-pill--${chest.kind}`}>
						{#if chest.kind === 'cash'}
							+${chest.value.toFixed(2)}
						{:else if chest.kind === 'multiplier'}
							×{chest.value}
						{:else if chest.kind === 'retrigger'}
							+{chest.value} Chests
						{:else}
							+{chest.value} Key
						{/if}
					</div>
				{/each}
			</div>
			<div class="win-modal-hint">Tap anywhere to continue</div>
		</div>
	</div>
{/if}

{#if showWinModal}
	<div
		class="win-backdrop"
		role="button"
		tabindex="0"
		onclick={() => (showWinModal = false)}
		onkeydown={(e) => e.key === 'Enter' && (showWinModal = false)}
	>
		<div class="win-modal">
			<div class="win-modal-title">{totalWin > 0 ? 'Treasure won!' : 'Bonus!'}</div>
			{#if totalWin > 0}
				<div class="win-modal-amount">${totalWin.toFixed(2)}</div>
				<div class="win-modal-mult">{(totalWin / betAmount).toFixed(1)}x</div>
			{/if}
			{#if awardedFreeScratches > 0}
				<div class="win-modal-bonus">+{awardedFreeScratches} Free Scratches</div>
			{/if}
			<div class="win-modal-hint">Tap anywhere to continue</div>
		</div>
	</div>
{/if}
