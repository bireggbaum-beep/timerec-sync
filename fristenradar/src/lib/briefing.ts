import type { FristItem } from '../types';
import { urgencyLevel, diffDays } from './urgency';

export function generateBriefing(items: FristItem[], today: Date = new Date()): string {
  const critical = items.filter(i => {
    const level = urgencyLevel(i, today);
    return level === 'ÜBERFÄLLIG' || level === 'KRITISCH' || level === 'HEUTE ANFANGEN';
  });
  const coming = items.filter(i => urgencyLevel(i, today) === 'BALD');

  const wochentag = today.toLocaleDateString('de-CH', { weekday: 'long' });
  const datum = today.toLocaleDateString('de-CH', { day: 'numeric', month: 'long' });

  let text = `Guten Morgen. Heute ist ${wochentag}, der ${datum}.\n\n`;

  if (critical.length === 0) {
    text += 'Heute gibt es keine akut dringenden Fristen.';
  } else {
    text += `${
      critical.length === 1
        ? 'Ein Punkt braucht'
        : `${critical.length} Punkte brauchen`
    } heute deine Aufmerksamkeit.\n`;

    for (const item of critical) {
      const d = diffDays(item.dueDate, today);
      const level = urgencyLevel(item, today);
      if (level === 'ÜBERFÄLLIG') {
        text += `— ${item.title}: Bereits abgelaufen. Sofort klären.\n`;
      } else {
        text += `— ${item.title}: Frist in ${d} ${d === 1 ? 'Tag' : 'Tagen'}. ${
          level === 'KRITISCH' ? 'Sofort handeln.' : 'Heute anfangen.'
        }\n`;
      }
    }
  }

  if (coming.length > 0) {
    text += `\nAuf dem Radar: ${coming.length} ${
      coming.length === 1 ? 'Frist nähert sich' : 'Fristen nähern sich'
    }.\n`;
    for (const item of coming.slice(0, 2)) {
      const d = diffDays(item.dueDate, today);
      const startIsPast = diffDays(today, item.startBy) >= 0;
      text += `— ${item.title}: fällig in ${d} Tagen. ${
        startIsPast
          ? 'Spätestens jetzt anfangen.'
          : `Anfangen ab ${item.startBy.toLocaleDateString('de-CH', { day: 'numeric', month: 'short' })}.`
      }\n`;
    }
  }

  return text;
}

export async function enhanceBriefingWithAI(rawBriefing: string): Promise<string> {
  const key = import.meta.env.VITE_OPENROUTER_KEY;
  if (!key) return rawBriefing;

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-flash-1.5',
      messages: [
        {
          role: 'user',
          content:
            `Formuliere dieses Morgenbriefing auf Deutsch natürlich und klar um. ` +
            `Maximal 5 Sätze. Kein Smalltalk. Fokus auf Handlungsbedarf. Originaldaten:\n\n${rawBriefing}`,
        },
      ],
    }),
  });

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? rawBriefing;
}

export function speakBriefing(text: string): void {
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'de-DE';
  utterance.rate = 0.95;
  utterance.pitch = 1.0;
  window.speechSynthesis.speak(utterance);
}
