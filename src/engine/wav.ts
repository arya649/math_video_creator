// Sound as plain numbers, and as a WAV file.

/** The parts of an AudioBuffer the engine uses (so tests can pass their own). */
export interface Sound {
  sampleRate: number;
  numberOfChannels: number;
  length: number;
  getChannelData(channel: number): Float32Array;
}

/** A 16-bit PCM WAV file of a sound. */
export function encodeWav(sound: Sound): Blob {
  const ch = sound.numberOfChannels, n = sound.length, rate = sound.sampleRate;
  const data = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const text = (o: number, s: string) => { for (let i = 0; i < s.length; i++) data.setUint8(o + i, s.charCodeAt(i)); };
  text(0, 'RIFF'); data.setUint32(4, 36 + n * ch * 2, true); text(8, 'WAVE');
  text(12, 'fmt '); data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, ch, true);
  data.setUint32(24, rate, true); data.setUint32(28, rate * ch * 2, true); data.setUint16(32, ch * 2, true); data.setUint16(34, 16, true);
  text(36, 'data'); data.setUint32(40, n * ch * 2, true);
  const chans = Array.from({ length: ch }, (_, c) => sound.getChannelData(c));
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) {
    const v = Math.max(-1, Math.min(1, chans[c][i]));
    data.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true);
    o += 2;
  }
  return new Blob([data.buffer], { type: 'audio/wav' });
}

/** A plain sound made of numbers. */
export class PlainSound implements Sound {
  channels: Float32Array[];
  constructor(public sampleRate: number, public numberOfChannels: number, public length: number) {
    this.channels = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
  }
  getChannelData(c: number) { return this.channels[c]; }
}
