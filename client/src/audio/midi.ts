import { pressKey, releaseKey, setPedal } from "./player";
import { ensureAudioStarted } from "./engine";
import { useAudioStore } from "../state/audioStore";

/**
 * Web MIDI input. Supported in Chromium browsers and Safari; Firefox does
 * not implement the Web MIDI API.
 */

const NOTE_ON = 0x90;
const NOTE_OFF = 0x80;
const CONTROL_CHANGE = 0xb0;
const CC_SUSTAIN = 64;

let access: MIDIAccess | null = null;

function handleMessage(event: MIDIMessageEvent): void {
  const data = event.data;
  if (!data || data.length < 2) return;
  const status = data[0]! & 0xf0;
  const d1 = data[1]!;
  const d2 = data.length > 2 ? data[2]! : 0;

  if (status === NOTE_ON && d2 > 0) {
    // MIDI arrives outside any user gesture; the context is usually already
    // unlocked by the room's "tap to start" - this is a best-effort nudge.
    void ensureAudioStarted().catch(() => {});
    pressKey(d1, d2 / 127);
  } else if (status === NOTE_OFF || (status === NOTE_ON && d2 === 0)) {
    releaseKey(d1);
  } else if (status === CONTROL_CHANGE && d1 === CC_SUSTAIN) {
    setPedal(d2 >= 64);
  }
}

function refreshDevices(): void {
  if (!access) return;
  const devices: string[] = [];
  access.inputs.forEach((input) => {
    input.onmidimessage = handleMessage;
    devices.push(input.name ?? "MIDI device");
  });
  useAudioStore.getState().set({ midiDevices: devices });
}

export async function initMidi(): Promise<void> {
  if (!("requestMIDIAccess" in navigator)) {
    useAudioStore.getState().set({ midiSupported: false });
    return;
  }
  try {
    access = await navigator.requestMIDIAccess();
    useAudioStore.getState().set({ midiSupported: true });
    refreshDevices();
    access.onstatechange = refreshDevices;
  } catch {
    useAudioStore.getState().set({ midiSupported: false });
  }
}
