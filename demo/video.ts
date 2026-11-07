// npm run demo:video: records a narrated product tour of the running app and assembles demo/out/freshshare-demo.mp4.
// See docs in demo/README.md. Options: --only=landing,post (record a subset, for trying a scene).
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { chromium, type Browser } from "@playwright/test";
import { APP_URL, GREEN_DARK, MAX_TOTAL_SECONDS, OUT, VOICE, WORK } from "./config";
import { ENC_FINAL, duration, ffmpeg, logoHtml, mmss, narrate, renderCard, srtTime, stillToVideo, type Narration } from "./lib/media";
import { Stage, muxScene } from "./lib/stage";
import { SCENES, type State } from "./scenes";
import { CHAPTERS, INTRO, OUTRO, type ChapterScript } from "./script";

const require = createRequire(import.meta.url);
const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7).split(",");
/** --reuse=landing,claim,...: keep those chapters' finished scenes from the previous run instead of recording them
 *  again (saves time and doesn't write to the app's database twice). Other chapters are recorded. */
const reuse = process.argv.find((a) => a.startsWith("--reuse="))?.slice(8).split(",") ?? [];
const WORK_PREV = `${WORK}-prev`;

/** The kit's module list (docs DEMO_VIDEO.md) and what this repo has for each. */
const KIT_MODULES: { n: number; module: string; scene?: string; note?: string }[] = [
  { n: 1, module: "Landing page + early access", scene: "landing" },
  { n: 2, module: "Sign up with terms", scene: "signup" },
  { n: 2.5, module: "Verified badge + food alerts near home (T2.2)", scene: "verify", note: "Recorded with the separate test account from DEMO_TEST_EMAIL (shown blurred); the e-mail and phone steps are the labelled DEMO shortcuts (code 123456)." },
  { n: 3, module: "Post food in 30 seconds", scene: "post" },
  { n: 4, module: "Browse and map", scene: "browse" },
  { n: 5, module: "Claim, confirm, address reveal", scene: "claim" },
  { n: 6, module: "Real-time chat", scene: "chat" },
  { n: 7, module: "Pickup, complete and rate", scene: "pickup" },
  { n: 8, module: "Notifications", scene: "notifications", note: "Live bell recorded. The claim e-mail (/dev/outbox on Floci) is not part of this stack: e-mail goes through Amazon SES, so there is no outbox page to show." },
  { n: 9, module: "Community fridges", scene: "fridges" },
  { n: 10, module: "Organizations + bulk pickup", scene: "orgs" },
  { n: 11, module: "Admin and safety", scene: "admin" },
  { n: 12, module: "Impact dashboard", scene: "impact", note: "There is no /impact page in this app; recorded the impact panel on the profile (portions, kg, CO2e, share card) instead." },
  { n: 13, module: "Tier 2/3 extras: recurring listings (T2.4)", scene: "recurring", note: "The schedule is deleted again right after the scene, so it never posts on the live site." },
  { n: 13.5, module: "Tier 2/3 extras: waitlist (T2.3) and blocking (T2.5)", scene: "extras", note: "Also built and shown elsewhere: food alerts (chapter 'verify'), map place search and clustering (T2.8, chapter 'browse'). Not built: languages/RTL, leaderboard and badges, volunteer drivers, help center safety check." },
  { n: 14, module: "On your phone", scene: "phone", note: "No PWA (T2.2/T3.10) is built, so this shows the core pages in a 390 px phone browser." },
  { n: 15, module: "Under the hood", scene: "stack", note: "No `npm run aws:smoke` / Floci in this stack; the live proof is the production health check and a listing photo served from S3 via CloudFront." },
  { n: 16, module: "Tier K (AI autofill, assistant, translation, Stripe, Google sign-in)", note: "Not built in this repo." },
  { n: 17, module: "E1/E2 Post by voice / Ask by voice (ElevenLabs)", note: "Not built; docs/ELEVENLABS.md is not in this repo, so the narration uses msedge-tts." },
];

interface Part {
  file: string;
  seconds: number;
  chapter?: string; // chapter title starts at this part
  cues?: Narration["cues"]; // narration cues relative to this part's start
}

