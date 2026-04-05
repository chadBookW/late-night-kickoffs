// IST = UTC+5:30
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export function nowIST(): Date {
  const utcNow = new Date();
  return new Date(utcNow.getTime() + IST_OFFSET_MS);
}

export function yesterdayIST(): { dateStr: string; utcFrom: string; utcTo: string } {
  const ist = nowIST();
  ist.setDate(ist.getDate() - 1);
  const year = ist.getFullYear();
  const month = String(ist.getMonth() + 1).padStart(2, "0");
  const day = String(ist.getDate()).padStart(2, "0");
  const dateStr = `${year}-${month}-${day}`;

  // Yesterday midnight IST to today midnight IST in UTC
  const startIST = new Date(`${dateStr}T00:00:00+05:30`);
  const endIST = new Date(`${dateStr}T23:59:59+05:30`);

  return {
    dateStr,
    utcFrom: startIST.toISOString().split("T")[0],
    utcTo: endIST.toISOString().split("T")[0],
  };
}

export function toISTDate(utcDateStr: string): string {
  const utc = new Date(utcDateStr);
  const ist = new Date(utc.getTime() + IST_OFFSET_MS);
  const year = ist.getFullYear();
  const month = String(ist.getMonth() + 1).padStart(2, "0");
  const day = String(ist.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Given an IST date string (YYYY-MM-DD), return the UTC dateFrom/dateTo
 * that fully covers that IST day.
 * IST 2026-04-05 00:00 = UTC 2026-04-04 18:30
 * IST 2026-04-05 23:59 = UTC 2026-04-05 18:29
 * So we need to query football-data.org for dateFrom=Apr 4, dateTo=Apr 5.
 */
export function istDateToUtcRange(istDateStr: string): { utcFrom: string; utcTo: string } {
  const startIST = new Date(`${istDateStr}T00:00:00+05:30`);
  const endIST = new Date(`${istDateStr}T23:59:59+05:30`);
  return {
    utcFrom: startIST.toISOString().split("T")[0],
    utcTo: endIST.toISOString().split("T")[0],
  };
}

export function formatMatchweekFromRound(round: string): number | null {
  const match = round.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}
