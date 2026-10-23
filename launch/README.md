# Launch films

## The launch film (`ambient-launch.mp4`, about 1:34)

The main cut: a fast, music-led film made of real recordings of the app (a virtual camera, a visible cursor, zooms and real clicks) joined to animated title cards. Parts: the hook (169 / 162 / 421), the turn ("Ambient handles the rest. You focus on what matters."), Horizon, a captured promise, Fork the week, two models weighing in, the animated hive, the hive acting, iPhone, your real Bee (every line of personal text blurred in the page before it is captured), an agent over MCP, and the close.

```bash
cd launch
node seg-desktop.mjs  http://127.0.0.1:4317 out/seg/desktop.mp4   # Demo mode, synthetic
node seg-phone.mjs    http://127.0.0.1:4317 out/seg/phone.mp4
node seg-real.mjs     http://127.0.0.1:4317 out/seg/real.mp4      # Your Bee, redacted
for f in hook turn hive term close phonebg; do node render.mjs $f; done
node chrome.mjs out/seg                                            # phone bezel and mask
# phoneclip: overlay seg/phone.mp4 on ambient-phonebg.mp4 with the mask and bezel (see assemble notes in git history)
node assemble.mjs && node music.mjs                                # silent cut, then the 120 BPM synthesized track
```

The music is synthesized from scratch (`music.mjs`), so there is nothing to license. Swap in any track you like at 120 BPM and the cuts still land on the beat.

## Earlier standalone films

Five short films built from code, in the app's own type, colors and grain. Every product shot is a real screenshot of the app in Demo mode (synthetic story). No real Bee data appears.

| Film | Length | Format | For |
|---|---|---|---|
| `room` | 60s | 1920×1080 | The flagship: problem, name, the hive, a promise, the fork, the action, the close |
| `fork` | 40s | 1920×1080 | Fork the week as a concept: three futures on a 9-to-5 week, from real `forkWeek` output |
| `phone` | 40s | 1080×1920 | Vertical cut for social, on iPhone 16 Pro screens |
| `agents` | 40s | 1920×1080 | An agent calls `ambient_fork_week` over MCP and answers honestly |
| `honest` | 46s | 1920×1080 | Five design principles, each beside the screen that keeps it |

## Render

```bash
cd app && npm run demo                 # or npm start; capture uses ?mode=demo
node ../launch/capture.mjs http://127.0.0.1:4317   # writes launch/shots/
node ../launch/render.mjs room         # writes launch/out/ambient-room.mp4
```

Needs `playwright` and `ffmpeg` (set `FFMPEG` and `CHROME_PATH` if they aren't on PATH). Open any `films/*.html` in a browser to preview it as a live loop. Each film is a plain HTML page with a `seek(t)` timeline (`films/engine.js`), so frames are deterministic.

The films are silent by design. Add a quiet royalty-free track, or your own voice, in an editor.
