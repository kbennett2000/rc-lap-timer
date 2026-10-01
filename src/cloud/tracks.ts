// Shared tracks and their leaderboards in the cloud (docs/cloud.md; the tables and their rules are in
// supabase/migrations/*_tracks.sql). Anyone can read them; adding a track or posting a lap needs an account.

import type { LeaderboardEntry, TrackName } from "@/domain/leaderboard";
import { cloudClient } from "./client";
import { CloudError, toCloudError } from "./errors";

export interface Track {
  id: string;
  name: string;
  area: string;
  // Added by the signed-in account.
  mine: boolean;
  // How many sessions are posted on it.
  posts: number;
}

export interface LeaderboardRow {
  id: string;
  driverName: string;
  carName: string;
  bestLapMs: number;
  bestLapNumber: number;
  penalties: number;
  lapCount: number;
  sessionDate: string;
  // Posted by the signed-in account.
  mine: boolean;
}

// One of the signed-in account's posts.
export interface Post {
  id: string;
  sessionId: string;
  trackId: string;
  trackName: string;
}

// Enough for any club: the app lists them all and searches on the phone.
const MAX_TRACKS = 1000;
const MAX_ROWS = 100;

interface Result<T> {
  data: T | null;
  error: unknown;
  status: number;
}

function check<T>({ data, error, status }: Result<T>): T {
  if (error) throw toCloudError(error, status);
  return data as T;
}

export async function listTracks(): Promise<Track[]> {
  const client = await cloudClient();
  const rows = check(
    await client.from("track_list").select("id, name, area, mine, posts").order("name").limit(MAX_TRACKS),
  ) as (Omit<Track, "posts"> & { posts: number | string })[];
  return rows.map((row) => ({ ...row, posts: Number(row.posts) }));
}

export async function createTrack({ name, area }: TrackName): Promise<Track> {
  const client = await cloudClient();
  const result = await client.from("tracks").insert({ name, area }).select("id, name, area").single();
  if (result.error?.code === "23505") throw new CloudError("track-taken");
  const track = check(result) as Pick<Track, "id" | "name" | "area">;
  return { ...track, mine: true, posts: 0 };
}

export async function renameTrack(id: string, { name, area }: TrackName): Promise<void> {
  const client = await cloudClient();
  const result = await client.from("tracks").update({ name, area }).eq("id", id).select("id");
  if (result.error?.code === "23505") throw new CloudError("track-taken");
  if (check(result).length === 0) throw new CloudError("not-yours");
}

// Only whoever added a track can delete it, and only while nobody else has laps on it.
export async function deleteTrack(id: string): Promise<void> {
  const client = await cloudClient();
  if (check(await client.from("tracks").delete().eq("id", id).select("id")).length === 0) {
    throw new CloudError("track-in-use");
  }
}

export async function leaderboard(trackId: string): Promise<LeaderboardRow[]> {
  const client = await cloudClient();
  const rows = check(
    await client
      .from("leaderboard")
      .select(
        "id, driverName:driver_name, carName:car_name, bestLapMs:best_lap_ms, bestLapNumber:best_lap_number, penalties, lapCount:lap_count, sessionDate:session_date, mine",
      )
      .eq("track_id", trackId)
      .order("best_lap_ms")
      .order("session_date")
      .limit(MAX_ROWS),
  );
  return rows as LeaderboardRow[];
}

export async function myPosts(accountId: string): Promise<Post[]> {
  const client = await cloudClient();
  const rows = check(
    await client
      .from("lap_records")
      .select("id, sessionId:session_id, trackId:track_id, track:tracks(name)")
      .eq("user_id", accountId),
  ) as unknown as (Omit<Post, "trackName"> & { track: { name: string } | null })[];
  return rows.map(({ track, ...post }) => ({ ...post, trackName: track?.name ?? "" }));
}

// Posts a session's best lap on a track, or moves its post there.
export async function postSession(accountId: string, trackId: string, entry: LeaderboardEntry): Promise<void> {
  const client = await cloudClient();
  check(
    await client.from("lap_records").upsert(
      {
        user_id: accountId,
        track_id: trackId,
        session_id: entry.sessionId,
        driver_name: entry.driverName,
        car_name: entry.carName,
        best_lap_ms: entry.bestLapMs,
        best_lap_number: entry.bestLapNumber,
        penalties: entry.penalties,
        lap_count: entry.lapCount,
        session_date: entry.sessionDate,
      },
      { onConflict: "user_id,session_id" },
    ),
  );
}

export async function removePost(id: string): Promise<void> {
  const client = await cloudClient();
  check(await client.from("lap_records").delete().eq("id", id));
}
