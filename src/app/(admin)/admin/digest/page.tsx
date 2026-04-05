"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Check,
  Star,
  Edit3,
  ExternalLink,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

type AdminMatch = {
  matchId: string;
  rankOrder: number;
  featuredInEmail: boolean;
  match: {
    id: string;
    home_score: number | null;
    away_score: number | null;
    kickoff_at: string;
  } | null;
  analysis: {
    id: string;
    match_id: string;
    excitement_score: number;
    primary_tier: string;
    is_biggie: boolean;
    biggie_reason: string | null;
    summary_short: string | null;
    summary_status: string;
    admin_override: boolean;
  } | null;
  homeTeam: { name: string } | null;
  awayTeam: { name: string } | null;
  league: { name: string } | null;
  links: Array<{ id: string; url: string; link_type: string }>;
};

type DigestData = {
  digestRun: {
    id: string;
    digest_date_ist: string;
    approval_status: string;
    approved_at: string | null;
  };
  matches: AdminMatch[];
};

const TIER_OPTIONS = [
  { value: "banger", label: "🔥 Banger" },
  { value: "worth_a_watch", label: "👍 Worth a Watch" },
  { value: "snoozefest", label: "😴 Snoozefest" },
];

export default function AdminDigestPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DigestData | null>(null);
  const [dateStr, setDateStr] = useState(() => {
    const now = new Date();
    const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
    ist.setDate(ist.getDate() - 1);
    return ist.toISOString().split("T")[0];
  });
  const [approving, setApproving] = useState(false);
  const [editingMatch, setEditingMatch] = useState<string | null>(null);
  const [editSummary, setEditSummary] = useState("");
  const [editTier, setEditTier] = useState("");
  const [editLink, setEditLink] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const fetchDigest = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/digest/${dateStr}`);
    if (res.ok) {
      const json = await res.json();
      setData(json);
    } else {
      setData(null);
    }
    setLoading(false);
  }, [dateStr]);

  useEffect(() => {
    fetchDigest();
  }, [fetchDigest]);

  const navigateDate = (delta: number) => {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + delta);
    setDateStr(d.toISOString().split("T")[0]);
  };

  const handleApprove = async () => {
    if (!data) return;
    setApproving(true);
    await fetch(`/api/admin/digest/${dateStr}/approve`, { method: "POST" });
    await fetchDigest();
    setApproving(false);
  };

  const startEdit = (m: AdminMatch) => {
    setEditingMatch(m.matchId);
    setEditSummary(m.analysis?.summary_short || "");
    setEditTier(m.analysis?.primary_tier || "snoozefest");
    setEditLink(m.links?.[0]?.url || "");
  };

  const saveEdit = async (m: AdminMatch) => {
    setSavingEdit(true);

    // Save analysis changes
    if (m.analysis) {
      await fetch(`/api/admin/match-analysis/${m.matchId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary_short: editSummary,
          primary_tier: editTier,
          is_biggie: m.analysis.is_biggie,
        }),
      });
    }

    // Save link
    if (editLink) {
      await fetch(`/api/admin/match-link/${m.matchId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: editLink }),
      });
    }

    setSavingEdit(false);
    setEditingMatch(null);
    await fetchDigest();
  };

  const toggleBiggie = async (m: AdminMatch) => {
    if (!m.analysis) return;
    await fetch(`/api/admin/match-analysis/${m.matchId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        is_biggie: !m.analysis.is_biggie,
        summary_short: m.analysis.summary_short,
        primary_tier: m.analysis.primary_tier,
      }),
    });
    await fetchDigest();
  };

  const toggleFeatured = async (m: AdminMatch) => {
    if (!data) return;
    await fetch(`/api/admin/match-analysis/${m.matchId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        featured_in_email: !m.featuredInEmail,
        digest_run_id: data.digestRun.id,
      }),
    });
    await fetchDigest();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <h1 className="text-lg font-bold text-zinc-900">
            Admin — Digest Review
          </h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigateDate(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium text-zinc-700 min-w-[120px] text-center">
              {dateStr}
            </span>
            <Button variant="outline" size="sm" onClick={() => navigateDate(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        {!data ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center">
            <p className="text-zinc-500">No digest found for {dateStr}</p>
          </div>
        ) : (
          <>
            {/* Status bar */}
            <div className="mb-6 flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4">
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                    data.digestRun.approval_status === "approved"
                      ? "bg-green-100 text-green-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {data.digestRun.approval_status === "approved"
                    ? "✓ Approved"
                    : "⏳ Pending Review"}
                </span>
                <span className="text-sm text-zinc-500">
                  {data.matches.length} matches
                </span>
              </div>
              {data.digestRun.approval_status !== "approved" && (
                <Button
                  onClick={handleApprove}
                  disabled={approving}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {approving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="mr-2 h-4 w-4" />
                  )}
                  Approve & Queue Emails
                </Button>
              )}
            </div>

            {/* Match list */}
            <div className="space-y-3">
              {data.matches.map((m) => (
                <div
                  key={m.matchId}
                  className="rounded-xl border border-zinc-200 bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Row 1: fixture + score */}
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-medium text-zinc-400">
                          #{m.rankOrder}
                        </span>
                        <h3 className="font-bold text-zinc-900">
                          {m.homeTeam?.name || "?"} {m.match?.home_score ?? "-"}{" "}
                          — {m.match?.away_score ?? "-"}{" "}
                          {m.awayTeam?.name || "?"}
                        </h3>
                      </div>

                      {/* Row 2: badges */}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {m.analysis?.is_biggie && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                            ⭐ Biggie
                          </span>
                        )}
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                          {m.analysis?.primary_tier?.replace("_", " ")}
                        </span>
                        <span className="text-xs text-zinc-400">
                          Score: {m.analysis?.excitement_score}
                        </span>
                        {m.featuredInEmail && (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                            In email
                          </span>
                        )}
                      </div>

                      {/* Row 3: summary */}
                      {editingMatch === m.matchId ? (
                        <div className="mt-3 space-y-3">
                          <textarea
                            value={editSummary}
                            onChange={(e) => setEditSummary(e.target.value)}
                            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
                            rows={2}
                          />
                          <div className="flex gap-3">
                            <select
                              value={editTier}
                              onChange={(e) => setEditTier(e.target.value)}
                              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm"
                            >
                              {TIER_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                            <input
                              type="url"
                              placeholder="Highlight URL"
                              value={editLink}
                              onChange={(e) => setEditLink(e.target.value)}
                              className="flex-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm"
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => saveEdit(m)}
                              disabled={savingEdit}
                            >
                              {savingEdit ? (
                                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                              ) : (
                                <Check className="mr-1 h-3 w-3" />
                              )}
                              Save
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditingMatch(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-zinc-600">
                          {m.analysis?.summary_short || "No summary"}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-1 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => startEdit(m)}
                        className="text-xs"
                      >
                        <Edit3 className="mr-1 h-3 w-3" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleBiggie(m)}
                        className="text-xs"
                      >
                        <Star
                          className={`mr-1 h-3 w-3 ${
                            m.analysis?.is_biggie
                              ? "fill-amber-400 text-amber-400"
                              : ""
                          }`}
                        />
                        Biggie
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleFeatured(m)}
                        className="text-xs"
                      >
                        <ExternalLink className="mr-1 h-3 w-3" />
                        {m.featuredInEmail ? "Remove" : "Feature"}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
