"use client";

import { motion } from "framer-motion";
import { CheckCircle, Trophy, Clock, ShieldCheck, Zap } from "lucide-react";
import Image from "next/image";

const ease = [0.25, 0.1, 0.25, 1] as const;

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay, ease },
  }),
};

const PERKS = [
  {
    icon: Trophy,
    title: "Ranked by excitement",
    desc: "Every match scored algorithmically so bangers float to the top.",
  },
  {
    icon: ShieldCheck,
    title: "Spoiler-free by default",
    desc: "Scores are hidden until you choose to reveal — watch first, read later.",
  },
  {
    icon: Clock,
    title: "In your inbox every morning",
    desc: "Delivered before your day starts. No app to check, no feeds to scroll.",
  },
  {
    icon: Zap,
    title: "100% free, zero spam",
    desc: "No ads, no paywalls, no data selling. One-click unsubscribe anytime.",
  },
];

export default function ConfirmPage() {
  return (
    <div className="relative min-h-screen">
      {/* Full-page stadium background — same as landing */}
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/hero-stadium.jpg')" }}
      />
      <div className="fixed inset-0 bg-gradient-to-b from-black/70 via-black/55 to-black/85" />

      {/* Nav */}
      <motion.nav
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease }}
        className="relative z-10 flex items-center justify-between px-2 pt-3 md:px-4"
      >
        <a href="/">
          <Image
            src="/logo-Photoroom.png"
            alt="Late Night Kickoffs"
            width={240}
            height={120}
            className="-ml-4 drop-shadow-lg"
            priority
          />
        </a>
      </motion.nav>

      {/* Confirmation hero */}
      <section className="relative z-10 px-6 pt-12 pb-10 md:pt-20 md:pb-14">
        <div className="mx-auto max-w-lg text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease }}
          >
            <CheckCircle className="mx-auto mb-5 h-16 w-16 text-emerald-400 drop-shadow-lg" />
          </motion.div>

          <motion.h1
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={0.15}
            className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl"
          >
            You&apos;re in!
          </motion.h1>

          <motion.p
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={0.3}
            className="mx-auto mt-4 max-w-md text-base leading-relaxed text-zinc-300"
          >
            Your subscription is confirmed. You&apos;ll receive your first
            digest the next morning there are matches from your selected leagues.
          </motion.p>
        </div>
      </section>

      {/* Why this is great */}
      <section className="relative z-10 px-6 pb-20">
        <div className="mx-auto max-w-xl">
          <motion.p
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={0.45}
            className="mb-8 text-center text-sm font-semibold uppercase tracking-wide text-zinc-400"
          >
            Here&apos;s what&apos;s coming to your inbox
          </motion.p>

          <div className="grid gap-4 sm:grid-cols-2">
            {PERKS.map((perk, i) => (
              <motion.div
                key={perk.title}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                custom={0.5 + i * 0.1}
                className="rounded-xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur-md"
              >
                <perk.icon className="mb-3 h-6 w-6 text-emerald-400" />
                <h3 className="mb-1 text-sm font-semibold text-white">
                  {perk.title}
                </h3>
                <p className="text-sm leading-relaxed text-zinc-400">
                  {perk.desc}
                </p>
              </motion.div>
            ))}
          </div>

          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={1}
            className="mt-10 text-center"
          >
            <a
              href="/"
              className="inline-block rounded-xl bg-emerald-600 px-8 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
            >
              Back to home
            </a>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 1.2, ease }}
        className="relative z-10 border-t border-white/10 py-8 text-center text-sm text-zinc-500"
      >
        Late Night Kickoffs &copy; {new Date().getFullYear()}
      </motion.footer>
    </div>
  );
}
