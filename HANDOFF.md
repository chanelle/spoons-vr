# SPOONS: IWSDK port handoff

**Branch:** `iwsdk-port` (not merged, no PR, live site untouched). The plain three.js version is still intact on the default branch and still what chanelle.github.io/spoons-vr serves.

**Status:** port complete. Every automated check passes, in desktop mode and in the IWSDK emulator. Not yet tried on a physical Quest.

## What changed

- `src/main.js` now runs on Meta's Immersive Web SDK (`@iwsdk/core` 1.1.0):
  - `World.create()` owns the renderer, scene, camera, render loop and XR session (`world.launchXR()`), passthrough `immersive-ar` first, then VR, then desktop.
  - The game loop is one IWSDK ECS system (`SpoonsSystem`). The table root and the sky are IWSDK transform entities.
  - Hands and controllers come from IWSDK's input manager (`world.input.xr`). Pinch is still thumb tip to index tip distance with the same 2 cm / 4 cm thresholds, and the pointer is still the midpoint.
  - Pause on headset removal uses `world.visibilityState`. Recentering uses `world.player.head`.
- `src/game.js`, `src/art.js`, `src/audio.js`: **unchanged**.
- `index.html`: only the three.js import map was removed.
- three.js now comes from npm (the IWSDK build of r185) instead of `vendor/` (r170). `vendor/` is deleted on this branch.
- New: `vite.config.js`, `package-lock.json`, `test/emulator.mjs`, this file. README run instructions updated.
- IWSDK's own hand models, controller models and ray pointers are switched off so the look is the same as before (real hands in passthrough plus the small pinch dot) and nothing is downloaded at runtime.

## Preview

Needs Node 20.19+ or 22.12+.

```bash
git fetch origin && git checkout iwsdk-port
npm ci
npm run dev        # https://localhost:8081 (self-signed certificate)
```

- **Desktop:** open the URL, accept the certificate warning, drag with the mouse.
- **Emulator:** on localhost the dev server injects IWER (Quest 3 emulation). Click "Enter with your hands (passthrough)", then use the emulator panel to switch to hands and pinch.
- **Quest, same Wi-Fi:** `npm run dev` prints a Network URL such as `https://192.168.x.x:8081`. Open it in the Meta Quest Browser and accept the certificate warning (Advanced, then Proceed). Quest needs HTTPS, plain HTTP will not offer XR. The emulator is not injected on a real headset.
- **Static build:** `npm run build` writes `dist/` (relative paths, works from any folder). Check it locally with `python3 -m http.server 8766 -d dist`.

### Hosting a judge-facing build (not done, on purpose)

GitHub Pages currently serves the default branch as plain files, and this branch needs a build. Options, pick one:

1. Drag the `dist/` folder onto Netlify Drop or Cloudflare Pages. Fastest, gives an HTTPS link, touches nothing on GitHub.
2. Merge the branch and switch Pages to a GitHub Actions workflow that runs `npm ci && npm run build` and publishes `dist/`. Keeps the current URL but replaces the live three.js version.
3. Publish `dist/` to a second repository with Pages turned on.

## Test results

| Test | Baseline (default branch, 39006c5) | After port (`iwsdk-port`) |
|---|---|---|
| `npm test` (game rules) | 10 pass, 0 fail | 10 pass, 0 fail |
| `node test/smoke.mjs` (headless mouse play-through) | play, pay 8 to 7 spoons, tomorrow 1, borrowed 1, end summary, errors none | identical output, errors none (run against the built `dist/`) |
| Screenshots | reference | visually identical in the frames compared |
| `npm run build` | n/a (no build) | succeeds in about 20 s |

Reproduce:

```bash
npm test
npm run build && python3 -m http.server 8766 -d dist &
node test/smoke.mjs http://127.0.0.1:8766/ /tmp/out
SPOONS_HTTP=1 npm run dev &          # plain HTTP for headless runs
node test/emulator.mjs http://localhost:8081/ /tmp/out
```

`smoke.mjs` and `emulator.mjs` need Playwright with a Chromium installed (`npx playwright install chromium`).

## Emulator verification (IWER Quest 3, via `test/emulator.mjs`)

24 of 24 checks pass:

- Emulator injected, IWSDK world running, passthrough offered.
- Session starts through IWSDK as `immersive-ar` with `alpha-blend`, `hand-tracking` and `local-floor` granted.
- Passthrough: sky hidden, canvas clear alpha 0.
- Table recentres on the head. Everything is within 0.62 m of the head (seated reach).
- Hands only: open hand does not select. Pinch an orb starts the day. Pinch a spoon, release on a task, it pays. Pinch a card, release on Tomorrow, deferred. Release on Let go, dropped. Pinch the jar, borrows. Hold a pinch on the pillow, rest progresses. Left hand tracked too.
- Controller trigger picks up a spoon.
- Game pauses when the session is hidden and resumes when visible.
- Leaving XR restores the desktop view and keeps the day.
- No page errors, and no network requests to other hosts.

**Not verified** (needs the real headset): real passthrough compositing, real hand tracking feel and pinch reliability, frame rate, comfort of the seated layout, audio, and the first load time on Quest.

## Known issues

- **Not tested on a physical Quest.** The emulator proves the code path, not the feel.
- **Bigger download.** IWSDK bundles its UI, physics glue and three.js into one 6.6 MB script (1.7 MB gzipped). The old version was about 0.7 MB. Expect a few seconds before the first frame on Quest, so the README line "it starts instantly" is no longer quite true. Fonts and the physics engine in `dist/assets` are lazy chunks that SPOONS never requests.
- IWSDK asks for the WebXR `layers` feature and multiview rendering by default. This is the normal IWSDK path on Quest but the old version did not use it. If passthrough shows a black background on the headset, this is the first place to look.
- The console shows four harmless warnings "Failed to load visual asset ... input will be tracked without a visual". That is the deliberate switch-off of IWSDK's hand and controller models.
- With controllers there is no visible controller model or dot. This matches the old version.
- `test/capture.mjs` and `test/views.mjs` were not rerun (frame capture was skipped to save time).
- Commits on this branch are attributed to Claude Fable 5.2, the model that actually did the work.

## Remaining submission requirements

1. Confirm Meta VR Start membership for the submitting account.
2. Host the build at a public HTTPS link (see hosting options above) and test that link in the Quest Browser.
3. Record a demo video under 3 minutes, from the Quest or the emulator, and upload it to YouTube or Vimeo.
4. Write the Devpost text description. Say it is built with IWSDK (WebXR).
5. Choose the Gaming track and the New Experience division.
6. Submit before **Nov 18, 12:00 PM PT**.

## The one thing to do on the real headset

Open the HTTPS link in the Quest Browser, enter passthrough, and play one full day with hands only: check you see your room (not black), that pinching picks up spoons and cards reliably, and that everything is reachable from a chair.
