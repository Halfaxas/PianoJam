import { ROOM_LIMITS } from "@pianojam/shared";

/** Music-flavored nickname generator for the "Surprise me" button. */

const ADJECTIVES = [
  "Nimble", "Jazzy", "Funky", "Mellow", "Groovy", "Swift", "Golden",
  "Cosmic", "Dreamy", "Bouncy", "Smooth", "Wild", "Electric", "Velvet",
  "Dapper", "Snazzy", "Breezy", "Mighty", "Sleepy", "Sparkly",
];

const NOUNS = [
  "Fingers", "Keys", "Maestro", "Octave", "Chord", "Melody", "Tempo",
  "Sonata", "Prodigy", "Pianist", "Arpeggio", "Forte", "Crescendo",
  "Virtuoso", "Staccato", "Encore", "Cadenza", "Glissando", "Riff", "Tune",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export function randomNickname(): string {
  for (let attempt = 0; attempt < 20; attempt++) {
    const name = pick(ADJECTIVES) + pick(NOUNS);
    if (name.length <= ROOM_LIMITS.nicknameMax) return name;
  }
  return pick(ADJECTIVES).slice(0, 10) + pick(NOUNS).slice(0, 10);
}
