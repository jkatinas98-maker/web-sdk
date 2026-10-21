// Lightweight synth sound effects via the Web Audio API — no audio files to
// bundle or host. Every sound is a short oscillator blip, generated on the
// fly, so this works the moment the page loads with zero assets.
type SoundType =
	| 'click' // UI button: small wooden knock
	| 'scratch' // scraping a cell: parchment/sand scrape
	| 'reveal' // a cell opens: paper flip + soft wood tap
	| 'win' // regular win: coin jingle + ship's bell
	| 'bonus' // free scratches: ship's bell x3 + brass horn
	| 'jackpot' // top symbol / prize lands: coin cascade
	| 'scatterLand' // special tile lands: single ship's bell
	| 'woodTick' // reel ticks
	| 'woodThunk' // reel lands
	| 'chestOpen' // treasure chest: creak, lid thunk, coins
	| 'cannon' // big win: cannon boom
	| 'splash' // Kraken / Shark: sea splash
	| 'match' // a winning tile ticks in (pitch rises 1st -> 3rd)
	| 'pirateArr' // voice: pirate "Arrr!" (recorded sample only)
	| 'pirateCheer' // voice: crew cheering (recorded sample only)
	| 'parrot'; // parrot squawk (recorded sample only)

// ---------- Recorded samples ----------
// Drop audio files into src/assets/sfx/ named after a sound type, with
// optional variants: win.mp3, win_2.mp3, pirateArr.mp3, pirateArr_2.mp3,
// parrot.mp3, cannon.mp3, ... Any type that has a file plays the file
// (a random variant each time); types without one fall back to the synth
// below. Voice-only types (pirateArr, pirateCheer, parrot) stay silent
// until their files exist.
const SAMPLE_FILES = import.meta.glob('../assets/sfx/*.{mp3,ogg,wav,webm}', {
	eager: true,
	query: '?url',
	import: 'default',
}) as Record<string, string>;

const sampleUrls: Partial<Record<SoundType, string[]>> = {};
for (const [path, url] of Object.entries(SAMPLE_FILES)) {
	const base = path.split('/').pop()!.replace(/\.[^.]+$/, '');
	const type = base.replace(/_\d+$/, '') as SoundType;
	(sampleUrls[type] ??= []).push(url);
}

const sampleBuffers = new Map<string, AudioBuffer | null>();
const loadSamples = (ctx: AudioContext) => {
	for (const urls of Object.values(sampleUrls)) {
		for (const url of urls ?? []) {
			if (sampleBuffers.has(url)) continue;
			sampleBuffers.set(url, null);
			fetch(url)
				.then((r) => r.arrayBuffer())
				.then((data) => ctx.decodeAudioData(data))
				.then((buf) => sampleBuffers.set(url, buf))
				.catch((e) => console.warn('sfx load failed', url, e));
		}
	}
};

// Per-type loudness for samples (tweak by ear).
const SAMPLE_GAIN: Partial<Record<SoundType, number>> = {
	pirateArr: 0.9,
	pirateCheer: 0.8,
	parrot: 0.7,
	cannon: 0.9,
};

// Returns true if a recorded sample was played.
const playSample = (ctx: AudioContext, type: SoundType, delay = 0): boolean => {
	const urls = sampleUrls[type];
	if (!urls?.length) return false;
	const ready = urls.map((u) => sampleBuffers.get(u)).filter((b): b is AudioBuffer => !!b);
	if (!ready.length) return true; // still loading: stay quiet rather than double up with synth
	const buf = ready[Math.floor(Math.random() * ready.length)];
	const src = ctx.createBufferSource();
	src.buffer = buf;
	const g = ctx.createGain();
	g.gain.value = (SAMPLE_GAIN[type] ?? 0.8) * volume;
	src.connect(g).connect(ctx.destination);
	src.start(ctx.currentTime + delay);
	return true;
};

const hasSample = (type: SoundType) => !!sampleUrls[type]?.length;


