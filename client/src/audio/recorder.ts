import * as Tone from "tone";
import { ensureAudioStarted, getRecorder } from "./engine";
import { useAudioStore } from "../state/audioStore";

/**
 * Records everything routed through the master gain (your playing and your
 * peers' notes as rendered locally) and exports a 16-bit PCM WAV file.
 */

export async function startRecording(): Promise<void> {
  await ensureAudioStarted();
  const recorder = getRecorder();
  if (recorder.state === "started") return;
  recorder.start();
  useAudioStore.getState().set({ recording: true, recordingStartedAt: Date.now() });
}

export async function stopRecording(): Promise<Blob> {
  const recorder = getRecorder();
  const blob = await recorder.stop();
  useAudioStore.getState().set({ recording: false, recordingStartedAt: null });
  return blob;
}

export function discardRecording(blob: Blob | null): void {
  // Nothing to free explicitly; kept for call-site clarity.
  void blob;
}

export async function saveRecordingAsWav(blob: Blob, filename: string): Promise<void> {
  const arrayBuffer = await blob.arrayBuffer();
  const ctx = Tone.getContext().rawContext as AudioContext;
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
  const wav = encodeWav(audioBuffer);
  const url = URL.createObjectURL(new Blob([wav], { type: "audio/wav" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".wav") ? filename : `${filename}.wav`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function encodeWav(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = Math.min(2, buffer.numberOfChannels);
  const sampleRate = buffer.sampleRate;
  const frames = buffer.length;
  const bytesPerSample = 2;
  const dataSize = frames * numChannels * bytesPerSample;
  const out = new ArrayBuffer(44 + dataSize);
  const view = new DataView(out);

  const writeString = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
  view.setUint16(32, numChannels * bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  const channels = Array.from({ length: numChannels }, (_, c) => buffer.getChannelData(c));
  let offset = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c]![i]!));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return out;
}
