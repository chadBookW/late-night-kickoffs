"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle } from "lucide-react";

const LEAGUES = [
  { code: "PL", name: "Premier League", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { code: "LL", name: "La Liga", flag: "🇪🇸" },
  { code: "UCL", name: "Champions League", flag: "🏆" },
  { code: "BL", name: "Bundesliga", flag: "🇩🇪" },
  { code: "SA", name: "Serie A", flag: "🇮🇹" },
  { code: "L1", name: "Ligue 1", flag: "🇫🇷" },
];

export default function PreferencesPage() {
  const [token, setToken] = useState<string | null>(null);
  const [leagues, setLeagues] = useState<string[]>([]);
  const [frequency, setFrequency] = useState("daily");
  const [status, setStatus] = useState<"loading" | "ready" | "saving" | "saved" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (!t) {
      setStatus("error");
      setError("Missing token");
      return;
    }
    setToken(t);

    fetch(`/api/preferences?token=${t}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setStatus("error");
          setError(data.error);
        } else {
          setLeagues(data.leagues || []);
          setFrequency(data.frequency || "daily");
          setStatus("ready");
        }
      })
      .catch(() => {
        setStatus("error");
        setError("Failed to load preferences");
      });
  }, []);

  const toggleLeague = (code: string) => {
    setLeagues((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const handleSave = async () => {
    if (!token || leagues.length === 0) return;
    setStatus("saving");

    try {
      const res = await fetch("/api/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, leagues, frequency }),
      });

      if (!res.ok) throw new Error("Failed to save");
      setStatus("saved");
      setTimeout(() => setStatus("ready"), 2000);
    } catch {
      setStatus("error");
      setError("Failed to save preferences");
    }
  };

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 px-6">
        <div className="text-center">
          <h1 className="mb-2 text-2xl font-bold text-white">Something went wrong</h1>
          <p className="text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 px-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">Your Preferences</h1>
          <p className="mt-1 text-gray-400">Choose which leagues and how often</p>
        </div>

        <div className="space-y-4 rounded-xl border border-gray-800 bg-gray-900 p-6">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">Leagues</label>
            <div className="flex flex-wrap gap-2">
              {LEAGUES.map((league) => (
                <button
                  key={league.code}
                  type="button"
                  onClick={() => toggleLeague(league.code)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium transition-all ${
                    leagues.includes(league.code)
                      ? "bg-green-500/20 text-green-400 ring-1 ring-green-500/40"
                      : "bg-white/5 text-gray-400 hover:bg-white/10"
                  }`}
                >
                  {league.flag} {league.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">Frequency</label>
            <div className="flex gap-3">
              {[
                { value: "daily", label: "Daily" },
                { value: "weekends_only", label: "Weekends only" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFrequency(opt.value)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                    frequency === opt.value
                      ? "bg-green-500/20 text-green-400 ring-1 ring-green-500/40"
                      : "bg-white/5 text-gray-400 hover:bg-white/10"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={handleSave}
            disabled={status === "saving" || leagues.length === 0}
            className="w-full bg-green-600 text-white hover:bg-green-700"
          >
            {status === "saving" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : status === "saved" ? (
              <span className="flex items-center gap-2"><CheckCircle className="h-4 w-4" /> Saved!</span>
            ) : (
              "Save preferences"
            )}
          </Button>
        </div>

        <p className="text-center text-xs text-gray-500">
          <a href={`/unsubscribe?token=${token}`} className="underline hover:text-gray-400">
            Unsubscribe from all emails
          </a>
        </p>
      </div>
    </div>
  );
}