let audioCtx: AudioContext | null = null;
// A single 0-1 volume knob instead of a plain on/off switch — 0 is mute,
// everything else scales every gain value below. Base gains were tuned
// quiet; bumped up ~3x across the board so even "max" is actually audible.
let volume = 1;

const getContext = (): AudioContext | null => {
	if (typeof window === 'undefined') return null;
	if (!audioCtx) {
		const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
		if (!Ctor) return null;
		audioCtx = new Ctor();
	}
	return audioCtx;
};

// ---------- Background music ----------
// Looping soundtrack with its OWN on/off switch (the music-note button),
// independent of the effects volume knob above. The track is mastered loud
// (about -17 dB average) while the synth effects average roughly -24 dB,
// so ~0.33 puts it ~30% quieter than the effects at full volume. Tweak
// MUSIC_GAIN if the balance needs adjusting by ear.
const MUSIC_GAIN = 0.33;
let music: HTMLAudioElement | null = null;
let musicStarted = false;
let musicEnabled = true;

const applyMusicState = () => {
	if (!music) return;
	music.volume = MUSIC_GAIN;
	if (!musicEnabled) music.pause();
	else if (musicStarted && music.paused) music.play().catch(() => {});
};

// Browsers block audio until the player interacts with the page, so this
// is called from the first pointer/key event (see Game.svelte). Safe to
// call repeatedly — only the first successful call does anything.
export const startMusic = (src: string) => {
	if (musicStarted || typeof window === 'undefined') return;
	musicStarted = true;
	if (!music) {
		music = new Audio(src);
		music.loop = true;
		music.preload = 'auto';
	}
	applyMusicState();
};

export const setMusicEnabled = (value: boolean) => {
	musicEnabled = value;
	applyMusicState();
};

export const isMusicEnabled = () => musicEnabled;

// Effects-only volume (0 = muted). Doesn't touch the music.
export const setVolume = (value: number) => {
	volume = Math.min(1, Math.max(0, value));
};

export const getVolume = () => volume;

// Kept as thin wrappers over the volume knob so older call sites (a plain
// on/off mute) still work: muting sets volume to 0, "enabled" is just
// volume > 0.
export const setSoundEnabled = (value: boolean) => setVolume(value ? 1 : 0);
export const isSoundEnabled = () => volume > 0;

// Shared white-noise buffer for the wooden knocks (made once, reused).
let noiseBuffer: AudioBuffer | null = null;
const getNoise = (ctx: AudioContext) => {
	if (!noiseBuffer) {
		const len = Math.floor(ctx.sampleRate * 0.25);
		noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
		const data = noiseBuffer.getChannelData(0);
		for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
	}
	return noiseBuffer;
};

