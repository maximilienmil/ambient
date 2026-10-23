// Renders the iPhone bezel (ring + island, transparent centre) and the rounded screen mask.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
const X = 1130, Y = 90, W = 414, H = 900, R = 52;
await p.setContent(`<body style="margin:0;background:transparent"><div style="position:absolute;left:${X}px;top:${Y}px;width:${W}px;height:${H}px;border-radius:${R}px;box-shadow:0 0 0 16px #17160a,0 0 0 18px #4a4838;"></div><div style="position:absolute;left:${X + W / 2 - 62}px;top:${Y + 14}px;width:124px;height:36px;border-radius:20px;background:#000"></div></body>`);
await p.screenshot({ path: process.argv[2] + '/bezel.png', omitBackground: true });
await p.setContent(`<body style="margin:0;background:#000"><div style="width:${W}px;height:${H}px;border-radius:${R}px;background:#fff"></div></body>`);
await p.screenshot({ path: process.argv[2] + '/mask.png', clip: { x: 0, y: 0, width: W, height: H } });
await b.close();
