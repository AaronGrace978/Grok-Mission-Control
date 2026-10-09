# Grok Mission Control

A visually stunning desktop application for simulating a crewed rocket mission from Earth to the Moon and then on to Mars, featuring real-time 3D graphics and an AI co-pilot powered by Grok.

Built for the Grokbot Hackathon in Boston.

## Features

- **Real-time 3D Mission Simulation**: Watch a Starship-style rocket travel from Earth through lunar orbit to Mars
- **High-end Graphics**: Three.js-powered 3D rendering with bloom effects, particle systems, and procedurally generated planet textures
- **Mission Phases**: 
  - Pre-launch
  - Launch & Ascent
  - Low Earth Orbit
  - Trans-Lunar Injection
  - Lunar Approach & Orbit
  - Trans-Mars Injection
  - Mars Cruise Phase
  - Mars Approach & Orbit
- **Interactive HUD**: Real-time telemetry display including velocity, distance, fuel levels, and mission elapsed time
- **Timeline Controls**: Play/pause, speed controls (1x to 10000x), and scrubber to jump to any mission phase
- **Camera Views**: Chase, Orbital, and Cockpit perspectives
- **Grok AI Co-pilot**: Chat with an AI assistant that's aware of your current mission status and can answer questions about the mission
- **Grok-themed Design**: Near-black backgrounds, crisp white and cool-grey type, glowing accents, glassy panels

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **3D Graphics**: Three.js with react-three-fiber, react-three/drei, and postprocessing
- **Desktop**: Tauri v2 (Rust backend)
- **State Management**: Zustand
- **AI Integration**: xAI Grok API (OpenAI-compatible)

## Prerequisites

### For Browser Mode (Easiest)
- Node.js 18+ and npm

### For Desktop Build (Tauri)
- Node.js 18+ and npm
- Rust toolchain
- Platform-specific dependencies:
  - **Linux**: `webkit2gtk`, `rsvg2` - see [Tauri Linux prerequisites](https://tauri.app/guides/prerequisites/#linux)
  - **macOS**: Xcode Command Line Tools
  - **Windows**: WebView2, Visual Studio Build Tools

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up your Grok API Key:**
   - Get an API key from [console.x.ai](https://console.x.ai)
   - Launch the app and click the Settings (⚙️) button
   - Enter your API key and save
   - The key is stored locally (Tauri store in desktop mode, localStorage in browser mode)

## Running the App

### Browser Mode (Recommended for demo)
```bash
npm run dev
```
Open your browser to `http://localhost:1420`

### Desktop Mode (Tauri)
```bash
npm run tauri dev
```

### Build Desktop App
```bash
npm run tauri build
```
The built application will be in `src-tauri/target/release/`

## Usage

1. **Launch the application** - enjoy the boot sequence
2. **Watch the mission unfold** - the simulation starts automatically
3. **Interact with controls:**
   - Use the timeline scrubber to jump to different mission phases
   - Play/pause the simulation
   - Adjust playback speed (1x to 10000x)
   - Switch camera views (Chase, Orbital, Cockpit)
4. **Chat with Grok** - ask questions about the mission in the right panel
5. **Monitor telemetry** - view real-time mission data in the HUD

## Mission Timeline

- **T+0:10**: Launch
- **T+10:00**: Low Earth Orbit
- **T+15:00**: Trans-Lunar Injection
- **T+64:00:00**: Lunar Approach
- **T+72:00:00**: Lunar Orbit
- **T+96:00:00**: Trans-Mars Injection
- **T+180d**: Mars Cruise
- **T+231d**: Mars Approach
- **T+232d**: Mars Orbit

(Timeline compressed for demonstration; actual missions would take much longer)

## Planet Textures

This application uses procedurally generated textures for all celestial bodies:
- **Sun**: Glowing yellow-orange sphere with atmospheric halo
- **Earth**: Blue and green gradients with white cloud patches
- **Moon**: Grey surface with darker craters
- **Mars**: Red-orange surface with brown geological features

All textures are generated at runtime using Canvas 2D API, ensuring no external texture dependencies.

## Architecture

### Frontend Structure
```
src/
├── components/
│   ├── celestial/      # Sun, Earth, Moon, Mars components
│   ├── MissionScene.tsx # Main 3D scene orchestrator
│   ├── Rocket.tsx       # Rocket model with exhaust particles
│   ├── HUD.tsx          # Heads-up display with telemetry
│   ├── GrokPanel.tsx    # AI chat interface
│   ├── BootSequence.tsx # Startup animation
│   └── Settings.tsx     # API key configuration
├── store/
│   └── missionStore.ts  # Zustand state management
├── utils/
│   └── missionPhysics.ts # Mission simulation calculations
├── types/
│   └── mission.ts       # TypeScript type definitions
├── App.tsx              # Root component
└── main.tsx            # React entry point
```

### Tauri Backend
```
src-tauri/
├── src/
│   └── lib.rs          # Rust API handlers (Grok chat)
├── Cargo.toml          # Rust dependencies
└── tauri.conf.json     # Tauri configuration
```

## API Integration

The app calls the xAI Grok API with current mission telemetry in the system prompt:
- **Tauri mode**: API calls made from Rust backend (no CORS issues)
- **Browser mode**: API calls proxied through Vite dev server

Default model: `grok-beta`

## Performance

- Target: 60 FPS on RTX 4060-class GPU
- Degrades gracefully on lower-end hardware
- Quality settings available in future updates

## Development Notes

- All celestial body positions are calculated based on mission elapsed time
- Physics are simplified for demonstration purposes (not orbital mechanics accuracy)
- Particle effects used for rocket exhaust during powered flight phases
- Bloom post-processing adds realistic glow to Sun, Earth atmosphere, and engine exhaust

## License

Built for the Grokbot Hackathon. All code is original except for:
- Three.js and React libraries (MIT)
- Planet textures generated procedurally (no external assets)

## Credits

Created for the Grokbot Hackathon in Boston, October 9, 2026
