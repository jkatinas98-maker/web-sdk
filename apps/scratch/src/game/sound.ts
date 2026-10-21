// Lightweight synth sound effects via the Web Audio API — no audio files to
// bundle or host. Every sound is a short oscillator blip, generated on the
// fly, so this works the moment the page loads with zero assets.
type SoundType =
	| 'click'
	| 'scratch'
	| 'reveal'
	| 'win'
	| 'bonus'
	| 'jackpot'
	| 'scatterLand'
	| 'woodTick'
	| 'woodThunk';

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

export const playSound = (type: SoundType) => {
	if (volume <= 0) return;

	try {
		const ctx = getContext();
		if (!ctx) return;
		if (ctx.state === 'suspended') ctx.resume();

		const now = ctx.currentTime;

		const tone = (
			freq: number,
			peakGain: number,
			duration: number,
			shape: OscillatorType = 'sine',
			startAt = 0,
			sweepTo?: number,
		) => {
			const osc = ctx.createOscillator();
			const gain = ctx.createGain();
			osc.connect(gain);
			gain.connect(ctx.destination);
			osc.type = shape;
			const t0 = now + startAt;
			osc.frequency.setValueAtTime(freq, t0);
			if (sweepTo) osc.frequency.exponentialRampToValueAtTime(sweepTo, t0 + duration);
			gain.gain.setValueAtTime(peakGain * volume, t0);
			gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
			osc.start(t0);
			osc.stop(t0 + duration);
		};

		// Wooden knock: a short band-passed noise click (the "tock" of the
		// wood) over a low, fast-falling body tone.
		const knock = (pitch: number, gainAmt: number, body: number, startAt = 0) => {
			const t0 = now + startAt;
			const src = ctx.createBufferSource();
			src.buffer = getNoise(ctx);
			const bp = ctx.createBiquadFilter();
			bp.type = 'bandpass';
			bp.frequency.value = pitch;
			bp.Q.value = 6;
			const g = ctx.createGain();
			g.gain.setValueAtTime(gainAmt * volume, t0);
			g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.05);
			src.connect(bp).connect(g).connect(ctx.destination);
			src.start(t0);
			src.stop(t0 + 0.06);

			const osc = ctx.createOscillator();
			const og = ctx.createGain();
			osc.type = 'triangle';
			osc.frequency.setValueAtTime(body, t0);
			osc.frequency.exponentialRampToValueAtTime(body * 0.55, t0 + 0.07);
			og.gain.setValueAtTime(gainAmt * 0.9 * volume, t0);
			og.gain.exponentialRampToValueAtTime(0.001, t0 + 0.08);
			osc.connect(og).connect(ctx.destination);
			osc.start(t0);
			osc.stop(t0 + 0.09);
		};

		if (type === 'woodTick') {
			const v = 0.85 + Math.random() * 0.3;
			knock(1500 * v, 0.55, 320 * v);
		} else if (type === 'woodThunk') {
			// Heavy landing: two deep knocks, like a crate lid dropping shut.
			knock(700, 0.8, 150);
			knock(1100, 0.45, 210, 0.07);
		} else if (type === 'click') {
			tone(520, 0.08, 0.03);
		} else if (type === 'scratch') {
			tone(140 + Math.random() * 160, 0.05, 0.03, 'sawtooth');
		} else if (type === 'reveal') {
			tone(420, 0.1, 0.1, 'sine', 0, 820);
		} else if (type === 'win') {
			tone(420, 0.18, 0.12, 'triangle');
			tone(630, 0.18, 0.12, 'triangle', 0.1);
			tone(840, 0.18, 0.3, 'triangle', 0.25);
		} else if (type === 'jackpot') {
			// A brighter, more sparkly chime than a plain reveal — marks the
			// instant a mode's top symbol lands, win or not.
			tone(660, 0.14, 0.1, 'sine', 0);
			tone(990, 0.14, 0.12, 'sine', 0.06);
			tone(1320, 0.16, 0.2, 'sine', 0.12);
		} else if (type === 'scatterLand') {
			// A quick magic-sparkle "ding" for landing an individual 🎁 tile —
			// separate from the 4-note fanfare that plays once 3 have landed.
			tone(1200, 0.14, 0.05, 'sine', 0);
			tone(1800, 0.14, 0.09, 'sine', 0.04);
		} else if (type === 'bonus') {
			// A 4-note ascending fanfare for the 🎁 scatter trigger — meant
			// to stand well apart from the regular win jingle.
			tone(523, 0.16, 0.12, 'square', 0);
			tone(659, 0.16, 0.12, 'square', 0.1);
			tone(784, 0.16, 0.12, 'square', 0.2);
			tone(1047, 0.2, 0.35, 'square', 0.3);
		}
	} catch (error) {
		console.error('playSound failed:', error);
	}
};
