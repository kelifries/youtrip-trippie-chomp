# Trippie Chomp — Day-of-Launch Runbook

**Launch:** 2026-05-07
**Production URL:** https://youtrip-trippie-chomp.pages.dev/
**Fallback URL:** https://youtrip-marketing.github.io/youtrip-trippie-chomp/ (gh-pages, kept alive through May 7+1w)
**Rollback tag:** `checkpoint-2026-05-04-prelaunch` (commit `fb8f495`)

---

## Pre-launch checks (5 min, before going live with comms)

Run through these on phone in this order:

- [ ] Hit https://youtrip-trippie-chomp.pages.dev/ — game loads, Trippie face animates, PLAY button responsive
- [ ] Tap PLAY → audio kicks in (silent switch off!), HowToPlayScene renders
- [ ] Tap START GAME → boarding pass anim → L1 plays smoothly
- [ ] Force a game-over → SHARE button → `navigator.share()` opens iOS share sheet with image attached
- [ ] Hit URL inside Instagram IAB (DM yourself the link, tap from inside DM) — full flow works
- [ ] CF Web Analytics dashboard tab open: https://dash.cloudflare.com/f4bf180e30d2849523385e20ead5dd8b/web-analytics
- [ ] GH Actions tab open: https://github.com/YouTrip-Marketing/youtrip-trippie-chomp/actions

If any check fails: **do not push the launch comms yet.** Triage first using sections below.

---

## Production access

| What | Where |
|---|---|
| Production URL | https://youtrip-trippie-chomp.pages.dev/ |
| Repo | https://github.com/YouTrip-Marketing/youtrip-trippie-chomp |
| Production branch | `experimental-redesign` |
| Auto-deploy | GHA on push (`.github/workflows/cf-pages.yml`) — ~90s push-to-live |
| CF Pages dashboard | https://dash.cloudflare.com/f4bf180e30d2849523385e20ead5dd8b/pages/view/youtrip-trippie-chomp |
| CF Web Analytics | https://dash.cloudflare.com/f4bf180e30d2849523385e20ead5dd8b/web-analytics |
| GH Actions log | https://github.com/YouTrip-Marketing/youtrip-trippie-chomp/actions |
| Push access | Terry, Kelicia (any repo collaborator with write access auto-deploys via GHA) |

---

## Hotfix protocol

For a small fix that does NOT require rolling back:

```bash
cd ~/projects/youtrip-trippie-chomp
git checkout experimental-redesign && git pull
# make the fix
git add <files> && git commit -m "hotfix: <what>"
git push origin experimental-redesign
# GHA auto-deploys, ~90s. Watch the run at github.com/YouTrip-Marketing/youtrip-trippie-chomp/actions
```

Then hard-refresh the production URL on phone (Chrome iOS: pull down on URL bar; Safari: tap-and-hold reload). Verify the fix.

**If the fix breaks something else:** see Rollback below.

---

## Rollback protocol

### Quick path — revert just the bad commit (~2 min)

```bash
cd ~/projects/youtrip-trippie-chomp
git checkout experimental-redesign && git pull
git revert HEAD --no-edit         # or git revert <bad-commit-sha> if not the latest
git push origin experimental-redesign
# GHA auto-deploys the reverted state, ~90s
```

### Nuclear path — hard reset to the known-good tag

Use only if multiple commits are bad and revert is messy:

```bash
cd ~/projects/youtrip-trippie-chomp
git checkout experimental-redesign && git pull
git reset --hard checkpoint-2026-05-04-prelaunch
git push --force-with-lease origin experimental-redesign
```

`--force-with-lease` is safer than `--force` — it'll abort if someone else pushed since you pulled.

### CF dashboard one-click rollback (alternative)

If the git path is somehow broken: CF Pages dashboard → project → Deployments → find the last good deployment → "Rollback to this deployment". Instant, no rebuild.

---

## Watchlist (first 3 hours after launch)

What to monitor + what's a real signal vs noise:

| Signal | What it means | Action |
|---|---|---|
| CF Web Analytics pageviews spike sharply | Launch comms landing | ✅ expected |
| Pageviews drop to 0 mid-day | Game offline / CF outage | 🔴 escalate, check CF status, fall back to gh-pages |
| Failed GH Actions run | Push didn't deploy | 🟡 check logs, manual fix, re-push |
| User reports "no audio" | Almost certainly silent switch on user's phone | 🟢 reply with "check Ring/Silent switch on side of phone" |
| User reports "game won't load" | Could be network or browser-specific | 🟡 ask for browser + URL they used, verify URL on your phone |
| User reports "share button broken" | Could be IG IAB navigator.share quirk | 🟡 IG IAB has known limitations; document fallback (download image, manual upload) |
| User reports score is "$999,999" | The brand-safety cap working as designed | 🟢 not a bug |

CF Web Analytics tab: refresh every 15-30 min for the first 3 hours. After that, hourly is fine.

---

## Common issue triage

### "I don't hear audio"
> "Check the Ring/Silent switch on the side of your iPhone — the small switch above the volume buttons. If you see orange, it's set to silent and web games can't play sound. Flip it toward the screen to ring mode and reload."

Most common issue. Not a code bug. Status bar shows a bell-with-slash icon when silent.

### "Game shows old version after update"
Browser cache. Tell them to:
- Chrome iOS: pull-to-refresh, or close tab + reopen
- Safari: tap-and-hold reload button → "Reload Without Content Blockers"
- Or open in private/incognito mode

### "Share image looks low-quality"
The image is 1080×1920 (IG Story spec). Some DM previews compress aggressively — actual share to IG Story renders at full res.

### "Score went into the millions and got capped"
By design. Cap at $999,999 prevents fake share posts; no false positive for real users at this threshold.

### CF Pages outage / build failure
Fall back to gh-pages: https://youtrip-marketing.github.io/youtrip-trippie-chomp/ — still alive, last known good build. **However**, the YT app webview is hardcoded to the CF URL — for app users, gh-pages doesn't help unless YT tech ships a new app build. Web-direct visitors can use gh-pages.

---

## Contact tree

| Issue type | Who | What |
|---|---|---|
| Code bug / build failure | Terry → next Claude session | Reproduce, fix, push |
| Comms / copy issue | Kelicia | Caption, URL, hashtag, IG Story sticker |
| Visual / creative issue | Cass | Layout, brand alignment, polish |
| Campaign / budget / ad issue | Sandra, Cheryl | Spend, perf, KV |
| YT app webview issue | YT tech team | URL config, native bridge |
| Cloudflare account access | Terry only (CF account holder) | Dashboard, API tokens |

---

## Post-launch (first 24 hours)

- [ ] First-hour smoke check — confirm no error spike on CF Analytics
- [ ] Note observed launch traffic peak — useful baseline for future launches
- [ ] Note any user complaints + categorize (audio / load / share / other)
- [ ] If a hotfix shipped, tag it: `git tag -a v1.0.1 -m "hotfix description" && git push --tags`
- [ ] If launch is clean by EOD: tag `git tag -a v1.0 -m "Travel Fund launch May 7" && git push --tags`

---

## Useful refs

- `LAUNCH-CHECKLIST.md` — pre-launch readiness (mostly closed by 2026-05-06)
- `HANDOFF.md` — current build state
- `CLAUDE.md` — project-level instructions
- `~/life/marketing-org/dev/trippie-chomp/CONTEXT.md` — marketing why
- Live deployment list: https://github.com/YouTrip-Marketing/youtrip-trippie-chomp/deployments
