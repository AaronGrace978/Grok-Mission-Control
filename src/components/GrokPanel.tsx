import { useState, useRef, useEffect } from 'react';
import { useMissionStore } from '../store/missionStore';
import { getPhaseDescription, formatMET } from '../utils/missionPhysics';

interface Message {
  role: 'user' | 'assistant';
  content: string;
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

export default function GrokPanel() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hello, I'm Grok, your AI co-pilot. I'm here to assist with mission operations and answer questions about our journey. How can I help?"
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { telemetry } = useMissionStore();

  useEffect(() => {
    const loadApiKey = async () => {
      if (window.__TAURI__) {
        try {
          const { Store } = await import('@tauri-apps/plugin-store');
          const store = new Store('settings.json');
          const key = await store.get<string>('grokApiKey');
          setApiKey(key || null);
        } catch (e) {
          console.error('Failed to load API key from Tauri store:', e);
        }
      } else {
        const key = localStorage.getItem('grokApiKey');
        setApiKey(key);
      }
    };
    loadApiKey();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    
    if (!apiKey) {
      alert('Please set your Grok API key in Settings first.');
      return;
    }

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const systemPrompt = `You are Grok, an AI co-pilot aboard a spacecraft. Current mission status:
- Phase: ${getPhaseDescription(telemetry.phase)}
- Mission Elapsed Time: ${formatMET(telemetry.met)}
- Velocity: ${telemetry.velocity.toFixed(2)} km/s
- Distance from Earth: ${telemetry.distanceFromEarth.toFixed(0)} km
- Fuel: ${telemetry.fuel.toFixed(1)}%

Respond as a helpful, knowledgeable co-pilot with personality. Keep responses concise but informative.`;

    try {
      let response: string;
      
      if (window.__TAURI__) {
        response = await window.__TAURI__.core.invoke('chat_with_grok', {
          apiKey,
          model: 'grok-beta',
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages.map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: input }
          ]
        });
      } else {
        const apiResponse = await fetch('/api/xai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: 'grok-beta',
            messages: [
              { role: 'system', content: systemPrompt },
              ...messages.map(m => ({ role: m.role, content: m.content })),
              { role: 'user', content: input }
            ],
            stream: false
          })
        });

        if (!apiResponse.ok) {
          throw new Error(`API error: ${apiResponse.status}`);
        }

        const data = await apiResponse.json();
        response = data.choices[0]?.message?.content || 'No response from Grok';
      }

      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (error) {
      console.error('Error calling Grok API:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Error communicating with Grok. Please check your API key and connection.' 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="grok-panel">
      <div className="panel-header">
        <div className="grok-indicator">
          <span className="grok-icon">⚡</span>
          <span>GROK CO-PILOT</span>
        </div>
        <div className={`status-indicator ${apiKey ? 'online' : 'offline'}`}>
          {apiKey ? 'ONLINE' : 'OFFLINE'}
        </div>
      </div>

      <div className="messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.role}`}>
            <div className="message-header">
              {msg.role === 'user' ? '👤 ASTRONAUT' : '⚡ GROK'}
            </div>
            <div className="message-content">{msg.content}</div>
          </div>
        ))}
        {isLoading && (
          <div className="message assistant">
            <div className="message-header">⚡ GROK</div>
            <div className="message-content typing">Thinking...</div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-area">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          placeholder={apiKey ? "Ask Grok anything..." : "Set API key in Settings"}
          disabled={isLoading || !apiKey}
          className="chat-input"
        />
        <button 
          onClick={sendMessage} 
          disabled={isLoading || !input.trim() || !apiKey}
          className="send-btn"
        >
          ➤
        </button>
      </div>
    </div>
  );
}
