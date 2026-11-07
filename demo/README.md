# Demo video

A narrated product tour recorded from the running app with Playwright, assembled with ffmpeg. No API keys, no editing software.

```bash
npm run demo:reset   # fresh demo sessions + checks the demo data (see below for re-seeding)
npm run demo:video   # records and writes demo/out/
```

Target: `APP_URL`, default `https://freshshare.de`. For a local stack: `APP_URL=http://localhost:5173 npm run demo:reset && APP_URL=http://localhost:5173 npm run demo:video`.

Output in `demo/out/` (not committed):

| File | What |
| --- | --- |
| `freshshare-demo.mp4` | 1920x1080, 30 fps, H.264 + AAC, captions burned in, audio at -16 LUFS |
| `captions.srt` | the narration as subtitles |
| `chapters.txt` | `mm:ss Chapter title`, from the real part durations (ffprobe) |
| `script.md` | the narration text per chapter |
| `modules.json` | recorded chapters, and every skipped module with the reason |

## How it works

- `script.ts`: narration, two to four sentences per chapter. Voice: msedge-tts `en-US-AriaNeural` (free, no key); without network the video gets captions only and `modules.json` says so.
- `scenes.ts`: one Playwright scene per chapter, real clicks and real database writes, each checked with `expect` (the result must appear or the scene fails, is retried once, then skipped and logged).
- `lib/stage.ts`: recorded browser contexts per role (sessions saved once per role in `demo/out/.auth/`, so no password is typed on screen), a visible cursor and click ripple, a "signed in as" pill, split screen (giver left, receiver right) and a blur on any e-mail that is not `@demo.freshshare.de`.
- `video.ts`: module checks, narration, recording, title cards, intro and outro (with a QR code to the app), concat, burned-in captions, loudness normalisation and the reports.

## Demo data

Only the seeded `@demo.freshshare.de` accounts are used (password `freshshare-demo`, marked `// DEMO`). Override with `DEMO_GIVER_EMAIL`, `DEMO_RECEIVER_EMAIL`, `DEMO_ADMIN_EMAIL`, `DEMO_PASSWORD` in `.env`.

Every recording writes to the target's database. It never touches real neighbours' data: claims, bulk runs and reports only use listings from the seeded demo givers, and any e-mail on screen that isn't `@demo.freshshare.de` is blurred. What it leaves behind: a posted bread-rolls listing (then claimed and collected), two seeded listings in a bulk run, a rejected "Demo Fridge" suggestion, an approved "Demo Community Kitchen" organization, a dismissed demo report, demo early-access and sign-up accounts. Reversible steps are put back (the notification claim, the waitlist claim, the block). For a clean state, re-seed first:

- local: `npm run demo:reset` runs `npm run db:seed`
- AWS: `DEMO_RESEED=1 npm run demo:reset` triggers the "App database seed (manual)" workflow with the GitHub CLI and waits for it

Without a re-seed it still runs: the claim chapter uses the listing Anna posts in chapter 3 when the lasagne is gone. Seeded listings run out after a few recordings; then the bulk-run chapter is skipped and logged in `modules.json`.
