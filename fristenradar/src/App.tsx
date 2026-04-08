import { useState, useEffect } from 'react';
import { useGoogleLogin, googleLogout } from '@react-oauth/google';
import type { FristItem, FristType, FristStatus } from './types';
import { useCalendar } from './hooks/useCalendar';
import { useStatusStore } from './hooks/useStatusStore';
import { urgencyLevel, urgencyScore, URGENCY_COLOR } from './lib/urgency';
import { LeftPanel } from './components/LeftPanel';
import { BriefingPanel } from './components/BriefingPanel';
import { Section } from './components/Section';
import { FristCard } from './components/FristCard';

type FilterType = FristType | 'alle';

export function App() {
  const today = new Date();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('alle');
  const { items: rawItems, loading, error, loadMock, loadFromGoogle } = useCalendar();
  const { saveStatus, getStatus } = useStatusStore();

  // On mount, load mock data so something is always visible
  useEffect(() => {
    loadMock();
  }, [loadMock]);

  // Merge persisted statuses into items
  const items: FristItem[] = rawItems.map(item => ({
    ...item,
    status: getStatus(item.id, item.status),
  }));

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

  function handleRefresh() {
    if (accessToken) {
      loadFromGoogle(accessToken);
    } else {
      loadMock();
    }
  }

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
