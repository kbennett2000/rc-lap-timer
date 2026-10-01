"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCloudAccount } from "@/cloud/account";
import { toCloudError } from "@/cloud/errors";
import { createTrack, deleteTrack, renameTrack, type Track } from "@/cloud/tracks";
import { formatLapTime } from "@/domain/format";
import { cleanTrack, MAX_TRACK_NAME_LENGTH, type TrackName } from "@/domain/leaderboard";
import { nameKey } from "@/domain/rules";
import { useLeaderboard, useRefreshPosts, useRemovePost, useTracks } from "./queries";

function Problem({ message, onRetry }: { message: string | null; onRetry?: () => void }) {
  if (!message) return null;
  return (
    <div role="alert" className="space-y-2 rounded border border-red-200 bg-red-50 p-3 text-red-900">
      <p>{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

const trackLabel = (track: Pick<Track, "name" | "area">) => (track.area ? `${track.name} (${track.area})` : track.name);

// A track's name and area, for adding or renaming one.
function TrackForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: TrackName;
  submitLabel: string;
  onSubmit: (track: TrackName) => Promise<unknown>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [area, setArea] = useState(initial.area);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="space-y-2 rounded border p-3"
      onSubmit={async (event) => {
        event.preventDefault();
        const checked = cleanTrack(name, area);
        if (!checked.ok) {
          setProblem(checked.error);
          return;
        }
        setBusy(true);
        setProblem(null);
        try {
          await onSubmit(checked.value);
        } catch (error) {
          setProblem(toCloudError(error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Label htmlFor="track-name">Track name</Label>
      <Input
        id="track-name"
        value={name}
        maxLength={MAX_TRACK_NAME_LENGTH}
        onChange={(event) => setName(event.target.value)}
      />
      <Label htmlFor="track-area">Where it is (optional)</Label>
      <Input
        id="track-area"
        placeholder="Such as Austin, TX"
        value={area}
        maxLength={MAX_TRACK_NAME_LENGTH}
        onChange={(event) => setArea(event.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy || !name.trim()}>
          {busy ? "Saving…" : submitLabel}
        </Button>
        <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
      </div>
      <Problem message={problem} />
    </form>
  );
}

// The Tracks tab, in an app built with a cloud service (docs/cloud.md): the shared tracks, and each one's
// leaderboard.
export default function TracksScreen() {
  const [openId, setOpenId] = useState<string | null>(null);
  const tracks = useTracks();
  const open = tracks.data?.find((track) => track.id === openId);

  return (
    <div className="space-y-4 px-2 sm:px-0">
      {open ? <TrackBoard track={open} onBack={() => setOpenId(null)} /> : <TrackList onOpen={setOpenId} />}
    </div>
  );
}

function TrackList({ onOpen }: { onOpen: (id: string) => void }) {
  const account = useCloudAccount();
  const tracks = useTracks();
  const refresh = useRefreshPosts();
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);

  const shown = (tracks.data ?? []).filter((track) => nameKey(`${track.name} ${track.area}`).includes(nameKey(search)));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          Tracks
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>
          Shared tracks and their leaderboards.{" "}
          {account
            ? "To put a session on one, use Post to leaderboard on the session in Practice or Session Mgmt."
            : "Anyone can look. To add a track or post your laps, sign in under Manager → Data."}
        </p>
        <Label htmlFor="track-search" className="sr-only">
          Search tracks
        </Label>
        <Input
          id="track-search"
          type="search"
          placeholder="Search tracks"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        {tracks.isPending && <p>Loading tracks…</p>}
        <Problem
          message={tracks.error ? toCloudError(tracks.error).message : null}
          onRetry={() => void tracks.refetch()}
        />
        {tracks.data && (
          <ul className="space-y-2">
            {shown.map((track) => (
              <li key={track.id}>
                <button
                  type="button"
                  className="w-full rounded border p-3 text-left hover:bg-accent"
                  onClick={() => onOpen(track.id)}
                >
                  <span className="font-medium">{track.name}</span>
                  {track.area && <span className="text-muted-foreground"> · {track.area}</span>}
                  <span className="block text-muted-foreground">
                    {track.posts === 1 ? "1 session posted" : `${track.posts} sessions posted`}
                  </span>
                </button>
              </li>
            ))}
            {shown.length === 0 && (
              <li className="text-muted-foreground">{search ? "No tracks match." : "No tracks yet."}</li>
            )}
          </ul>
        )}

        {account &&
          (adding ? (
            <TrackForm
              initial={{ name: search.trim(), area: "" }}
              submitLabel="Add track"
              onCancel={() => setAdding(false)}
              onSubmit={async (track) => {
                const added = await createTrack(track);
                setAdding(false);
                setSearch("");
                await refresh();
                onOpen(added.id);
              }}
            />
          ) : (
            <Button variant="outline" onClick={() => setAdding(true)}>
              Add a track
            </Button>
          ))}
      </CardContent>
    </Card>
  );
}

function TrackBoard({ track, onBack }: { track: Track; onBack: () => void }) {
  const board = useLeaderboard(track.id);
  const remove = useRemovePost();
  const refresh = useRefreshPosts();
  const [editing, setEditing] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const removeTrack = useMutation({ mutationFn: () => deleteTrack(track.id) });

  return (
    <Card>
      <CardHeader className="space-y-2">
        <Button variant="ghost" size="sm" className="w-fit px-0" onClick={onBack}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          All tracks
        </Button>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          {track.name}
        </CardTitle>
        {track.area && <p className="text-sm text-muted-foreground">{track.area}</p>}
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          Each driver&apos;s best lap. Laps are posted by the people who drove them, timed by their own phone or timer.
        </p>
        {board.isPending && <p>Loading the leaderboard…</p>}
        <Problem
          message={board.error ? toCloudError(board.error).message : null}
          onRetry={() => void board.refetch()}
        />
        {board.data && board.data.length === 0 && <p>No laps posted yet.</p>}
        {board.data && board.data.length > 0 && (
          <ol aria-label="Leaderboard" className="divide-y rounded border">
            {board.data.map((row, index) => (
              <li key={row.id} className="flex items-start gap-3 p-3">
                <span className="w-6 shrink-0 font-semibold">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {row.driverName} <span className="font-normal text-muted-foreground">· {row.carName}</span>
                  </p>
                  <p className="text-muted-foreground">
                    Lap {row.bestLapNumber} of {row.lapCount}
                    {row.penalties > 0 && ` · ${row.penalties} ${row.penalties === 1 ? "penalty" : "penalties"}`} ·{" "}
                    {new Date(row.sessionDate).toLocaleDateString()}
                  </p>
                  {row.mine && (
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto px-0"
                      disabled={remove.isPending}
                      onClick={async () => {
                        setProblem(null);
                        try {
                          await remove.mutateAsync(row);
                        } catch (error) {
                          setProblem(toCloudError(error).message);
                        }
                      }}
                    >
                      Remove my post
                    </Button>
                  )}
                </div>
                <span className="shrink-0 font-mono font-semibold">{formatLapTime(row.bestLapMs)}</span>
              </li>
            ))}
          </ol>
        )}

        {track.mine &&
          (editing ? (
            <TrackForm
              initial={{ name: track.name, area: track.area }}
              submitLabel="Save"
              onCancel={() => setEditing(false)}
              onSubmit={async (changes) => {
                await renameTrack(track.id, changes);
                setEditing(false);
                await refresh();
              }}
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                Rename track
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={removeTrack.isPending}
                onClick={async () => {
                  if (!confirm(`Delete ${trackLabel(track)} and its leaderboard?`)) return;
                  setProblem(null);
                  try {
                    await removeTrack.mutateAsync();
                    await refresh();
                    onBack();
                  } catch (error) {
                    setProblem(toCloudError(error).message);
                  }
                }}
              >
                Delete track
              </Button>
            </div>
          ))}
        <Problem message={problem} />
      </CardContent>
    </Card>
  );
}
