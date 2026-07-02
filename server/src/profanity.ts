import {
  englishDataset,
  englishRecommendedTransformers,
  RegExpMatcher,
  TextCensor,
} from "obscenity";

/**
 * Content moderation for user-generated text. Profanity: nicknames are
 * rejected outright; chat messages are censored (matched words replaced) so
 * the conversation keeps flowing. Links: not allowed anywhere (nicknames
 * rejected, chat messages blocked).
 */

const matcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

const censor = new TextCensor();

export function hasProfanity(text: string): boolean {
  return matcher.hasMatch(text);
}

export function censorProfanity(text: string): string {
  const matches = matcher.getAllMatches(text);
  if (matches.length === 0) return text;
  return censor.applyTo(text, matches);
}

/**
 * Explicit URLs (scheme or www.) plus bare domains on common TLDs. The TLD
 * list is deliberately conservative so prose like "e.g." or "ver 2.0" never
 * trips it.
 */
const LINK_PATTERN = new RegExp(
  "(?:https?://|www\\.)\\S+" +
    "|\\b[\\w-]+\\.(?:com|net|org|io|gg|xyz|co|me|tv|app|dev|info|biz|online|site|club|store|live|stream|link|ly|cc)\\b",
  "i",
);

export function containsLink(text: string): boolean {
  return LINK_PATTERN.test(text);
}
