"use client";

import { useMemo, useState } from "react";
import { Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCloudAccount, type CloudAccount } from "@/cloud/account";
import { toCloudError } from "@/cloud/errors";
import { createTrack, type Track } from "@/cloud/tracks";
import { formatLapTime } from "@/domain/format";
import { cleanTrack, entryForSession, MAX_TRACK_NAME_LENGTH, type LeaderboardEntry } from "@/domain/leaderboard";
import { sameName } from "@/domain/rules";
import type { SessionRecord } from "@/domain/types";
import { useMyPosts, usePostSession, useRemovePost, useTracks } from "./queries";

const NEW_TRACK = "new";
const trackForKey = (locationId: string) => `rc-lap-timer-track-for:${locationId}`;

function readSetting(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function saveSetting(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private browsing: no suggestion next time.
  }
}

// The track to suggest for a session: the one last used for its location, or one with the location's name.
function suggestedTrack(tracks: Track[], session: SessionRecord): string {
  const remembered = readSetting(trackForKey(session.locationId));
  if (remembered && tracks.some((track) => track.id === remembered)) return remembered;
  return tracks.find((track) => sameName(track.name, session.locationName))?.id ?? "";
}

// On a saved session's card, for a signed-in account in an app built with a cloud service (docs/cloud.md): post the
// session's best lap to a shared track's leaderboard, or take it down.
export function LeaderboardPost({ session }: { session: SessionRecord }) {
  const account = useCloudAccount();
  const entry = useMemo(() => entryForSession(session), [session]);
  if (!account || !entry) return null;
  return <PostControls account={account} session={session} entry={entry} />;
}

function PostControls({
  account,
  session,
  entry,
}: {
  account: CloudAccount;
  session: SessionRecord;
  entry: LeaderboardEntry;
}) {
  const posts = useMyPosts(account);
  const remove = useRemovePost();
  const [choosing, setChoosing] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const post = posts.data?.find((p) => p.sessionId === session.id);

  if (choosing) {
    return (
      <PostPanel
        account={account}
        session={session}
        entry={entry}
        onDone={() => setChoosing(false)}
        movingFrom={post?.trackId}
      />
    );
  }

  return (
    <div className="mt-3 space-y-2 text-sm">
      {post ? (
        <div className="flex flex-wrap items-center gap-2">
          <Trophy className="h-4 w-4" />
          <span>
            On the leaderboard at <strong>{post.trackName}</strong>.
          </span>
          <Button variant="outline" size="sm" onClick={() => setChoosing(true)}>
            Move
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={remove.isPending}
            onClick={async () => {
              setProblem(null);
              try {
                await remove.mutateAsync(post);
              } catch (error) {
                setProblem(toCloudError(error).message);
              }
            }}
          >
            Remove from leaderboard
          </Button>
        </div>
      ) : (
        <Button variant="outline" size="sm" disabled={posts.isPending} onClick={() => setChoosing(true)}>
          <Trophy className="mr-2 h-4 w-4" />
          Post to leaderboard
        </Button>
      )}
      {problem && (
        <p role="alert" className="text-red-700">
          {problem}
        </p>
      )}
    </div>
  );
}

function PostPanel({
  account,
  session,
  entry,
  movingFrom,
  onDone,
}: {
  account: CloudAccount;
  session: SessionRecord;
  entry: LeaderboardEntry;
  movingFrom?: string;
  onDone: () => void;
}) {
  const tracks = useTracks();
  const postSession = usePostSession(account);
  const [chosen, setChosen] = useState<string | null>(null);
  const [newName, setNewName] = useState(session.locationName);
  const [newArea, setNewArea] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const others = (tracks.data ?? []).filter((track) => track.id !== movingFrom);
  // Until a track is chosen, the suggestion; with no tracks at all, a new one.
  const trackId = chosen ?? (suggestedTrack(others, session) || (tracks.data && others.length === 0 ? NEW_TRACK : ""));

  const submit = async () => {
    setBusy(true);
    setProblem(null);
    try {
      let target = trackId;
      if (target === NEW_TRACK) {
        const checked = cleanTrack(newName, newArea);
        if (!checked.ok) {
          setProblem(checked.error);
          return;
        }
        target = (await createTrack(checked.value)).id;
      }
      await postSession.mutateAsync({ trackId: target, entry });
      saveSetting(trackForKey(session.locationId), target);
      onDone();
    } catch (error) {
      setProblem(toCloudError(error).message);
      // Someone may have added the same track meanwhile.
      void tracks.refetch();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 space-y-2 rounded border p-3 text-sm">
      <p className="font-medium">{movingFrom ? "Move to another track" : "Post to a track's leaderboard"}</p>
      <p>
        Everyone will be able to see: {entry.driverName}, {entry.carName}, best lap {formatLapTime(entry.bestLapMs)}{" "}
        (lap {entry.bestLapNumber} of {entry.lapCount}
        {entry.penalties > 0 && `, ${entry.penalties} ${entry.penalties === 1 ? "penalty" : "penalties"}`}), and the
        date.
      </p>
      {tracks.isPending && <p>Loading tracks…</p>}
      {tracks.data && (
        <>
          <Label>Track</Label>
          <Select value={trackId} onValueChange={setChosen}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose a track" />
            </SelectTrigger>
            <SelectContent>
              {others.map((track) => (
                <SelectItem key={track.id} value={track.id}>
                  {track.area ? `${track.name} (${track.area})` : track.name}
                </SelectItem>
              ))}
              <SelectItem value={NEW_TRACK}>A new track…</SelectItem>
            </SelectContent>
          </Select>
        </>
      )}
      {trackId === NEW_TRACK && (
        <div className="space-y-2">
          <Label htmlFor={`new-track-${session.id}`}>New track&apos;s name</Label>
          <Input
            id={`new-track-${session.id}`}
            value={newName}
            maxLength={MAX_TRACK_NAME_LENGTH}
            onChange={(event) => setNewName(event.target.value)}
          />
          <Label htmlFor={`new-track-area-${session.id}`}>Where it is (optional)</Label>
          <Input
            id={`new-track-area-${session.id}`}
            placeholder="Such as Austin, TX"
            value={newArea}
            maxLength={MAX_TRACK_NAME_LENGTH}
            onChange={(event) => setNewArea(event.target.value)}
          />
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={busy || !trackId} onClick={() => void submit()}>
          {busy ? "Posting…" : "Post"}
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={onDone}>
          Cancel
        </Button>
      </div>
      {(problem || tracks.error) && (
        <p role="alert" className="text-red-700">
          {problem ?? toCloudError(tracks.error).message}
        </p>
      )}
    </div>
  );
}
