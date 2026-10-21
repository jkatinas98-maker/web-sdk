<script lang="ts">
	import './app.css';
	import { untrack } from 'svelte';
	import { App } from 'pixi-svelte';
	import { getContext } from '../game/context';
	import { stateBet, stateUrlDerived } from 'state-shared';
	import config from '../game/config';
	import type { BetMode } from '../game/types';
	import type { BookEventOfType, ChestOutcome, OctopusCard, SharkOutcome } from '../game/typesBookEvent';
	import { createMockBet } from '../game/mockBet';
	import { playBookEvents } from '../game/utils';
	import { playSound, setVolume, startMusic, setMusicEnabled } from '../game/sound';
	import musicUrl from '../assets/music.mp3';
	import { SYMBOL_LABEL } from '../game/symbolIcons';
	import { SYMBOL_IMAGE_URL } from '../game/assets';
	import logoUrl from '../assets/logo.png';
	import frameUrl from '../assets/frame.webp';
	import krakenPanelUrl from '../assets/kraken_panel.webp';
	import krakenSceneUrl from '../assets/kraken_scene.webp';
	import bgPosterUrl from '../assets/background.jpg';
	import bgMp4Url from '../assets/bg_loop.mp4';
	import bgWebmUrl from '../assets/bg_loop.webm';
	import octopusIconUrl from '../assets/symbols/octopus.png';
	import bigWinUrl from '../assets/winpop/big_win.webp';
	import epicBonusUrl from '../assets/winpop/epic_bonus.webp';
	import maxWinSignUrl from '../assets/signs/maxwin_sign.webp';
	import modeEasyUrl from '../assets/signs/mode_easy.webp';
	import modeMediumUrl from '../assets/signs/mode_medium.webp';
	import modeHardUrl from '../assets/signs/mode_hard.webp';
	import megaWinUrl from '../assets/winpop/mega_win.webp';
	import epicWinUrl from '../assets/winpop/epic_win.webp';
	import type { SymbolName } from '../game/types';
	import EnableGameActor from './EnableGameActor.svelte';
	import Ticket from './Ticket.svelte';
	import CaseReel from './CaseReel.svelte';
	import SharkBiteBar from './SharkBiteBar.svelte';
	import ChestPick from './ChestPick.svelte';

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
		| { kind: 'kraken'; data: BookEventOfType<'krakenResult'> }
		| { kind: 'chest'; data: ChestOutcome[] }
		| { kind: 'shark'; data: SharkOutcome }
		| { kind: 'octopus'; data: OctopusCard[] }
		| { kind: 'chestPick'; data: BookEventOfType<'chestPick'> }
	> = [];
	let featureOverlayQueue: typeof pendingFeatureEvents = $state([]);
	const activeFeatureOverlay = $derived(featureOverlayQueue[0] ?? null);

	// Kraken is shown in-card (over the ticket), not as a full-screen modal,
	// and steps through stages on taps:
	//   numbers  -> player's number shown, the Kraken's face-down ("?")
	//   revealed -> Kraken's number flipped; hit/miss shown
	//   case     -> (hit only) CS2-style case reel spinning to the prize
	//   landed   -> prize shown; next tap advances like any other overlay
	// Reset whenever a *new* kraken entry becomes the active one.
	type KrakenStage = 'numbers' | 'revealed' | 'case' | 'landed';
	let krakenStage: KrakenStage = $state('numbers');
	$effect(() => {
		if (activeFeatureOverlay?.kind === 'kraken') krakenStage = 'numbers';
	});
	const krakenRevealed = $derived(krakenStage !== 'numbers');

	function advanceFeatureOverlay() {
		playSound('click');
		featureOverlayQueue = featureOverlayQueue.slice(1);
		if (featureOverlayQueue.length === 0 && (totalWin > 0 || awardedFreeScratches > 0)) {
			showWinModal = isBigWin();
			playSound(awardedFreeScratches > 0 ? 'bonus' : 'win');
		}
	}

	// Kraken's own tap handler (see the stages above). Taps during the case
	// spin are ignored; the reel reports when it lands.
	function handleKrakenTap() {
		const hit = activeFeatureOverlay?.kind === 'kraken' && activeFeatureOverlay.data.hit;
		if (krakenStage === 'numbers') {
			krakenStage = 'revealed';
			playSound(hit ? 'scatterLand' : 'click');
		} else if (krakenStage === 'revealed') {
			if (hit) {
				krakenStage = 'case';
				playSound('click');
			} else {
				advanceFeatureOverlay();
			}
		} else if (krakenStage === 'landed') {
			advanceFeatureOverlay();
		}
	}

	// --- Shark Bite -----------------------------------------------------
	// A 'shark' queue entry rolls the bar (not a modal: the card stays
	// visible); once it lands, the outcome's own entry (kraken / chest /
	// octopus) follows in the queue. Pirate and bonus have no entry of their
	// own (bonus free scratches are already in pendingFreeScratches).
	let sharkRollId = $state(0);
	let sharkOutcome: SharkOutcome | null = $state(null);
	let sharkRollCounter = 0;
	let featureTimer: ReturnType<typeof setTimeout> | undefined;
	$effect(() => {
		const active = activeFeatureOverlay;
		untrack(() => {
			if (active?.kind === 'shark') {
				sharkOutcome = active.data;
				sharkRollCounter += 1;
				sharkRollId = sharkRollCounter;
				playSound('scatterLand');
			} else if (sharkOutcome !== null) {
				sharkOutcome = null;
			}
		});
	});

	function handleSharkLanded(outcome: SharkOutcome) {
		clearTimeout(featureTimer);
		// Let the landed icon + label sit for a beat; the pirate placeholder
		// a little longer so "coming soon" can be read.
		featureTimer = setTimeout(advanceFeatureOverlay, outcome === 'pirate' ? 2400 : 1600);
	}

	// --- Octopus: 3 bonus cards dealt into the same grid -----------------
	// octoIndex -1 = intro banner, 0..2 = which bonus card is up.
	let octoCards: OctopusCard[] = $state([]);
	let octoIndex = $state(-1);
	let octoCardDone = $state(false);
	let octoWinSum = $state(0);
	const octoActive = $derived(activeFeatureOverlay?.kind === 'octopus');
	// The player scratches bonus cards just like a normal card.
	const octoScratching = $derived(octoActive && octoIndex >= 0 && !octoCardDone);

	$effect(() => {
		const active = activeFeatureOverlay;
		if (active?.kind !== 'octopus') return;
		untrack(() => {
			octoCards = active.data;
			octoIndex = -1;
			octoCardDone = false;
			octoWinSum = 0;
			playSound('bonus');
			clearTimeout(featureTimer);
			featureTimer = setTimeout(() => dealOctoCard(0), 1800);
		});
	});

	function dealOctoCard(i: number) {
		octoIndex = i;
		octoCardDone = false;
		winningSymbol = null;
		context.stateGameDerived.setPanels(octoCards[i].panels);
		playSound('click');
	}

	// Bonus card fully scratched -> show its win, then deal the next one
	// (or finish the feature).
	$effect(() => {
		const { panels, revealed } = context.stateGame;
		if (!octoScratching || panels.length === 0 || revealed.size < panels.length) return;
		untrack(() => {
			const card = octoCards[octoIndex];
			octoCardDone = true;
			octoWinSum += card.win;
			winningSymbol = findWinningSymbol(card.panels);
			playSound(card.win > 0 ? 'win' : 'click');
			clearTimeout(featureTimer);
			featureTimer = setTimeout(() => {
				if (octoIndex + 1 < octoCards.length) {
					dealOctoCard(octoIndex + 1);
				} else {
					octoIndex = -1;
					octoCardDone = false;
					advanceFeatureOverlay();
				}
			}, 1700);
		});
	});

	// First paying symbol to reach 3 on a card -- the same rule the book
	// resolves wins by.
	function findWinningSymbol(panels: Array<{ name: SymbolName } | undefined>): SymbolName | null {
		const counts: Partial<Record<SymbolName, number>> = {};
		for (const panel of panels) {
			if (!panel || config.symbols[panel.name].mult <= 0) continue;
			counts[panel.name] = (counts[panel.name] ?? 0) + 1;
			if (counts[panel.name]! >= 3) return panel.name;
		}
		return null;
	}

	// The win pop-up only shows for big wins: at least the mode's
	// second-highest symbol multiplier (easy 16x, medium 41x, hard 130x),
	// or when free scratches were awarded. Smaller wins just show in the
	// Win plaque, with the win sound.
	function isBigWin(): boolean {
		if (awardedFreeScratches > 0) return true;
		const mults = (config.betModes[betMode].symbols as SymbolName[])
			.map((name) => config.symbols[name].mult)
			.sort((a, b) => b - a);
		return betAmount > 0 && totalWin / betAmount >= mults[1];
	}

	// Big / Mega / Epic tier for the win pop-up, by multiple of the bet:
	// Big from the mode's second-highest symbol, Epic at its top symbol
	// (= the mode's max win), Mega in between (geometric midpoint).
	type WinTier = 'big' | 'mega' | 'epic';
	const WIN_TIER_ART: Record<WinTier, string> = { big: bigWinUrl, mega: megaWinUrl, epic: epicWinUrl };
	const winTier = $derived.by((): WinTier | null => {
		if (totalWin <= 0 || betAmount <= 0) return null;
		const mults = (config.betModes[betMode].symbols as SymbolName[])
			.map((name) => config.symbols[name].mult)
			.sort((a, b) => b - a);
		const x = totalWin / betAmount;
		if (x >= mults[0]) return 'epic';
		if (x >= Math.sqrt(mults[0] * mults[1])) return 'mega';
		if (x >= mults[1]) return 'big';
		return null;
	});

	// Count the amount up when the pop-up opens.
	let shownWin = $state(0);
	$effect(() => {
		if (!showWinModal) return;
		const target = untrack(() => totalWin);
		const start = performance.now();
		const dur = 1800;
		let raf = 0;
		const step = (now: number) => {
			const t = Math.min(1, (now - start) / dur);
			shownWin = target * (1 - Math.pow(1 - t, 3));
			if (t < 1) raf = requestAnimationFrame(step);
		};
		shownWin = 0;
		raf = requestAnimationFrame(step);
		return () => cancelAnimationFrame(raf);
	});

	// --- Free-scratch bonus ----------------------------------------------
	// Awarded free scratches play back to back automatically. Every free
	// card's win multiplier adds onto the bonus multiplier shown on the
	// medallion over the anchor (x2, then a x4 card makes it x6, ...); when
	// the last one is done, a summary shows the bonus total.
	let bonusActive = $state(false);
	let bonusMult = $state(0);
	let bonusPlayed = $state(0);
	let bonusSpins = $state(0);
	let pendingBonusSummary = $state(false);
	let showBonusSummary = $state(false);
	let roundIsFree = false;
	const fmtMult = (m: number) => `x${+m.toFixed(2)}`;

	// Summary once nothing else is on screen.
	$effect(() => {
		if (pendingBonusSummary && featureOverlayQueue.length === 0 && !showWinModal) {
			untrack(() => {
				pendingBonusSummary = false;
				showBonusSummary = true;
				playSound('jackpot');
			});
		}
	});

	function closeBonusSummary() {
		playSound('click');
		showBonusSummary = false;
		bonusActive = false;
	}

	// Auto-deal the next free scratch once the previous card is fully done.
	$effect(() => {
		if (
			!bonusActive ||
			freeScratchesRemaining <= 0 ||
			viewState === 'playing' ||
			isProcessing ||
			featureOverlayQueue.length > 0 ||
			showWinModal ||
			showBonusSummary
		)
			return;
		const t = setTimeout(() => playGame(), 1100);
		return () => clearTimeout(t);
	});

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

	// Music has its own on/off toggle, separate from the effects volume.
	let musicOn = $state(true);
	function toggleMusic() {
		musicOn = !musicOn;
		setMusicEnabled(musicOn);
		playSound('click');
	}
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
		clearTimeout(featureTimer);
		context.stateGameDerived.reset();
	}

	function togglePaytable() {
		playSound('click');
		showPaytable = !showPaytable;
	}

	// Layout: the Shark Bite bar sits directly on top of the illustrated
	// frame, both the same width (pillar to pillar), as big as the screen
	// allows. Coordinates below are in each art's source pixels; everything
	// is placed proportionally from them.
	//
	// Two arrangements:
	//   wide   (desktop / landscape): logo + mode tabs in a column on the
	//          left, sound buttons top-right, bar + frame use the full height.
	//   narrow (portrait phones): compact logo, ribbon and tabs stacked
	//          above the bar.
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
	// Shark Bite bar art (1983x793 source; y0..y1 is the painted band).
	const SHARK_BAR = { w: 1983, y0: 80, y1: 745, tube: { x0: 318, x1: 1668, y0: 450, y1: 650 } };

	let vw = $state(typeof window === 'undefined' ? 390 : window.innerWidth);
	let vh = $state(typeof window === 'undefined' ? 844 : window.innerHeight);

	const VIEW_W = FRAME.viewX1 - FRAME.viewX0;
	const contentH = FRAME.contentY1 - FRAME.contentY0;
	// Bar height per unit of frame scale, when the bar is VIEW_W wide.
	// The frame tucks right under the bar: it starts at the tube's bottom
	// rim (the splash below it overlaps the frame), and a little higher
	// still so the bar sits over the top of the frame's skull crest.
	const BAR_RIM_Y = 690;
	const FRAME_TUCK = 34; // frame source px hidden under the bar
	const BAR_H_PER_S = (VIEW_W * (BAR_RIM_Y - SHARK_BAR.y0)) / SHARK_BAR.w - FRAME_TUCK;
	const STACK_H_PER_S = BAR_H_PER_S + contentH;
	const MAX_SCALE = 1;
	// Narrow mode: logo + ribbon + tabs band above the bar.
	const NARROW_HEADER_H = 178;
	const MODE_SIGN_URL: Record<string, string> = { easy: modeEasyUrl, medium: modeMediumUrl, hard: modeHardUrl };
	const SIDE_MIN = 190;

	const wideScale = $derived(Math.min(vw / VIEW_W, (vh - 8) / STACK_H_PER_S, MAX_SCALE));
	const wide = $derived((vw - VIEW_W * wideScale) / 2 >= SIDE_MIN);
	const frameScale = $derived(
		Math.max(
			0.12,
			wide ? wideScale : Math.min(vw / VIEW_W, (vh - NARROW_HEADER_H - 8) / STACK_H_PER_S, MAX_SCALE),
		),
	);
	const sharkBarW = $derived(VIEW_W * frameScale);
	const sharkBarH = $derived(BAR_H_PER_S * frameScale);
	const stackH = $derived(STACK_H_PER_S * frameScale);
	// Wide: center the bar+frame stack vertically. Narrow: right under the
	// header band.
	const sharkTop = $derived(wide ? Math.max(2, (vh - stackH) / 2) : NARROW_HEADER_H);
	// Side column width for the logo + tabs in wide mode.
	const sideW = $derived(Math.min(280, (vw - sharkBarW) / 2 - 24));
	const frameLeft = $derived(vw / 2 - (FRAME.w / 2) * frameScale);
	const frameTop = $derived(sharkTop + sharkBarH - FRAME.contentY0 * frameScale);
	// Shark bar's glass tube on screen (the Octopus banner sits there).
	const sharkTube = $derived.by(() => {
		const k = sharkBarW / SHARK_BAR.w;
		return {
			left: vw / 2 - sharkBarW / 2 + SHARK_BAR.tube.x0 * k,
			width: (SHARK_BAR.tube.x1 - SHARK_BAR.tube.x0) * k,
			top: sharkTop + (SHARK_BAR.tube.y0 - SHARK_BAR.y0) * k,
			height: (SHARK_BAR.tube.y1 - SHARK_BAR.tube.y0) * k,
		};
	});
	// The frame window in screen pixels, as insets from each viewport edge —
	// the pixi grid and the in-card Kraken overlay both fill exactly this.
	const gridRect = $derived({
		top: frameTop + FRAME.win.y0 * frameScale,
		bottom: vh - (frameTop + FRAME.win.y1 * frameScale),
		left: frameLeft + FRAME.win.x0 * frameScale,
		right: vw - (frameLeft + FRAME.win.x1 * frameScale),
	});

	// "The Kraken Rises" panel art (1672x941) fitted inside the frame window,
	// plus where its two number plaques sit, in panel fractions.
	const KRAKEN_PANEL = { w: 1672, h: 941, player: { x: 543, y: 632 }, kraken: { x: 1122, y: 632 } };
	// The Kraken feature takes over the whole screen: panel fitted to the
	// viewport (with some breathing room), reel as wide as fits.
	const krakenPanel = $derived.by(() => {
		const w = Math.min(vw * 0.94, (vh * 0.8 * KRAKEN_PANEL.w) / KRAKEN_PANEL.h, 1150);
		return { w, h: (w * KRAKEN_PANEL.h) / KRAKEN_PANEL.w };
	});
	const krakenReelW = $derived(Math.min(vw * 0.97, 1350));
	const plaqueAt = (p: { x: number; y: number }) =>
		`left:${(p.x / KRAKEN_PANEL.w) * 100}%;top:${(p.y / KRAKEN_PANEL.h) * 100}%;`;

	// Absolutely position an overlay (hit area / text) on the frame art by
	// its center + size in source-image pixels.
	const at = (cx: number, cy: number, w: number, h: number) =>
		`left:${((cx - w / 2) / FRAME.w) * 100}%;top:${((cy - h / 2) / FRAME.h) * 100}%;` +
		`width:${(w / FRAME.w) * 100}%;height:${(h / FRAME.h) * 100}%;`;

	// Difficulty and bet amount lock while a round is live AND while free
	// scratches are owed — a free scratch replays at whatever mode/bet
	// triggered it, so they have to be used up before either can change.
	const locked = $derived(viewState === 'playing' || freeScratchesRemaining > 0 || featureOverlayQueue.length > 0);

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
		if (isProcessing || featureOverlayQueue.length > 0) return;
		const isFreeRound = freeScratchesRemaining > 0;
		roundIsFree = isFreeRound;
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
		clearTimeout(featureTimer);
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
		if (viewState === 'playing' || octoScratching) {
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
			if (roundIsFree && betAmount > 0) {
				bonusMult = Math.round((bonusMult + totalWin / betAmount) * 100) / 100;
				bonusPlayed += 1;
			}
			if (pendingFreeScratches > 0) {
				freeScratchesRemaining += pendingFreeScratches;
				awardedFreeScratches = pendingFreeScratches;
				if (!bonusActive) {
					bonusActive = true;
					bonusMult = 0;
					bonusPlayed = 0;
					bonusSpins = pendingFreeScratches;
				} else {
					bonusSpins += pendingFreeScratches;
				}
			}
			if (roundIsFree && bonusActive && freeScratchesRemaining === 0) {
				pendingBonusSummary = true;
			}
			if (totalWin > 0) {
				// Re-derive which symbol actually won by scanning the resolved
				// panels for the first paying symbol to reach 3 occurrences —
				// the same rule the book itself resolves by. (Matching
				// totalWin back against a paytable entry instead would be
				// ambiguous: several ids are shared across difficulties, e.g.
				// mult2 is "2x" in every mode, so a win amount alone can't
				// tell you which actual symbol hit.)
				winningSymbol = findWinningSymbol(panels);
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
					showWinModal = isBigWin();
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
		sharkBite: ({ data }: { data: BookEventOfType<'sharkBite'> }) => {
			pendingFeatureEvents = [...pendingFeatureEvents, { kind: 'shark', data: data.outcome }];
		},
		chestPick: ({ data }: { data: BookEventOfType<'chestPick'> }) => {
			pendingFeatureEvents = [...pendingFeatureEvents, { kind: 'chestPick', data }];
		},
		octopusCards: ({ data }: { data: BookEventOfType<'octopusCards'> }) => {
			pendingFeatureEvents = [...pendingFeatureEvents, { kind: 'octopus', data: data.cards }];
		},
	});
