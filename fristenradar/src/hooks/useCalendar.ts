import { useState, useCallback } from 'react';
import type { FristItem } from '../types';
import {
  fetchEvents,
  fetchCalendarIdByName,
  fetchEventsFromCalendar,
  getMockEvents,
} from '../lib/calendarApi';
import { mapEventsToFristItems } from '../lib/fristMapper';
import { urgencyScore } from '../lib/urgency';

interface CalendarState {
  items: FristItem[];
  loading: boolean;
  error: string | null;
  lastSync: Date | null;
}

export function useCalendar() {
  const [state, setState] = useState<CalendarState>({
    items: [],
    loading: false,
    error: null,
    lastSync: null,
  });

  const loadMock = useCallback(() => {
    const items = mapEventsToFristItems(getMockEvents());
    items.sort((a, b) => urgencyScore(b) - urgencyScore(a));
    setState({ items, loading: false, error: null, lastSync: new Date() });
  }, []);

  const loadFromGoogle = useCallback(async (accessToken: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const primary = await fetchEvents(accessToken);

      // Also try to fetch from "Fristen & Deadlines" calendar
      const fristenId = await fetchCalendarIdByName(accessToken, 'Fristen & Deadlines');
      const fristenEvents = fristenId
        ? await fetchEventsFromCalendar(accessToken, fristenId)
        : [];

      // Deduplicate by id
      const seen = new Set<string>();
      const allEvents = [...primary, ...fristenEvents].filter(e => {
        if (seen.has(e.id)) return false;
        seen.add(e.id);
        return true;
      });

      // Tag events from fristen calendar so fristMapper recognizes them
      fristenEvents.forEach(e => { e.calendarId = 'Fristen & Deadlines'; });

      const items = mapEventsToFristItems(allEvents);
      items.sort((a, b) => urgencyScore(b) - urgencyScore(a));
      setState({ items, loading: false, error: null, lastSync: new Date() });
    } catch (err) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Unbekannter Fehler',
      }));
    }
  }, []);

  return { ...state, loadMock, loadFromGoogle };
}
