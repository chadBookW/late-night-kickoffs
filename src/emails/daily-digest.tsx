import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Link,
  Hr,
  Img,
  Button,
  Preview,
  Tailwind,
} from "@react-email/components";

// ── Types ──

type DigestEmailMatch = {
  homeTeam: string;
  awayTeam: string;
  leagueName?: string;
  matchweek?: string;
  tier: string;
  isBiggie: boolean;
  summary: string;
  highlightUrl: string | null;
  featuredInEmail?: boolean;
};

type DigestEmailProps = {
  digestDate: string;
  matches: DigestEmailMatch[];
  unsubscribeUrl: string;
  preferencesUrl: string;
};

const logoUrl = process.env.EMAIL_LOGO_URL || "";

// ── Component ──

export function DailyDigestEmail({
  digestDate = "",
  matches = [],
  unsubscribeUrl = "#",
  preferencesUrl = "#",
}: DigestEmailProps) {
  const bangers = matches.filter((m) => m.tier === "banger");
  const worthAWatch = matches.filter((m) => m.tier === "worth_a_watch");
  const snoozefests = matches.filter((m) => m.tier === "snoozefest");

  const snoozefestLine = snoozefests
    .map((m) => `${m.homeTeam} vs ${m.awayTeam}`)
    .join(", ");

  return (
    <Html>
      <Head />
      <Preview>{`LNK — ${digestDate} · ${bangers.length} banger${bangers.length !== 1 ? "s" : ""}, ${worthAWatch.length} worth a watch`}</Preview>
      <Tailwind>
        <Body className="bg-[#f4f4f5] m-0 p-0 font-['Geist',-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,Helvetica,Arial,sans-serif]">
          <Container className="max-w-[600px] mx-auto my-0 bg-white">

            {/* ── Header ── */}
            <Section className="pt-8 pb-0 px-8 text-center">
              {logoUrl ? (
                <Img
                  src={logoUrl}
                  width="120"
                  height="auto"
                  alt="Late Night Kickoffs"
                  className="mx-auto block"
                />
              ) : (
                <Text className="text-[24px] font-bold m-0 tracking-tight">
                  <span className="text-[#10b981]">⚽</span>{" "}
                  <span className="text-[#171717]">Late Night Kickoffs</span>
                </Text>
              )}
              <Hr className="border-[#e5e5e5] mt-5 mb-1" />
              <Text className="text-[#737373] text-[13px] m-0 mt-3 tracking-wide uppercase">
                {digestDate}
              </Text>
            </Section>

            {/* ── Banger Tier ── */}
            {bangers.length > 0 && (
              <Section className="px-8 pt-4 pb-0">
                {bangers.map((match, idx) => (
                    <Section
                      key={idx}
                      className="bg-[#f0fdf4] rounded-lg pl-0 pr-6 pt-6 pb-6 mb-4 border-l-4 border-[#10b981]"
                    >
                      <Section className="pl-5">
                        <Text className="text-[11px] font-bold tracking-[1.5px] uppercase text-[#10b981] m-0 mb-1">
                          🔥 BANGER
                        </Text>

                        <Text className="text-[#171717] text-[20px] font-bold leading-7 m-0 mb-1">
                          {match.homeTeam} vs {match.awayTeam}
                        </Text>

                        {match.leagueName && (
                          <Text className="text-[#737373] text-[12px] m-0 mb-3">
                            {match.leagueName}
                            {match.matchweek ? ` · Matchweek ${match.matchweek}` : ""}
                          </Text>
                        )}

                        {match.summary && (
                          <Text className="text-[#404040] text-[14px] leading-[22px] m-0 mb-4">
                            {match.summary}
                          </Text>
                        )}

                        {match.highlightUrl && (
                          <Button
                            href={match.highlightUrl}
                            className="bg-[#059669] text-white text-[13px] font-bold rounded-md px-5 py-2.5 no-underline"
                          >
                            Watch Highlights →
                          </Button>
                        )}
                      </Section>
                    </Section>
                  ))}
              </Section>
            )}

            {/* ── Worth a Watch Tier ── */}
            {worthAWatch.length > 0 && (
              <Section className="px-8 pt-6 pb-0">
                <Text className="text-[12px] font-bold tracking-[1px] uppercase text-[#a1a1aa] m-0 mb-3">
                  Worth a Watch
                </Text>
                {worthAWatch.map((match, idx) => {
                  const isLast = idx === worthAWatch.length - 1;
                  return (
                    <Section key={idx}>
                      <Section className="py-3 px-0">
                        <Text className="text-[#171717] text-[15px] font-semibold m-0 leading-6">
                          {match.homeTeam} vs {match.awayTeam}
                        </Text>
                        {match.leagueName && (
                          <Text className="text-[#71717a] text-[12px] m-0 mt-0.5">
                            {match.leagueName}
                            {match.matchweek ? ` · MW ${match.matchweek}` : ""}
                          </Text>
                        )}
                        {match.summary && (
                          <Text className="text-[#52525b] text-[13px] leading-5 m-0 mt-1">
                            {match.summary}
                          </Text>
                        )}
                        {match.highlightUrl && (
                          <Link
                            href={match.highlightUrl}
                            className="text-[#10b981] text-[13px] font-semibold no-underline mt-1 inline-block"
                          >
                            Highlights →
                          </Link>
                        )}
                      </Section>
                      {!isLast && <Hr className="border-[#e5e5e5] my-0" />}
                    </Section>
                  );
                })}
              </Section>
            )}

            {/* ── Snoozefest Tier ── */}
            {snoozefests.length > 0 && (
              <Section className="px-8 pt-6 pb-2">
                <Hr className="border-[#e5e5e5] my-0 mb-4" />
                <Text className="text-[12px] font-bold tracking-[1px] uppercase text-[#71717a] m-0 mb-2">
                  Skip These
                </Text>
                <Text className="text-[#71717a] text-[13px] leading-5 m-0">
                  {snoozefestLine}
                </Text>
              </Section>
            )}

            {/* ── Footer ── */}
            <Section className="px-8 pt-8 pb-10 text-center">
              <Hr className="border-[#e5e5e5] my-0 mb-5" />
              <Text className="text-[#a3a3a3] text-[12px] m-0 mb-2">
                You&apos;re receiving this because you subscribed to Late Night Kickoffs.
              </Text>
              <Text className="text-[#a3a3a3] text-[11px] m-0">
                <Link href={preferencesUrl} className="text-[#a3a3a3] underline">
                  Preferences
                </Link>
                &nbsp;&nbsp;·&nbsp;&nbsp;
                <Link href={unsubscribeUrl} className="text-[#a3a3a3] underline">
                  Unsubscribe
                </Link>
              </Text>
            </Section>

          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

DailyDigestEmail.PreviewProps = {
  digestDate: "Jun 15, 2025",
  unsubscribeUrl: "https://example.com/unsubscribe?token=abc",
  preferencesUrl: "https://example.com/preferences?token=abc",
  matches: [
    {
      homeTeam: "Arsenal",
      awayTeam: "Liverpool",
      leagueName: "Premier League",
      matchweek: "28",
      tier: "banger",
      isBiggie: true,
      summary:
        "Five goals, two momentum swings, and a late free kick at the Emirates. A rivalry clash packed with drama from start to finish.",
      highlightUrl: "https://example.com/highlights/arsenal-liverpool",
      featuredInEmail: true,
    },
    {
      homeTeam: "Aston Villa",
      awayTeam: "Newcastle",
      leagueName: "Premier League",
      matchweek: "28",
      tier: "worth_a_watch",
      isBiggie: false,
      summary: "Plenty of attacking intent and a major late moment kept this lively.",
      highlightUrl: "https://example.com/highlights/villa-newcastle",
    },
    {
      homeTeam: "AC Milan",
      awayTeam: "Juventus",
      leagueName: "Serie A",
      matchweek: "32",
      tier: "worth_a_watch",
      isBiggie: false,
      summary: "A cagey Derby d'Italia with a single decisive moment.",
      highlightUrl: null,
    },
    {
      homeTeam: "Burnley",
      awayTeam: "Sheffield Utd",
      tier: "snoozefest",
      isBiggie: false,
      summary: "",
      highlightUrl: null,
    },
    {
      homeTeam: "Fulham",
      awayTeam: "Bournemouth",
      tier: "snoozefest",
      isBiggie: false,
      summary: "",
      highlightUrl: null,
    },
    {
      homeTeam: "Wolves",
      awayTeam: "Everton",
      tier: "snoozefest",
      isBiggie: false,
      summary: "",
      highlightUrl: null,
    },
  ],
} as DigestEmailProps;

export default DailyDigestEmail;
