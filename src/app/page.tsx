"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, CheckCircle, Play } from "lucide-react";
import Image from "next/image";

/* ─── animation variants ─── */

const ease = [0.25, 0.1, 0.25, 1] as const;

const blurReveal = {
  hidden: { opacity: 0, filter: "blur(8px)" },
  visible: {
    opacity: 1,
    filter: "blur(0px)",
    transition: { duration: 0.8, ease },
  },
};

const slideUp = {
  hidden: { y: "100%" },
  visible: (delay: number) => ({
    y: "0%",
    transition: { duration: 0.7, delay, ease },
  }),
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay, ease },
  }),
};

const cardReveal = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: 0.15 * i, ease },
  }),
};

/* ─── mock data ─── */

const MOCK_MATCHES = [
  {
    tier: "banger" as const,
    badge: "BANGER",
    score: "3 - 2",
    home: "Arsenal",
    away: "Liverpool",
    league: "Premier League",
    time: "89' Penalty",
    summary:
      "Five goals, relentless pace, and a controversial late penalty made this impossible to look away from.",
    tint: "bg-orange-50 ring-orange-200/60",
    badgeClass: "bg-orange-100 text-orange-800 border-orange-200",
  },
  {
    tier: "worth_a_watch" as const,
    badge: "WORTH A WATCH",
    score: "1 - 0",
    home: "Man City",
    away: "Chelsea",
    league: "Premier League",
    time: "78' Red Card",
    summary:
      "Tight defensive battle broken open by a late goal and a controversial red card.",
    tint: "bg-zinc-50 ring-zinc-200/60",
    badgeClass: "bg-amber-100 text-amber-800 border-amber-200",
  },
  {
    tier: "snoozefest" as const,
    badge: "SNOOZEFEST",
    score: "0 - 0",
    home: "Wolves",
    away: "Bournemouth",
    league: "Premier League",
    time: "Full Time",
    summary:
      "Forgettable affair with few clear-cut chances. We saved you 90 minutes.",
    tint: "bg-zinc-50 ring-zinc-200/60",
    badgeClass: "bg-zinc-100 text-zinc-600 border-zinc-200",
  },
];

/* ─── page ─── */

