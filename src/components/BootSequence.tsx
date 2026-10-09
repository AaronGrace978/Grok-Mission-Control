import { useEffect, useState } from 'react';

interface BootSequenceProps {
  onComplete: () => void;
}

export default function BootSequence({ onComplete }: BootSequenceProps) {
  const [stage, setStage] = useState(0);
  
  const bootMessages = [
    'INITIALIZING GROK MISSION CONTROL...',
    'LOADING FLIGHT SYSTEMS...',
    'ESTABLISHING TELEMETRY LINK...',
    'GROK CO-PILOT ONLINE',
    'ALL SYSTEMS NOMINAL',
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setStage(prev => {
        if (prev >= bootMessages.length - 1) {
          clearInterval(interval);
          setTimeout(onComplete, 800);
          return prev;
        }
        return prev + 1;
      });
    }, 600);

    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <div className="boot-sequence">
      <div className="boot-content">
        <div className="boot-logo">
          <div className="logo-icon large">⚡</div>
          <h1>GROK MISSION CONTROL</h1>
        </div>
        
        <div className="boot-messages">
          {bootMessages.slice(0, stage + 1).map((msg, idx) => (
            <div 
              key={idx} 
              className={`boot-message ${idx === stage ? 'current' : ''}`}
            >
              <span className="boot-bullet">▸</span> {msg}
            </div>
          ))}
        </div>

        <div className="boot-progress">
          <div 
            className="boot-progress-bar" 
            style={{ width: `${((stage + 1) / bootMessages.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
