# Grill: Poker tracker — Google Sheet → Cloudflare Worker + D1
Date: 2026-10-16

## Intent
Replace the Google Sheet "Poker Calculator" (and its Apps Script sidebar) with a small web app on Cloudflare that friends can open to see the current game, the dashboard and players, while only selected people can run a game.

## Constraints
- Cloudflare Workers + D1 only; deployed on Kit's own custom domain.
- Cloudflare Access (email OTP, Zero Trust free plan) is the only auth; no login system in the app.
- Keep it simple: manual refresh, no realtime.

## Key decisions
- Decision: app fully replaces the sheet; sheet becomes archive. Reason: avoid two sources of truth. Alternative considered: keep both in sync.
- Decision: public read, admin write. Reason: friends can see results without OTP / seats. Alternative considered: everything behind Access.
- Decision: admin pages under `/admin/*`, protected by a self-hosted Access app on that path (policy "Poker Apps"); Worker also verifies the Access JWT. Reason: an "Edit" button on public pages triggers login.
- Decision: buy-ins stored as per-player totals, not an event log. Reason: simplicity.
- Decision: chip counting by denomination, hard-coded 1 白 / 5 綠 / 10 藍 / 50 紅 / 100 黑.
- Decision: chip imbalance allowed; host chosen at end of game; difference absorbed by host or by winners pro-rata to winnings (choice per game).
- Decision: no who-pays-whom settlement; show adjusted P/L per player.
- Decision: one running game at a time; closed games are read-only in the app (fixes via D1 backend).
- Decision: new players created inline on the current-game page, admin only; nickname set by admin only; public display defaults to nickname with a toggle.
- Decision: dashboard units chips and BB only (no CAD); keep `include_dashboard` flag; heads-up concept dropped.
- Decision: game 91 in the Calculator sheet is a leftover template, not migrated.

## Surfaced assumptions
- Blank `include_dashboard` (games 66–90) means TRUE.
- `[system]` rows in history (chip imbalances) are migrated as-is, as their own adjustment records, and excluded from player rankings.
- Adj. above water = (wins + 1) / (games + 2) (Laplace smoothing), matching the sheet.

## Out of scope
- Mahjong / dinner / payment settlements (1207-1208 summary sheet).
- e-transfer details of players.
- Event log of individual rebuys, realtime updates, configurable chip sets, CAD reporting.