export const playSound = (type: SoundType, pitch = 1) => {
	if (volume <= 0) return;

	try {
		const ctx = getContext();
		if (!ctx) return;
		if (ctx.state === 'suspended') ctx.resume();
		loadSamples(ctx);
		if (playSample(ctx, type)) return;

		const now = ctx.currentTime;

		const out = ctx.destination;

		const tone = (
			freq: number,
			peakGain: number,
			duration: number,
			shape: OscillatorType = 'sine',
			startAt = 0,
			sweepTo?: number,
			attack = 0.002,
		) => {
			const osc = ctx.createOscillator();
			const gain = ctx.createGain();
			osc.connect(gain);
			gain.connect(out);
			osc.type = shape;
			const t0 = now + startAt;
			osc.frequency.setValueAtTime(freq, t0);
			if (sweepTo) osc.frequency.exponentialRampToValueAtTime(sweepTo, t0 + duration);
			gain.gain.setValueAtTime(0.0001, t0);
			gain.gain.exponentialRampToValueAtTime(peakGain * volume, t0 + attack);
			gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
			osc.start(t0);
			osc.stop(t0 + duration + 0.02);
		};

		// Filtered noise burst (filter frequency can sweep).
		const noise = (
			filter: BiquadFilterType,
			freq: number,
			q: number,
			gainAmt: number,
			duration: number,
			startAt = 0,
			freqTo?: number,
			attack = 0.003,
		) => {
			const t0 = now + startAt;
			const src = ctx.createBufferSource();
			src.buffer = getNoise(ctx);
			src.loop = true;
			const f = ctx.createBiquadFilter();
			f.type = filter;
			f.frequency.setValueAtTime(freq, t0);
			if (freqTo) f.frequency.exponentialRampToValueAtTime(freqTo, t0 + duration);
			f.Q.value = q;
			const g = ctx.createGain();
			g.gain.setValueAtTime(0.0001, t0);
			g.gain.exponentialRampToValueAtTime(gainAmt * volume, t0 + attack);
			g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
			src.connect(f).connect(g).connect(out);
			src.start(t0);
			src.stop(t0 + duration + 0.02);
		};

		// Wooden knock: band-passed noise "tock" over a falling body tone.
		const knock = (pitch: number, gainAmt: number, body: number, startAt = 0) => {
			noise('bandpass', pitch, 6, gainAmt, 0.05, startAt);
			tone(body, gainAmt * 0.9, 0.08, 'triangle', startAt, body * 0.55);
		};

		// Metallic coin clink: inharmonic partials, very short.
		const clink = (freq: number, gainAmt: number, startAt = 0) => {
			tone(freq, gainAmt, 0.12, 'sine', startAt);
			tone(freq * 2.76, gainAmt * 0.6, 0.08, 'sine', startAt);
			tone(freq * 5.4, gainAmt * 0.35, 0.05, 'sine', startAt);
			noise('highpass', 6000, 0.7, gainAmt * 0.4, 0.02, startAt);
		};

		// Ship's bell: long ringing inharmonic partials.
		const bell = (freq: number, gainAmt: number, startAt = 0, length = 1.4) => {
			const partials: Array<[number, number]> = [
				[0.5, 0.35],
				[1, 1],
				[2, 0.5],
				[2.4, 0.45],
				[3, 0.3],
				[4.2, 0.2],
			];
			for (const [r, a] of partials) tone(freq * r, gainAmt * a, length / Math.sqrt(r), 'sine', startAt);
			noise('bandpass', freq * 4, 2, gainAmt * 0.3, 0.03, startAt);
		};

		// Brass horn note: sawtooth through a low-pass that opens up.
		const horn = (freq: number, gainAmt: number, startAt: number, duration: number) => {
			const t0 = now + startAt;
			const lp = ctx.createBiquadFilter();
			lp.type = 'lowpass';
			lp.Q.value = 2;
			lp.frequency.setValueAtTime(freq * 1.5, t0);
			lp.frequency.exponentialRampToValueAtTime(freq * 5, t0 + 0.08);
			lp.frequency.exponentialRampToValueAtTime(freq * 2, t0 + duration);
			const g = ctx.createGain();
			g.gain.setValueAtTime(0.0001, t0);
			g.gain.exponentialRampToValueAtTime(gainAmt * volume, t0 + 0.04);
			g.gain.setValueAtTime(gainAmt * volume * 0.8, t0 + duration * 0.7);
			g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
			lp.connect(g).connect(out);
			for (const detune of [-6, 6]) {
				const o = ctx.createOscillator();
				o.type = 'sawtooth';
				o.frequency.setValueAtTime(freq, t0);
				o.detune.value = detune;
				o.connect(lp);
				o.start(t0);
				o.stop(t0 + duration + 0.02);
			}
		};

		const coinShower = (count: number, spread: number, gainAmt: number, startAt = 0) => {
			for (let i = 0; i < count; i++) {
				const t = startAt + (i / count) * spread + Math.random() * 0.03;
				clink(2200 + Math.random() * 1800, gainAmt * (0.6 + Math.random() * 0.4), t);
			}
		};

		const r = 0.9 + Math.random() * 0.2; // per-play pitch variation

		if (type === 'match') {
			// Bright silver "ting" + a soft wood tap under it.
			tone(1046 * pitch, 0.12, 0.25, 'sine');
			tone(2093 * pitch, 0.05, 0.15, 'sine', 0.005);
			knock(1800, 0.15, 400 * pitch);
		} else if (type === 'click') {
			knock(1900 * r, 0.35, 420 * r);
		} else if (type === 'scratch') {
			noise('bandpass', 2600 * r, 1.2, 0.18, 0.07, 0, 1400);
		} else if (type === 'reveal') {
			// Parchment flip + soft wood tap (replaces the old bubbly sweep).
			noise('highpass', 1800, 0.8, 0.22, 0.09, 0, 5000);
			knock(1200 * r, 0.3, 260 * r, 0.03);
		} else if (type === 'woodTick') {
			knock(1500 * r, 0.55, 320 * r);
		} else if (type === 'woodThunk') {
			knock(700, 0.8, 150);
			knock(1100, 0.45, 210, 0.07);
		} else if (type === 'scatterLand') {
			bell(880 * r, 0.12);
		} else if (type === 'jackpot') {
			coinShower(14, 0.6, 0.14);
			bell(1175, 0.08, 0.05, 1);
		} else if (type === 'win') {
			// Coins, then a pirate "Arrr!" or the parrot (if those samples exist).
			coinShower(10, 0.45, 0.11);
			const voice: SoundType = Math.random() < 0.6 ? 'pirateArr' : 'parrot';
			if (hasSample(voice)) playSample(ctx, voice, 0.25);
		} else if (type === 'bonus') {
			bell(659, 0.11, 0, 1);
			bell(659, 0.11, 0.28, 1);
			bell(659, 0.12, 0.56, 1.2);
			horn(196, 0.09, 0.8, 0.3);
			horn(262, 0.09, 1.1, 0.3);
			horn(392, 0.1, 1.4, 0.8);
			coinShower(12, 0.8, 0.1, 1.4);
			if (hasSample('pirateArr')) playSample(ctx, 'pirateArr', 1.9);
		} else if (type === 'chestOpen') {
			// Hinge creak (wobbling saw through a resonant band-pass)...
			const t0 = now;
			const o = ctx.createOscillator();
			o.type = 'sawtooth';
			o.frequency.setValueAtTime(70, t0);
			o.frequency.linearRampToValueAtTime(110, t0 + 0.18);
			o.frequency.linearRampToValueAtTime(60, t0 + 0.35);
			const bp = ctx.createBiquadFilter();
			bp.type = 'bandpass';
			bp.frequency.value = 900;
			bp.Q.value = 8;
			const g = ctx.createGain();
			g.gain.setValueAtTime(0.0001, t0);
			g.gain.exponentialRampToValueAtTime(0.35 * volume, t0 + 0.05);
			g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.38);
			o.connect(bp).connect(g).connect(out);
			o.start(t0);
			o.stop(t0 + 0.4);
			// ...lid thunk, then the gold.
			knock(600, 0.7, 130, 0.36);
			coinShower(16, 0.7, 0.13, 0.42);
			if (hasSample('parrot') && Math.random() < 0.5) playSample(ctx, 'parrot', 0.9);
		} else if (type === 'pirateArr' || type === 'pirateCheer' || type === 'parrot') {
			// Voices need recordings (no synth version) -- silent until the
			// files are added.
		} else if (type === 'cannon') {
			tone(90, 0.6, 0.6, 'sine', 0, 35);
			noise('lowpass', 900, 0.7, 0.6, 0.9, 0, 120, 0.005);
			noise('bandpass', 2500, 1, 0.15, 0.08);
		} else if (type === 'splash') {
			noise('lowpass', 600, 0.8, 0.35, 0.9, 0, 3500, 0.12);
			noise('highpass', 3000, 0.7, 0.12, 0.6, 0.1, 8000, 0.05);
		}
	} catch (error) {
		console.error('playSound failed:', error);
	}
};
