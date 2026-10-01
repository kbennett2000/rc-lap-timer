// The cloud's shared tracks, leaderboards and the signed-in account's posts, cached for every screen that shows them.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CloudAccount } from "@/cloud/account";
import { leaderboard, listTracks, myPosts, postSession, removePost, type Post } from "@/cloud/tracks";
import type { LeaderboardEntry } from "@/domain/leaderboard";

export const TRACKS_KEY = ["cloud", "tracks"];
const leaderboardKey = (trackId: string) => ["cloud", "leaderboard", trackId];
const postsKey = (accountId: string | undefined) => ["cloud", "posts", accountId];

export function useTracks() {
  return useQuery({ queryKey: TRACKS_KEY, queryFn: listTracks, staleTime: 60_000 });
}

export function useLeaderboard(trackId: string) {
  return useQuery({ queryKey: leaderboardKey(trackId), queryFn: () => leaderboard(trackId), staleTime: 60_000 });
}

export function useMyPosts(account: CloudAccount | null | undefined) {
  return useQuery({
    queryKey: postsKey(account?.id),
    queryFn: () => myPosts(account!.id),
    enabled: Boolean(account),
    staleTime: 60_000,
  });
}

// After a post changes, everything that shows posts.
export function useRefreshPosts() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["cloud"] });
}

export function usePostSession(account: CloudAccount) {
  const refresh = useRefreshPosts();
  return useMutation({
    mutationFn: ({ trackId, entry }: { trackId: string; entry: LeaderboardEntry }) =>
      postSession(account.id, trackId, entry),
    onSettled: refresh,
  });
}

export function useRemovePost() {
  const refresh = useRefreshPosts();
  return useMutation({ mutationFn: (post: Pick<Post, "id">) => removePost(post.id), onSettled: refresh });
}
