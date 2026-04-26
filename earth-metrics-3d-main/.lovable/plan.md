## Soil Compass — 3D Interactive Website

A minimalist, black-themed website that puts a rotating 3D model of your Soil Compass device front and center, with real-time-style metrics floating around it. Two pages: a cinematic landing page and a live-demo dashboard preview.

### Visual Direction
- **Black canvas background** with subtle gradient depth and faint grid/topographic line accents.
- **Minimalist typography** — thin, spaced sans-serif (e.g., Inter / Space Grotesk) for headings; tiny mono labels for metric callouts.
- **Accent color**: a single warm earthy tone (amber/copper) against the black for highlights, plus a cool cyan for live-data pings.
- Smooth fade-ins, slow auto-rotation, and gentle parallax — nothing flashy, everything deliberate.

### Page 1 — Landing (`/`)
- **Hero**: Full-viewport 3D scene (React Three Fiber) of the Soil Compass device — a stylized cylindrical probe planted into a cross-section of soil, slowly auto-rotating. Mouse drag to orbit, scroll to zoom.
- Floating metric tags anchored to the model with thin leader lines:
  - 🌡 Temperature
  - 💧 Moisture
  - ☔ Weather (condition icon)
  - 🌊 Water level
  - 🧭 Orientation
  - 📏 Depth / elevation
  - 📍 GPS coords
- Minimal headline overlay (e.g., "Soil Compass — sense the ground beneath.") + a single CTA → "View Live Demo".
- Secondary section: 3-column thin-line feature blocks (Real-time sensing · AI Chatbot · Field-ready hardware).
- Section showcasing the chatbot — a clean dark chat bubble preview with sample Q&A about soil readings.
- Footer with thin separator, project credits, and contact link.

### Page 2 — Live Demo (`/demo`)
- Smaller 3D model on the left (still rotating, interactive).
- Right side: a dashboard panel with animated metric cards updating on a slow interval to simulate live data:
  - Moisture % with mini line chart
  - Temperature °C with trend indicator
  - Water level gauge
  - Weather card (condition + humidity + wind)
  - GPS / orientation readout
  - Depth profile bar
- "Ask the Compass" chatbot widget at the bottom — a styled mock conversation window where users can type and receive scripted/templated replies about the current readings.
- All numbers update smoothly with subtle animation; values are simulated client-side for the demo.

### Technical Notes
- 3D built with **react-three-fiber + drei** (works inside the Cloudflare Worker SSR — Three.js is client-only via dynamic loading where needed).
- The Soil Compass model is procedurally built from primitives (cylinder probe, soil layer slab, antenna ring) — no external asset required, so it loads instantly and stays crisp.
- Two routes: `src/routes/index.tsx` and `src/routes/demo.tsx`, each with its own SEO meta.
- Simulated metrics live in a small client hook (`useLiveMetrics`) that ticks values within realistic ranges. Easy to swap later with a real API.
- Fully responsive — 3D canvas scales down gracefully on mobile, dashboard cards stack.

### What you'll get after approval
1. Clean dark design system tuned for the soil/earth aesthetic.
2. The 3D Soil Compass scene with orbit controls and floating metric tags.
3. Landing page with hero, features, chatbot teaser, footer.
4. Live demo page with animated dashboard + mock chatbot.
5. Top navigation linking the two pages.

If you'd like, after the first build we can swap the simulated metrics for your real device API and replace the procedural 3D model with an actual GLB export of your hardware.