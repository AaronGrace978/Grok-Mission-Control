import { useState, useEffect } from 'react';

interface SettingsProps {
  onClose: () => void;
}

declare global {
  interface Window {
    __TAURI__?: {
      core: {
        invoke: (command: string, args: any) => Promise<any>;
      };
    };
  }
}

export default function Settings({ onClose }: SettingsProps) {
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const loadApiKey = async () => {
      if (window.__TAURI__) {
        try {
          const { load } = await import('@tauri-apps/plugin-store');
          const store = await load('settings.json');
          const key = await store.get<string>('grokApiKey');
          if (key) setApiKey(key);
        } catch (e) {
          console.error('Failed to load API key:', e);
        }
      } else {
        const key = localStorage.getItem('grokApiKey');
        if (key) setApiKey(key);
      }
    };
    loadApiKey();
  }, []);

  const handleSave = async () => {
    if (window.__TAURI__) {
      try {
        const { load } = await import('@tauri-apps/plugin-store');
        const store = await load('settings.json');
        await store.set('grokApiKey', apiKey);
        await store.save();
      } catch (e) {
        console.error('Failed to save API key:', e);
      }
    } else {
      localStorage.setItem('grokApiKey', apiKey);
    }
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 1500);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>⚙️ SETTINGS</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="settings-body">
          <div className="setting-group">
            <label htmlFor="apiKey">Grok API Key</label>
            <input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your xAI Grok API key"
              className="api-key-input"
            />
            <p className="setting-help">
              Get your API key from <a href="https://console.x.ai" target="_blank" rel="noopener noreferrer">console.x.ai</a>
            </p>
          </div>

          <div className="setting-group">
            <h3>About</h3>
            <p>Grok Mission Control - A space mission simulator with AI co-pilot</p>
            <p className="version">Version 0.1.0</p>
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="cancel-btn">Cancel</button>
          <button onClick={handleSave} className="save-btn" disabled={!apiKey.trim()}>
            {saved ? '✓ Saved!' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
