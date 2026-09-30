// The timer's own pages tell it the time as they open, and when they come back into view (at most every five
// minutes). That sets the timer's clock if it's behind (src/lib/clock.ts). A failure doesn't matter: the next page
// tries again. The phone app tells the timer when it syncs (src/features/data/sync.ts).
const EVERY_MS = 5 * 60_000;

export function watchTimerClock(fetchImpl: typeof fetch = (...args) => fetch(...args)): () => void {
  let last = -Infinity;
  const tell = () => {
    if (document.visibilityState !== "visible" || performance.now() - last < EVERY_MS) return;
    last = performance.now();
    fetchImpl("/api/sync/clock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ now: Date.now() }),
    }).catch(() => undefined);
  };
  tell();
  document.addEventListener("visibilitychange", tell);
  return () => document.removeEventListener("visibilitychange", tell);
}