</script>

<svelte:window
	bind:innerWidth={vw}
	bind:innerHeight={vh}
	onpointerdown={() => startMusic(musicUrl)}
	onkeydown={() => startMusic(musicUrl)}
/>

<!-- Animated harbor background: the artist's 32-frame loop (water ripple,
     glints, lantern flicker) encoded as a ~0.5 MB looping video. The
     painted still underneath (body background) is the poster/fallback,
     e.g. while it loads or under prefers-reduced-motion. -->
<video class="bg-video" autoplay muted loop playsinline preload="auto" poster={bgPosterUrl} aria-hidden="true">
	<source src={bgWebmUrl} type="video/webm" />
	<source src={bgMp4Url} type="video/mp4" />
</video>
<div class="bg-dim" aria-hidden="true"></div>

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
			interactive={viewState === 'playing' || octoScratching}
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
		class:ready={(viewState !== 'playing' && !isProcessing && freeScratchesRemaining === 0 && featureOverlayQueue.length === 0) || octoScratching}
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
	{#if bonusActive}
		<!-- Bonus multiplier medallion over the anchor -->
		<div class="bonus-medallion" style={at(1041, 875, 176, 176)}>
			{#key bonusMult}
				<span class="bonus-medallion-mult">{fmtMult(bonusMult)}</span>
			{/key}
			<span class="bonus-medallion-count">{Math.min(bonusPlayed + (viewState === 'playing' ? 1 : 0), bonusSpins)}/{bonusSpins}</span>
		</div>
	{/if}

	<button
		class="frame-btn"
		style={at(1210, 875, 100, 100)}
		disabled={viewState !== 'playing' && !octoScratching}
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

<div class="ui-layer" class:wide>
	<!-- Logo + max-win ribbon + mode tabs: a column on the left in wide
	     layouts, a compact band above the Shark Bite bar on phones. -->
	<header
		class="header-bar"
		class:wide
		style={wide ? `width:${sideW}px;top:${Math.max(10, sharkTop)}px;` : `height:${NARROW_HEADER_H}px;`}
	>
		<img class="logo" src={logoUrl} alt="Pirate Scratch" />
		<!-- Wooden max-win sign (text is live, so it follows the mode / free
		     scratches) -->
		<div class="maxwin-sign" class:free={freeScratchesRemaining > 0}>
			<img src={maxWinSignUrl} alt="" draggable="false" />
			<span class="maxwin-sign-text">
				{freeScratchesRemaining > 0
					? `${freeScratchesRemaining} free scratch${freeScratchesRemaining === 1 ? '' : 'es'} left`
					: `Win up to ${maxWin}x bet`}
			</span>
		</div>
		<div class="mode-signs">
			{#each Object.keys(config.betModes) as mode}
				{@const m = config.betModes[mode as BetMode]}
				<button
					class="mode-sign"
					class:active={betMode === mode}
					disabled={locked}
					aria-label={`${mode} ${m.rows}×${m.cols}`}
					onclick={() => selectMode(mode as BetMode)}
				>
					<img src={MODE_SIGN_URL[mode]} alt="" draggable="false" />
				</button>
			{/each}
		</div>
	</header>

	<div class="sound-group">
		<button
			class="sound-toggle music-toggle"
			class:off={!musicOn}
			onclick={toggleMusic}
			aria-label={musicOn ? 'Turn music off' : 'Turn music on'}
		>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
				<path d="M9 18V6l10-2v12" />
				<circle cx="6.5" cy="18" r="2.5" fill="currentColor" stroke="none" />
				<circle cx="16.5" cy="16" r="2.5" fill="currentColor" stroke="none" />
				{#if !musicOn}
					<path d="M4 4l16 16" stroke-width="2.6" />
				{/if}
			</svg>
		</button>
		<button class="sound-toggle" class:off={volumeLevel === 0} onclick={cycleVolume} aria-label="Change effects volume">
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
	</div>

	<!-- SHARK BITE bar: same width as the frame, sitting right on top of it -->
	<div class="shark-bar-slot" style={`top:${sharkTop}px;`}>
		<SharkBiteBar width={sharkBarW} rollId={sharkRollId} outcome={sharkOutcome} onLanded={handleSharkLanded} />
	</div>
</div>

{#if octoActive}
	<!-- Octopus bonus cards: banner in the Shark Bite bar's tube, so the
	     grid stays fully visible; the cards are dealt into the normal grid. -->
	<div
		class="octo-banner"
		style={`top:${sharkTube.top}px;left:${sharkTube.left}px;width:${sharkTube.width}px;height:${sharkTube.height}px;font-size:${Math.max(10, sharkTube.height * 0.2)}px;`}
	>
		<img class="octo-banner-icon" src={octopusIconUrl} alt="" />
		<div class="octo-banner-text">
			{#if octoIndex < 0}
				<div class="octo-banner-title">Octopus bonus!</div>
				<div class="octo-banner-sub">3 bonus cards — every win adds up</div>
			{:else}
				<div class="octo-banner-title">Bonus card {octoIndex + 1} / {octoCards.length}</div>
				<div class="octo-banner-sub">
					{#if octoCardDone}
						{octoCards[octoIndex].win > 0 ? `+$${octoCards[octoIndex].win.toFixed(2)}` : 'No win'} · bonus total ${octoWinSum.toFixed(2)}
					{:else}
						Scratch it! · bonus total ${octoWinSum.toFixed(2)}
					{/if}
				</div>
			{/if}
		</div>
	</div>
{/if}

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
				<div class="pay-item kraken-item">
					<img class="pay-item-icon" src={SYMBOL_IMAGE_URL.kraken} alt={SYMBOL_LABEL.kraken} />
					<span class="pay-item-name">{SYMBOL_LABEL.kraken} (match its number)</span>
					<span class="pay-item-mult">×2 – ×{maxWin}</span>
				</div>
				<div class="pay-item shark-item">
					<img class="pay-item-icon" src={SYMBOL_IMAGE_URL.shark} alt={SYMBOL_LABEL.shark} />
					<span class="pay-item-name">{SYMBOL_LABEL.shark} (rolls the bar)</span>
					<span class="pay-item-mult">Kraken · Octopus · Key · Bonus</span>
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
		style={`--kraken-scene:url(${krakenSceneUrl});`}
		role="button"
		tabindex="0"
		onclick={handleKrakenTap}
		onkeydown={(e) => e.key === 'Enter' && handleKrakenTap()}
	>
		{#if krakenStage === 'case' || krakenStage === 'landed'}
			<div class="kraken-case" style={`width:${krakenReelW}px;`}>
				<div class="feature-modal-title kraken-case-title">The Kraken's Treasure</div>
				<CaseReel {betMode} mult={k.multiplier} onLanded={() => (krakenStage = 'landed')} />
				{#if krakenStage === 'landed'}
					<div class="kraken-result kraken-result-hit">×{k.multiplier} &mdash; +${k.amount.toFixed(2)}</div>
					<div class="kraken-card-hint">Tap to continue</div>
				{:else}
					<div class="kraken-card-hint">Opening...</div>
				{/if}
			</div>
		{:else}
			<div
				class="kraken-panel"
				style={`width:${krakenPanel.w}px;height:${krakenPanel.h}px;font-size:${krakenPanel.w * 0.085}px;`}
			>
				<img class="kraken-panel-img" src={krakenPanelUrl} alt="The Kraken Rises" draggable="false" />
				<div class="kraken-plaque-num" style={plaqueAt(KRAKEN_PANEL.player)}>{k.playerNumber}</div>
				<!-- "=" between the plaques (the art's baked "VS" was removed);
				     turns into a red "≠" on a miss. -->
				<div
					class="kraken-equals"
					class:miss={krakenRevealed && !k.hit}
					class:hit={krakenRevealed && k.hit}
					style={plaqueAt({ x: 833, y: 613 })}
				>
					{krakenRevealed && !k.hit ? '≠' : '='}
				</div>
				<div
					class="kraken-plaque-num"
					class:hidden={!krakenRevealed}
					class:hit={krakenRevealed && k.hit}
					style={plaqueAt(KRAKEN_PANEL.kraken)}
				>
					{krakenRevealed ? k.krakenNumber : '?'}
				</div>
				<div class="kraken-panel-foot">
					{#if krakenRevealed}
						<div class={k.hit ? 'kraken-result kraken-result-hit' : 'kraken-result kraken-result-miss'}>
							{k.hit ? 'MATCH!' : 'No match'}
						</div>
						<div class="kraken-card-hint">{k.hit ? "Tap to open the Kraken's treasure" : 'Tap to continue'}</div>
					{:else}
						<div class="kraken-card-hint">Tap to reveal the Kraken's number</div>
					{/if}
				</div>
			</div>
		{/if}
	</div>
{/if}

{#if activeFeatureOverlay?.kind === 'chestPick'}
	{@const cp = activeFeatureOverlay.data}
	{#key cp}
		<ChestPick win={cp.win} missed={cp.missed} {betAmount} onDone={advanceFeatureOverlay} />
	{/key}
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
		class:bigwin-backdrop={winTier !== null}
		role="button"
		tabindex="0"
		onclick={() => (showWinModal = false)}
		onkeydown={(e) => e.key === 'Enter' && (showWinModal = false)}
	>
		{#if awardedFreeScratches > 0}
			<div class="bigwin bigwin--bonus">
				<div class="bigwin-rays"></div>
				<img class="bigwin-art" src={epicBonusUrl} alt="Epic bonus" draggable="false" />
				{#if awardedFreeScratches !== 10}
					<div class="bigwin-mult">+{awardedFreeScratches} Free Scratches</div>
				{/if}
				{#if totalWin > 0}
					<div class="bigwin-mult">+${totalWin.toFixed(2)} this card</div>
				{/if}
				<div class="win-modal-hint">Tap to start the bonus</div>
			</div>
		{:else if winTier}
			<div class={`bigwin bigwin--${winTier}`}>
				<div class="bigwin-rays"></div>
				<img class="bigwin-art" src={WIN_TIER_ART[winTier]} alt={`${winTier} win`} draggable="false" />
				<div class="bigwin-amount">${shownWin.toFixed(2)}</div>
				<div class="bigwin-mult">{(totalWin / betAmount).toFixed(1)}x bet</div>
				{#if awardedFreeScratches > 0}
					<div class="win-modal-bonus">+{awardedFreeScratches} Free Scratches</div>
				{/if}
				<div class="win-modal-hint">Tap anywhere to continue</div>
			</div>
		{:else}
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
		{/if}
	</div>
{/if}

{#if showBonusSummary}
	<div
		class="win-backdrop bigwin-backdrop"
		role="button"
		tabindex="0"
		onclick={closeBonusSummary}
		onkeydown={(e) => e.key === 'Enter' && closeBonusSummary()}
	>
		<div class="bigwin bigwin--bonus">
			<div class="bigwin-rays"></div>
			<div class="bonus-summary-title">Bonus complete!</div>
			<div class="bonus-summary-medal">{fmtMult(bonusMult)}</div>
			<div class="bigwin-amount">${(bonusMult * betAmount).toFixed(2)}</div>
			<div class="bigwin-mult">{bonusSpins} free scratches</div>
			<div class="win-modal-hint">Tap anywhere to continue</div>
		</div>
	</div>
{/if}
