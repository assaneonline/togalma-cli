import sharp from "sharp";
import { fileURLToPath } from "node:url";

const RESET = "\x1b[0m";
const CLEAR_AND_HOME = "\x1b[2J\x1b[H";
const HOME = "\x1b[H";
const CLEAR_TO_END = "\x1b[J";

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function termColumns(): number {
  const c = Number(process.stdout.columns);
  return Number.isFinite(c) && c > 0 ? c : 80;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function fg(r: number, g: number, b: number) {
  return `\x1b[38;2;${r};${g};${b}m`;
}

function bg(r: number, g: number, b: number) {
  return `\x1b[48;2;${r};${g};${b}m`;
}

function resetFg() {
  return "\x1b[39m";
}

function resetBg() {
  return "\x1b[49m";
}

type RenderOpts = {
  pngPath: string;
  widthCols: number;
  heightPx?: number;
  scaleX?: number;
  scaleY?: number;
  flipX?: boolean;
};

function snapToMultiple(n: number, m: number) {
  return Math.max(m, Math.round(n / m) * m);
}

function brailleChar(mask: number): string {
  // Unicode Braille patterns start at U+2800.
  return String.fromCodePoint(0x2800 + (mask & 0xff));
}

function brailleMaskFrom2x4(on: boolean[][]): number {
  // Dot mapping (x,y) within 2x4 cell:
  // (0,0)->1  (1,0)->4
  // (0,1)->2  (1,1)->5
  // (0,2)->3  (1,2)->6
  // (0,3)->7  (1,3)->8
  let m = 0;
  if (on[0][0]) m |= 0x01;
  if (on[0][1]) m |= 0x02;
  if (on[0][2]) m |= 0x04;
  if (on[0][3]) m |= 0x40;
  if (on[1][0]) m |= 0x08;
  if (on[1][1]) m |= 0x10;
  if (on[1][2]) m |= 0x20;
  if (on[1][3]) m |= 0x80;
  return m;
}

async function renderLogoAnsiLines(opts: {
  pngPath: string;
  widthCols: number;
  heightPx?: number;
  scaleX?: number;
  scaleY?: number;
  flipX?: boolean;
}): Promise<string[]> {
  // Finer granularity: Braille (2x4 pixels per character).
  const scaleX = typeof opts.scaleX === "number" && Number.isFinite(opts.scaleX) ? opts.scaleX : 1;
  const scaleY = typeof opts.scaleY === "number" && Number.isFinite(opts.scaleY) ? opts.scaleY : 1;
  const flipX = !!opts.flipX;
  const baseCols = Math.max(2, Math.round(opts.widthCols));
  const baseWidthPx = baseCols * 2;
  const scaledWidthPx = Math.max(1, Math.round(baseWidthPx * clamp(scaleX, 0.08, 1)));
  const baseHeightPx =
    typeof opts.heightPx === "number" && Number.isFinite(opts.heightPx) && opts.heightPx > 0
      ? Math.round(opts.heightPx)
      : undefined;
  const scaledHeightPx =
    baseHeightPx !== undefined ? Math.max(1, Math.round(baseHeightPx * clamp(scaleY, 0.08, 1))) : undefined;

  // Resize to scaledWidth while keeping a constant height, then pad back to baseWidth
  // with transparent background. Constant height prevents vertical "jumping" between frames.
  let img = sharp(opts.pngPath).ensureAlpha();
  if (flipX) img = img.flop();
  const { data, info } = await img
    .resize({
      width: scaledWidthPx,
      height: scaledHeightPx ?? baseHeightPx,
      fit: "contain",
      position: "center",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      withoutEnlargement: false,
    })
    .extend({
      top:
        baseHeightPx !== undefined && scaledHeightPx !== undefined
          ? Math.floor((baseHeightPx - scaledHeightPx) / 2)
          : 0,
      bottom:
        baseHeightPx !== undefined && scaledHeightPx !== undefined
          ? Math.ceil((baseHeightPx - scaledHeightPx) / 2)
          : 0,
      left: Math.floor((baseWidthPx - scaledWidthPx) / 2),
      right: Math.ceil((baseWidthPx - scaledWidthPx) / 2),
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  const alphaMin = 12;

  const lines: string[] = [];
  // Each terminal line represents 4 pixels vertically (braille cell height).
  for (let y = 0; y < h; y += 4) {
    let line = "";
    // Each braille cell is 2 pixels wide.
    for (let x = 0; x < w; x += 2) {
      const on: boolean[][] = [
        [false, false, false, false],
        [false, false, false, false],
      ];
      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      let n = 0;

      for (let dy = 0; dy < 4; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const px = x + dx;
          const py = y + dy;
          if (px >= w || py >= h) continue;
          const idx = (py * w + px) * 4;
          const r = data[idx] ?? 0;
          const g = data[idx + 1] ?? 0;
          const b = data[idx + 2] ?? 0;
          const a = data[idx + 3] ?? 0;
          const isOn = a >= alphaMin;
          on[dx][dy] = isOn;
          if (isOn) {
            rSum += r;
            gSum += g;
            bSum += b;
            n++;
          }
        }
      }

      const mask = brailleMaskFrom2x4(on);
      if (mask === 0 || n === 0) {
        line += resetFg() + resetBg() + " ";
        continue;
      }

      const rr = Math.round(rSum / n);
      const gg = Math.round(gSum / n);
      const bb = Math.round(bSum / n);
      line += resetBg() + fg(rr, gg, bb) + brailleChar(mask);
    }
    line += RESET;
    lines.push(line);
  }
  return lines;
}

let cached: { key: string; lines: string[] } | null = null;

async function getSplashLines(): Promise<string[]> {
  const cols = termColumns();
  // Reserve some space for margins; keep within sane bounds.
  const width = clamp(Math.floor(cols * 0.55), 34, 60);

  const url = new URL("../assets/togalma-logo-square.png", import.meta.url);
  const path = fileURLToPath(url);
  const key = `${path}::${width}`;

  if (cached && cached.key === key) return cached.lines;
  const lines = await renderLogoAnsiLines({ pngPath: path, widthCols: width });
  cached = { key, lines };
  return lines;
}

export async function playMenuSplash(): Promise<void> {
  if (process.env.TOGALMA_NO_SPLASH) return;
  if (!process.stdout.isTTY || !process.stdin.isTTY) return;

  const cols = termColumns();
  const width = clamp(Math.floor(cols * 0.55), 34, 60);
  const url = new URL("../assets/togalma-logo-square.png", import.meta.url);
  const path = fileURLToPath(url);

  // Precompute a constant pixel height from the base render so all frames have
  // identical line count (prevents vertical drift and trails).
  const meta = await sharp(path).metadata();
  const rawHeightPx =
    meta.width && meta.height ? Math.round(((width * 2) * meta.height) / meta.width) : undefined;
  const baseHeightPx = rawHeightPx ? snapToMultiple(rawHeightPx, 4) : undefined;

  // Vertical-axis rotation illusion:
  // - scaleX goes 1 -> ~0 -> 1
  // - second half is mirrored (flipX)
  const frames = 14;
  const msPerFrame = 32;
  process.stdout.write(CLEAR_AND_HOME);

  for (let i = 0; i < frames; i++) {
    const t = frames === 1 ? 0 : i / (frames - 1); // 0..1
    const theta = t * Math.PI; // 0..π
    // Rotation around Y axis (vertical): simulate by squashing X and mirroring after midpoint.
    const rotX = Math.max(0.08, Math.abs(Math.cos(theta)));
    const flipX = theta > Math.PI / 2;

    // Combine with uniform shrink (zoom) centered on the logo.
    // Strongest shrink at mid animation; subtle at ends.
    const shrinkAmp = 0.18;
    const zoom = 1 - shrinkAmp * Math.sin(Math.PI * t);

    const lines = await renderLogoAnsiLines({
      pngPath: path,
      widthCols: width,
      heightPx: baseHeightPx,
      scaleX: rotX * zoom,
      scaleY: zoom,
      flipX,
    });
    process.stdout.write(HOME);
    process.stdout.write(CLEAR_TO_END);
    process.stdout.write(lines.join("\n"));
    await sleep(msPerFrame);
  }

  process.stdout.write("\n");
}

