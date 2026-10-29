# SPOONS

A seated, hands-first WebXR game about spending your energy. Entry for the Meta VR Start Developer Competition 2026 (Gaming · New Experience).

Each morning you pick how your body feels and get a tray of spoons. Tasks float in. Every one costs spoons. Pinch a spoon and drop it on a task to pay. Pinch a task and toss it to **Tomorrow** or **Let go**. Hold the pillow to rest (time keeps moving). Flares bend spoons. Borrowing from tomorrow always works and always costs double. One day runs about 7 minutes. Deferred tasks and borrowed spoons carry into the next morning.

Spoon theory: Christine Miserandino.

## Run it

No build step and no install. Serve the folder and open it:

```
python3 -m http.server 8765
```

- **Quest (passthrough, hands):** serve over HTTPS (GitHub Pages, Vercel) and open in the Meta Quest Browser, then tap *Enter with your hands*.
- **Desktop:** drag with the mouse. Same game, same rules.
- **Emulator:** works with the Immersive Web Emulator extension (controllers count as pinch).

## Layout

- `src/game.js`: pure, seeded game logic (no rendering). Unit-tested.
- `src/main.js`: scene, hand pinch input, controllers, mouse, XR session.
- `src/art.js`: procedural spoons, tray, cards. No downloaded assets.
- `src/audio.js`: synthesized sounds.
- `vendor/three.module.min.js`: three.js r170 (MIT).

## Tests

```
npm test                     # game logic
node test/smoke.mjs URL DIR  # headless play-through with screenshots
```

## Status

v0.1 overnight prototype. Untested on a real headset yet.
