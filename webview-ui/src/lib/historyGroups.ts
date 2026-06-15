import type { HistoryIndexEntry } from '../types';

export interface HistoryDayGroup {
  dayKey: string;
  label: string;
  entries: HistoryIndexEntry[];
}

export interface HistorySignatureGroup {
  signature: string;
  method: string;
  path: string;
  entries: HistoryIndexEntry[];
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dayKey(date: Date): string {
  const d = startOfDay(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return startOfDay(new Date(y, m - 1, d));
}

function formatDayLabel(day: Date, today: Date): string {
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const dayStart = startOfDay(day);
  if (dayStart.getTime() === startOfDay(today).getTime()) {
    return 'Today';
  }
  if (dayStart.getTime() === startOfDay(yesterday).getTime()) {
    return 'Yesterday';
  }
  return day.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function groupHistoryByDay(entries: HistoryIndexEntry[]): HistoryDayGroup[] {
  const today = new Date();
  const map = new Map<string, HistoryIndexEntry[]>();

  for (const entry of entries) {
    const key = dayKey(new Date(entry.timestamp));
    const list = map.get(key) ?? [];
    list.push(entry);
    map.set(key, list);
  }

  return [...map.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, dayEntries]) => ({
      dayKey: key,
      label: formatDayLabel(parseDayKey(key), today),
      entries: dayEntries.sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    }));
}

export function groupHistoryBySignature(entries: HistoryIndexEntry[]): HistorySignatureGroup[] {
  const map = new Map<string, HistoryIndexEntry[]>();
  for (const entry of entries) {
    const list = map.get(entry.signature) ?? [];
    list.push(entry);
    map.set(entry.signature, list);
  }
  return [...map.entries()]
    .map(([signature, sigEntries]) => ({
      signature,
      method: sigEntries[0]?.method ?? '',
      path: sigEntries[0]?.path ?? '',
      entries: sigEntries.sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    }))
    .sort((a, b) => {
      const latestA = a.entries[0]?.timestamp ?? '';
      const latestB = b.entries[0]?.timestamp ?? '';
      return latestB.localeCompare(latestA);
    });
}

export function formatHistoryTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function defaultExpandedHistoryDays(groups: HistoryDayGroup[]): string[] {
  const todayKey = dayKey(new Date());
  return groups.some((g) => g.dayKey === todayKey) ? [todayKey] : groups[0] ? [groups[0].dayKey] : [];
}
