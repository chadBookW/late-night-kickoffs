import { getGroq } from "./groq";
import { containsSpoiler, getFallbackSummary } from "./spoiler-check";

export type SummaryInput = {
  homeTeam: string;
  awayTeam: string;
  league: string;
  /** Vague bucket: "goalless", "tight", "a few goals", "goal-fest" */
  goalBucket: "goalless" | "tight" | "a few goals" | "goal-fest";
  hasComeback: boolean;
  hasExtraTime: boolean;
  hasPenaltyShootout: boolean;
  isRivalry: boolean;
  isBiggie: boolean;
  redditBuzz: "high" | "moderate" | "low" | "none";
  tier: "banger" | "worth_a_watch" | "snoozefest";
};

export function goalsToBucket(totalGoals: number): SummaryInput["goalBucket"] {
  if (totalGoals === 0) return "goalless";
  if (totalGoals <= 2) return "tight";
  if (totalGoals <= 4) return "a few goals";
  return "goal-fest";
}

const SYSTEM_PROMPT = `You write spoiler-free, excitement-building teasers for football matches. Your goal is to make people WANT to watch the highlights without knowing what happened.

CRITICAL RULES — NEVER BREAK THESE:
- NEVER state who won, lost, or drew
- NEVER reveal the score or exact goal count
- NEVER imply a winning or losing team
- NEVER use: won, beat, defeated, lost, comeback, winner, loser, victory, slipped, held on, collapsed, upset, edged, stunned, narrowly beat, scraped, snatched, cruised, dominated, thrashed, hammered, humiliated, overturned, rescued, salvaged, surrendered, capitulated, bottled, choked
- NEVER reveal the result direction in any way
- DO tease: drama level, rivalry, atmosphere, extra time, penalties, community buzz, intensity
- Build curiosity — make readers think "I need to watch this"
- Maximum 280 characters
- Write in third-person narrative style`;

export async function generateSummary(
  input: SummaryInput
): Promise<{ summary: string; status: "generated" | "template_fallback" }> {
  const userPrompt = buildUserPrompt(input);

  // Attempt 1
  try {
    const summary = await callGroq(userPrompt);
    if (!containsSpoiler(summary)) {
      return { summary, status: "generated" };
    }
    console.warn("[summary] Spoiler detected in attempt 1, retrying...");
  } catch (err) {
    console.error("[summary] Groq call failed (attempt 1):", err);
  }

  // Attempt 2
  try {
    const summary = await callGroq(userPrompt + "\n\nIMPORTANT: Do NOT reveal who won or lost. Focus only on match tempo, goals count, and incidents.");
    if (!containsSpoiler(summary)) {
      return { summary, status: "generated" };
    }
    console.warn("[summary] Spoiler detected in attempt 2, using fallback");
  } catch (err) {
    console.error("[summary] Groq call failed (attempt 2):", err);
  }

  // Fallback
  return {
    summary: getFallbackSummary(input.tier),
    status: "template_fallback",
  };
}

function buildUserPrompt(input: SummaryInput): string {
  const parts: string[] = [
    `Match: ${input.homeTeam} vs ${input.awayTeam}`,
    `League: ${input.league}`,
    `Goal activity: ${input.goalBucket}`,
  ];

  if (input.hasComeback) parts.push("A team trailed at half-time but changed the result.");
  if (input.hasPenaltyShootout) parts.push("The match went to a penalty shootout.");
  else if (input.hasExtraTime) parts.push("The match went to extra time.");
  if (input.isRivalry) parts.push("This is a known rivalry/derby match.");
  if (input.isBiggie) parts.push("This is a high-profile fixture.");
  if (input.redditBuzz === "high") parts.push("Fan community reaction: massive online buzz.");
  else if (input.redditBuzz === "moderate") parts.push("Fan community reaction: solid engagement.");

  parts.push(`\nClassification: ${input.tier.replace("_", " ")}`);
  parts.push("\nWrite a 1-2 sentence summary (max 280 chars). Do NOT reveal the result or who won/lost.");

  return parts.join("\n");
}

async function callGroq(prompt: string): Promise<string> {
  const groq = getGroq();

  // 10-second timeout to prevent hanging if Groq is slow/down
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const completion = await groq.chat.completions.create(
      {
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 150,
      },
      { signal: controller.signal }
    );

    const content = completion.choices[0]?.message?.content?.trim();
    if (!content) throw new Error("Empty response from Groq");
    return content;
  } finally {
    clearTimeout(timeout);
  }
}
