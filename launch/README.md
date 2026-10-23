# Launch films

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
