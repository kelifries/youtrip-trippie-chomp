interface Env {
  DB: D1Database;
}

const SCORE_MAX = 999_999;
const LEVEL_MIN = 1;
// Level is a monotonic counter — game loops L2-L8 visually after L8 but
// `this.level` keeps climbing (9, 10, 11...). Cap is a sanity ceiling.
const LEVEL_MAX = 999;
const DURATION_MAX = 3600;

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }

  const b = body as { score?: unknown; level?: unknown; duration_s?: unknown };
  const score = toInt(b.score);
  const level = toInt(b.level);
  const duration_s = toInt(b.duration_s);

  if (
    score === null || score < 0 || score > SCORE_MAX ||
    level === null || level < LEVEL_MIN || level > LEVEL_MAX ||
    duration_s === null || duration_s < 0 || duration_s > DURATION_MAX
  ) {
    return new Response(null, { status: 400 });
  }

  await env.DB
    .prepare("INSERT INTO plays (ts, score, level, duration_s) VALUES (?, ?, ?, ?)")
    .bind(Date.now(), score, level, duration_s)
    .run();

  return new Response(null, { status: 204 });
};

function toInt(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return Math.trunc(v);
}
