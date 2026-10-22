# Open items

Status as of 21 October 2026, two days before the Friday 23 October noon PDT deadline. Items are ordered by how much they affect the demo and the submission. The older [readiness audit](FRIDAY-READINESS-AUDIT.md) predates several fixes (for example, calendar matching now requires a unique scheduling identity), so treat it as history, not a current checklist.

## Must do before submitting

1. **Make the repository safe to publish.**
   - Switch the repo to public only after the items below are cleared. It is private today.
   - `design/reference/` holds Bee's marketing screenshots and App Store images. `design/assets/bee-lilac.webp` and `bee-macro.jpg` are third-party images. Remove them, or confirm they may be redistributed, and replace them with licensed or original assets.
   - `docs/video-script.md` names a real service in one shot ("Send notes to Disability Services"). Rename it or keep the planned blur.
   - `app/audit-sample.json` is no longer tracked (it quotes real transcripts, including other people). Regenerate it locally with `npm run audit-sample` when needed.
2. ~~Port v5 onto the backend.~~ Done: `npm start` serves v5 at `/` with Demo and Your Bee modes. The older screens remain at `/workspace` and `/legacy`. Remaining: real Bee data on this account is stale (to-dos stop in May; Bee reports every speaker as Unknown), so the live fork is honest but quiet. Rehearse with a fresh `npm run ingest`.
3. **Connect the demo Google account** so the message and calendar holds are real:
   `gog auth add <demo-email> --services gmail,calendar --gmail-scope send`, then set `LATENT_DEMO_ACCOUNT`, `LATENT_DEMO_CALENDAR` and `LATENT_EXTERNAL_ACTIONS=1`. Rehearse a partial failure. If the connector is down on the day, show the prepared action honestly and do not animate a fake success.
4. **Rehearse the live moment end to end.** Stream event, new fork within about five seconds, reconnect catch-up. The recovery path is covered by a test; a real attributed Bee event has not been demonstrated.
5. **Submission package.** Demo video, Devpost text, product feedback, friction log, cover image and 3 to 5 screenshots (screenshots are in `docs/screenshots/`).

## Should do

6. **Measured proof page.** Retired-count audit accuracy, the Jev / Liquid d1 / both / plain-AI comparison table, and tests passing. `npm run eval` already prints a table; it shows "not configured" until models are connected, and that is the honest result today.
7. **Jev and Liquid d1.** Settings now stores keys, tests connections, scores rows and asks both about a promise. Jev has no endpoint yet. The local Liquid d1 (Splash) answered with HTTP 401 in testing, so its key or server auth needs fixing.
8. ~~Replace the unlicensed font.~~ Done: Geist and Instrument Serif (OFL) are self-hosted in `app/public/fonts/`.
9. **Owner audit.** The one-time 40-item hand check that turns the auto-label agreement into an accuracy number.
10. **Wrapped card.** One shareable card built only from measured numbers. Not started.

## Known gaps, stated on purpose

- **Speaker attribution.** Bee reports `Unknown` on this account ([ADR 0002](adr/0002-no-voice-attribution.md)). Latent does not claim to know your voice. The demo uses a captured event, labeled as a replay.
- **No outcome predictor.** There are no independent labels, so there is no completion probability anywhere. The product shows hours and arithmetic.
- **Semantic duplicates.** Reconcile merges exact-text duplicates today. Same-meaning, different-words is a follow-up.
- **Month and Year views.** Static illustrations of the intended shape. Real month estimates need editable assumptions backed by data.
- **Not in scope for this submission:** native iOS, TimesFM, a year-long forecast, agent-to-agent negotiation.
