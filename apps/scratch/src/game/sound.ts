// Lightweight synth sound effects via the Web Audio API — no audio files to
// bundle or host. Every sound is a short oscillator blip, generated on the
// fly, so this works the moment the page loads with zero assets.
type SoundType = 'click' | 'scratch' | 'reveal' | 'win' | 'bonus' | 'jackpot' | 'scatterLand';

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

export const setVolume = (value: number) => {
	volume = Math.min(1, Math.max(0, value));
};

export const getVolume = () => volume;

// Kept as thin wrappers over the volume knob so older call sites (a plain
// on/off mute) still work: muting sets volume to 0, "enabled" is just
// volume > 0.
export const setSoundEnabled = (value: boolean) => setVolume(value ? 1 : 0);
export const isSoundEnabled = () => volume > 0;

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

		if (type === 'click') {
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
