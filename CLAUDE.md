# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

LichtOrgel is an audio-driven "light organ": a single self-contained file, `index.html` (HTML + CSS + JS, no build step, no dependencies, no package.json), published via GitHub Pages (https://helmutqualtinger.github.io/LichtOrgel/, repo HelmutQualtinger/LichtOrgel). It is also an installable PWA: `manifest.webmanifest`, `sw.js` and the icons. The UI text and code comments are in German; keep them German.

## Running

Microphone access (`getUserMedia`) needs a secure context, so serve over localhost rather than opening the file directly:

```sh
python3 -m http.server 8000   # then open http://localhost:8000 (avoid port 5000: macOS AirPlay)
```

URL parameter `?gpu=webgpu | webgl | off` forces a render backend (useful for comparing backends or testing the Canvas 2D fallback).

## Verification (no test suite)

- Syntax check: extract the `<script>` body and run `node --check` on it.
- Headless Chrome via `--dump-dom` works for synchronous checks (call `applyMode(name)` + `drawVisual(fakeLevels)` from an injected script). Do **not** use `--virtual-time-budget` for WebGPU: virtual time makes async shader compilation appear to hang. For WebGPU, drive real-time headless Chrome over the DevTools protocol (`--remote-debugging-port`, `Runtime.evaluate` with `awaitPromise`) and take screenshots with `Page.captureScreenshot`.
- Chrome flags `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream --auto-select-desktop-capture-source=Entire` let headless runs exercise both the mic and the screen-share path (served over `http://127.0.0.1`, not `file://`). Real microphone input can't be tested headless; `Oszilloskop`/`Wasserfall` and the GPU uniform values only get real data with a live mic.

## Architecture

One `requestAnimationFrame` loop, `drawLevels()`, runs while the mic is active:

1. **Audio**: source menu `#source` (persisted as `lichtorgel-source`), three optgroups: inputs, synthesizer loops, own music. Inputs: default mic, any `audioinput` device (e.g. a BlackHole loopback), or `system` = computer sound via `getDisplayMedia` (Chrome/Edge only; video track is stopped immediately, user must tick "Share audio"). `openStream()` picks the API; processing (echo cancellation, noise suppression, auto gain) is deliberately **off** for low latency. Computer sound is shifted by `systemOffsetDb` (−20 dB) because a digital signal is much louder than a mic. Music: `file` = own audio file via a hidden file input; `startMusic()` plays it in a loop through an `Audio` element → `createMediaElementSource` → analyser → `musicGain` → `destination` (audible) and sets `stream` to an empty `MediaStream` as the "audio is running" marker that the rest of the code checks. (An internet-radio source existed briefly and was removed on request.) Synth group: `synth:<id>` = generative loops from `synthPresets` (goa, forest, psydub, raga, sixties, krautrock, kosmos, bowls; object order = menu order, first = autostart default), built by `createSynth()` purely with Web Audio (voices: kick, noiseHit, synth incl. `type: "organ"` periodic wave, pluck, drum, snare, bowl) (oscillators, filters, noise buffer, convolver reverb from a generated impulse, filtered feedback delay). Signal chain: voice buses (`makeBus` dry/delay/reverb sends) → per-preset `gain` → glue compressor → limiter (−3 dB, ratio 20) → `synth.output` → analyser. A 25 ms `setInterval` schedules 16th-note steps ahead on the audio clock (`preset.step(state, step, time, voice, stepDur)`), with a longer horizon while the tab is hidden. `startSynth()` waits for a user gesture itself if the context can't start. `startMusic()` plays an `Audio` element through `createMediaElementSource` → analyser → `destination` (audible) and sets `stream` to an empty `MediaStream` as the "audio is running" marker that the rest of the code checks. Autostart: page load always enables auto mode and calls `autostart()` with a synthesizer loop (the saved one if a synth was last chosen, else the first preset, Goa); no mic permission is requested at load. If the browser blocks sound or speech until a user gesture, the first pointerdown/keydown unlocks it. Resilience: `watchStream()` auto-reconnects a mic whose track ends (device change, AirPods, sleep; falls back to the default mic if the device vanished), the `AudioContext` is resumed on `statechange`/`visibilitychange`, and `drawLevels()` schedules the next frame before rendering and catches per-frame errors, so a throwing mode can't kill the loop. Any user action bumps `reconnectToken` to cancel a pending reconnect. → `AnalyserNode` (`fftSize` 1024, `smoothingTimeConstant` 0). Latency was a user complaint; don't raise FFT size or smoothing without reason.
2. **Bands**: 10 log-spaced bands, 40 Hz–16 kHz, power-averaged in dBFS and clamped to `minDb` −90 … `maxDb` −30. There is no level meter display anymore (removed on request); the bands only feed the visualization.

**Layout**: one compact header bar (title, mic toggle, status, `<select>` menus for mode and theme, backend/fps label) above `#vis-stage`, which fills the rest of the viewport (`100dvh`, page never scrolls). A `ResizeObserver` on the stage resizes both canvases.
3. **Visualization**: `drawLevels()` calls `drawVisual(levels)`, which normalizes levels into `visLevels` (0..1; instant attack, 0.25 decay), derives `bass`, `overall`, `dominant` and a `beat` flag (bass jump above its running average), then renders the selected mode. Called with no argument it draws the idle state (mic off, theme/mode switch, resize).

### Modes, themes, backends

- `themes` — palette objects (`bg`, three `colors`, `core`, `glow`). Adding an entry auto-creates its menu option.
- `modes` — Canvas 2D implementations `(ctx, w, h, theme, state)`. Each mode clears or fades the canvas itself (`fade()` uses `destination-out` for trails). Per-mode scratch state lives in `fx`, which `renderModes()` points at `fxStore[mode]` before each call (two modes can run at once); `resetModeState()` clears it when a mode is entered. Modes must draw via their `ctx`/`ctx.canvas`, never `visCanvas` directly. Adding an entry auto-creates its menu option.
- `gpuShaders` — optional GPU versions of a mode, keyed by the same name. If the active backend is GPU and a shader exists, it is used instead of the 2D mode on a stacked `#visual-gpu` canvas.
- Backend chain in `initGpu()`: WebGPU (4 s timeout) → WebGL2 → Canvas 2D. A canvas keeps its first context type, so a failed attempt calls `freshGpuCanvas()` before trying the next.

### Mode crossfades, auto mode and theme blending

- Mode changes (manual and auto) go through `transitionTo()`: for `modeBlendMs` (2.5 s) the old and new mode render simultaneously in `renderModes()`. 2D+2D uses the two 2D layers (`#visual`, `#visual-b`) with opposite opacity; GPU+GPU draws both shaders in one pass, the new one blended via a blend constant (WebGPU: background-built `blendPipelines`, WebGL: `CONSTANT_ALPHA`); GPU+2D fades the GPU canvas, which lies on top. The theme background gradient sits on `#vis-stage`, so 2D layers stay transparent. `applyMode()` switches instantly (init, idle).
- `#auto` toggle (persisted as `lichtorgel-auto`). `autoStep()` runs inside `drawVisual()`, so it only advances while audio is running. Every `autoModeMs` (20 s) it crossfades to the **next** mode in menu order on the next bass beat (at most 3 s late); every `autoThemeMs` (12 s) it blends to the next theme in order.
- Theme changes (auto and manual) go through `blendToTheme()`. Modes and `renderGpu()` must read the theme from `currentTheme()` (passed in as `t`), never `themes[themeName]` directly: during a blend `currentTheme()` returns an interpolated theme object with hex colors. Caches derived from theme colors must key on the colors (see Plasma's LUT), not on `themeName`.
- Choosing a mode or theme by hand resets the auto schedule.
- Speech (`#speech` toggle, `lichtorgel-speech`): on every theme change `speakNext()` speaks one of the 31 sayings of the current language via `speechSynthesis` (rate 0.72) and shows it in `#caption`. Order is a Fisher–Yates shuffle consumed without repeats, reshuffled when empty. `pickVoice()` takes the first German voice matching `femaleVoices` (Premium/Enhanced preferred). Speech can't be louder than `volume = 1` and bypasses Web Audio, so for music sources `duckMusic()` lowers `musicGain` (after the analyser, so the visuals are unaffected) to `duckLevel` 0.25 while speaking. `speak()` needs prior user activation, which the Auto/Start clicks provide. `stopSpeech()` runs on auto off, speech off and `stopAudio()`; `setAuto(autoOn)` is called only after the speech block because `stopSpeech` touches `caption`.

### Shader authoring rules (important)

Shaders are written **once** in a restricted GLSL subset (`shaderLib` + each `gpuShaders` entry, with a `vec4 shade(vec2 fc)` entry point, `fc` in device pixels with top-left origin). WebGL2 uses them as-is; for WebGPU `toWGSL()` converts them with regex. Code must therefore follow:

- every declaration typed (`float x = ...`), no implicit int→float; floats always written with `.0`
- braces on every `if`/`for`; no ternary operator; no swizzle assignment; never assign to function parameters
- use `atan2` and `fmod` (defined in both preambles), not `atan(y,x)`/`mod`
- helper functions must be defined before use (GLSL order)
- avoid GLSL/WGSL reserved words as identifiers (e.g. `half`, `sample`, `filter`, `in`, `out`)

Uniforms are one `vec4 u[12]` array (layout documented in the comment above `shaderLib`); `renderGpu()` fills it. Both preambles also provide `orbitAt(int i)`, reading an RG32F 1024×4 texture (WebGPU binding 1, WebGL texture unit 0).

Mandelbrot deep zoom (state machine in `mandelStep()`: `pan` from the previous spot → `in` to `mandelDepth` = 1e-16, or earlier when `mandelBlackShare()` (24×14 CPU sample grid) finds > 90 % interior → `out` → next spot; velocity eases smoothly; the method itself works to ~1e-30). Mandelbrot ignores the theme colors and uses its own `heatStops` palette (mirrored, 8 cycles over 0..maxIt; GLSL `heat()` must match): `mandelSpots` are Misiurewicz points as 50-digit strings; `referenceOrbit()` iterates the target with BigInt fixed point (200 bits) on the CPU, the backends upload `mandel.ref.f32` into the orbit texture when `mandel.version` changes, and the shader (and the 2D fallback, in doubles) iterates only the per-pixel delta (perturbation) with rebasing when |z| < |dz| or the reference orbit ends. `mandelStep()` advances the zoom once per frame; while Mandelbrot is on, `renderGpu()` adapts the GPU canvas resolution to the frame rate (`gpuState.mandelRes`, 0.4…1); u[10..11] carry offset, scale, max iterations, rotation, fade and orbit length. float32 deltas stop working below ~1e-36, so don't push `mandelDepth` much past 30. After changing a shader, verify it compiles under **both** `?gpu=webgpu` and `?gpu=webgl`.

### Languages (UI and voice)

- The flag menu `#lang` (`lichtorgel-lang`, default from `navigator.language`) sets UI **and** voice language: `uiText[de|en|it]` holds all UI strings, `tr(key, ...args)` looks them up (functions for strings with parameters). Static HTML uses `data-i18n`, `data-i18n-title`, `data-i18n-aria`; `applyUiLang()` re-renders those, the menus (`relabelMenus()`, `fillSources()`) and the current status.
- `setStatus(key, active, ...args)` takes a **translation key**, never literal text, so a language switch can re-translate the visible status.
- Mode and theme keys stay German internally (saved settings, `gpuShaders`); `modeLabel()`/`themeLabel()` translate only the displayed names.
- `languages[lang]` holds the 31 `sayings` and the preferred female `voices` per language. Speech fires on every **theme change** (auto and manual), not on mode changes.
- `applyUiLang(uiLang)` runs at the end of the script, because it needs the source menu and status helpers defined further down.

### PWA and mobile

- `sw.js` caches the app shell with stale-while-revalidate (cache name `lichtorgel-v1`); it is registered only over `https:` so local development is never cached. Add new top-level files to `ASSETS` in `sw.js`; bump the cache name only when files are removed or renamed.
- No Xcode/Android SDK on this machine; native store builds (e.g. Capacitor) would need them plus developer accounts.
- Phones: `isMobile` (`pointer: coarse`) caps canvas resolution (2D 1.5×, GPU 1.25×) and shortens the synth reverb (1.8 s) to keep the audio thread from underrunning; music contexts use `latencyHint: "playback"` (mic keeps `"interactive"`); the synth scheduler re-syncs instead of cramming late notes (prevents clicks). Safe-area insets pad `main` (`viewport-fit=cover`).

### Persistence

Selected theme and mode are stored in `localStorage` (`lichtorgel-theme`, `lichtorgel-mode`) via `loadSetting`/`saveSetting`, wrapped in try/catch.
