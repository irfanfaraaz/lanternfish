/**
 * Known crawlers and AI agents. Order matters: more specific names come first,
 * so `Claude-SearchBot` is not reported as `ClaudeBot`.
 */
const NAMES = [
  "OAI-SearchBot",
  "ChatGPT-User",
  "GPTBot",
  "Claude-SearchBot",
  "Claude-User",
  "ClaudeBot",
  "Perplexity-User",
  "PerplexityBot",
  "Google-Extended",
  "Googlebot",
  "Bingbot",
  "Applebot",
  "DuckAssistBot",
  "Meta-ExternalAgent",
  "Amazonbot",
] as const;

export type BotName = (typeof NAMES)[number];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const KNOWN_BOTS: readonly { name: BotName; pattern: RegExp }[] = NAMES.map((name) => ({
  name,
  pattern: new RegExp(`\\b${escape(name)}\\b`, "i"),
}));

const GENERIC_BOT = /bot\b|crawler|spider|headless|slurp|python-requests|curl\/|wget/i;

/** A known bot's name, `"other"` for a generic bot, or null for a likely human. */
export function detectBot(ua: string): string | null {
  for (const b of KNOWN_BOTS) if (b.pattern.test(ua)) return b.name;
  return GENERIC_BOT.test(ua) ? "other" : null;
}

/** Alternation of known bot names, for a Next.js `has` user-agent matcher. */
// Next.js matchers are case-sensitive and some real UAs are lowercase
// (bingbot, meta-externalagent), so both spellings are listed.
export const BOT_UA_REGEX_SOURCE = `.*(${[...new Set(NAMES.flatMap((n) => [n, n.toLowerCase()]))].map(escape).join("|")}).*`;
