import { useState } from 'react';
import type { FristItem } from '../types';
import { generateBriefing, enhanceBriefingWithAI, speakBriefing } from '../lib/briefing';

interface Props {
  items: FristItem[];
  onRefresh: () => void;
  today?: Date;
}

export function BriefingPanel({ items, onRefresh, today = new Date() }: Props) {
  const [text, setText] = useState(() => generateBriefing(items, today));
  const [speaking, setSpeaking] = useState(false);
  const [enhancing, setEnhancing] = useState(false);

  function handleSpeak() {
    setSpeaking(true);
    speakBriefing(text);
    // Reset speaking flag when synthesis ends
    const interval = setInterval(() => {
      if (!window.speechSynthesis.speaking) {
        setSpeaking(false);
        clearInterval(interval);
      }
    }, 500);
  }

  async function handleEnhance() {
    setEnhancing(true);
    try {
      const enhanced = await enhanceBriefingWithAI(text);
      setText(enhanced);
    } finally {
      setEnhancing(false);
    }
  }

  function handleRefresh() {
    setText(generateBriefing(items, today));
    onRefresh();
  }

  const hasOpenRouterKey = !!import.meta.env.VITE_OPENROUTER_KEY;

  return (
    <div className="briefing-panel">
      <div className="briefing-header">
        <span className="briefing-title">Morgenbriefing</span>
        <div className="briefing-actions">
          {hasOpenRouterKey && (
            <button
              className="btn-secondary"
              onClick={handleEnhance}
              disabled={enhancing}
              title="KI-Briefing generieren"
            >
              {enhancing ? '⏳' : '✨'} KI
            </button>
          )}
          <button
            className="btn-secondary"
            onClick={handleSpeak}
            disabled={speaking}
            title="Vorlesen"
          >
            {speaking ? '🔊' : '▶'} Vorlesen
          </button>
          <button
            className="btn-secondary"
            onClick={handleRefresh}
            title="Aktualisieren"
          >
            🔄 Aktualisieren
          </button>
        </div>
      </div>
      <div className="briefing-text">
        {text.split('\n').map((line, i) => (
          <p key={i}>{line || '\u00A0'}</p>
        ))}
      </div>
    </div>
  );
}
