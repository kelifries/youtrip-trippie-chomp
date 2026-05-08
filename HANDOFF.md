# Handoff — 2026-05-07 (launch day, play-stats backend staged)

## Play-stats backend (staged, NOT deployed yet — ship May 8 AM SGT)

**What:** Logs every game-end (death with 0 lives) to a Cloudflare D1 table. Score / level / duration_s only. No client_id, no share-event tracking, no leaderboard.

**Files added (this session):**
- `migrations/0001_init.sql` — D1 schema (one table `plays`)
- `wrangler.toml` — `DB` binding for `chomp-stats` DB (database_id placeholder)
- `functions/api/log-play.ts` — Pages Function POST handler, validates + inserts
- `src/systems/Stats.ts` — fire-and-forget `logPlay()` (sendBeacon + fetch keepalive)
- `src/scenes/GameScene.ts` — `gameStartMs` field, `logPlay()` call at death

**Build verified clean** (`npm run build` passes, tsc + vite emit dist).

**Manual one-time before deploy (Terry, ~5 min):**
```bash
cd ~/projects/youtrip-trippie-chomp

# 1. Create the D1 database (copy the database_id from the output)
npx wrangler d1 create chomp-stats

# 2. Paste the database_id into wrangler.toml (replace REPLACE_AFTER_D1_CREATE)

# 3. Apply schema to remote D1
npx wrangler d1 execute chomp-stats --remote --file=migrations/0001_init.sql

# 4. CF dashboard: Pages → youtrip-trippie-chomp → Settings → Functions
#    → Bindings → D1 → Add → Variable name `DB` → Database `chomp-stats`
#    (this is REQUIRED — wrangler.toml alone does not configure Pages production bindings)

# 5. Commit + push to experimental-redesign → GHA auto-deploys
```

**Verify after deploy:**
```bash
# Play once on the live site, then:
npx wrangler d1 execute chomp-stats --remote --command "SELECT COUNT(*) FROM plays"
```

**Useful queries (anytime):**
```bash
# Total plays
npx wrangler d1 execute chomp-stats --remote --command "SELECT COUNT(*) FROM plays"

# Plays in last 24h
npx wrangler d1 execute chomp-stats --remote --command \
  "SELECT COUNT(*) FROM plays WHERE ts > unixepoch()*1000 - 86400000"

# Score distribution
npx wrangler d1 execute chomp-stats --remote --command \
  "SELECT MIN(score) min, ROUND(AVG(score)) avg, MAX(score) max, COUNT(*) n FROM plays"

# Level reached histogram
npx wrangler d1 execute chomp-stats --remote --command \
  "SELECT level, COUNT(*) n FROM plays GROUP BY level ORDER BY level"

# Average session length
npx wrangler d1 execute chomp-stats --remote --command \
  "SELECT ROUND(AVG(duration_s)) avg_seconds FROM plays"
```

**Risks accepted (per Terry, 2026-05-07):**
- No client_id → cannot dedupe one user's 50 plays from 50 unique users.
- No share-event tracking → can count plays + scores but not share-rate (the actual CONTEXT.md KPI). Worth revisiting after launch read.
- Endpoint failure isolated from game UX (fire-and-forget + try/catch).

---

# Handoff — 2026-05-06 PM (T-1 to May 7)

## Launch readiness

CF Pages live, all dev-owned launch-critical items shipped + day-of `RUNBOOK.md` in repo. Source of truth for pre-launch: `LAUNCH-CHECKLIST.md`. Source of truth for day-of ops: `RUNBOOK.md`.

## Live deploys

- **CF Pages (production):** https://youtrip-trippie-chomp.pages.dev/
- **gh-pages (fallback):** https://youtrip-marketing.github.io/youtrip-trippie-chomp/ — sunset ~May 7+1w
- **Auto-deploy:** GHA on push to `experimental-redesign` (`.github/workflows/cf-pages.yml`)
- **CF Web Analytics:** beacon embedded (token `724f654dbf97465bbb2d8120e1161ec9`)
- **Rollback tag:** `checkpoint-2026-05-04-prelaunch` (at `fb8f495`)

## Latest build state

8 levels: SG → TYO → SPACE (L3) → SYD → SEL → SEA underwater (L6) → KUL → BKK. Loop L2–L8 after L8.

**Powerups:** LASER, MAGNET, LOCK (5s active each).

