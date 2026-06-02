# Motion Studio — Project Context

> **For Claude:** This file is the authoritative context document for the Motion Studio project. Read it at the start of any session to get full context without needing to re-explore the codebase.

---

## What This Is

**Motion Studio** is a production-grade AI video creation studio built as a feature for **Imagine Art** (imagine.art). It allows users to go from a text prompt → AI-generated storyboard → editable video composition → real rendered MP4, entirely in-browser.

The engine is called **Kinetic** (this is the in-product name — never say "Hyperframes" to users, though the open-source library behind it is [HeyGen Hyperframes](https://github.com/heygen-com/hyperframes)).

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| State | Zustand (persisted to localStorage) |
| AI | Gemini 2.5 Flash (`gemini-2.5-flash`) via server-side proxy |
| Video render | `npx hyperframes@latest render` → headless Chrome → FFmpeg → MP4 |
| Dev server | Vite with two custom plugins: `renderPlugin.mjs` + `aiPlugin.mjs` |
| Prod server | Express (`server/prod.mjs`) — serves `/dist` + same API routes |
| Deployment target | Railway (Docker) — requires Chrome + FFmpeg system deps |

---

## Directory Structure

```
motion-studio/
├── src/
│   ├── types.ts            ← all domain types (VideoProject, SceneElement, EditorScene, etc.)
│   ├── data.ts             ← seed templates, palette map, generateStoryboard fallback, buildEditorState
│   ├── store.ts            ← Zustand store — projects, editors, undo/redo, scene element mutations
│   ├── scene.ts            ← iframe preview HTML generator (CSS animations, infinite loop, for thumbnails)
│   ├── sceneModel.ts       ← scene graph: deriveElements(), buildScenes(), elementStyle(), meshBg()
│   ├── composition.ts      ← Kinetic-valid HTML composition builder (buildCompositionFromScenes)
│   ├── render.ts           ← client render API — startRender(), pollRender(), getRenderStatus()
│   ├── ai.ts               ← Gemini client — generateStoryboardAI(), editorCommandAI(), repairCalls()
│   ├── App.tsx             ← router
│   ├── main.tsx
│   ├── styles/
│   │   ├── tokens.css      ← Imagine Art design tokens (dark, #8A3FFC brand, neutral ramp)
│   │   └── global.css      ← base styles, .btn, .chip, .badge, .tl-clip, .ms-layerrow
│   ├── components/
│   │   ├── Icon.tsx        ← inline SVG icon set (stroke, 24px, Lucide-style)
│   │   ├── ScenePreview.tsx ← <iframe srcdoc> animated preview component
│   │   ├── Sidebar.tsx     ← Imagine Art left sidebar with Motion Studio nav item
│   │   ├── cards.tsx       ← TemplateCard, ProjectCard
│   │   └── shared.tsx      ← Modal, Segmented, ProgressBar, StatusBadge
│   └── pages/
│       ├── Dashboard.tsx         ← /studio — Higgsfield-style start cards, projects, templates
│       ├── ProjectSetup.tsx      ← /studio/new — prompt, URL scrape, model picker, assets
│       ├── StoryboardEditor.tsx  ← /studio/projects/:id/storyboard
│       ├── VideoEditor.tsx       ← /studio/projects/:id/editor (NLE with scene graph)
│       └── editorParts.tsx       ← LayerPanel, ContextualToolbar, AIPromptBar, AIChatPanel, Timeline
├── server/
│   ├── renderPlugin.mjs    ← Vite dev plugin: /api/render, serves /renders with HTTP Range support
│   ├── aiPlugin.mjs        ← Vite dev plugin: /api/ai/storyboard, /api/ai/edit, /api/ai/regenerate-frame
│   └── prod.mjs            ← Production Express server (same API routes, serves /dist)
├── Dockerfile              ← node:20-bullseye-slim + chromium + ffmpeg
├── railway.toml
├── .env                    ← GEMINI_API_KEY, GEMINI_MODEL=gemini-2.5-flash
└── vite.config.ts
```

---

## Core Concepts

### Scene Graph Model (key architectural decision)
Each video scene is an **HTML document** that Kinetic renders to frames. In the editor, each scene is represented as a `EditorScene` with an array of `SceneElement` objects (not just overlays). This means:

- The canvas shows the **actual editable scene elements** (Headline, Subtitle, Globe, etc.) as React nodes
- Clicking any scene element in the Layers panel or on canvas selects it
- Elements can be moved, resized (corner handles), and edited inline (double-click)
- When rendering, `buildCompositionFromScenes()` converts the scene graph → lint-valid Kinetic HTML

**Overlays** are *persistent* elements that appear across the whole video (logo, watermark, uploaded image). Scene elements are *per-scene*.

### Scene Element Types (`src/sceneModel.ts`)
```ts
type SceneElementType = 'text' | 'shape' | 'image' | 'graphic'
// graphic kinds: 'globe' | 'ring' | 'frame' | 'bars'
```
`deriveElements(seed)` auto-generates scene elements from a storyboard seed. Each scene kind (`hero`, `cards`, `globe`, `cta`, etc.) has a predefined element layout.

### Render Pipeline
```
User clicks "Generate Video"
  → startRender(project) in render.ts
  → buildCompositionFromScenes(scenes, overlays) in composition.ts
    → produces 1920×1080 lint-valid HTML (clip shells, GSAP timeline, deterministic)
  → POST /api/render { id, html, meta }
  → backend spawns: npx hyperframes@latest render -o out.mp4 --fps 30
    → headless Chrome (PUPPETEER_EXECUTABLE_PATH in Docker)
    → FFmpeg assembles MP4
  → poll /api/render/status?id=... every 900ms
  → when complete: serves /renders/:id/out.mp4 with HTTP Range headers (so <video> can seek)
```

### HTTP Range Requests (critical bug fixed)
The MP4 server **must** serve with `Accept-Ranges: bytes` and handle `Range` headers (206 Partial Content). Without this, browsers can't seek — the video plays forward only, and paused frames show nothing. Both `renderPlugin.mjs` and `server/prod.mjs` implement range support.

### AI Integration (Gemini)
- **Storyboard generation**: POST `/api/ai/storyboard` → Gemini JSON-mode → structured `{scenes:[{kind, title, headline, copy, notes}]}`. Falls back to `generateStoryboard()` (deterministic local) on any error.
- **Editor commands**: POST `/api/ai/edit` → Gemini → `{summary, calls:[{tool, target, ...args}]}`. Client-side `repairCalls()` fills in missing args that Gemini drops (e.g. `color` for `set_color`).
- **Frame regeneration**: POST `/api/ai/regenerate-frame` → updates a single storyboard scene.
- **Fallback**: Every AI call has a fully functional deterministic fallback — the UI never breaks without a key.

### "Editing: X" Awareness
When an element is selected, both the AI prompt bar and the AI Editor panel update to show `Editing: <element name>`. The AI bar placeholder changes to `Edit "Headline" — e.g. make it gold and larger`. Element-specific quick chips appear (vs whole-video chips when nothing is selected).

---

## Design System

Follows **Imagine Art Design System V-3** exactly:

| Token | Value |
|---|---|
| Brand color | `#8A3FFC` (imagine-60) |
| Background | `#0F0F0F` (neutral-110) |
| Elevated surface | `#171717` (neutral-100) |
| Card/surface | `#1A1A1A` |
| Border | `#232323` |
| Primary text | `#FFFFFF` |
| Secondary text | `#D1D1D1` |
| Muted text | `#9A9A9A` |
| Font | Inter (body), Outfit (display) |
| Radius | xs:4 sm:8 md:12 lg:16 pill:9999 |

**No lime/green accents in chrome.** All accent usage maps to the purple `#8A3FFC`. The `--lime` token is remapped to `var(--accent)`.

---

## Editor Architecture

### Canvas (VideoEditor.tsx)
- Shows the **live editable scene** (not the MP4) when paused — rendered as React DOM
- Shows the **MP4 video element** only during playback (`display: block/none` toggle)
- Video element is always mounted (for seek) but hidden when paused
- Pointer interactions: `onPointerDown` on element → drag move; `onPointerDown` on resize handle → corner-scale resize; `onDoubleClick` on text → `contentEditable` inline editing
- Click on canvas background (not an element) → deselect (using `data-bg="1"` attribute check)

### LayerPanel
- **Scene X · [Name]** section shows the current scene's `SceneElement[]` — draggable to reorder, with hover-reveal duplicate/delete buttons
- **Overlays** section shows persistent overlays (logo, uploaded image)  
- **Tracks** section shows video clips, audio, captions (non-selectable metadata)
- Upload image button: reads file as dataURL, calls `store.addSceneElement` + `store.addAsset`

### ContextualToolbar
- Font family dropdown, ± font size stepper, B/I, align, 8 color swatches + custom color picker
- Opacity slider, rotate slider, duplicate button, delete button
- Only shown when `sel !== null`; `isText` prop controls whether font controls appear

### Timeline
- Neutral clip blocks with purple accent left-stripe (no rainbow colors)
- Purple playhead with glow
- Audio waveform as neutral bars
- Resizable by dragging top edge
- Zoom slider

---

## Known Issues / Next Steps

1. **Railway deployment**: The render pipeline (Chrome + FFmpeg) needs Docker. See `Dockerfile`. Free tier on Railway requires credit card after $5 trial. For no-card hosting, Render.com free tier has 512MB RAM which may OOM on render.

2. **Storyboard regenerate**: Fixed — clicking "Regenerate" now re-runs `generateStoryboardAI` in-place without navigating back to setup. The storyboard generation step feed plays, then Gemini result replaces the frames.

3. **Assets in render**: Uploaded images (`.webp`, etc.) are stored as `dataURL` in `project.config.assets[]` and used as the logo overlay's `src`. The `buildCompositionFromScenes` function embeds the dataURL directly into the HTML so it renders correctly in headless Chrome.

4. **Kinetic lint rules to always respect** (from the skill):
   - Every timed element: `class="clip"` + `data-start` + `data-duration` + `data-track-index`
   - GSAP only animates inner divs, never `.clip` elements directly
   - No overlapping clips on same track
   - `Math.random()`, `Date.now()`, `requestAnimationFrame`, `fetch()` are **forbidden** in composition HTML
   - GSAP timeline must be `{ paused: true }` and registered as `window.__timelines['main']`
   - No `repeat: -1` (infinite) — use finite repeat count

5. **GitHub**: Repo is at `github.com/raamizkn/motion-studio`

6. **Gemini API key**: Stored in `.env` as `GEMINI_API_KEY`. Current key is for `gemini-2.5-flash`. For Railway deployment, set this as an environment variable in the Railway dashboard (don't rely on the `.env` file).

7. **Scene transitions**: When the playhead moves to a new scene, the Layers panel auto-updates to show that scene's elements. This is driven by `currentScene = editor.scenes.find(s => time >= s.start && time < s.end)`.

---

## Running Locally

```bash
cd motion-studio
npm run dev        # starts Vite dev server on :5173 (includes AI + render plugins)
```

Navigate to `http://localhost:5173` → redirects to `/studio`.

For the render to work locally: `ffmpeg` must be on PATH (`brew install ffmpeg`).

## Building for Production

```bash
npm run build      # tsc + vite build → /dist
npm start          # node server/prod.mjs — serves /dist + API on PORT (default 3000)
```

---

## Naming Reference

| Internal name | User-facing name |
|---|---|
| Hyperframes | **Kinetic** (never say "Hyperframes" in the UI) |
| `generateStoryboard` | "Generate Storyboard" |
| `EditorScene` | "Scene" |
| `SceneElement` | The named layer (Headline, Globe, etc.) |
| `OverlayElement` | "Overlay" (persistent, cross-scene) |
| `buildCompositionFromScenes` | The render pipeline entry point |
| `deriveElements` | Converts storyboard seed → editable scene graph |
