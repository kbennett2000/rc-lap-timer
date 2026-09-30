import type { Session } from "./types";

export function sortNewestFirst<T extends Pick<Session, "date">>(sessions: T[]): T[] {
  return [...sessions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function recentSessions<T extends Pick<Session, "date">>(sessions: T[], count: number): T[] {
  return sortNewestFirst(sessions).slice(0, count);
}
