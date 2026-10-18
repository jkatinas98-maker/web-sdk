// Lightweight synth sound effects via the Web Audio API — no audio files to
// bundle or host. Every sound is a short oscillator blip, generated on the
// fly, so this works the moment the page loads with zero assets.
type SoundType = 'click' | 'scratch' | 'reveal' | 'win';

let audioCtx: AudioContext | null = null;
let enabled = true;

const getContext = (): AudioContext | null => {
	if (typeof window === 'undefined') return null;
	if (!audioCtx) {
		const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
		if (!Ctor) return null;
		audioCtx = new Ctor();
	}
	return audioCtx;
};

export const setSoundEnabled = (value: boolean) => {
	enabled = value;
};

export const isSoundEnabled = () => enabled;

export const playSound = (type: SoundType) => {
	if (!enabled) return;

	try {
		const ctx = getContext();
		if (!ctx) return;
		if (ctx.state === 'suspended') ctx.resume();

		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.connect(gain);
		gain.connect(ctx.destination);
		const now = ctx.currentTime;

		if (type === 'click') {
			osc.type = 'sine';
			osc.frequency.setValueAtTime(520, now);
			gain.gain.setValueAtTime(0.025, now);
			gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
			osc.start(now);
			osc.stop(now + 0.03);
		} else if (type === 'scratch') {
			osc.type = 'sawtooth';
			osc.frequency.setValueAtTime(140 + Math.random() * 160, now);
			gain.gain.setValueAtTime(0.015, now);
			gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
			osc.start(now);
			osc.stop(now + 0.03);
		} else if (type === 'reveal') {
			osc.type = 'sine';
			osc.frequency.setValueAtTime(420, now);
			osc.frequency.exponentialRampToValueAtTime(820, now + 0.08);
			gain.gain.setValueAtTime(0.035, now);
			gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
			osc.start(now);
			osc.stop(now + 0.1);
		} else if (type === 'win') {
			osc.type = 'triangle';
			osc.frequency.setValueAtTime(420, now);
			osc.frequency.setValueAtTime(630, now + 0.1);
			osc.frequency.setValueAtTime(840, now + 0.25);
			gain.gain.setValueAtTime(0.06, now);
			gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
			osc.start(now);
			osc.stop(now + 0.45);
		}
	} catch (error) {
		console.error('playSound failed:', error);
	}
};
