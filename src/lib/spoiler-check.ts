const BLOCKED_WORDS = [
  "won",
  "win",
  "wins",
  "beat",
  "beats",
  "beating",
  "defeated",
  "defeat",
  "lost",
  "lose",
  "losing",
  "comeback",
  "come back",
  "came back",
  "winner",
  "winners",
  "loser",
  "losers",
  "victory",
  "victorious",
  "slipped",
  "slip",
  "held on",
  "holding on",
  "collapsed",
  "collapse",
  "upset",
  "upsets",
  "edged",
  "edge",
  "stunned",
  "stun",
  "stunning",
  "narrowly beat",
  "scraped",
  "snatched",
  "cruised",
  "dominated",
  "thrashed",
  "hammered",
  "humiliated",
  "overturned",
  "rescued",
  "salvaged",
  "surrendered",
  "capitulated",
  "bottled",
  "choked",
];

const BLOCKED_PATTERNS = BLOCKED_WORDS.map((word) => {
  // "won" should not match "won't"
  if (word === "won") return new RegExp(`\\bwon(?!')\\b`, "i");
  return new RegExp(`\\b${word}\\b`, "i");
});

// Patterns that reveal specific scores or goal counts
const SCORE_PATTERNS = [
  /\b\d\s*[-–—]\s*\d\b/,          // "3-2", "3 – 2"
  /\bscored\s+\d/i,                // "scored 3"
  /\b\d+\s+goals?\b/i,            // "5 goals", "1 goal"
  /\b(one|two|three|four|five|six|seven|eight|nine|ten)\s+goals?\b/i,
  /\bgoalless\b/i,                 // reveals 0-0
  /\bnil[- ]nil\b/i,              // reveals 0-0
  /\bclean sheet\b/i,             // reveals 0 goals conceded
  /\bhat[- ]trick\b/i,            // reveals 3+ goals by one player
  /\bscoreless\b/i,               // reveals 0-0
];

export function containsSpoiler(text: string): boolean {
  if (BLOCKED_PATTERNS.some((pattern) => pattern.test(text))) return true;
  if (SCORE_PATTERNS.some((pattern) => pattern.test(text))) return true;
  return false;
}

export function findSpoilerWords(text: string): string[] {
  return BLOCKED_WORDS.filter((word) => {
    const pattern = new RegExp(`\\b${word}\\b`, "i");
    return pattern.test(text);
  });
}

// Fallback templates by tier — spoiler-free excitement teasers
const FALLBACK_TEMPLATES = {
  banger: [
    "Buckle up — this one had everything. Drama, chaos, and moments you have to see.",
    "The kind of match you tell people about the next morning. Do not miss this.",
    "Absolute scenes. Clear your schedule and watch the highlights immediately.",
  ],
  worth_a_watch: [
    "Some quality moments and enough drama to justify hitting play on the highlights.",
    "A solid watch with a couple of key moments that made things interesting.",
    "Not a classic, but there's enough here to keep you entertained.",
  ],
  snoozefest: [
    "You can probably skip this one unless you're a die-hard.",
    "Not much to write home about — your time is better spent elsewhere.",
    "A quiet affair. The highlights reel will be mercifully short.",
  ],
};

export function getFallbackSummary(tier: "banger" | "worth_a_watch" | "snoozefest"): string {
  const templates = FALLBACK_TEMPLATES[tier];
  return templates[Math.floor(Math.random() * templates.length)];
}
