import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Browser, BrowserContext, Locator, Page } from "@playwright/test";
import { APP_URL, AUTH_DIR, GREEN_DARK, ORANGE, credentials, type Role } from "../config";
import { ENC, FPS, H, VFAST, W, ffmpeg } from "./media";

// ---------- In-page helpers injected into every recorded page ----------

const INJECTED_JS = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "injected.js"), "utf8");

// ---------- Auth ----------

export const authFile = (role: Role) => path.join(AUTH_DIR, `${role}.json`);

/** Sign in once per role through the API (no password ever on screen) and save the cookie as storageState.
 *  Reuses a saved state while it still works, to stay under the login rate limit. */
export async function ensureAuth(browser: Browser, role: Role): Promise<string> {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  const file = authFile(role);
  if (fs.existsSync(file)) {
    const ctx = await browser.newContext({ storageState: file, baseURL: APP_URL });
    const ok = (await ctx.request.get("/api/me")).ok();
    await ctx.close();
    if (ok) return file;
  }
  const ctx = await browser.newContext({ baseURL: APP_URL });
  const res = await ctx.request.post("/api/auth/login", { data: credentials(role) });
  if (!res.ok()) {
    await ctx.close();
    throw new Error(`login as ${role} (${credentials(role).email}) failed: HTTP ${res.status()} ${(await res.text()).slice(0, 200)}`);
  }
  await ctx.storageState({ path: file });
  await ctx.close();
  return file;
}

/** An API client signed in as `role` (not recorded). */
export async function api(browser: Browser, role: Role) {
  const ctx = await browser.newContext({ storageState: await ensureAuth(browser, role), baseURL: APP_URL });
  return { ctx, request: ctx.request };
}

// ---------- Stage: recorded pages and segments ----------

export interface Rec {
  page: Page;
  ctx: BrowserContext;
  t0: number;
  size: { width: number; height: number };
}

type Segment = { kind: "single"; rec: Rec; start: number; end: number } | { kind: "split"; left: Rec; right: Rec; start: number; end: number };

export type Layout = "desktop" | "half" | "phone";

export class Stage {
  segments: Segment[] = [];
  private recs: Rec[] = [];
  private n = 0;
  constructor(private browser: Browser, readonly dir: string, public audioSeconds: number) {
    fs.mkdirSync(dir, { recursive: true });
  }

  /** Opens a recorded page. Navigate it before shooting, so page loads aren't in the video. */
  /** `role` signs in as a demo role; `{ storageState }` uses a session prepared by the scene (e.g. a fresh account). */
  async open(role: Role | null | { storageState: string }, label: string, layout: Layout = "desktop"): Promise<Rec> {
    const viewport = layout === "half" ? { width: 960, height: H } : layout === "phone" ? { width: 390, height: 844 } : { width: 1440, height: 810 };
    // Playwright records at the CSS viewport size; ffmpeg scales it up to 1920x1080 afterwards.
    const scale = layout === "phone" ? 2 : 1;
    const size = { ...viewport };
    const ctx = await this.browser.newContext({
      baseURL: APP_URL,
      viewport,
      deviceScaleFactor: scale,
      isMobile: layout === "phone",
      hasTouch: layout === "phone",
      storageState: !role ? undefined : typeof role === "object" ? role.storageState : await ensureAuth(this.browser, role),
      recordVideo: { dir: path.join(this.dir, `raw-${this.n++}`), size },
      acceptDownloads: true,
      locale: "en-GB",
      timezoneId: "Europe/Berlin",
      geolocation: { latitude: 49.5897, longitude: 11.004 },
      permissions: ["geolocation"],
    });
    ctx.setDefaultTimeout(15_000);
    await ctx.addInitScript({ content: `window.__demoLabel = ${JSON.stringify(label)};
${INJECTED_JS}` });
    const page = await ctx.newPage();
    const rec = { page, ctx, t0: Date.now(), size };
    this.recs.push(rec);
    return rec;
  }

  async shoot(rec: Rec, fn: (p: Page) => Promise<void>) {
    const start = Date.now();
    await fn(rec.page);
    this.segments.push({ kind: "single", rec, start, end: Date.now() });
  }

  async split(left: Rec, right: Rec, fn: (l: Page, r: Page) => Promise<void>) {
    const start = Date.now();
    await fn(left.page, right.page);
    this.segments.push({ kind: "split", left, right, start, end: Date.now() });
  }

  get elapsed() {
    return this.segments.reduce((s, x) => s + (x.end - x.start) / 1000, 0);
  }

  /** Keeps the last segment running (live page, no freeze) until the scene covers its narration. */
  async hold(extra = 0.8) {
    const last = this.segments.at(-1);
    if (!last) return;
    const page = last.kind === "single" ? last.rec.page : last.right.page;
    while (this.elapsed < this.audioSeconds + extra) {
      await page.waitForTimeout(Math.min(1000, (this.audioSeconds + extra - this.elapsed) * 1000 + 50));
      last.end = Date.now();
    }
  }