async function launch(): Promise<Browser> {
  try {
    return await chromium.launch();
  } catch (e) {
    console.warn(`Bundled Chromium did not start (${(e as Error).message.split("\n")[0]}); trying the installed Chrome.`);
    return chromium.launch({ channel: "chrome" });
  }
}

function titleHtml(n: number, total: number, title: string) {
  return `<div class="wrap">${logoHtml}<h1>${title}</h1><div class="num">Chapter ${n} of ${total}</div></div>`;
}

function outroHtml() {
  const qrcode = require("qrcode-generator");
  const qr = qrcode(0, "M");
  qr.addData(APP_URL);
  qr.make();
  const svg = qr.createSvgTag({ cellSize: 9, margin: 3, scalable: true });
  const host = new URL(APP_URL).host;
  return `<div style="display:flex;align-items:center;gap:110px">
    <div style="text-align:left">${logoHtml}<h1 style="font-size:96px">${host}</h1>
      <p>Share surplus food with neighbours in 30 seconds.</p>
      <p style="margin-top:44px;font-size:32px;opacity:.85">Built at the FreshShare hackathon</p></div>
    <div style="background:#fff;border-radius:28px;padding:22px;width:420px;height:420px">${svg.replace("<svg ", '<svg width="376" height="376" ')}</div>
  </div>`;
}

function phoneBgHtml() {
  return `<div style="position:absolute;left:150px;top:50%;transform:translateY(-50%);width:720px;text-align:left">${logoHtml}
    <h1 style="font-size:72px">Same web app, phone browser</h1><p>390 × 844 viewport · touch · bottom sheet</p></div>`;
}

