# Open items

Status as of 21 October 2026, two days before the Friday 23 October noon PDT deadline. Items are ordered by how much they affect the demo and the submission. The older [readiness audit](FRIDAY-READINESS-AUDIT.md) predates several fixes (for example, calendar matching now requires a unique scheduling identity), so treat it as history, not a current checklist.

## Must do before submitting

1. **Make the repository safe to publish.**
   - Switch the repo to public only after the items below are cleared. It is private today.
   - `design/reference/` holds Bee's marketing screenshots and App Store images. `design/assets/bee-lilac.webp` and `bee-macro.jpg` are third-party images. Remove them, or confirm they may be redistributed, and replace them with licensed or original assets.
   - `docs/video-script.md` names a real service in one shot ("Send notes to Disability Services"). Rename it or keep the planned blur.
   - `app/audit-sample.json` is no longer tracked (it quotes real transcripts, including other people). Regenerate it locally with `npm run audit-sample` when needed.
2. **Show the working backend in the demo, or label the prototype honestly.** The v5 interface is a prototype with synthetic data. The backend that works lives behind the older production UI in `app/public/`. Either port v5 onto `app/` (it needs `/api/horizon/compare`, the action bundles and the MCP tools) or keep it clearly framed as the design target. The README already states this.
3. **Connect the demo Google account** so the message and calendar holds are real:
   `gog auth add <demo-email> --services gmail,calendar --gmail-scope send`, then set `LATENT_DEMO_ACCOUNT`, `LATENT_DEMO_CALENDAR` and `LATENT_EXTERNAL_ACTIONS=1`. Rehearse a partial failure. If the connector is down on the day, show the prepared action honestly and do not animate a fake success.
4. **Rehearse the live moment end to end.** Stream event, new fork within about five seconds, reconnect catch-up. The recovery path is covered by a test; a real attributed Bee event has not been demonstrated.
5. **Submission package.** Demo video, Devpost text, product feedback, friction log, cover image and 3 to 5 screenshots (screenshots are in `docs/screenshots/`).

## Should do

6. **Measured proof page.** Retired-count audit accuracy, the Jev / System One / both / plain-AI comparison table, and tests passing. `npm run eval` already prints a table; it shows "not configured" until models are connected, and that is the honest result today.
7. **Jev and System One.** The decision-model adapter exists and the d1 endpoint is intentionally idle. Until real endpoints are wired, the verdicts in the prototype are illustrative and must be described that way.
8. **Replace the unlicensed font in the production UI.** `app/public/tokens.css` references Fonetika, which is personal-use-only and git-ignored, so a fresh clone gets 404s. Swap in Geist and Instrument Serif (both OFL), which v5 already uses.
9. **Owner audit.** The one-time 40-item hand check that turns the auto-label agreement into an accuracy number.
10. **Wrapped card.** One shareable card built only from measured numbers. Not started.

## Known gaps, stated on purpose

- **Speaker attribution.** Bee reports `Unknown` on this account ([ADR 0002](adr/0002-no-voice-attribution.md)). Latent does not claim to know your voice. The demo uses a captured event, labeled as a replay.
- **No outcome predictor.** There are no independent labels, so there is no completion probability anywhere. The product shows hours and arithmetic.
- **Semantic duplicates.** Reconcile merges exact-text duplicates today. Same-meaning, different-words is a follow-up.
- **Month and Year views.** Static illustrations of the intended shape. Real month estimates need editable assumptions backed by data.
- **Not in scope for this submission:** native iOS, TimesFM, a year-long forecast, agent-to-agent negotiation.
