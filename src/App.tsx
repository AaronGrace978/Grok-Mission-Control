import { useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import MissionScene from './components/MissionScene';
import HUD from './components/HUD';
import GrokPanel from './components/GrokPanel';
import BootSequence from './components/BootSequence';
import Settings from './components/Settings';
import { useMissionStore } from './store/missionStore';

function App() {
  const [showBoot, setShowBoot] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const missionPhase = useMissionStore((state) => state.currentPhase);

  useEffect(() => {
    const timer = setTimeout(() => setShowBoot(false), 4000);
    return () => clearTimeout(timer);
  }, []);

  if (showBoot) {
    return <BootSequence onComplete={() => setShowBoot(false)} />;
  }

  return (
    <div className="app">
      <Canvas
        camera={{ position: [0, 50, 100], fov: 60 }}
        gl={{ antialias: true, alpha: false }}
        dpr={[1, 2]}
      >
        <MissionScene />
      </Canvas>
      
      <HUD onSettingsClick={() => setShowSettings(true)} />
      <GrokPanel />
      
      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
    </div>
  );
}

export default App;