**Polish baseline:** code-rendered scoreboard with tap-anywhere advance, per-level taglines + L1 cold-start, maze inner-glow flicker, Trippie anchor glow, bonus full-screen dim with alive-looking monsters (with power-pellet visual flash override), audio tick/pop/whoosh, gentler speed ramp, mobile sizing locked at 480x720.

## What shipped 2026-05-06 (full day)

- ✅ **CF Pages migration** — project, GHA workflow with `cloudflare/wrangler-action@v3`, repo secrets
- ✅ **CF Web Analytics** — beacon in index.html (replaces GA4)
- ✅ **Mobile audio resilience** — defensive ctx.resume, iOS 'interrupted' state, silent-buffer unlock, native-event document-level capture-phase listener (root cause was Ring/Silent switch, but defenses retained)
- ✅ **Bonus level visual fix** — `powerPelletFlashTimer` overrides bonus-render-alive rule
- ✅ **Scoreboard tap-anywhere** — overlay interactive after 2.5s
- ✅ **Share image rewrite (PM)** — replaced programmatic canvas drawing with pre-designed `share-card.webp` overlay (87KB, alpha-channel WebP). Code now: cover-fit bg → drawImage(share-card) → drawText(score in mint #10DBAC at y=620). Asset bakes "I SAVED", Trippie, prize copy, CTA pill, brand lockup, T&Cs.
- ✅ **Share score font fix (PM)** — dropped `font-weight: 700` (Press Start 2P is 400-only; 700 was synthesizing bold and didn't match the asset's baked text). Added `await document.fonts.load()` before canvas render.
- ✅ **Share score y-position** — baseline 580 → 620 (better centered in gap between "I SAVED" and Trippie)
- ✅ **Debug hook gating** — `?level`, `?sb`, `?bp`, `N` key all behind `import.meta.env.DEV`
- ✅ **Asset prune** — removed unused `scoreboard-frame.webp` + `worldmap.webp` (~97KB)
- ✅ **Self-host Press Start 2P** — 4.6KB latin subset, removed Google Fonts CDN dependency
- ✅ **Score-cap brand-safety** — `SHARE_SCORE_MAX = 999_999` clamps share artifact only
- ✅ **Day-of RUNBOOK.md** — pre-launch checks, hotfix/rollback protocols, watchlist, common-issue triage, contact tree
- ✅ **IG IAB tested** — DM-link tap on iPhone, audio + share + game all functional
- ✅ **YT app webview tested** — pointed at CF URL, in-app browser passes through

## Critical pending — T-1

| Item | Owner | Blocker |
|---|---|---|
| Cass final visual approval on the live CF build | Cass | external |
| Day-of-launch rollback drill | dev | — |
| (Optional) iPhone SE / Android device QA | dev | — |

**Note:** Kelicia "campaign URL + hashtag" ask is no longer required — those strings are not in runtime code anymore (they live only in the share-card.webp asset, baked at design time, which the asset already finalized).

## Decisions locked

- **Hosting:** CF Pages primary, gh-pages fallback through May 7+1w
- **Auth/deploy:** GHA + wrangler-action (Kelicia push-to-deploy without CF account)
- **Analytics:** CF Web Analytics only (no GA4)
- **Score manipulation:** client-side cap on share artifact at $999,999
- **CSP frame-ancestors:** dropped (webview is direct, not iframed)
- **Share image architecture:** asset overlay > programmatic draw. Designer owns the card; code paints only dynamic data (score).
- **Custom domain `play.youtrip.com`:** KIV post-launch

## Open thread (separate convo)

- Auto-applied @youtripsg sticker on IG Story is **not possible from web** — needs native bridge to `instagram-stories://share` deep-link. Flagged to Kelicia / native team.
- Stale TBD references in `COPY.md:59`, `CREATIVE-BRIEF.md:155` (`@youtrip` vs `@youtrip_sg`). Locked policy-wise but text not yet swept.

## Useful refs

- `RUNBOOK.md` — day-of-launch ops (pre-flight checks, hotfix, rollback, triage, contact tree)
- `LAUNCH-CHECKLIST.md` — pre-launch readiness
- `CREATIVE-BRIEF.md` — locked direction
- `BUILD-BLOCKS.md` — execution plan
- `CLAUDE.md` — project-level instructions
- `~/life/marketing-org/dev/trippie-chomp/CONTEXT.md` — marketing why
- `.github/workflows/cf-pages.yml` — CF auto-deploy
- `~/Downloads/share-y620.png` — final share image render preview (sample $12,500)
