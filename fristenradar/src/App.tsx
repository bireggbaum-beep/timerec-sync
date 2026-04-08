import { useState, useEffect, useCallback, useMemo } from 'react';
import { useGoogleLogin, googleLogout } from '@react-oauth/google';
import type { FristItem, FristType, FristStatus } from './types';
import { useCalendar } from './hooks/useCalendar';
import { useStatusStore } from './hooks/useStatusStore';
import { urgencyLevel, urgencyScore, URGENCY_COLOR } from './lib/urgency';
import { LeftPanel } from './components/LeftPanel';
import { BriefingPanel } from './components/BriefingPanel';
import { Section } from './components/Section';
import { FristCard } from './components/FristCard';

const AUTO_REFRESH_INTERVAL_MS = 30 * 60 * 1000; // 30 Minuten

type FilterType = FristType | 'alle';

export function App() {
  // Stable "today" — updated at Mitternacht für Dauerbetrieb auf dem Tablet
  const [today, setToday] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  useEffect(() => {
    const now = new Date();
    const msUntilMidnight =
      new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime();
    const timer = setTimeout(() => setToday(new Date()), msUntilMidnight);
    return () => clearTimeout(timer);
  }, [today]);

  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('alle');
  const { items: rawItems, loading, error, loadMock, loadFromGoogle } = useCalendar();
  const { saveStatus, getStatus } = useStatusStore();

  // Merge persisted statuses into items
  const items: FristItem[] = useMemo(
    () => rawItems.map(item => ({ ...item, status: getStatus(item.id, item.status) })),
    [rawItems, getStatus]
  );

  const handleRefresh = useCallback(() => {
    if (accessToken) {
      loadFromGoogle(accessToken);
    } else {
      loadMock();
    }
  }, [accessToken, loadFromGoogle, loadMock]);

  // Initial load
  useEffect(() => { loadMock(); }, [loadMock]);

  // Auto-refresh alle 30 Minuten
  useEffect(() => {
    const interval = setInterval(handleRefresh, AUTO_REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [handleRefresh]);

  function handleStatusChange(id: string, status: FristStatus) {
    saveStatus(id, status);
  }

  const login = useGoogleLogin({
    scope: 'https://www.googleapis.com/auth/calendar.readonly',
    onSuccess: async tokenResponse => {
      setAccessToken(tokenResponse.access_token);
      await loadFromGoogle(tokenResponse.access_token);
    },
  });

  function handleLogout() {
    googleLogout();
    setAccessToken(null);
    loadMock();
  }

  // Filter by type
  const filtered = activeFilter === 'alle'
    ? items
    : items.filter(i => i.type === activeFilter);

  // Group by urgency bucket
  const urgent = filtered.filter(i => {
    const l = urgencyLevel(i, today);
    return l === 'ÜBERFÄLLIG' || l === 'KRITISCH' || l === 'HEUTE ANFANGEN';
  }).sort((a, b) => urgencyScore(b, today) - urgencyScore(a, today));

  const soon = filtered
    .filter(i => urgencyLevel(i, today) === 'BALD')
    .sort((a, b) => urgencyScore(b, today) - urgencyScore(a, today));

  const radar = filtered
    .filter(i => urgencyLevel(i, today) === 'RADAR')
    .sort((a, b) => urgencyScore(b, today) - urgencyScore(a, today));

  return (
    <div className="app-layout">
      <LeftPanel
        items={items}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        onLogin={() => login()}
        onLogout={handleLogout}
        isLoggedIn={!!accessToken}
        today={today}
      />

      <main className="main-content">
        {loading && <div className="loading-state">Lade Kalender…</div>}
        {error && <div className="error-state">Fehler: {error}</div>}

        <BriefingPanel items={items} onRefresh={handleRefresh} today={today} />

        {urgent.length > 0 && (
          <Section
            title="Heute / Dringend"
            color={URGENCY_COLOR['KRITISCH']}
            count={urgent.length}
          >
            {urgent.map(item => (
              <FristCard
                key={item.id}
                item={item}
                onStatusChange={handleStatusChange}
                today={today}
              />
            ))}
          </Section>
        )}

        {soon.length > 0 && (
          <Section
            title="Diese Woche"
            color={URGENCY_COLOR['BALD']}
            count={soon.length}
          >
            {soon.map(item => (
              <FristCard
                key={item.id}
                item={item}
                onStatusChange={handleStatusChange}
                today={today}
              />
            ))}
          </Section>
        )}

        {radar.length > 0 && (
          <Section
            title="Frühwarnung / Radar"
            color={URGENCY_COLOR['RADAR']}
            count={radar.length}
          >
            {radar.map(item => (
              <FristCard
                key={item.id}
                item={item}
                onStatusChange={handleStatusChange}
                today={today}
              />
            ))}
          </Section>
        )}

        {filtered.length === 0 && !loading && (
          <div className="loading-state">Keine Fristen im aktuellen Filter.</div>
        )}
      </main>
    </div>
  );
}
