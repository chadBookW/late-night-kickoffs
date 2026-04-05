"use client";

import { useEffect, useState } from "react";
import { MailX } from "lucide-react";

export default function UnsubscribePage() {
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (!token) {
      setStatus("error");
      return;
    }

    fetch(`/api/unsubscribe?token=${token}`)
      .then((res) => {
        if (res.ok) setStatus("done");
        else setStatus("error");
      })
      .catch(() => setStatus("error"));
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 px-6">
      <div className="max-w-md text-center">
        {status === "loading" && (
          <p className="text-gray-400">Unsubscribing...</p>
        )}
        {status === "done" && (
          <>
            <MailX className="mx-auto mb-4 h-16 w-16 text-gray-400" />
            <h1 className="mb-2 text-3xl font-bold text-white">Unsubscribed</h1>
            <p className="mb-6 text-gray-400">
              You won&apos;t receive any more digest emails. If this was a mistake,
              you can always re-subscribe from the homepage.
            </p>
            <a
              href="/"
              className="text-sm text-green-400 underline underline-offset-4 hover:text-green-300"
            >
              Back to home
            </a>
          </>
        )}
        {status === "error" && (
          <>
            <h1 className="mb-2 text-2xl font-bold text-white">Something went wrong</h1>
            <p className="text-gray-400">Invalid or expired link.</p>
          </>
        )}
      </div>
    </div>
  );
}
