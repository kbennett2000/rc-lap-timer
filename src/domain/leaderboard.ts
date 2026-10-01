// Shared tracks and their leaderboards (docs/cloud.md): what a session puts on a leaderboard, and the rules for a
// track's name. Pure; the database checks the same limits (supabase/migrations/*_tracks.sql).

import type { Checked } from "./rules";
import type { SessionRecord } from "./types";

export const MAX_TRACK_NAME_LENGTH = 80;
// A lap must be shorter than an hour.
export const MAX_LAP_MS = 3_600_000;

// What goes public when a session is posted.
export interface LeaderboardEntry {
  sessionId: string;
  driverName: string;
  carName: string;
  bestLapMs: number;
  bestLapNumber: number;
  // On the best lap.
  penalties: number;
  lapCount: number;
  sessionDate: string;
}

// A session's best lap, as a leaderboard entry: the first of its fastest laps. None for a session without laps.
export function entryForSession(session: SessionRecord): LeaderboardEntry | null {
  const laps = [...session.laps]
    .filter((lap) => lap.lapTime > 0 && lap.lapTime < MAX_LAP_MS)
    .sort((a, b) => a.lapNumber - b.lapNumber);
  if (laps.length === 0) return null;
  const best = laps.reduce((fastest, lap) => (lap.lapTime < fastest.lapTime ? lap : fastest));
  return {
    sessionId: session.id,
    driverName: session.driverName,
    carName: session.carName,
    bestLapMs: Math.round(best.lapTime),
    bestLapNumber: best.lapNumber,
    penalties: session.penalties.find((penalty) => penalty.lapNumber === best.lapNumber)?.count ?? 0,
    lapCount: Math.max(session.laps.length, best.lapNumber),
    sessionDate: session.date,
  };
}

export interface TrackName {
  name: string;
  area: string;
}

// A track's name is 1 to 80 characters; its area (where it is, to tell tracks with the same name apart) is optional,
// up to 80. Both are trimmed.
export function cleanTrack(name: string, area: string): Checked<TrackName> {
  const trimmed = { name: name.trim(), area: area.trim() };
  if (!trimmed.name) return { ok: false, error: "Track name is required" };
  if (trimmed.name.length > MAX_TRACK_NAME_LENGTH || trimmed.area.length > MAX_TRACK_NAME_LENGTH) {
    return { ok: false, error: `Track names and areas must be ${MAX_TRACK_NAME_LENGTH} characters or fewer` };
  }
  return { ok: true, value: trimmed };
}

// A place on a leaderboard: 1st, 2nd, 3rd, 4th … 11th, 12th, 13th … 21st.
export function ordinal(place: number): string {
  const teen = place % 100 >= 11 && place % 100 <= 13;
  const suffix = teen ? "th" : (["th", "st", "nd", "rd"][place % 10] ?? "th");
  return `${place}${suffix}`;
}