async function main() {
  const t0 = Date.now();
  fs.rmSync(WORK_PREV, { recursive: true, force: true });
  if (reuse.length && fs.existsSync(WORK)) fs.renameSync(WORK, WORK_PREV);
  fs.rmSync(WORK, { recursive: true, force: true });
  fs.mkdirSync(WORK, { recursive: true });

  const health = await fetch(`${APP_URL}/api/health`).catch((e) => e as Error);
  if (health instanceof Error || !health.ok) {
    console.error(`The app is not answering at ${APP_URL}/api/health. Start it (or set APP_URL) and try again.`);
    process.exit(1);
  }
  console.log(`Recording ${APP_URL}`);

  const browser = await launch();
  const voiceOk = { value: true };
  const state: State = { stamp: Date.now() };
  const parts: Part[] = [];
  const recorded: { n: number; id: string; title: string }[] = [];
  const skipped: { n: number | string; module: string; reason: string }[] = [];
  const failures = new Map<string, string>();

  const chapterList = CHAPTERS.filter((c) => !only || only.includes(c.id));

  // Intro card
  {
    const n = await narrate(INTRO.id, INTRO.lines, path.join(WORK, "audio"), voiceOk);
    const png = path.join(WORK, "intro.png");
    await renderCard(browser, `<div class="wrap">${logoHtml}<h1>${INTRO.title}</h1><p>A live recording of ${new URL(APP_URL).host}</p></div>`, png);
    const file = path.join(WORK, "00-intro.mp4");
    const seconds = Math.max(5, n.duration + 0.8);
    await stillToVideo(png, n.file, seconds, file);
    parts.push({ file, seconds: await duration(file), chapter: "Intro", cues: n.cues });
  }

  const phoneBg = path.join(WORK, "phone-bg.png");
  await renderCard(browser, phoneBgHtml(), phoneBg);

  const done: { ch: ChapterScript; dir: string; sceneFile: string; cues: Narration["cues"] }[] = [];
  for (const ch of chapterList) {
    const scene = SCENES.find((s) => s.id === ch.id)!;
    const dir = path.join(WORK, `ch-${ch.id}`);
    fs.mkdirSync(dir, { recursive: true });
    console.log(`\n▶ ${ch.title}`);

    // Reuse the recorded clip from the previous run and mux it again with the current narration.
    const prevDir = reuse.includes(ch.id) && fs.existsSync(WORK_PREV) ? fs.readdirSync(WORK_PREV).find((d) => new RegExp(`^(\\d+|ch)-${ch.id}$`).test(d)) : undefined;
    const prevClip = prevDir ? fs.readdirSync(path.join(WORK_PREV, prevDir)).filter((f) => /^clip-(\d+|reused)\.mp4$/.test(f)).sort().at(-1) : undefined;
    if (prevDir && prevClip) {
      const clipFile = path.join(dir, "clip-reused.mp4");
      fs.copyFileSync(path.join(WORK_PREV, prevDir, prevClip), clipFile);
      const narr = await narrate(ch.id, ch.lines, path.join(WORK, "audio"), voiceOk);
      const sceneFile = path.join(dir, "scene.mp4");
      await muxScene(clipFile, await duration(clipFile), narr.file, narr.duration, sceneFile);
      done.push({ ch, dir, sceneFile, cues: narr.cues });
      recorded.push({ n: 0, id: ch.id, title: ch.title });
      console.log("  ✓ reused from the previous run");
      continue;
    }
    if (reuse.includes(ch.id)) console.warn("  (nothing to reuse, recording)");

    if (scene.needs && !recorded.some((r) => r.id === scene.needs)) {
      skip(ch, `needs chapter "${scene.needs}", which was not recorded${failures.has(scene.needs) ? ` (${failures.get(scene.needs)})` : ""}`);
      continue;
    }
    try {
      if (scene.check) await scene.check({ browser, stage: null as never, state });
    } catch (e) {
      skip(ch, `module check failed: ${msg(e)}`);
      continue;
    }
    const narr = await narrate(ch.id, ch.lines, path.join(WORK, "audio"), voiceOk);

    let clip: string | null = null;
    let clipSeconds = 0;
    for (let attempt = 1; attempt <= 2 && !clip; attempt++) {
      const stage = new Stage(browser, path.join(dir, `try-${attempt}`), narr.duration);
      try {
        await scene.run({ browser, stage, state, phoneBg });
        const file = path.join(dir, `clip-${attempt}.mp4`);
        clipSeconds = await stage.render(file, ch.id === "phone" ? phoneBg : undefined);
        clip = file;
      } catch (e) {
        await stage.abort();
        console.warn(`  ! attempt ${attempt} failed: ${msg(e)}`);
        if (attempt === 2) failures.set(ch.id, msg(e));
      }
    }
    if (!clip) {
      skip(ch, `scene failed twice: ${failures.get(ch.id)}`);
      continue;
    }

    const sceneFile = path.join(dir, "scene.mp4");
    await muxScene(clip, clipSeconds, narr.file, narr.duration, sceneFile);
    done.push({ ch, dir, sceneFile, cues: narr.cues });
    recorded.push({ n: 0, id: ch.id, title: ch.title });
    console.log(`  ✓ recorded (${clipSeconds.toFixed(1)} s of action, ${narr.duration.toFixed(1)} s narration)`);
  }

  // Title cards, numbered over the chapters that made it in.
  for (const [i, d] of done.entries()) {
    recorded.find((r) => r.id === d.ch.id)!.n = i + 1;
    const cardPng = path.join(d.dir, "title.png");
    await renderCard(browser, titleHtml(i + 1, done.length, d.ch.title), cardPng);
    const card = path.join(d.dir, "title.mp4");
    await stillToVideo(cardPng, null, 1.2, card);
    parts.push({ file: card, seconds: await duration(card), chapter: d.ch.title });
    parts.push({ file: d.sceneFile, seconds: await duration(d.sceneFile), cues: d.cues });
  }

  // Outro card
  {
    const n = await narrate(OUTRO.id, OUTRO.lines, path.join(WORK, "audio"), voiceOk);
    const png = path.join(WORK, "outro.png");
    await renderCard(browser, outroHtml(), png);
    const file = path.join(WORK, "99-outro.mp4");
    await stillToVideo(png, n.file, Math.max(6, n.duration + 1.5), file);
    parts.push({ file, seconds: await duration(file), chapter: "Try it", cues: n.cues });
  }
  await browser.close();

  // ---------- Assemble ----------
  const list = path.join(WORK, "parts.txt");
  fs.writeFileSync(list, parts.map((p) => `file '${p.file.replace(/\\/g, "/")}'`).join("\n"));
  const joined = path.join(WORK, "joined.mp4");
  await ffmpeg(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", joined]);

  // Real cumulative timestamps (ffprobe durations of each part)
  let t = 0;
  const chapters: string[] = [];
  const srt: string[] = [];
  let cueNo = 1;
  for (const p of parts) {
    if (p.chapter) chapters.push(`${mmss(t)} ${p.chapter}`);
    for (const c of p.cues ?? []) srt.push(`${cueNo++}\n${srtTime(t + c.start)} --> ${srtTime(t + c.end)}\n${c.text}\n`);
    t += p.seconds;
  }
  fs.writeFileSync(path.join(OUT, "captions.srt"), srt.join("\n"));
  fs.writeFileSync(path.join(OUT, "chapters.txt"), chapters.join("\n") + "\n");

  // Burn in the captions (white on the app's dark green) and normalise loudness to -16 LUFS.
  const bgr = GREEN_DARK.slice(1).match(/../g)!.reverse().join("").toUpperCase();
  const style = `FontName=Segoe UI,FontSize=12,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H00${bgr},BackColour=&H00${bgr},BorderStyle=3,Outline=6,Shadow=0,MarginV=14,MarginL=40,MarginR=40,Alignment=2`;
  const final = path.join(OUT, "freshshare-demo.mp4");
  await ffmpeg(
    ["-i", path.relative(OUT, joined), "-vf", `subtitles=captions.srt:force_style='${style}'`, "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", ...ENC_FINAL, "-movflags", "+faststart", "freshshare-demo.mp4"],
    OUT,
  );
  const totalSeconds = await duration(final);

  // ---------- Reports ----------
  const allScripts = [INTRO, ...chapterList.filter((c) => recorded.some((r) => r.id === c.id)), OUTRO];
  fs.writeFileSync(path.join(OUT, "script.md"), `# FreshShare demo narration\n\nRecorded against ${APP_URL}. Voice: ${voiceOk.value ? `msedge-tts ${VOICE}` : "none (captions only)"}.\n\n` + allScripts.map((c: ChapterScript) => `## ${c.title}\n\n${c.lines.join(" ")}\n`).join("\n"));
  for (const m of KIT_MODULES) {
    if (!m.scene) skipped.push({ n: m.n, module: m.module, reason: m.note! });
  }
  const modules = {
    generatedAt: new Date().toISOString(),
    appUrl: APP_URL,
    voice: voiceOk.value ? `msedge-tts ${VOICE}, rate +0%` : "none: msedge-tts could not reach the network, so the video has captions only",
    totalSeconds: Number(totalSeconds.toFixed(2)),
    withinLimit: totalSeconds <= MAX_TOTAL_SECONDS,
    recorded: recorded.map((r) => {
      const kit = KIT_MODULES.find((m) => m.scene === r.id);
      return { chapter: r.n, kitModule: kit?.n, id: r.id, title: r.title, ...(kit?.note ? { note: kit.note } : {}) };
    }),
    skipped,
  };
  fs.writeFileSync(path.join(OUT, "modules.json"), JSON.stringify(modules, null, 2) + "\n");

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Video:    ${final}`);
  console.log(`Length:   ${mmss(totalSeconds)} (${totalSeconds.toFixed(1)} s)${totalSeconds > MAX_TOTAL_SECONDS ? "  ⚠ over 4:00" : ""}`);
  console.log(`Voice:    ${modules.voice}`);
  console.log(`\nChapters:\n${chapters.map((c) => `  ${c}`).join("\n")}`);
  console.log(`\nSkipped:\n${skipped.map((s) => `  #${s.n} ${s.module}: ${s.reason}`).join("\n") || "  none"}`);
  console.log(`\nDone in ${Math.round((Date.now() - t0) / 1000)} s.`);

  function skip(ch: ChapterScript, reason: string) {
    const kit = KIT_MODULES.find((m) => m.scene === ch.id);
    skipped.push({ n: kit?.n ?? ch.id, module: kit?.module ?? ch.title, reason });
    console.warn(`  ✗ skipped: ${reason}`);
  }
}

/** First line of the error plus the line naming the element (Playwright puts it on "Locator:"). */
const msg = (e: unknown) => {
  const lines = (e instanceof Error ? e.message : String(e)).replace(/\u001b\[[0-9;]*m/g, "").split("\n");
  const loc = lines.find((l) => /^\s*(Locator|waiting for)/.test(l));
  return [lines[0], loc?.trim()].filter(Boolean).join(" | ").slice(0, 400);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
