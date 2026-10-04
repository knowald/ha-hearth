/*
 * Alert chimes, synthesized with WebAudio so there are no sound files to
 * ship. Loaded on the first alert that chimes; chimeGate.ts decides whether
 * one may play at all.
 */

export type ChimeTone = 'chime' | 'soft' | 'bell';

interface Note {
	frequency: number;
	/** Seconds after the chime starts. */
	at: number;
	/** Seconds until the note has faded out. */
	length: number;
	/** Peak level before the volume applies, 0 to 1. */
	level: number;
	wave: OscillatorType;
}

// a two-note doorbell, a single quiet note, and a struck bell whose
// overtone sits at the inharmonic ratio real bells have
export const CHIME_NOTES: Record<ChimeTone, Note[]> = {
	chime: [
		{ frequency: 659.25, at: 0, length: 0.5, level: 0.5, wave: 'sine' },
		{ frequency: 523.25, at: 0.28, length: 0.8, level: 0.5, wave: 'sine' }
	],
	soft: [{ frequency: 523.25, at: 0, length: 0.7, level: 0.3, wave: 'sine' }],
	bell: [
		{ frequency: 880, at: 0, length: 1.6, level: 0.45, wave: 'sine' },
		{ frequency: 880 * 2.76, at: 0, length: 0.9, level: 0.12, wave: 'sine' }
	]
};

const ATTACK = 0.01;
// exponential ramps cannot reach 0
const SILENT = 0.0001;

/**
 * Schedules a tone on the context and returns the context time it ends at.
 * `volume` runs from 0 to 1.
 */
export function playChime(context: AudioContext, tone: ChimeTone, volume: number): number {
	const start = context.currentTime + 0.02;
	let end = start;
	for (const note of CHIME_NOTES[tone]) {
		const oscillator = context.createOscillator();
		const gain = context.createGain();
		const begin = start + note.at;
		const finish = begin + note.length;
		const peak = Math.max(SILENT, note.level * Math.min(1, Math.max(0, volume)));
		oscillator.type = note.wave;
		oscillator.frequency.setValueAtTime(note.frequency, begin);
		gain.gain.setValueAtTime(SILENT, begin);
		gain.gain.exponentialRampToValueAtTime(peak, begin + ATTACK);
		gain.gain.exponentialRampToValueAtTime(SILENT, finish);
		oscillator.connect(gain);
		gain.connect(context.destination);
		oscillator.start(begin);
		oscillator.stop(finish + 0.05);
		end = Math.max(end, finish);
	}
	return end;
}
