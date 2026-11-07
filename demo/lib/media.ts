import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import type { Browser } from "@playwright/test";
import { GREEN, GREEN_DARK, VOICE } from "../config";

const require = createRequire(import.meta.url);
export const FFMPEG: string = require("ffmpeg-static");
export const FFPROBE: string = require("ffprobe-static").path;

export const FPS = 30;
export const W = 1920;
export const H = 1080;
/** Same encoding for every part, so the concat demuxer can join them without re-encoding. */
/** Intermediate parts: fast and near-lossless (the final pass re-encodes everything once). */
export const VFAST = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "16"];
export const ENC = [...VFAST, "-pix_fmt", "yuv420p", "-r", String(FPS), "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2"];

export function run(bin: string, args: string[], cwd?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, { cwd, windowsHide: true });
    let out = "";
    let err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(`${path.basename(bin)} failed (${code}): ${err.slice(-1500)}`))));
  });
}

export const ffmpeg = (args: string[], cwd?: string) => run(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", ...args], cwd);

export async function duration(file: string): Promise<number> {
  const out = await run(FFPROBE, ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file]);
  return Number(out.trim());
}

// ---------- Narration ----------

export interface Narration {
  file: string | null; // chapter audio (wav), null when there is no voice
  duration: number;
  cues: { start: number; end: number; text: string }[]; // relative to the chapter audio start
}

const GAP = 0.3; // pause between sentences

/** One MP3 per sentence with msedge-tts (free neural voice), joined into one chapter track. Falls back to captions only. */
export async function narrate(id: string, lines: string[], dir: string, voiceOk: { value: boolean }): Promise<Narration> {
  fs.mkdirSync(dir, { recursive: true });
  const cues: Narration["cues"] = [];
  const parts: string[] = [];
  let t = 0;
  for (const [i, text] of lines.entries()) {
    let d = estimate(text);
    let file: string | null = null;
    if (voiceOk.value) {
      try {
        file = await tts(text, path.join(dir, `${id}-${i}`));
        d = await duration(file);
      } catch (e) {
        voiceOk.value = false;
        console.warn(`  ! TTS unavailable, captions only from now on: ${(e as Error).message}`);
      }
    }
    cues.push({ start: t, end: t + d, text });
    if (file) parts.push(file);
    t += d + GAP;
  }
  const total = t - GAP;
  if (!voiceOk.value || parts.length !== lines.length) return { file: null, duration: total, cues };
  // Join the sentence MP3s with short silences into one wav.
  const out = path.join(dir, `${id}.wav`);
  const inputs = parts.flatMap((p) => ["-i", p]);
  const chain = parts.map((_, i) => `[${i}:a]aresample=48000,aformat=channel_layouts=stereo${i < parts.length - 1 ? `,apad=pad_dur=${GAP}` : ""}[a${i}]`);
  const concat = `${parts.map((_, i) => `[a${i}]`).join("")}concat=n=${parts.length}:v=0:a=1[out]`;
  await ffmpeg([...inputs, "-filter_complex", [...chain, concat].join(";"), "-map", "[out]", out]);
  return { file: out, duration: await duration(out), cues };
}

const estimate = (text: string) => Math.max(1.5, text.split(/\s+/).length / 2.6); // ~155 words per minute

async function tts(text: string, base: string): Promise<string> {
  const { MsEdgeTTS, OUTPUT_FORMAT } = await import("msedge-tts");
  const dir = `${base}-tts`;
  fs.mkdirSync(dir, { recursive: true });
  const t = new MsEdgeTTS();
  await t.setMetadata(VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
  const r = await Promise.race([
    t.toFile(dir, text, { rate: "+0%" }),
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error("TTS timeout")), 30_000)),
  ]);
  t.close();
  const file = `${base}.mp3`;
  fs.renameSync(r.audioFilePath, file);
  if (fs.statSync(file).size < 1000) throw new Error("empty TTS audio");
  return file;
}

// ---------- Cards (rendered with the browser, so they share the app's fonts and colours) ----------

const cardCss = `
  *{box-sizing:border-box;margin:0}
  body{width:${W}px;height:${H}px;font-family:"Segoe UI",Inter,system-ui,sans-serif;color:#fff;
    background:linear-gradient(135deg,${GREEN} 0%,${GREEN_DARK} 100%);display:flex;align-items:center;justify-content:center;overflow:hidden}
  .logo{font-size:64px;font-weight:800;letter-spacing:-1px}
  .logo span{color:#ffe2c4}
  .wrap{text-align:center;padding:0 140px}
  h1{font-size:88px;font-weight:800;line-height:1.1;margin-top:36px}
  p{font-size:40px;opacity:.92;margin-top:28px;line-height:1.35}
  .num{display:inline-block;font-size:30px;font-weight:700;background:rgba(255,255,255,.18);border-radius:999px;padding:8px 24px;margin-top:40px}
`;

export async function renderCard(browser: Browser, html: string, file: string) {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>${cardCss}</style><body>${html}</body>`);
  await page.waitForTimeout(150);
  await page.screenshot({ path: file });
  await page.close();
}

export const logoHtml = `<div class="logo">🥕 Fresh<span>Share</span></div>`;

/** Still image + optional narration → mp4 part of at least `minSeconds`. */
export async function stillToVideo(png: string, audio: string | null, seconds: number, out: string) {
  const a = audio ? ["-i", audio] : ["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo"];
  await ffmpeg([
    "-loop", "1", "-framerate", String(FPS), "-i", png, ...a,
    "-filter_complex", `[0:v]scale=${W}:${H},format=yuv420p[v];[1:a]aresample=48000,apad[a]`,
    "-map", "[v]", "-map", "[a]", "-t", seconds.toFixed(3), ...ENC, out,
  ]);
}

export function srtTime(s: number) {
  const ms = Math.round(s * 1000);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const sec = Math.floor((ms % 60_000) / 1000);
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(h)}:${pad(m)}:${pad(sec)},${pad(ms % 1000, 3)}`;
}

export function mmss(s: number) {
  const t = Math.round(s);
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

/** The final file: quality preset, plays in VLC and browsers. */
export const ENC_FINAL = ["-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-r", String(FPS), "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2"];
