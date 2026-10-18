# Latent — demo script

2:45, recorded on the iPhone in the installed PWA at 390 × 844, light mode.
Every number below is from the real account: 334 conversations, 381 days,
159,364 utterances, 162 Bee to-dos, 130 open, 32 done.

Record in one take where possible. Cut only between screens, never mid-gesture.

---

## 0:00 – 0:12 · The claim

**Picture.** Today, first frame, nothing tapped. The merge card is visible.

**Say.** "This is a year of my life. Three hundred and thirty-four
conversations, recorded by a wearable. Bee turned them into one hundred and
thirty open to-dos."

**On screen.** No captions. Let the number sit.

**Note.** Do not open with a logo or a title card. The first frame is the
product.

---

## 0:12 – 0:32 · The record

**Picture.** Tap Record. Hold on "381 days read" and "20".

**Say.** "Three hundred and eighty-one days. Twenty of every hundred to-dos get
closed. That is the honest number, not a promise."

**Action.** Scroll one card, slowly, to "Phrase by phrase".

**Do not say.** "It knows your voice." The record shows one class only.

---

## 0:32 – 1:00 · The mess, and the first action

**Picture.** Back to Today. The duplicate card reads "Send notes to Disability
Services · 3 copies".

**Say.** "Ten of these rows are the same task, written three times, because Bee
writes a to-do again every time a conversation mentions it."

**Action.** Tap **Merge all 10**. The hero count goes 130 → 120. The toast
appears. The card becomes the next action.

**Say.** "One tap. The count drops, and every merge leaves a receipt."

**Privacy.** The card names a real service. Blur that one line in the edit, or
record with the phone angled so only the count and the button are readable.
Blur, do not substitute text.

---

## 1:00 – 1:40 · The agent

**Picture.** Cut to the laptop: a terminal running Claude Code, with the Latent
MCP server connected. The phone stays in frame, propped up, showing Today.

**Type.** `what should I act on?`

**Agent calls.** `latent_should_act` → "Discussion Leader: To the Lighthouse Day
2", due 15 April, 236 days open, reason: it carries a due date and that date has
passed.

**Say.** "The agent is not guessing. It reads the same ledger the phone reads,
through one tool layer."

**Type.** `close it`

**Agent calls.** `latent_close` → open 119, receipt written.

**Picture.** Cut to the phone: the count is 119, and the receipt is on Record.

**Say.** "Same file. Same receipt. The screen and the agent cannot disagree."

**Note.** If the phone and laptop cannot be in one shot, cut phone → laptop →
phone. Never claim they are side by side if they are not.

---

## 1:40 – 2:05 · The cut

**Picture.** Trust. Hold on "1,939 conversation-derived rows, not counted" and
"162 commitments".

**Say.** "We also tried to turn conversation into commitments. Nineteen hundred
rows came out. About one in five held up. So we cut the lane and kept the
number, rather than shipping a guess."

**On screen.** Nothing. This is the line judges remember; do not decorate it.

---

## 2:05 – 2:25 · The twin

**Picture.** Twin. 130 beads, the "3+ weeks" chip selected. Pan once across the
field.

**Say.** "One hundred and thirty open. Every one of them was written more than
three weeks ago. This is not a backlog that arrived yesterday."

---

## 2:25 – 2:38 · The limit

**Picture.** Trust, top counts.

**Say.** "Zero bystander words were stored. But Bee labelled all three hundred
and thirty-four conversations as one speaker, so that is a limit, not a boast."

---

## 2:38 – 2:45 · Close

**Picture.** Today, 120 open, clean.

**Say.** "Bee remembers everything. Latent decides what deserves you."

**On screen.** `github.com/maximilienmil/latent`

---

## Recording checklist

- Installed PWA, standalone, light mode, 390 × 844.
- Notifications off, Low Power Mode off, battery above 40%.
- Load the app once before recording so the ledger is warm.
- Agent beat: `npm run mcp` must be registered before the take; test
  `latent_should_act` once off camera.
- Merge beat is destructive. If a take fails after the tap, restore the demo
  copy first: `cp data/latent.sqlite data/demo-reset.sqlite` before recording,
  and copy it back between takes.
- Blur: the duplicate line at 0:40, any personal names in to-do text.
- No Bee wordmark or logo anywhere in frame. Say "Bee" as a product name only.
- Music: none, or one low bed under 12 dB. The voice carries this.
