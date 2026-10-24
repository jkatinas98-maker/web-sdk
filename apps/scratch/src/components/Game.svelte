<script lang="ts">
	import './app.css';
	import { untrack } from 'svelte';
	import { App } from 'pixi-svelte';
	import { getContext } from '../game/context';
	import { stateBet, stateUrlDerived } from 'state-shared';
	import config from '../game/config';
	import type { BetMode } from '../game/types';
	import type { BookEvent, BookEventOfType, ChestOutcome, OctopusCard, SharkOutcome } from '../game/typesBookEvent';
	import { createMockRound, cardMatchWin, SKULL_GRID_PRIZE } from '../game/mockBet';
	import { playBookEvents, roundPresented } from '../game/utils';
	import { playSound, stopSound, setVolume, startMusic, setMusicVolume, setMusicTrack, setBeachMode } from '../game/sound';
	import musicUrl from '../assets/music.mp3';
	import { SYMBOL_LABEL } from '../game/symbolIcons';
	import { SYMBOL_IMAGE_URL } from '../game/assets';
	import logoUrl from '../assets/logo.png';
	import frameUrl from '../assets/frame.webp';
	import frameBandUrl from '../assets/frame_band.webp';
	import frameCrestUrl from '../assets/frame_crest.webp';
	import krakenPanelUrl from '../assets/kraken_panel.webp';
	import krakenSceneUrl from '../assets/kraken_scene.webp';
	import krakenAnimUrl from '../assets/kraken_anim.webp';
	import bgPosterUrl from '../assets/background.jpg';
	import bgAnimUrl from '../assets/bg_anim.webp';
	import octopusIconUrl from '../assets/symbols/octopus.png';
	import octopusBarUrl from '../assets/octopus_bar.webp';
	import octopusBgUrl from '../assets/octopus_bg.webp';
	import pirateIconUrl from '../assets/symbols/pirate.png';
	import bigWinUrl from '../assets/winpop/big_win.webp';
	import epicBonusUrl from '../assets/winpop/epic_bonus.webp';
	import bonusAnimUrl from '../assets/bonus_anim.webp';
	import bonusMusicUrl from '../assets/music_bonus.mp3';
	import maxWinSignUrl from '../assets/signs/maxwin_sign.webp';
	import medallionUrl from '../assets/ui/medallion.webp';
	import bonusWinArtUrl from '../assets/ui/bonus_win.webp';
	import matchBarUrl from '../assets/ui/match_bar.webp';
	import matchBarGoldUrl from '../assets/ui/match_bar_gold.webp';
	import matchBarRedUrl from '../assets/ui/match_bar_red.webp';
	import btnSoundUrl from '../assets/ui/btn_sound.webp';
	import btnMusicUrl from '../assets/ui/btn_music.webp';
	import loadBarUrl from '../assets/ui/load_bar.webp';
	import loadWaterUrl from '../assets/ui/load_water.webp';
	import loadBtnUrl from '../assets/ui/load_btn.webp';
	import modeEasyUrl from '../assets/signs/mode_easy.webp';
	import modeMediumUrl from '../assets/signs/mode_medium.webp';
	import modeHardUrl from '../assets/signs/mode_hard.webp';
	import wsChatUrl from '../assets/winpop/ws_chat.webp';
	import niceWinUrl from '../assets/winpop/nice_win.webp';
	import epicWinUrl from '../assets/winpop/epic_win.webp';
	import maxWinUrl from '../assets/winpop/max_win.webp';
	import type { SymbolName } from '../game/types';
	import EnableGameActor from './EnableGameActor.svelte';
	import Ticket from './Ticket.svelte';
	import CaseReel from './CaseReel.svelte';
	import SharkBiteBar from './SharkBiteBar.svelte';
	import { buildWinSchedule, findWinningSymbols } from '../game/winTiming';
	import ChestPick from './ChestPick.svelte';
	import tapContinueUrl from '../assets/ui/tap_continue.webp';
	import krakensTreasureUrl from '../assets/krakens_treasure.webp';
	import resultKrakenUrl from '../assets/shark/result_kraken.webp';
	import resultOctopusUrl from '../assets/shark/result_octopus.webp';
	import resultPirateUrl from '../assets/shark/result_pirate.webp';
	import resultKeyUrl from '../assets/shark/result_key.webp';
	import resultBonusUrl from '../assets/shark/result_bonus.webp';
	import { money } from '../game/money';
	import { stateConfig } from 'state-shared';
	import Sparkles from './Sparkles.svelte';
	import RulesModal from './RulesModal.svelte';

	const context = getContext();

	type ViewState = 'start' | 'playing' | 'revealed';

	let viewState: ViewState = $state('start');
	let isProcessing = $state(false);
	let betMode: BetMode = $state('medium');
	let betAmount = $state(1);
	let totalWin: number = $state(0);
	let showWinModal = $state(false);
	let showPaytable = $state(false);
	let winningSymbols: SymbolName[] = $state([]);
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

	// --- Round books ----------------------------------------------------
	// One bet = one book = the whole round: the base card, then every free
	// card the bonus deals (same from the RGS and from the local demo).
	// It's split into cards at each revealPanels and played one card at a
	// time; the free cards are dealt from it instead of new bets.
	let roundCards: BookEvent[][] = [];
	let roundFinal = 0; // round payout per $1 (already capped at max win)
	let roundPaidSoFar = 0; // per $1, credited by the round's earlier cards

	function startRound(events: BookEvent[]) {
		// (also the RGS resume path: make sure we're in a live round)
		viewState = 'playing';
		isProcessing = true;
		roundCards = [];
		roundFinal = 0;
		roundPaidSoFar = 0;
		for (const e of events) {
			if (e.type === 'revealPanels') roundCards.push([e]);
			else if (e.type === 'finalWin') roundFinal = e.amount;
			else if (e.type !== 'setTotalWin' && roundCards.length) roundCards[roundCards.length - 1].push(e);
		}
		playNextCard();
	}

	// What one card pays, per $1: base card = its matches (+ skull grid) +
	// everything its features won; free card = bet x the bonus multiplier
	// when it wins. The round's last card settles to the book's (capped)
	// total so the sum always equals what the round actually pays.
	function cardPay(card: BookEvent[], isLast: boolean): number {
		if (isLast) return Math.max(0, Math.round((roundFinal - roundPaidSoFar) * 100) / 100);
		const reveal = card[0];
		if (reveal.type !== 'revealPanels') return 0;
		if (reveal.gameType === 'freegame') {
			const bm = card.find((e) => e.type === 'bonusMultiplier');
			return bm && bm.type === 'bonusMultiplier' ? bm.total : 0;
		}
		const names = reveal.panels.map((p) => p.name);
		let pay = cardMatchWin(betMode, names);
		if (names.every((n) => n === 'skull')) pay += SKULL_GRID_PRIZE[betMode];
		for (const e of card) {
			if (e.type === 'krakenResult' || e.type === 'pirateBounty') pay += e.amount;
			else if (e.type === 'chestPick') pay += e.win;
			else if (e.type === 'octopusCards') pay += e.cards.reduce((t, c) => t + c.win, 0);
		}
		return Math.round(pay * 100) / 100;
	}

	function playNextCard() {
		const card = roundCards.shift();
		if (!card) {
			freeScratchesRemaining = 0;
			isProcessing = false;
			viewState = 'revealed';
			return;
		}
		const pay = cardPay(card, roundCards.length === 0);
		roundPaidSoFar = Math.round((roundPaidSoFar + pay) * 100) / 100;
		pendingWin = Math.round(pay * betAmount * 100) / 100;
		playBookEvents(card);
	}

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
		| { kind: 'pirate'; data: BookEventOfType<'pirateBounty'> }
	> = [];
	let featureOverlayQueue: typeof pendingFeatureEvents = $state([]);
	const activeFeatureOverlay = $derived(featureOverlayQueue[0] ?? null);
	// Features that cover the whole screen with their own scene.
	const fullscreenFeature = $derived(
		activeFeatureOverlay?.kind === 'chestPick' || activeFeatureOverlay?.kind === 'kraken',
	);

	// If the browser drops the grid's WebGL context (phones do this when GPU
	// memory runs low), rebuild the pixi app so the grid comes back instead
	// of staying invisible. The grid's state lives outside pixi, so the
	// rebuilt canvas shows exactly the same card.
	let glEpoch = $state(0);
	$effect(() => {
		let timer: ReturnType<typeof setTimeout> | undefined;
		const onLost = (e: Event) => {
			if (!(e.target instanceof HTMLCanvasElement)) return;
			e.preventDefault();
			clearTimeout(timer);
			timer = setTimeout(() => (glEpoch += 1), 250);
		};
		document.addEventListener('webglcontextlost', onLost, true);
		return () => {
			clearTimeout(timer);
			document.removeEventListener('webglcontextlost', onLost, true);
		};
	});

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
		if (activeFeatureOverlay?.kind === 'kraken') {
			krakenStage = 'numbers';
			stopSound('wheelSpin'); // never carry a reel spin into the Kraken
			playSound('splash');
			setTimeout(() => playSound('krakenRoar'), 250);
		}
	});
	const krakenRevealed = $derived(krakenStage !== 'numbers');

	function advanceFeatureOverlay() {
		playSound('click');
		featureOverlayQueue = featureOverlayQueue.slice(1);
		if (featureOverlayQueue.length === 0) finishPresentation();
	}

	// The round's result is shown in order: the card's win reveal first,
	// then any features (Shark Bite, Kraken, chests, ...), and only after
	// all of that the payout lands -- free scratches are credited (and the
	// bonus background switches) here too, so nothing gives away a feature
	// before it plays.
	let presentPending = $state(false);
	let pendingAward = 0;
	function finishPresentation() {
		if (medallionPending !== null) {
			const m = medallionPending;
			medallionPending = null;
			if (m > bonusMult) playSound('bonusCoins');
			bonusMult = m;
		}
		if (pendingAward > 0) {
			freeScratchesRemaining += pendingAward;
			awardedFreeScratches = pendingAward;
			if (!bonusActive) {
				bonusActive = true;
				bonusMult = 0;
				bonusWinSum = 0;
				bonusPlayed = 0;
				bonusSpins = pendingAward;
			} else {
				bonusSpins += pendingAward;
			}
			pendingAward = 0;
		}
		if (roundIsFree && bonusActive && freeScratchesRemaining === 0) pendingBonusSummary = true;
		if (isMockMode) {
			mockBalance = Math.round((mockBalance + totalWin) * 100) / 100;
			mockLastWin = totalWin;
		} else if (roundCards.length === 0) {
			// Round fully shown: the Win plaque shows what the round paid.
			stateBet.winBookEventAmount = Math.round(roundFinal * betAmount * 100) / 100;
			// Round fully shown: now let the SDK credit the win to the balance.
			roundPresented();
		}
		if (totalWin > 0 || awardedFreeScratches > 0) {
			showWinModal = isBigWin();
			// Bonus gets its own fanfare instead of the regular win jingle.
			playSound(awardedFreeScratches > 0 ? 'bonus' : 'win');
		}
	}

	// Kraken's own tap handler (see the stages above). Taps during the case
	// spin are ignored; the reel reports when it lands.
	function handleKrakenTap() {
		const hit = activeFeatureOverlay?.kind === 'kraken' && activeFeatureOverlay.data.hit;
		if (krakenStage === 'numbers') {
			krakenStage = 'revealed';
			if (hit) {
				playSound('krakenMatch');
			} else {
				playSound('krakenMiss');
				if (Math.random() < 0.25) setTimeout(() => playSound('pirateLaugh'), 700);
			}
		} else if (krakenStage === 'revealed') {
			if (hit) {
				krakenStage = 'case';
				playSound('krakenTreasure');
			} else {
				advanceFeatureOverlay();
			}
		} else if (krakenStage === 'landed') {
			advanceFeatureOverlay();
		}
	}

	// Autoplay: each Kraken step (reveal numbers, open the treasure reel,
	// collect) waits 1 second for a tap, then carries on by itself.
	const KRAKEN_AUTO_MS = 1000;
	$effect(() => {
		const stage = krakenStage;
		if (!autoplay || activeFeatureOverlay?.kind !== 'kraken') return;
		if (stage !== 'numbers' && stage !== 'revealed' && stage !== 'landed') return;
		const timer = setTimeout(() => {
			if (untrack(() => krakenStage) === stage) handleKrakenTap();
		}, KRAKEN_AUTO_MS);
		return () => clearTimeout(timer);
	});

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
				playSound('splash');
			} else if (sharkOutcome !== null) {
				sharkOutcome = null;
			}
		});
	});

	// The frame's skull crest sits on top of the Shark Bite bar, its hat
	// pointing into the centre window; it jumps when the roll lands.
	const CREST = { x0: 520, x1: 1016, y1: 104 };
	let crestHits = $state(0);

	let sharkLanded: SharkOutcome | null = $state(null);
	$effect(() => {
		if (sharkOutcome === null) sharkLanded = null;
	});
	// Banner shown over the grid once the Shark Bite bar lands.
	const SHARK_RESULT_ART: Record<SharkOutcome, string> = {
		kraken: resultKrakenUrl,
		octopus: resultOctopusUrl,
		pirate: resultPirateUrl,
		key: resultKeyUrl,
		bonus: resultBonusUrl,
	};
	const SHARK_OUTCOME_LABEL: Record<SharkOutcome, string> = {
		kraken: 'Kraken!',
		octopus: 'Octopus — 3 bonus cards!',
		pirate: 'Pirate — plunders the top prize!',
		key: 'Key — treasure chests!',
		bonus: 'Bonus — free scratches!',
	};

	function handleSharkLanded(outcome: SharkOutcome) {
		crestHits += 1;
		sharkLanded = outcome;
		clearTimeout(featureTimer);
		// Let the landed icon + label sit for a beat.
		featureTimer = setTimeout(advanceFeatureOverlay, 1600);
	}

	// --- Pirate: plunders the top multiplier on the card ------------------
	// Banner in the Shark Bite tube for a moment, then moves on.
	$effect(() => {
		const active = activeFeatureOverlay;
		if (active?.kind !== 'pirate') return;
		untrack(() => {
			playSound('jackpot');
			clearTimeout(featureTimer);
			featureTimer = setTimeout(advanceFeatureOverlay, 2800);
		});
	});

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
			playSound('octopus');
			clearTimeout(featureTimer);
			featureTimer = setTimeout(() => dealOctoCard(0), 1800);
		});
	});

	function dealOctoCard(i: number) {
		octoIndex = i;
		octoCardDone = false;
		winningSymbols = [];
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
			winningSymbols = findWinningSymbols(card.panels);
			// During free scratches each Octopus card's win feeds the bonus
			// multiplier straight away, so the medallion ticks up live (the
			// exact book total is set again when the feature finishes).
			if (bonusActive && roundIsFree && card.win > 0 && betAmount > 0) {
				bonusMult = Math.round((bonusMult + card.win / betAmount) * 100) / 100;
				playSound('bonusCoins');
			}
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



	// Win pop-up thresholds, as multiples of the bet. Only wins of at least
	// "big" get a pop-up (smaller wins just show in the Win plaque with the
	// win sound); the tiers above it escalate the art. Hitting the mode's
	// max win gets the MAX WIN banner.
	type WinTier = 'nice' | 'big' | 'mega' | 'epic' | 'max';
	const WIN_TIER_ART: Record<WinTier, string> = {
		nice: niceWinUrl,
		big: bigWinUrl,
		mega: wsChatUrl, // "W's in the chat"
		epic: epicWinUrl,
		max: maxWinUrl,
	};
	const WIN_TIERS: Record<string, { nice: number; big: number; mega: number; epic: number }> = {
		easy: { nice: 9, big: 16, mega: 27, epic: 45 },
		medium: { nice: 20, big: 41, mega: 110, epic: 300 },
		hard: { nice: 40, big: 130, mega: 400, epic: 1000 },
	};

	function isBigWin(): boolean {
		if (awardedFreeScratches > 0) return true;
		return betAmount > 0 && totalWin / betAmount >= WIN_TIERS[betMode].nice;
	}

	const winTier = $derived.by((): WinTier | null => {
		if (totalWin <= 0 || betAmount <= 0) return null;
		const x = totalWin / betAmount;
		const t = WIN_TIERS[betMode];
		if (x >= config.betModes[betMode].max_win - 1e-9) return 'max';
		if (x >= t.epic) return 'epic';
		if (x >= t.mega) return 'mega';
		if (x >= t.big) return 'big';
		if (x >= t.nice) return 'nice';
		return null;
	});

	// Count the amount up when the pop-up opens (cannon boom for Big+).
	let shownWin = $state(0);
	$effect(() => {
		if (!showWinModal) return;
		if (untrack(() => winTier !== null && awardedFreeScratches === 0)) {
			playSound('cannon');
			const tier = untrack(() => winTier);
			setTimeout(() => playSound(tier === 'nice' || tier === 'big' ? 'pirateCheer' : 'tavern'), 450);
			if (tier === 'max') setTimeout(() => playSound('krakenRoar'), 150);
		}
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
	// Awarded free scratches play back to back automatically. A winning free
	// card adds its multiplier to the bonus multiplier on the medallion over
	// the anchor, and pays bet x that whole multiplier (x10 so far + a x2
	// card -> pays x12; next x2 -> pays x14, ...). The book carries the
	// multiplier (bonusMultiplier event); a summary shows the total at the
	// end.
	let bonusActive = $state(false);
	let bonusMult = $state(0);
	let bonusPlayed = $state(0);
	let bonusSpins = $state(0);
	let pendingBonusSummary = $state(false);
	let showBonusSummary = $state(false);
	let roundIsFree = false;
	let winAnimUntil = 0;
	let medallionPending: number | null = null;
	let bonusWinSum = $state(0);
	// Arrives with the book; shown once the card is scratched.
	let pendingBonusMult: number | null = null;
	const fmtMult = (m: number) => `x${+m.toFixed(2)}`;
	// Shrink a line of baked-style text so it fits its slot in the art:
	// `base` cqw for short strings, scaled down once it's longer than `fit`.
	const fitText = (text: string, base: number, fit: number) =>
		`font-size:${(base * Math.min(1, fit / Math.max(1, text.length))).toFixed(2)}cqw;`;

	// Match banner names ("3 CRABS MATCH x2").
	const MATCH_NAME: Partial<Record<SymbolName, string>> = {
		mult1_5: 'Pistols', mult2: 'Crabs', mult4: 'Barrels', mult5: 'Parrots', mult6: 'Cutlasses',
		mult9: 'Wheels', mult16: 'Spyglasses', mult36: 'Anchors', mult41: 'Maps', mult45: 'Flags',
		mult110: 'Crowns', mult130: 'Gold Bars', mult1000: 'Hoards', mult2500: 'Leviathans',
	};

	// Summary once nothing else is on screen.
	$effect(() => {
		if (pendingBonusSummary && featureOverlayQueue.length === 0 && !showWinModal) {
			untrack(() => {
				pendingBonusSummary = false;
				showBonusSummary = true;
				playSound('bonusComplete');
				setTimeout(() => playSound('tavern'), 1500);
			});
		}
	});

	// Bonus soundtrack while the bonus runs, main theme otherwise; tropical
	// birds as the island fades in.
	let wasBonus = false;
	$effect(() => {
		setMusicTrack(bonusActive ? bonusMusicUrl : musicUrl);
		setBeachMode(bonusActive);
		if (bonusActive && !wasBonus) playSound('tropicalBirds');
		wasBonus = bonusActive;
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
			presentPending ||
			featureOverlayQueue.length > 0 ||
			showWinModal ||
			showBonusSummary
		)
			return;
		const wait = Math.max(1100, winAnimUntil - performance.now() + 1300);
		const t = setTimeout(() => playGame(), wait);
		return () => clearTimeout(t);
	});

	// Win tally pills over the grid: one per winning symbol, appearing as
	// its 3rd matching tile ticks in (green "3 match"), turning gold and
	// bumping for each extra -- in step with the tiles (see winTiming.ts).
	type TallyPill = { name: SymbolName; value: number; step: number };
	let tallies: TallyPill[] = $state([]);
	$effect(() => {
		const winners = winningSymbols;
		const panels = context.stateGame.panels;
		const mode = betMode;
		tallies = [];
		if (winners.length === 0) return;
		const { segments } = buildWinSchedule(panels, winners, mode);
		const timers: ReturnType<typeof setTimeout>[] = [];
		const setPill = (pill: TallyPill) => {
			const rest = tallies.filter((p) => p.name !== pill.name);
			const order = segments.map((g) => g.symbol);
			tallies = [...rest, pill].sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
		};
		for (const seg of segments) {
			timers.push(
				setTimeout(() => {
					setPill({ name: seg.symbol, value: seg.mult, step: 0 });
					// The crab scuttles off with its win.
					if (seg.symbol === 'mult2') playSound('crab');
				}, seg.showAt),
			);
			for (const b of seg.bumps) {
				timers.push(setTimeout(() => setPill({ name: seg.symbol, value: b.value, step: b.step }), b.at));
			}
		}
		return () => timers.forEach(clearTimeout);
	});

	// Whole grid of skulls: a "Cursed!" consolation pill once revealed.
	let skullGrid = $state(false);
	$effect(() => {
		const { panels, revealed } = context.stateGame;
		const done = panels.length > 0 && revealed.size >= panels.length;
		const all = done && panels.every((p) => p?.name === 'skull');
		untrack(() => {
			if (all && !skullGrid) playSound('pirateLaugh');
			skullGrid = all;
		});
	});

	// --- Autoplay (the circular-arrows button) ---------------------------
	// Plays card after card on its own: deals, reveals everything, waits
	// for the win reveal and any features to finish, then goes again.
	// Big-win pop-ups close by themselves; features that need a choice
	// (Kraken taps, chest pick) still wait for the player. Stops when the
	// balance can't cover the bet, or when tapped again.
	let autoplay = $state(false);
	// Some jurisdictions forbid autoplay (Stake sends this on authenticate):
	// then the circular-arrows button is a plain "reveal all" instead.
	const autoplayAllowed = $derived(!stateConfig.jurisdiction?.disabledAutoplay);
	$effect(() => {
		if (!autoplayAllowed) autoplay = false;
	});
	function toggleAutoplay() {
		autoplay = !autoplay;
		playSound('click');
	}
	// Deal the next card when everything is idle.
	$effect(() => {
		if (
			!autoplay ||
			viewState === 'playing' ||
			isProcessing ||
			presentPending ||
			featureOverlayQueue.length > 0 ||
			showWinModal ||
			showBonusSummary ||
			freeScratchesRemaining > 0 // the bonus deals itself
		)
			return;
		if (isMockMode && mockBalance < betAmount) {
			autoplay = false;
			return;
		}
		const t = setTimeout(() => playGame(), 900);
		return () => clearTimeout(t);
	});
	// Reveal the card (and Octopus bonus cards) automatically.
	// (Keyed on the panel count: with a real bet the card arrives from the
	// server a moment after the deal, so it waits for it instead of firing
	// once on an empty grid.)
	$effect(() => {
		const n = context.stateGame.panels.length;
		if (!autoplay || !(viewState === 'playing' || octoScratching) || n === 0) return;
		const t = setTimeout(() => revealEverything(), 500);
		return () => clearTimeout(t);
	});
	// Close win / bonus pop-ups after a moment.
	$effect(() => {
		if (!autoplay || !(showWinModal || showBonusSummary)) return;
		const t = setTimeout(() => {
			if (showBonusSummary) closeBonusSummary();
			else showWinModal = false;
		}, 3200);
		return () => clearTimeout(t);
	});

	// --- Loading screen ------------------------------------------------
	// Logo + rope progress bar on the harbor until the art, fonts and a
	// minimum beat are ready, then "Tap to set sail" (that tap also unlocks
	// audio and starts the music).
	let loaderVisible = $state(true);
	let loaderProgress = $state(0);
	let fontsReady = $state(false);
	$effect(() => {
		document.fonts?.ready.then(() => (fontsReady = true)).catch(() => (fontsReady = true));
		const start = performance.now();
		let raf = 0;
		const tick = () => {
			const t = (performance.now() - start) / 1600;
			// (8s safety net so a slow/failed asset never traps the player here)
			const done = (context.stateApp.loaded && fontsReady && t >= 1) || t >= 5;
			loaderProgress = done ? 1 : Math.min(0.92, t * 0.92);
			if (!done) raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	});
	function startGame() {
		if (loaderProgress < 1) return;
		loaderVisible = false;
		startMusic(musicUrl);
		playSound('scatterLand');
	}

	// Bonus scatters: a chime that climbs with each one revealed (1st, 2nd,
	// 3rd...), like a slot's scatter build-up.
	let bonusSeen = 0;
	$effect(() => {
		const { panels, revealed } = context.stateGame;
		let n = 0;
		for (const i of revealed) if (panels[i]?.name === 'bonus') n += 1;
		if (n > bonusSeen) playSound('bonusLand', 1 + 0.08 * (n - 1));
		bonusSeen = n;
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

	// Bet ladder: 0.25 steps to 2, 0.5 to 5, 1 to 15, 5 to 50, 10 to 200,
	// 50 to 1000. The -/+ buttons move one rung.
	const BET_LADDER: number[] = (() => {
		const bands: Array<[upTo: number, step: number]> = [
			[2, 0.25],
			[5, 0.5],
			[15, 1],
			[50, 5],
			[200, 10],
			[1000, 50],
		];
		const out = [0.25];
		for (const [upTo, step] of bands) {
			let v = out[out.length - 1];
			while (v + step <= upTo + 1e-9) {
				v = Math.round((v + step) * 100) / 100;
				out.push(v);
			}
		}
		return out;
	})();

	// Cycle through 4 volume steps on each tap (mute / low / mid / full)
	// instead of a plain on-off mute — "max" alone was still too quiet, so
	// this also doubles as the way to actually turn it up.
	const VOLUME_LEVELS = [0, 0.4, 0.7, 1];
	let volumeLevel = $state(VOLUME_LEVELS.length - 1);

	// Music has its own volume knob, same 4 steps as the effects.
	let musicLevel = $state(VOLUME_LEVELS.length - 1);
	const musicOn = $derived(musicLevel > 0);
	function cycleMusic() {
		musicLevel = (musicLevel + 1) % VOLUME_LEVELS.length;
		setMusicVolume(VOLUME_LEVELS[musicLevel]);
		playSound('click');
	}
	function cycleVolume() {
		volumeLevel = (volumeLevel + 1) % VOLUME_LEVELS.length;
		setVolume(VOLUME_LEVELS[volumeLevel]);
		if (VOLUME_LEVELS[volumeLevel] > 0) playSound('click');
	}

	// Step one rung up/down the ladder; in demo mode never above the balance.
	function stepBet(dir: 1 | -1) {
		const i = BET_LADDER.findIndex((v) => v >= betAmount - 1e-9);
		const cur = i === -1 ? BET_LADDER.length - 1 : i;
		let next = Math.min(BET_LADDER.length - 1, Math.max(0, cur + dir));
		const cap = isMockMode ? displayBalance : Infinity;
		while (next > 0 && BET_LADDER[next] > cap) next -= 1;
		betAmount = BET_LADDER[next];
		playSound('click');
	}


	function selectMode(mode: BetMode) {
		if (mode === betMode || freeScratchesRemaining > 0) return;
		betMode = mode;
		playSound('modeSwitch');
		// Clear the previous round's panels — otherwise the last mode's
		// (wrong-sized, wrong-symbol-set) grid stays on screen, stale, until
		// the next bet is placed. The difficulty buttons are disabled while
		// viewState === 'playing' so this never interrupts a live round.
		viewState = 'start';
		totalWin = 0;
		showWinModal = false;
		winningSymbols = [];
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
	const FRAME_TUCK = 55; // frame source px under the bar: the skull's hat pokes into the centre window
	const BAR_H_PER_S = (VIEW_W * (BAR_RIM_Y - SHARK_BAR.y0)) / SHARK_BAR.w - FRAME_TUCK;
	const STACK_H_PER_S = BAR_H_PER_S + contentH;
	const MAX_SCALE = 1;
	// Narrow mode: logo + ribbon + tabs band above the bar.
	const NARROW_HEADER_H = 178;
	const MODE_SIGN_URL: Record<string, string> = { easy: modeEasyUrl, medium: modeMediumUrl, hard: modeHardUrl };
	const SIDE_MIN = 190;

	const wideScale = $derived(Math.min(vw / VIEW_W, (vh - 8) / STACK_H_PER_S, MAX_SCALE));
	const wide = $derived((vw - VIEW_W * wideScale) / 2 >= SIDE_MIN);
	// Phones (portrait): bigger logo + max-win sign on top, bar + frame
	// filling the middle, mode signs under the frame.
	const mobile = $derived(!wide && vh > vw * 1.25);
	const MOBILE_TOP_H = 112;
	const MOBILE_BOTTOM_H = 50;
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
	const sharkTop = $derived(wide ? Math.max(2, (vh - stackH) / 2) : mobile ? MOBILE_TOP_H : NARROW_HEADER_H);
	// Side column width for the logo + tabs in wide mode.
	const sideW = $derived(Math.min(280, (vw - sharkBarW) / 2 - 24));
	const frameLeft = $derived(vw / 2 - (FRAME.w / 2) * frameScale);
	const frameTop = $derived(sharkTop + sharkBarH - FRAME.contentY0 * frameScale);
	// Phones (portrait): the frame is width-limited, so its window ends up
	// short and wide with tiny tiles. Use the spare screen height to make
	// the frame TALLER: it's cut at FRAME_CUT.y1..y2 and the gap is filled by
	// repeating a band of the rope-wrapped pillars (frame_band.webp), so the
	// window grows and the grid stacks 3 wide with much bigger tiles. Desktop
	// is untouched (stretch 0).
	const FRAME_CUT = { y1: 330, y2: 600, band: 120 }; // source px
	const frameStretch = $derived(
		mobile
			? Math.min(1400, Math.max(0, (vh - MOBILE_BOTTOM_H - (sharkTop + sharkBarH) - 4) / frameScale - FRAME.contentY1))
			: 0,
	);
	const frameH = $derived(FRAME.h + frameStretch); // frame height in source px incl. stretch

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
		bottom: vh - (frameTop + (FRAME.win.y1 + frameStretch) * frameScale),
		left: frameLeft + FRAME.win.x0 * frameScale,
		right: vw - (frameLeft + FRAME.win.x1 * frameScale),
	});

	// "The Kraken Rises" panel art (1672x941) fitted inside the frame window,
	// plus where its two number plaques sit, in panel fractions.
	const KRAKEN_PANEL = { w: 1672, h: 941, player: { x: 543, y: 632 }, kraken: { x: 1122, y: 632 } };
	// The Kraken feature takes over the whole screen: panel fitted to the
	// viewport (with some breathing room), reel as wide as fits.
	const krakenPanel = $derived.by(() => {
		const w = Math.min(vw * 0.94, (vh * 0.72 * KRAKEN_PANEL.w) / KRAKEN_PANEL.h, 1150);
		return { w, h: (w * KRAKEN_PANEL.h) / KRAKEN_PANEL.w };
	});
	const krakenReelW = $derived(Math.min(vw * 0.97, 1350));
	const plaqueAt = (p: { x: number; y: number }) =>
		`left:${(p.x / KRAKEN_PANEL.w) * 100}%;top:${(p.y / KRAKEN_PANEL.h) * 100}%;`;

	// Absolutely position an overlay (hit area / text) on the frame art by
	// its center + size in source-image pixels.
	// (Anything below the stretch cut moves down by the stretch.)
	// Amounts in the player's currency; long ones shrink to fit the plaque.
	const valueFit = (v: number) => {
		const len = money(v).length;
		return len <= 9 ? '' : `font-size:${(0.66 * 9) / len}em;`;
	};

	const at = (cx: number, cy: number, w: number, h: number) => {
		const y = cy > FRAME_CUT.y2 ? cy + frameStretch : cy;
		return (
			`left:${((cx - w / 2) / FRAME.w) * 100}%;top:${((y - h / 2) / frameH) * 100}%;` +
			`width:${(w / FRAME.w) * 100}%;height:${(h / frameH) * 100}%;`
		);
	};

	// Difficulty and bet amount lock while a round is live AND while free
	// scratches are owed — a free scratch replays at whatever mode/bet
	// triggered it, so they have to be used up before either can change.
	const locked = $derived(
		viewState === 'playing' || presentPending || freeScratchesRemaining > 0 || featureOverlayQueue.length > 0,
	);

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
		if (isProcessing || presentPending || featureOverlayQueue.length > 0) return;
		const isFreeRound = freeScratchesRemaining > 0;
		roundIsFree = isFreeRound;
		pendingBonusMult = null;
		if (!isFreeRound && isMockMode && mockBalance < betAmount) return;

		playSound('click');
		isProcessing = true;
		viewState = 'playing';
		totalWin = 0;
		showWinModal = false;
		winningSymbols = [];
		pendingWin = null;
		pendingFreeScratches = 0;
		awardedFreeScratches = 0;
		pendingFeatureEvents = [];
		featureOverlayQueue = [];
		clearTimeout(featureTimer);
		context.stateGameDerived.reset();

		stateBet.activeBetModeKey = betMode;
		stateBet.betAmount = betAmount;

		// Free scratches are already in this round's book: deal the next card.
		if (isFreeRound) {
			playSound('scatterLand'); // ship's bell marks each free scratch
			freeScratchesRemaining -= 1;
			playNextCard();
			return;
		}

		if (isMockMode) {
			mockBalance = Math.round((mockBalance - betAmount) * 100) / 100;
			startRound(createMockRound(betMode).events);
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
			// Each tile gets its scratch + its own reveal sound (Cell plays
			// the reveal), like scratching it by hand.
			setTimeout(() => {
				playSound('scratch');
				context.stateGameDerived.reveal(i);
			}, delay);
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
			if (roundIsFree) {
				bonusPlayed += 1;
				bonusWinSum += totalWin;
				// Let this card's whole win reveal (3-match + every extra) play
				// before the medallion updates and before the next free card is
				// dealt -- otherwise the extras get cut off.
				const animMs = buildWinSchedule(panels, findWinningSymbols(panels), betMode).total;
				winAnimUntil = performance.now() + animMs;
				// The book's multiplier already includes this card's features
				// (Kraken, Shark Bite outcomes, chests, ...); the medallion
				// updates once those have all played (finishPresentation).
				medallionPending = pendingBonusMult;
			}
			if (totalWin > 0) {
				// Re-derive which symbol actually won by scanning the resolved
				// panels for the first paying symbol to reach 3 occurrences —
				// the same rule the book itself resolves by. (Matching
				// totalWin back against a paytable entry instead would be
				// ambiguous: several ids are shared across difficulties, e.g.
				// mult2 is "2x" in every mode, so a win amount alone can't
				// tell you which actual symbol hit.)
				winningSymbols = findWinningSymbols(panels);
			}
			// Features (Kraken, Shark Bite, chests, ...) and the payout wait
			// until the card's own win reveal has finished playing.
			const events = pendingFeatureEvents;
			pendingAward = pendingFreeScratches;
			const animMs =
				winningSymbols.length > 0
					? buildWinSchedule(panels, winningSymbols, betMode).total + 1600
					: 0;
			presentPending = true;
			setTimeout(() => {
				presentPending = false;
				featureOverlayQueue = events;
				if (events.length === 0) finishPresentation();
			}, animMs);
		}
	});

	context.eventEmitter.subscribeOnMount({
		chestSequence: ({ data }: { data: BookEventOfType<'chestSequence'> }) => {
			pendingFeatureEvents = [...pendingFeatureEvents, { kind: 'chest', data: data.chests }];
		},
		krakenResult: ({ data }: { data: BookEventOfType<'krakenResult'> }) => {
			pendingFeatureEvents = [...pendingFeatureEvents, { kind: 'kraken', data }];
		},
		sharkBite: ({ data }: { data: BookEventOfType<'sharkBite'> }) => {
			pendingFeatureEvents = [...pendingFeatureEvents, { kind: 'shark', data: data.outcome }];
		},
		roundBook: ({ data }: { data: BookEvent[] }) => {
			startRound(data);
		},
		freeScratchesAwarded: ({ data }: { data: BookEventOfType<'freeScratchesAwarded'> }) => {
			pendingFreeScratches += data.count;
		},
		bonusMultiplier: ({ data }: { data: BookEventOfType<'bonusMultiplier'> }) => {
			pendingBonusMult = data.total;
		},
		pirateBounty: ({ data }: { data: BookEventOfType<'pirateBounty'> }) => {
			pendingFeatureEvents = [...pendingFeatureEvents, { kind: 'pirate', data }];
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
<!-- Animated backgrounds are looping animated WebP images, not <video>:
     Stake's hosting blocks inlined media in <video>/<audio> but allows
     images. -->
<!-- Still poster underneath, so nothing ever flashes black while an
     animated background decodes. The harbour loop stays mounted; the
     bonus cove is only in the page while the bonus runs (memory). -->
<div class="bg-poster" style={`background-image:url(${bgPosterUrl});`} aria-hidden="true"></div>
<img class="bg-video" src={bgAnimUrl} alt="" aria-hidden="true" draggable="false" />
{#if bonusActive}
	<img class="bonus-bg on" src={bonusAnimUrl} alt="" aria-hidden="true" draggable="false" />
{/if}
<!-- Sunken ruins while the Octopus bonus cards play. -->
<div class="octo-bg" class:on={octoActive} style={`background-image:url(${octopusBgUrl});`} aria-hidden="true"></div>
<div class="bg-dim" aria-hidden="true"></div>

<EnableGameActor />
<div class="pixi-layer">
	{#key glEpoch}
	<App>
		<Ticket
			{betMode}
			top={gridRect.top}
			bottom={gridRect.bottom}
			left={gridRect.left}
			right={gridRect.right}
			frameless
			interactive={viewState === 'playing' || octoScratching}
			{winningSymbols}
			onRevealIndex={revealPanel}
		/>
	</App>
	{/key}
</div>

<!-- Illustrated frame: the art itself plus invisible hit areas / text laid
     over its baked-in controls (bet -/+ and readout, balance/win plaque,
     anchor = play / reveal all, refresh = reveal all, menu = paytable). The
     window is transparent, so the pixi grid underneath shows through. -->
<div
	class="frame-layer"
	style={`left:${frameLeft}px;top:${frameTop}px;width:${FRAME.w * frameScale}px;height:${frameH * frameScale}px;font-size:${Math.max(13, frameScale * 44)}px;`}
>
	{#if frameStretch > 0}
		<!-- top part / repeating pillar band / bottom part -->
		{@const W = FRAME.w * frameScale}
		<div
			class="frame-part"
			style={`top:0;height:${FRAME_CUT.y1 * frameScale}px;background-image:url(${frameUrl});background-size:${W}px ${FRAME.h * frameScale}px;background-position:0 0;`}
		></div>
		<div
			class="frame-part"
			style={`top:${FRAME_CUT.y1 * frameScale}px;height:${(FRAME_CUT.y2 - FRAME_CUT.y1 + frameStretch) * frameScale}px;background-image:url(${frameBandUrl});background-size:${W}px ${FRAME_CUT.band * frameScale}px;background-repeat:repeat-y;`}
		></div>
		<div
			class="frame-part"
			style={`top:${(FRAME_CUT.y2 + frameStretch) * frameScale}px;height:${(FRAME.h - FRAME_CUT.y2) * frameScale}px;background-image:url(${frameUrl});background-size:${W}px ${FRAME.h * frameScale}px;background-position:0 ${-FRAME_CUT.y2 * frameScale}px;`}
		></div>
	{:else}
		<img class="frame-img" src={frameUrl} alt="" draggable="false" />
	{/if}

	<button
		class="frame-btn"
		style={at(222, 880, 88, 88)}
		disabled={locked}
		aria-label="Decrease bet"
		onclick={() => stepBet(-1)}
	></button>
	<div class="frame-text frame-bet" style={at(356, 884, 172, 76)}>
		<span class="frame-label">Bet</span>
		<span class="frame-value" style={valueFit(betAmount)}>{money(betAmount)}</span>
	</div>
	<button
		class="frame-btn"
		style={at(490, 878, 88, 88)}
		disabled={locked}
		aria-label="Increase bet"
		onclick={() => stepBet(1)}
	></button>

	<div class="frame-text frame-plaque" style={at(768, 818, 290, 104)}>
		<div class="frame-plaque-row">
			<span class="frame-label">Balance</span>
			<span class="frame-value" style={valueFit(displayBalance)}>{money(displayBalance)}</span>
		</div>
		<div class="frame-plaque-row">
			<span class="frame-label">Win</span>
			<span class="frame-value win" style={valueFit(displayLastWin)}>{money(displayLastWin)}</span>
		</div>
	</div>

	<button
		class="frame-btn frame-btn--anchor"
		class:ready={(viewState !== 'playing' && !isProcessing && !presentPending && freeScratchesRemaining === 0 && featureOverlayQueue.length === 0) || octoScratching}
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
		class="frame-btn frame-btn--auto"
		class:auto-on={autoplay}
		style={at(1210, 875, 100, 100)}
		aria-label={!autoplayAllowed ? 'Reveal all' : autoplay ? 'Stop autoplay' : 'Start autoplay'}
		aria-pressed={autoplayAllowed ? autoplay : undefined}
		onclick={() => {
			if (autoplayAllowed) toggleAutoplay();
			else if (viewState === 'playing' || octoScratching) revealEverything();
		}}
	>
		{#if autoplay}<span class="auto-badge">AUTO</span>{/if}
	</button>
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
		class:mobile
		style={wide ? `width:${sideW}px;top:${Math.max(10, sharkTop)}px;` : `height:${mobile ? MOBILE_TOP_H : NARROW_HEADER_H}px;`}
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
		{#if !mobile}{@render modeSigns()}{/if}
	</header>

	{#snippet modeSigns()}
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
	{/snippet}

	{#if mobile}
		<!-- Phones: mode signs under the frame -->
		<div class="mode-signs-bottom" style={`top:${frameTop + (FRAME.contentY1 + frameStretch) * frameScale + 2}px;`}>
			{@render modeSigns()}
		</div>
	{/if}

	<div class="sound-group">
		<button
			class="sound-toggle music-toggle"
			class:off={!musicOn}
			onclick={cycleMusic}
			aria-label="Change music volume"
		>
			<img src={btnMusicUrl} alt="" draggable="false" />
			{#if !musicOn}<span class="sound-toggle-slash" aria-hidden="true"></span>{/if}
			<span class="sound-pips" aria-hidden="true">
				{#each [1, 2, 3] as l (l)}<i class:on={musicLevel >= l}></i>{/each}
			</span>
		</button>
		<button class="sound-toggle" class:off={volumeLevel === 0} onclick={cycleVolume} aria-label="Change effects volume">
			<img src={btnSoundUrl} alt="" draggable="false" />
			{#if volumeLevel === 0}<span class="sound-toggle-slash" aria-hidden="true"></span>{/if}
			<span class="sound-pips" aria-hidden="true">
				{#each [1, 2, 3] as l (l)}<i class:on={volumeLevel >= l}></i>{/each}
			</span>
		</button>
	</div>

	<!-- SHARK BITE bar: same width as the frame, sitting right on top of it -->
	<div class="shark-bar-slot" class:away={octoActive} style={`top:${sharkTop}px;`}>
		<SharkBiteBar width={sharkBarW} rollId={sharkRollId} outcome={sharkOutcome} onLanded={handleSharkLanded} />
	</div>

	<!-- Skull crest of the frame, drawn over the Shark Bite bar as its pointer -->
	<div
		class="frame-crest"
		style={`left:${frameLeft + CREST.x0 * frameScale}px;top:${frameTop}px;width:${(CREST.x1 - CREST.x0) * frameScale}px;height:${CREST.y1 * frameScale}px;`}
	>
		<img src={frameCrestUrl} alt="" draggable="false" />
	</div>

	{#if sharkLanded}
		<!-- What Shark Bite landed on: over the top of the card, in front of
		     the frame and its crest. -->
		<div class="shark-result-slot" style={`top:${gridRect.top + 6}px;left:${gridRect.left}px;right:${gridRect.right}px;`}>
			<div class="shark-result-banner">
				<img src={SHARK_RESULT_ART[sharkLanded]} alt={SHARK_OUTCOME_LABEL[sharkLanded]} draggable="false" />
				<Sparkles count={8} coins={6} spread={40} loop={false} />
			</div>
		</div>
	{/if}

	{#if octoActive}
		<!-- Octopus bonus: its own banner takes the Shark Bite bar's place (same
		     size and spot); the live text sits in the banner's red plaque. -->
		<!-- Smaller than the Shark Bite bar (its art is much taller), lifted so
		     its plaque ends just above the frame's skull hat (fully visible). -->
		{@const k = sharkBarW / 1983}
		{@const ow = sharkBarW * 0.88}
		{@const k2 = ow / 1983}
		<div
			class="octo-bar"
			style={`left:${vw / 2 - ow / 2}px;top:${frameTop + 12 * frameScale - 4 - 706 * k2}px;width:${ow}px;height:${793 * k2}px;`}
		>
			<img src={octopusBarUrl} alt="Octopus Bonus" draggable="false" />
			<div
				class="octo-bar-text"
				style={`left:${(628 / 1983) * 100}%;right:${((1983 - 1614) / 1983) * 100}%;top:${(518 / 793) * 100}%;bottom:${((793 - 690) / 793) * 100}%;font-size:${Math.max(9, 54 * k2)}px;`}
			>
				{#if octoIndex < 0}
					<div class="octo-bar-title">3 Bonus Cards!</div>
					<div class="octo-bar-sub">Every win adds up</div>
				{:else}
					<div class="octo-bar-title">Bonus card {octoIndex + 1}/{octoCards.length}</div>
					<div class="octo-bar-sub">
						{#if octoCardDone}
							{octoCards[octoIndex].win > 0 ? `+${money(octoCards[octoIndex].win)}` : 'No win'}
						{:else}
							Scratch it!
						{/if}
						<span class="octo-bar-dot">•</span> Bonus total: <span class="octo-bar-total">{money(octoWinSum)}</span>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

{#snippet matchBar(icon: string, label: string, value: string, tone: 'match' | 'extra' | 'cursed', bumped: boolean)}
	<div class={`match-bar match-bar--${tone}`}>
		<img class="match-bar-art" src={tone === 'extra' ? matchBarGoldUrl : tone === 'cursed' ? matchBarRedUrl : matchBarUrl} alt="" draggable="false" />
		<div class="shine"></div>
		<img class="match-bar-icon" src={icon} alt="" draggable="false" />
		<Sparkles count={tone === 'match' ? 5 : 9} coins={tone === 'extra' ? 8 : 0} spread={40} color={tone === 'cursed' ? '#ff8a7a' : '#ffe9a0'} />
		<div class="match-bar-text">
			<span class="match-bar-label" style={fitText(label, 4.2, 13)}>{label}</span>
			{#key value}
				<span class="match-bar-value" class:bumped style={fitText(value, 7.4, 4)}>{value}</span>
			{/key}
		</div>
	</div>
{/snippet}

{#if bonusActive}
	<!-- Bonus multiplier medallion: top right, just the big multiplier
	     (the sign under the logo already counts the free scratches). -->
	<div class="bonus-medallion" class:mobile>
		<img class="bonus-medallion-art" src={medallionUrl} alt="" draggable="false" />
		{#key bonusMult}
			<Sparkles count={8} coins={bonusMult > 0 ? 10 : 0} spread={45} loop={false} />
		{/key}
		<div class="bonus-medallion-mult-slot">
			{#key bonusMult}
				{@const mt = fmtMult(bonusMult)}
				<span class="bonus-medallion-mult" style={fitText(mt, 34, 3)}>{mt}</span>
			{/key}
		</div>
	</div>
{/if}

{#if skullGrid && featureOverlayQueue.length === 0}
	<div class="win-tally" style={`top:${gridRect.top + 4}px;left:${gridRect.left}px;right:${gridRect.right}px;`}>
		{@render matchBar(SYMBOL_IMAGE_URL.skull, 'Cursed! Skull grid', `+${SKULL_GRID_PRIZE[betMode]}x`, 'cursed', false)}
	</div>
{/if}

{#if tallies.length > 0 && featureOverlayQueue.length === 0}
	<!-- Win tally: one banner per winning symbol ("3 CRABS MATCH x2"); it
	     turns gold and counts up as extra copies land ("5 CRABS MATCH x2.5") -->
	<div class="win-tally" style={`top:${gridRect.top + 4}px;left:${gridRect.left}px;right:${gridRect.right}px;`}>
		{#each tallies as t (t.name)}
			{@render matchBar(
				SYMBOL_IMAGE_URL[t.name],
				`${3 + t.step} ${MATCH_NAME[t.name] ?? SYMBOL_LABEL[t.name]} match`,
				`x${t.value}`,
				t.step > 0 ? 'extra' : 'match',
				t.step > 0,
			)}
		{/each}
	</div>
{/if}

{#if activeFeatureOverlay?.kind === 'pirate'}
	{@const pb = activeFeatureOverlay.data}
	<div
		class="octo-banner pirate-banner"
		style={`top:${sharkTube.top}px;left:${sharkTube.left}px;width:${sharkTube.width}px;height:${sharkTube.height}px;font-size:${Math.max(10, sharkTube.height * 0.2)}px;`}
	>
		<img class="octo-banner-icon" src={pirateIconUrl} alt="" />
		<div class="octo-banner-text">
			<div class="octo-banner-title">The Pirate plunders!</div>
			<div class="octo-banner-sub">{SYMBOL_LABEL[pb.symbol]} · x{pb.multiplier} · +{money(pb.amount)}</div>
		</div>
		<img class="octo-banner-icon pirate-loot" src={SYMBOL_IMAGE_URL[pb.symbol]} alt="" />
	</div>
{/if}

{#if showPaytable}
	<RulesModal {betMode} onClose={togglePaytable} />
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
		<!-- Animated storm scene (the still is the poster / fallback) -->
		<img class="kraken-scene-video" src={krakenAnimUrl} alt="" aria-hidden="true" draggable="false" />
		<div class="kraken-scene-vignette" aria-hidden="true"></div>
		{#if krakenStage === 'case' || krakenStage === 'landed'}
			<div class="kraken-case" style={`width:${krakenReelW}px;`}>
				<img class="kraken-case-banner" src={krakensTreasureUrl} alt="The Kraken's Treasure" draggable="false" />
				<!-- Phones: the reel is zoomed in (sides of the frame cropped) so
				     the rolling tiles and the prize are big enough to read. -->
				<div class="case-reel-zoom" style={`--reel-zoom:${mobile ? 1.75 : 1};`}>
					<div class="case-reel-zoom-inner">
						<CaseReel {betMode} mult={k.multiplier} onLanded={() => (krakenStage = 'landed')} />
					</div>
				</div>
				{#if krakenStage === 'landed'}
					<div class="kraken-result kraken-result-hit">×{k.multiplier} &mdash; +{money(k.amount)}</div>
					<img class="tap-continue" src={tapContinueUrl} alt="Tap to continue" draggable="false" />
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
						{#if k.hit}<div class="kraken-card-hint">Tap to open the Kraken's treasure</div>{:else}<img class="tap-continue" src={tapContinueUrl} alt="Tap to continue" draggable="false" />{/if}
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
							+{money(chest.value)}
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
			<img class="tap-continue" src={tapContinueUrl} alt="Tap to continue" draggable="false" />
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
				<Sparkles count={18} coins={14} spread={60} />
				{#if awardedFreeScratches !== 10}
					<div class="bigwin-mult">+{awardedFreeScratches} Free Scratches</div>
				{/if}
				{#if totalWin > 0}
					<div class="bigwin-mult">+{money(totalWin)} this card</div>
				{/if}
				<div class="win-modal-hint">Tap to start the bonus</div>
			</div>
		{:else if winTier}
			<div class={`bigwin bigwin--${winTier}`}>
				<div class="bigwin-rays"></div>
				<img class="bigwin-art" src={WIN_TIER_ART[winTier]} alt={`${winTier} win`} draggable="false" />
				<Sparkles count={winTier === 'max' ? 28 : 18} coins={winTier === 'nice' ? 6 : winTier === 'big' ? 10 : winTier === 'max' ? 32 : 22} spread={65} color={winTier === 'max' ? '#d9f99d' : '#ffe9a0'} />
				<div class="bigwin-amount">{money(shownWin)}</div>
				<div class="bigwin-mult">{(totalWin / betAmount).toFixed(1)}x bet</div>
				{#if awardedFreeScratches > 0}
					<div class="win-modal-bonus">+{awardedFreeScratches} Free Scratches</div>
				{/if}
				<img class="tap-continue" src={tapContinueUrl} alt="Tap to continue" draggable="false" />
			</div>
		{:else}
			<div class="win-modal">
				<div class="win-modal-title">{totalWin > 0 ? 'Treasure won!' : 'Bonus!'}</div>
				{#if totalWin > 0}
					<div class="win-modal-amount">{money(totalWin)}</div>
					<div class="win-modal-mult">{(totalWin / betAmount).toFixed(1)}x</div>
				{/if}
				{#if awardedFreeScratches > 0}
					<div class="win-modal-bonus">+{awardedFreeScratches} Free Scratches</div>
				{/if}
				<img class="tap-continue" src={tapContinueUrl} alt="Tap to continue" draggable="false" />
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
			<div class="bonus-win-art">
				<img src={bonusWinArtUrl} alt="Bonus win" draggable="false" />
				<Sparkles count={22} coins={18} spread={60} />
				<div class="bonus-win-text">
					<span class="bonus-win-mult" style={fitText(fmtMult(bonusMult), 8.2, 6)}>{fmtMult(bonusMult)}</span>
					<span class="bonus-win-amount" style={fitText(money(bonusWinSum), 6.2, 8)}>{money(bonusWinSum)}</span>
					<span class="bonus-win-count">{bonusSpins} Free Scratches</span>
				</div>
			</div>
			<img class="tap-continue" src={tapContinueUrl} alt="Tap to continue" draggable="false" />
		</div>
	</div>
{/if}

{#if loaderVisible}
	<div
		class="loader"
		style={`--loader-bg:url(${bgPosterUrl});`}
		role="button"
		tabindex="0"
		onclick={startGame}
		onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && startGame()}
	>
		<img class="loader-logo" src={logoUrl} alt="Pirate Scratch" />
		<div class="loader-bar" aria-label="Loading">
			<div class="loader-tube">
				<div class="loader-water-clip" style={`width:${loaderProgress * 100}%;`}>
					<div class="loader-water" style={`--water:url(${loadWaterUrl});`}></div>
				</div>
			</div>
			<img class="loader-bar-art" src={loadBarUrl} alt="" draggable="false" />
		</div>
		{#if loaderProgress >= 1}
			<button class="loader-start" onclick={(e) => { e.stopPropagation(); startGame(); }}>
				<img src={loadBtnUrl} alt="Tap to set sail" draggable="false" />
			</button>
		{:else}
			<div class="loader-text">Hoisting the sails… {Math.round(loaderProgress * 100)}%</div>
		{/if}
	</div>
{/if}
