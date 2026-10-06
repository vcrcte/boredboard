import { supabase } from "@/lib/supabase";

export type PublicProfile = {
  id: string;
  name: string | null;
  username: string;
  bio: string | null;
  avatar_url: string | null;
  interests: string[];
  followers_count: number;
  following_count: number;
};

export type SuggestedProfile = PublicProfile & {
  shared_interests: string[];
};

/** Whether the viewer is following the given user. */
export async function isFollowing(viewerId: string, targetId: string): Promise<boolean> {
  const { data } = await supabase
    .from("follows")
    .select("id")
    .eq("follower_id", viewerId)
    .eq("following_id", targetId)
    .maybeSingle();
  return data !== null;
}

/** Follow a user. Returns true on success. */
export async function follow(followerId: string, followingId: string): Promise<boolean> {
  const { error } = await supabase.from("follows").insert({ follower_id: followerId, following_id: followingId });
  return !error;
}

/** Unfollow a user. Returns true on success. */
export async function unfollow(followerId: string, followingId: string): Promise<boolean> {
  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", followerId)
    .eq("following_id", followingId);
  return !error;
}

/** Get the list of users that userId follows. */
export async function getFollowing(userId: string): Promise<PublicProfile[]> {
  const { data: follows } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", userId);
  if (!follows?.length) return [];

  const ids = follows.map((f) => f.following_id as string);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, name, username, bio, avatar_url, interests, followers_count, following_count")
    .in("id", ids);
  return (profiles ?? []).map(normalizeProfile);
}

/** Get the list of users following userId. */
export async function getFollowers(userId: string): Promise<PublicProfile[]> {
  const { data: follows } = await supabase
    .from("follows")
    .select("follower_id")
    .eq("following_id", userId);
  if (!follows?.length) return [];

  const ids = follows.map((f) => f.follower_id as string);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, name, username, bio, avatar_url, interests, followers_count, following_count")
    .in("id", ids);
  return (profiles ?? []).map(normalizeProfile);
}

/** Get who the viewer follows among a set of user IDs. */
export async function getFollowedIds(viewerId: string, targetIds: string[]): Promise<Set<string>> {
  if (!targetIds.length) return new Set();
  const { data } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", viewerId)
    .in("following_id", targetIds);
  return new Set((data ?? []).map((r) => r.following_id as string));
}

/** Profiles the user might want to follow, based on shared interests. */
export async function getSuggested(userId: string, limit = 10): Promise<SuggestedProfile[]> {
  // First get the user's interests
  const { data: me } = await supabase
    .from("profiles")
    .select("interests")
    .eq("id", userId)
    .maybeSingle();
  const myInterests: string[] = me?.interests ?? [];

  // Get IDs the user already follows
  const { data: follows } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", userId);
  const followedIds = new Set((follows ?? []).map((f) => f.following_id as string));
  followedIds.add(userId); // exclude self

  // Get all profiles with interests
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, name, username, bio, avatar_url, interests, followers_count, following_count")
    .not("interests", "eq", "{}");

  if (!profiles?.length) return [];

  return profiles
    .filter((p) => !followedIds.has(p.id))
    .map((p) => {
      const profile = normalizeProfile(p);
      const shared = myInterests.filter((i) => profile.interests.includes(i));
      return { ...profile, shared_interests: shared };
    })
    .sort((a, b) => b.shared_interests.length - a.shared_interests.length || b.followers_count - a.followers_count)
    .slice(0, limit);
}

/** Search profiles by name or username. */
export async function searchProfiles(query: string, viewerId?: string, limit = 20): Promise<PublicProfile[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  // Search by username or name (ilike)
  const { data } = await supabase
    .from("profiles")
    .select("id, name, username, bio, avatar_url, interests, followers_count, following_count")
    .or(`username.ilike.%${q}%,name.ilike.%${q}%`)
    .limit(limit);

  return (data ?? [])
    .filter((p) => p.id !== viewerId)
    .map(normalizeProfile);
}

/** Save the user's interests to their profile. */
export async function saveInterests(userId: string, interests: string[]): Promise<boolean> {
  const { error } = await supabase
    .from("profiles")
    .update({ interests })
    .eq("id", userId);
  return !error;
}

function normalizeProfile(raw: Record<string, unknown>): PublicProfile {
  return {
    id: raw.id as string,
    name: (raw.name as string | null) ?? null,
    username: raw.username as string,
    bio: (raw.bio as string | null) ?? null,
    avatar_url: (raw.avatar_url as string | null) ?? null,
    interests: Array.isArray(raw.interests) ? raw.interests : [],
    followers_count: (raw.followers_count as number) ?? 0,
    following_count: (raw.following_count as number) ?? 0,
  };
}