export default function LandingPage() {
  const [email, setEmail] = useState("");
  const [selectedLeagues, setSelectedLeagues] = useState<string[]>(["PL", "CL"]);
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const LEAGUE_OPTIONS = [
    { code: "PL", label: "Premier League", emoji: "🏴\u200D☠️" },
    { code: "CL", label: "Champions League", emoji: "🏆" },
  ];

  const toggleLeague = (code: string) => {
    setSelectedLeagues((prev) =>
      prev.includes(code) ? prev.filter((l) => l !== code) : [...prev, code]
    );
  };

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, leagues: selectedLeagues }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Something went wrong");
      }

      setStatus("success");
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Something went wrong"
      );
      setStatus("error");
    }
  };

  return (
    <div className="relative min-h-screen">
      {/* Full-page stadium background */}
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/hero-stadium.jpg')" }}
      />
      <div className="fixed inset-0 bg-gradient-to-b from-black/70 via-black/55 to-black/85" />

      {/* ── Nav ── */}
      <motion.nav
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease }}
        className="relative z-10 flex items-center justify-between px-2 pt-3 md:px-4"
      >
        <Image
          src="/logo-Photoroom.png"
          alt="Late Night Kickoffs"
          width={240}
          height={120}
          className="-ml-4 drop-shadow-lg"
          priority
        />
        <a
          href="#subscribe"
          className="mr-4 -mt-8 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 md:mr-6"
        >
          Contact Us
        </a>
      </motion.nav>

      {/* ── Hero ── */}
      <section className="relative px-6 pt-16 pb-16 md:pt-24 md:pb-20 lg:pt-32 lg:pb-24">
        <div className="mx-auto max-w-2xl text-center">
          {/* Headline */}
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl md:text-6xl">
            <span className="block overflow-hidden">
              <motion.span
                className="block"
                variants={slideUp}
                initial="hidden"
                animate="visible"
                custom={0.15}
              >
                Know which matches
              </motion.span>
            </span>
            <span className="block overflow-hidden">
              <motion.span
                className="block text-emerald-400"
                variants={slideUp}
                initial="hidden"
                animate="visible"
                custom={0.25}
              >
                are worth watching
              </motion.span>
            </span>
          </h1>

          {/* Subheadline */}
          <motion.p
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={0.5}
            className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-zinc-300 md:text-lg"
          >
            A ranked, spoiler-free digest of yesterday&apos;s football — scored
            by excitement — delivered to your inbox every morning.
          </motion.p>

          {/* CTA form */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={0.7}
          >
            {status === "success" ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, ease }}
                className="mx-auto mt-10 max-w-sm rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-8 backdrop-blur-sm"
              >
                <CheckCircle className="mx-auto mb-3 h-10 w-10 text-emerald-400" />
                <h3 className="text-lg font-semibold text-white">
                  Check your inbox
                </h3>
                <p className="mt-2 text-sm text-zinc-300">
                  We&apos;ve sent a confirmation link to{" "}
                  <strong className="text-white">{email}</strong>. Click it
                  to activate your digest.
                </p>
              </motion.div>
            ) : (
              <form
                onSubmit={handleSubscribe}
                id="subscribe"
                className="mx-auto mt-10 max-w-md space-y-3 scroll-mt-32"
              >
                <div className="flex flex-wrap justify-center gap-2 mb-1">
                  {LEAGUE_OPTIONS.map((league) => (
                    <button
                      key={league.code}
                      type="button"
                      onClick={() => toggleLeague(league.code)}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                        selectedLeagues.includes(league.code)
                          ? "bg-emerald-600 text-white ring-2 ring-emerald-400/50"
                          : "bg-white/10 text-zinc-400 ring-1 ring-white/10 hover:bg-white/15 hover:text-zinc-200"
                      }`}
                    >
                      {league.emoji} {league.label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    type="email"
                    required
                    placeholder="you@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 flex-1 rounded-xl border-white/10 bg-white/10 px-4 text-base text-white placeholder:text-zinc-400 backdrop-blur-sm focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20"
                  />
                  <Button
                    type="submit"
                    disabled={status === "loading" || selectedLeagues.length === 0}
                    className="h-12 rounded-xl bg-emerald-600 px-8 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 focus-visible:ring-emerald-500/20 disabled:opacity-50"
                  >
                    {status === "loading" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Get the digest"
                    )}
                  </Button>
                </div>

                {status === "error" && (
                  <p className="text-sm text-red-600">{errorMsg}</p>
                )}

                <p className="text-xs text-zinc-400">
                  Free forever. No spam. One-click unsubscribe.
                </p>
              </form>
            )}
          </motion.div>
        </div>
      </section>

      {/* ── Proof of Value — Mockup Stack ── */}
      <section className="relative px-6 pb-24">
        <div className="mx-auto max-w-2xl">
          <Separator className="mb-16 bg-white/10" />

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5 }}
            className="mb-10 text-center text-sm font-semibold uppercase tracking-wide text-zinc-400"
          >
            A preview of your daily digest
          </motion.p>

          <div className="space-y-4">
            {MOCK_MATCHES.map((match, i) => (
              <motion.div
                key={i}
                variants={cardReveal}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-40px" }}
                custom={i}
              >
                <Card
                  className={`border-0 bg-white/[0.07] ring-1 ring-white/10 backdrop-blur-md`}
                >
                  <CardHeader>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        className={`${match.badgeClass} border text-[11px] font-bold uppercase`}
                      >
                        {match.tier === "banger" && "🔥 "}
                        {match.tier === "worth_a_watch" && "👍 "}
                        {match.tier === "snoozefest" && "😴 "}
                        {match.badge}
                      </Badge>
                      <span className="text-xs text-zinc-400">
                        {match.league}
                      </span>
                    </div>
                    <CardTitle className="mt-1 flex items-baseline gap-3 text-base font-semibold text-white sm:text-lg">
                      <span>
                        {match.home} vs {match.away}
                      </span>
                      <span className="font-mono text-lg font-bold tracking-wider text-emerald-400 sm:text-xl">
                        {match.score}
                      </span>
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <p className="text-sm leading-relaxed text-zinc-300">
                      &ldquo;{match.summary}&rdquo;
                    </p>

                    {/* Video thumbnail placeholder */}
                    <div className="group relative flex h-32 cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-white/[0.05] ring-1 ring-white/10 sm:h-40">
                      <div className="flex flex-col items-center gap-1.5 text-zinc-400 transition-colors group-hover:text-emerald-400">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 shadow-sm ring-1 ring-white/20">
                          <Play className="h-4 w-4 fill-current" />
                        </div>
                        <span className="text-xs font-medium">
                          Watch Highlights
                        </span>
                      </div>
                      <span className="absolute bottom-2 right-3 font-mono text-[11px] text-zinc-500">
                        {match.time}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <motion.footer
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, ease }}
        className="relative border-t border-white/10 py-8 text-center text-sm text-zinc-500"
      >
        Late Night Kickoffs &copy; {new Date().getFullYear()}
      </motion.footer>
    </div>
  );
}