  /** Closes the contexts, cuts each segment out of its raw recording and joins them into one 1920x1080 clip. */
  async render(out: string, phoneBg?: string): Promise<number> {
    const videos = new Map<Rec, string>();
    for (const r of this.recs) {
      const v = r.page.video();
      await r.ctx.close();
      if (v) videos.set(r, await v.path());
    }
    const parts: string[] = [];
    for (const [i, s] of this.segments.entries()) {
      const part = path.join(this.dir, `seg-${i}.mp4`);
      const len = Math.max(0.5, (s.end - s.start) / 1000);
      const cut = (r: Rec) => ["-ss", Math.max(0, (s.start - r.t0) / 1000).toFixed(3), "-t", len.toFixed(3), "-i", videos.get(r)!];
      const fit = `scale=${W}:${H}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=${GREEN_DARK}`;
      if (s.kind === "split") {
        await ffmpeg([
          ...cut(s.left), ...cut(s.right),
          "-filter_complex", `[0:v]scale=958:${H}:flags=lanczos,setsar=1[l];[1:v]scale=958:${H}:flags=lanczos,setsar=1[r];color=c=${ORANGE}:s=4x${H}:r=${FPS}[d];[l][d][r]hstack=inputs=3,fps=${FPS},format=yuv420p[v]`,
          "-map", "[v]", "-an", "-t", len.toFixed(3), ...VFAST, part,
        ]);
      } else if (phoneBg && s.rec.size.width < s.rec.size.height) {
        await ffmpeg([
          "-loop", "1", "-i", phoneBg, ...cut(s.rec),
          "-filter_complex", `[1:v]scale=-2:960:flags=lanczos,setsar=1[p];[0:v][p]overlay=x=W*0.62-w/2:y=(H-h)/2-20:shortest=1,fps=${FPS},format=yuv420p[v]`,
          "-map", "[v]", "-an", "-t", len.toFixed(3), ...VFAST, part,
        ]);
      } else {
        await ffmpeg([...cut(s.rec), "-vf", `${fit},setsar=1,fps=${FPS},format=yuv420p`, "-an", "-t", len.toFixed(3), ...VFAST, part]);
      }
      parts.push(part);
    }
    const list = path.join(this.dir, "segments.txt");
    fs.writeFileSync(list, parts.map((p) => `file '${p.replace(/\\/g, "/")}'`).join("\n"));
    await ffmpeg(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", out]);
    return this.elapsed;
  }

  async abort() {
    for (const r of this.recs) await r.ctx.close().catch(() => {});
  }
}

/** Mux a scene clip with its narration. The clip is sped up (max 2x) if it ran longer than the narration,
 *  then the shorter of the two is padded so both end together. */
export async function muxScene(clip: string, clipSeconds: number, audio: string | null, audioSeconds: number, out: string): Promise<number> {
  const target = audioSeconds + 0.8;
  const speed = clipSeconds > target + 1 ? Math.min(2, clipSeconds / target) : 1;
  const videoLen = clipSeconds / speed;
  const len = Math.max(videoLen, target);
  const a = audio ? ["-i", audio] : ["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo"];
  await ffmpeg([
    "-i", clip, ...a,
    "-filter_complex", `[0:v]setpts=PTS/${speed.toFixed(4)},tpad=stop_mode=clone:stop_duration=${(len - videoLen + 0.5).toFixed(3)}[v];[1:a]aresample=48000,aformat=channel_layouts=stereo,apad[a]`,
    "-map", "[v]", "-map", "[a]", "-t", len.toFixed(3), ...ENC, out,
  ]);
  return len;
}

// ---------- Watchable interactions ----------

const lastPos = new WeakMap<Page, { x: number; y: number }>();

export async function moveTo(page: Page, target: Locator) {
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  if (!box) return;
  const x = box.x + box.width / 2;
  const y = box.y + Math.min(box.height / 2, 30);
  const from = lastPos.get(page) ?? { x: x - 200, y: y + 120 };
  const dist = Math.hypot(x - from.x, y - from.y);
  await page.mouse.move(x, y, { steps: Math.max(8, Math.min(30, Math.round(dist / 25))) });
  lastPos.set(page, { x, y });
  await page.waitForTimeout(150);
}

/** Move the mouse to the element, click it, pause so the viewer sees the result. */
export async function click(page: Page, target: Locator, pause = 500) {
  await target.waitFor({ state: "visible" });
  await moveTo(page, target);
  await target.click();
  await page.waitForTimeout(pause);
}

export async function type(page: Page, target: Locator, text: string) {
  await click(page, target, 150);
  await target.fill("");
  await target.pressSequentially(text, { delay: 40 });
  await page.waitForTimeout(250);
}

/** Slow, smooth scroll of whatever is under the mouse. */
export async function scroll(page: Page, dy: number, ms = 1200) {
  const steps = Math.max(10, Math.round(ms / 25));
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, dy / steps);
    await page.waitForTimeout(ms / steps);
  }
}

/** Show the result long enough to read it. */
export const beat = (page: Page, ms = 800) => page.waitForTimeout(ms);

export async function ready(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForLoadState("networkidle", { timeout: 6000 }).catch(() => {}); // SSE streams keep the network busy
}

export async function go(page: Page, url: string) {
  await page.goto(url);
  await ready(page);
  const pos = lastPos.get(page);
  if (!pos) {
    const vp = page.viewportSize()!;
    await page.mouse.move(vp.width / 2, vp.height / 2);
    lastPos.set(page, { x: vp.width / 2, y: vp.height / 2 });
  }
}

/** Fake browser address bar, because Playwright recordings have no browser chrome. */
export async function addressBar(page: Page, url: string) {
  await injectedReady(page);
  await page.evaluate(`window.__demoAddressBar(${JSON.stringify(url)})`);
}

/** On-screen stopwatch for the posting chapter. */
export async function timer(page: Page, action: "start" | "stop") {
  await injectedReady(page);
  await page.evaluate(`window.__demoTimer.${action}()`);
}

/** Pages where the init script didn't run (e.g. setContent, image documents) get it now.
 *  All page-side code is passed as strings: tsx would add `__name()` helpers to compiled functions. */
async function injectedReady(page: Page) {
  if (!(await page.evaluate("typeof window.__demoTimer !== 'undefined'"))) await page.evaluate(INJECTED_JS);
}
