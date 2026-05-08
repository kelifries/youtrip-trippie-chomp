// Fire-and-forget play logger. Endpoint failure must never affect game UX,
// so all errors are swallowed. sendBeacon survives tab-close; fetch+keepalive
// is the fallback for browsers that reject the beacon (e.g. CORS edge cases —
// not expected here since the endpoint is same-origin, but defensive).

const ENDPOINT = "/api/log-play";

export function logPlay(score: number, level: number, duration_s: number): void {
  const payload = JSON.stringify({ score, level, duration_s });
  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: "application/json" });
      if (navigator.sendBeacon(ENDPOINT, blob)) return;
    }
    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // swallow
  }
}
