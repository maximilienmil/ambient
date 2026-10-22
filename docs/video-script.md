# Ambient: demo video script

Target length 2:45. Hard limit: under 3:00; judges may stop at 3:00. Recorded on a laptop (desktop layout) with one phone shot. Voiceover recorded separately and laid over the picture.

The story has two halves. First the scripted **Demo** shows the whole idea in 90 seconds. Then **Your Bee** proves it runs on a real account, and an agent uses it through MCP. Say plainly which half is which; that honesty is part of the pitch.

---

## 0:00–0:12 · The problem

**Picture.** Black screen, then the Bee wristband (your own footage, or a shot of your wrist). Cut to Reconcile in Your Bee mode, the open to-do count large.

**Say.** "Bee remembers everything I say. A year of conversations, 162 to-dos, 421 facts about me. That's the problem. Remembering everything isn't the same as knowing what matters."

**Edit note.** Hold the number for a full second before the voice says it.

## 0:12–0:20 · The name

**Picture.** The app icon (the glowing a·) on the iPhone home screen, tap to open. Then the sidebar wordmark, with the faint ASCII bees drifting. Slow push-in.

**Say.** "This is Ambient. An ambient agent on top of Bee that makes room for what matters."

## 0:20–0:40 · The hive worked overnight (Demo)

**Picture.** Horizon in Demo mode, top of page. The "Demo story · synthetic" pill must be visible. Hover the ring, then click **Done** in the legend and scroll the "While you slept" list slowly.

**Say.** "Overnight, the hive handled the small things. It merged duplicates, closed what was already done, held time for a call. Each one has a receipt, and you can see who did it: Ambient itself, a calendar connector, or another agent through MCP."

**Action.** Open one receipt (the Lisbon train receipt, done by Claude through MCP). Close it.

## 0:40–1:00 · A new promise arrives

**Picture.** Click **Replay captured promise**. The quote types out: "Sure, I'll help with the deck by Thursday." The conflict card appears: 6h needed, 6h open, minus 3h.

**Say.** "Then I say yes to something. Bee hears it. Ambient checks it against my week: the release needs six hours, I have six, and this favor takes three."

**Edit note.** Let the typing play in full. It is the moment the product reacts to the real world.

## 1:00–1:25 · Fork the week

**Picture.** Scroll to Fork the week. Click B, then C, then back to A, pausing so the week grid visibly changes each time. End on the recommendation card with "Jev A · Liquid d1 A · Both agree".

**Say.** "Instead of another to-do, I get the choice. Protect the launch, keep the favor and ship Monday, or ship something smaller. Each path is real calendar arithmetic, not a guess. Two decision models weigh in, Jev and Liquid d1. When they agree, Ambient recommends. When they don't, it asks me."

## 1:25–1:45 · The hive acts

**Picture.** Review message to Jordan → Send and hold time. The bees speed up, the steps tick off, the result card lands. Zoom in on "A request is not a yes."

**Say.** "One tap and the hive does it. The message goes from my demo account, the time is held. And it tells me the truth: Jordan still has to agree."

## 1:45–2:10 · Now with my real Bee

**Picture.** Click **Your Bee** in the top-right toggle. Horizon header with real numbers. Click **Sync from Bee** (do a sync before recording so it's quick). Scroll to the fork built from a real Bee to-do on your real calendar. Click **Review the message and holds → Approve and run** (sandbox). Show the receipt ID.

**Say.** "That was the story. This is my actual Bee. Real conversations, real to-dos, my real calendar. The same fork, the same approval, a real receipt. By default it runs in a sandbox, so nothing leaves my machine until I connect an account."

## 2:10–2:25 · Reconcile

**Picture.** Reconcile tab. Merge one duplicate group, watch the count drop, then press Undo. Confirm one harmless fact.

**Say.** "Ambient also cleans up Bee's record. Duplicates merge, and I can undo it. Facts Bee isn't sure about wait for me, and my answer stays in Ambient. Bee is never changed behind my back."

**Privacy.** Several real facts name family members, and one duplicate names a real service. Blur those lines, or scroll past them quickly. Choose the fact you confirm in advance.

## 2:25–2:40 · Any agent can use it

**Picture.** Terminal with Claude Code. Type: `can I help Jordan with the deck by Thursday? it's about 3 hours`. The agent calls `latent_fork_week` and answers with the three paths.

**Say.** "And it isn't locked in an app. Through MCP and an agent skill, any agent can ask the same question and get the same honest answer."

## 2:40–2:50 · Close

**Picture.** Back to Horizon (Demo), header with bees. Fade the wordmark in.

**Say.** "Bee remembers. Ambient makes room."

---

## Before you record

1. `cd app && npm run ingest` for fresh conversations, then `npm start`.
2. In Compass, Your Bee mode, set one goal with a due date this week and 6 hours.
3. Export your calendar again to `app/data/calendars/` if this week looks empty. With an empty calendar every path "fits", which is true but less dramatic.
4. In Settings, connect Jev and Liquid d1 if you have working endpoints, then test both. If not, the app says "not connected", which is fine to show.
5. Clear the demo state with a reload of `/?mode=demo`.
6. Browser: hide bookmarks bar and extensions, zoom 100%, window 1440×900. Turn on Do Not Disturb.
7. For the phone shot, open the app over Tailscale (`LATENT_BIND=0.0.0.0 LATENT_HOSTS=<ip> npm start`) and use iOS screen recording.

## How to record and edit

- **Screen:** macOS `Cmd+Shift+5` → Record Selected Portion around the browser window, or Screen Studio if you have it (it adds smooth zooms on clicks automatically).
- **Voice:** record the voiceover separately, in a quiet room, from this script. Read it twice and keep the better take of each line.
- **Editor:** iMovie or CapCut is enough. DaVinci Resolve if you want finer control.
- **Cuts:** cut between sections, never in the middle of a click or the typing moment. Trim dead time while pages load.
- **Zooms:** zoom in on three things only: the typed promise, the fork changing, and "A request is not a yes."
- **Captions:** burn in captions. Judges often watch muted.
- **Music:** one quiet, royalty-free track under the voice (YouTube Audio Library or Pixabay). No copyrighted music.
- **Labels:** keep "Demo story · synthetic" visible during Demo shots. Add a small "Real Bee account" caption at the start of the Your Bee section.
- **Length:** if you run long, cut the Reconcile section to merge only, and drop the phone shot.

## Lines to avoid

- "It knows my voice." Bee reports the speaker as Unknown on this account.
- Any success probability or "it predicts." The fork is calendar arithmetic.
- "It sent the email" during sandbox runs. Say "prepared".
