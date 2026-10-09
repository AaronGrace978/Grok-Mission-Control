import { useMissionStore } from '../store/missionStore';
import { formatMET, formatDistance, getPhaseDescription } from '../utils/missionPhysics';

interface HUDProps {
  onSettingsClick: () => void;
}

export default function HUD({ onSettingsClick }: HUDProps) {
  const { 
    telemetry, 
    isPlaying, 
    playbackSpeed, 
    togglePlayback, 
    setPlaybackSpeed,
    setCameraView,
    cameraView,
    missionTime,
    updateMissionTime
  } = useMissionStore();

  const speeds = [1, 10, 100, 1000, 10000];

  return (
    <div className="hud">
      <div className="hud-header">
        <div className="logo">
          <div className="logo-icon">⚡</div>
          <h1>GROK MISSION CONTROL</h1>
        </div>
        <button className="settings-btn" onClick={onSettingsClick}>
          ⚙️
        </button>
      </div>

      <div className="telemetry-panel">
        <div className="telemetry-group">
          <div className="telemetry-item">
            <span className="label">MISSION PHASE</span>
            <span className="value phase">{getPhaseDescription(telemetry.phase)}</span>
          </div>
          <div className="telemetry-item">
            <span className="label">MET</span>
            <span className="value">{formatMET(telemetry.met)}</span>
          </div>
        </div>

        <div className="telemetry-group">
          <div className="telemetry-item">
            <span className="label">VELOCITY</span>
            <span className="value">{telemetry.velocity.toFixed(2)} km/s</span>
          </div>
          <div className="telemetry-item">
            <span className="label">DISTANCE FROM EARTH</span>
            <span className="value">{formatDistance(telemetry.distanceFromEarth)}</span>
          </div>
        </div>

        <div className="telemetry-group">
          <div className="telemetry-item">
            <span className="label">DISTANCE TO TARGET</span>
            <span className="value">{formatDistance(telemetry.distanceToTarget)}</span>
          </div>
          <div className="telemetry-item">
            <span className="label">FUEL</span>
            <span className="value">{telemetry.fuel.toFixed(1)}%</span>
            <div className="fuel-bar">
              <div className="fuel-fill" style={{ width: `${telemetry.fuel}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div className="timeline-controls">
        <div className="timeline-scrubber">
          <input
            type="range"
            min="0"
            max="20044800"
            step="1000"
            value={missionTime}
            onChange={(e) => updateMissionTime(Number(e.target.value))}
            className="scrubber"
          />
          <div className="timeline-markers">
            <span>Launch</span>
            <span>Moon</span>
            <span>Mars</span>
          </div>
        </div>

        <div className="playback-controls">
          <button onClick={togglePlayback} className="control-btn">
            {isPlaying ? '⏸' : '▶'}
          </button>
          
          <div className="speed-controls">
            {speeds.map((speed) => (
              <button
                key={speed}
                onClick={() => setPlaybackSpeed(speed)}
                className={`speed-btn ${playbackSpeed === speed ? 'active' : ''}`}
              >
                {speed}x
              </button>
            ))}
          </div>

          <div className="camera-controls">
            <button
              onClick={() => setCameraView('chase')}
              className={`view-btn ${cameraView === 'chase' ? 'active' : ''}`}
            >
              Chase
            </button>
            <button
              onClick={() => setCameraView('orbital')}
              className={`view-btn ${cameraView === 'orbital' ? 'active' : ''}`}
            >
              Orbital
            </button>
            <button
              onClick={() => setCameraView('cockpit')}
              className={`view-btn ${cameraView === 'cockpit' ? 'active' : ''}`}
            >
              Cockpit
            </button>
          </div>
        </div>
      </div>

      <div className="disclaimer">
        Simulated telemetry for demonstration purposes
      </div>
    </div>
  );
}
