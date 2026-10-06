"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import Navbar, { getInitials } from "@/components/Navbar";
import { avatarTones } from "@/lib/sample-data";
import { follow, getFollowedIds, getSuggested, searchProfiles, unfollow, type PublicProfile, type SuggestedProfile } from "@/lib/social";
import { supabase } from "@/lib/supabase";
import { THEMES } from "@/lib/preferences";

const CREAM = "#F7F4EE";
const INDIGO = "#2A3560";
const TEXT = "#1C1A15";
const WHITE = "#FFFFFF";
const GEORGIA = "Georgia, 'Times New Roman', serif";
const ink = (a: number) => `rgba(28,26,21,${a})`;
const black = (a: number) => `rgba(0,0,0,${a})`;
const DIM = ink(0.4);

const card: CSSProperties = { background: WHITE, border: `1px solid ${black(0.07)}`, borderRadius: 14, padding: 16 };

function Avatar({ initials, size = 44, background, color }: { initials: string; size?: number; background: string; color: string }) {
  return (
    <span className="flex shrink-0 items-center justify-center" style={{ width: size, height: size, background, color, borderRadius: "50%", fontSize: size * 0.34, fontWeight: 500 }}>
      {initials}
    </span>
  );
}

function FollowButton({ userId, targetId, initialFollowing, onToggle }: { userId: string; targetId: string; initialFollowing: boolean; onToggle?: (following: boolean) => void }) {
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    setBusy(true);
    const next = !following;
    setFollowing(next);
    const ok = next ? await follow(userId, targetId) : await unfollow(userId, targetId);
    if (!ok) setFollowing(!next);
    else onToggle?.(next);
    setBusy(false);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className="shrink-0 transition disabled:opacity-50"
      style={{
        fontSize: 12,
        fontWeight: 500,
        padding: "6px 18px",
        borderRadius: 20,
        ...(following
          ? { background: "transparent", border: `1px solid ${black(0.15)}`, color: ink(0.6) }
          : { background: INDIGO, color: CREAM, border: `1px solid ${INDIGO}` }),
      }}
    >
      {following ? "Suivi" : "Suivre"}
    </button>
  );
}

function ProfileCard({ profile, userId, isFollowing: initialFollowing }: { profile: PublicProfile | SuggestedProfile; userId: string; isFollowing: boolean }) {
  const tone = avatarTones[(profile.id.charCodeAt(0) + profile.id.charCodeAt(1)) % avatarTones.length];
  const shared = "shared_interests" in profile ? (profile as SuggestedProfile).shared_interests : [];

  return (
    <div style={card}>
      <div className="flex items-start gap-3">
        <Link href={`/profile?id=${profile.id}`}>
          <Avatar initials={getInitials(profile.name, profile.username)} {...tone} />
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={`/profile?id=${profile.id}`} className="hover:underline">
            <p style={{ fontSize: 14, fontWeight: 500, color: TEXT }}>{profile.name ?? profile.username}</p>
          </Link>
          <p style={{ fontSize: 12, color: DIM }}>@{profile.username}</p>
          {profile.bio && <p className="mt-1" style={{ fontSize: 12, color: ink(0.55), lineHeight: 1.5 }}>{profile.bio}</p>}
        </div>
        <FollowButton userId={userId} targetId={profile.id} initialFollowing={initialFollowing} />
      </div>

      {(shared.length > 0 || profile.interests.length > 0) && (
        <div className="mt-3 flex flex-wrap" style={{ gap: 5 }}>
          {(shared.length > 0 ? shared : profile.interests.slice(0, 4)).map((interest) => (
            <span key={interest} style={{ fontSize: 10, padding: "3px 10px", borderRadius: 12, background: shared.includes(interest) ? "rgba(42,53,96,0.08)" : black(0.04), color: shared.includes(interest) ? INDIGO : ink(0.5) }}>
              {interest}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 flex" style={{ gap: 16 }}>
        <span style={{ fontSize: 11, color: DIM }}><strong style={{ color: TEXT }}>{profile.followers_count}</strong> abonnés</span>
        <span style={{ fontSize: 11, color: DIM }}><strong style={{ color: TEXT }}>{profile.following_count}</strong> abonnements</span>
      </div>
    </div>
  );
}

export default function Explore() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PublicProfile[] | null>(null);
  const [suggested, setSuggested] = useState<SuggestedProfile[] | null>(null);
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [searching, setSearching] = useState(false);
  const [activeInterest, setActiveInterest] = useState<string | null>(null);
  const [interestProfiles, setInterestProfiles] = useState<PublicProfile[] | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { router.replace("/login"); return; }
      setSession(data.session);
    });
  }, [router]);

  const userId = session?.user.id;

  // Load suggestions on mount
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const profiles = await getSuggested(userId, 12);
      if (!cancelled) {
        setSuggested(profiles);
        const ids = profiles.map((p) => p.id);
        const followed = await getFollowedIds(userId, ids);
        if (!cancelled) setFollowedIds(followed);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  // Search debounce
  useEffect(() => {
    if (!userId || !query.trim()) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    const timeout = setTimeout(async () => {
      const results = await searchProfiles(query, userId, 20);
      setSearchResults(results);
      const ids = results.map((p) => p.id);
      const followed = await getFollowedIds(userId, ids);
      setFollowedIds((prev) => new Set([...Array.from(prev), ...Array.from(followed)]));
      setSearching(false);
    }, 300);
    return () => clearTimeout(timeout);
  }, [query, userId]);

  // Browse by interest
  const browseInterest = useCallback(async (interest: string) => {
    if (!userId) return;
    setActiveInterest(interest);
    setInterestProfiles(null);
    // Search profiles whose interests contain this theme
    const { data } = await supabase
      .from("profiles")
      .select("id, name, username, bio, avatar_url, interests, followers_count, following_count")
      .contains("interests", [interest])
      .neq("id", userId)
      .order("followers_count", { ascending: false })
      .limit(20);
    const profiles = (data ?? []).map((p: Record<string, unknown>) => ({
      id: p.id as string,
      name: (p.name as string | null) ?? null,
      username: p.username as string,
      bio: (p.bio as string | null) ?? null,
      avatar_url: (p.avatar_url as string | null) ?? null,
      interests: Array.isArray(p.interests) ? p.interests as string[] : [],
      followers_count: (p.followers_count as number) ?? 0,
      following_count: (p.following_count as number) ?? 0,
    }));
    setInterestProfiles(profiles);
    const ids = profiles.map((p) => p.id);
    const followed = await getFollowedIds(userId, ids);
    setFollowedIds((prev) => new Set([...Array.from(prev), ...Array.from(followed)]));
  }, [userId]);

  if (!session) return <div className="min-h-screen" style={{ background: CREAM }} />;

  const showSearch = query.trim().length > 0;
  const showInterest = activeInterest && !showSearch;

  return (
    <div className="min-h-screen" style={{ background: CREAM, color: TEXT, fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}>
      <style>{`
        .ex-hover:hover { background: ${black(0.04)}; }
        .ex-input::placeholder { color: ${DIM}; }
      `}</style>
      <Navbar />

      <main className="mx-auto px-4 sm:px-6" style={{ maxWidth: 640, paddingBlock: 32 }}>
        <h1 style={{ fontFamily: GEORGIA, fontSize: 28, fontWeight: 400, color: TEXT }}>Explorer</h1>
        <p className="mt-1 mb-6" style={{ fontSize: 13, color: DIM }}>Découvre des profils qui partagent tes centres d&apos;intérêt</p>

        {/* Search bar */}
        <div className="relative mb-6">
          <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ fontSize: 14, color: DIM }}>🔍</span>
          <input
            type="search"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveInterest(null); }}
            placeholder="Chercher un profil..."
            className="ex-input w-full"
            style={{ background: WHITE, border: `1px solid ${black(0.08)}`, borderRadius: 12, padding: "12px 14px 12px 36px", fontSize: 13, color: TEXT, outline: "none" }}
          />
        </div>

        {/* Interest pills — browse by theme */}
        {!showSearch && (
          <div className="mb-6">
            <p className="mb-3" style={{ fontSize: 9, color: ink(0.35), letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 400 }}>Parcourir par thème</p>
            <div className="flex flex-wrap" style={{ gap: 6 }}>
              {THEMES.map((theme) => (
                <button
                  key={theme}
                  type="button"
                  onClick={() => activeInterest === theme ? setActiveInterest(null) : browseInterest(theme)}
                  style={{
                    fontSize: 12, padding: "6px 14px", borderRadius: 20, transition: "background-color 0.15s",
                    ...(activeInterest === theme ? { background: INDIGO, color: CREAM } : { background: "#F0EBE1", color: ink(0.6) }),
                  }}
                >
                  {theme}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Search results */}
        {showSearch && (
          <section>
            <p className="mb-3" style={{ fontSize: 9, color: ink(0.35), letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 400 }}>Résultats</p>
            {searching ? (
              <div className="flex flex-col" style={{ gap: 12 }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} className="animate-pulse" style={card}>
                    <div className="flex items-center gap-3">
                      <span style={{ width: 44, height: 44, borderRadius: "50%", background: black(0.06) }} />
                      <div className="flex-1">
                        <span className="block" style={{ width: "40%", height: 12, background: black(0.06), borderRadius: 6 }} />
                        <span className="mt-2 block" style={{ width: "25%", height: 10, background: black(0.04), borderRadius: 6 }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : searchResults && searchResults.length === 0 ? (
              <p className="text-center" style={{ ...card, fontSize: 13, color: DIM, padding: 32 }}>
                Aucun profil trouvé pour « {query} »
              </p>
            ) : (
              <div className="flex flex-col" style={{ gap: 12 }}>
                {(searchResults ?? []).map((profile) => (
                  <ProfileCard key={profile.id} profile={profile} userId={userId!} isFollowing={followedIds.has(profile.id)} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Interest-filtered profiles */}
        {showInterest && (
          <section>
            <p className="mb-3" style={{ fontSize: 9, color: ink(0.35), letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 400 }}>
              Profils intéressés par {activeInterest}
            </p>
            {interestProfiles === null ? (
              <div className="flex flex-col" style={{ gap: 12 }}>
                {[0, 1].map((i) => (
                  <div key={i} className="animate-pulse" style={card}>
                    <div className="flex items-center gap-3">
                      <span style={{ width: 44, height: 44, borderRadius: "50%", background: black(0.06) }} />
                      <div className="flex-1"><span className="block" style={{ width: "40%", height: 12, background: black(0.06), borderRadius: 6 }} /></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : interestProfiles.length === 0 ? (
              <p className="text-center" style={{ ...card, fontSize: 13, color: DIM, padding: 32 }}>
                Aucun profil n&apos;a encore ajouté « {activeInterest} » à ses centres d&apos;intérêt.
              </p>
            ) : (
              <div className="flex flex-col" style={{ gap: 12 }}>
                {interestProfiles.map((profile) => (
                  <ProfileCard key={profile.id} profile={profile} userId={userId!} isFollowing={followedIds.has(profile.id)} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Suggestions — shown when not searching */}
        {!showSearch && !showInterest && (
          <section>
            <p className="mb-3" style={{ fontSize: 9, color: ink(0.35), letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 400 }}>Suggestions pour toi</p>
            {suggested === null ? (
              <div className="flex flex-col" style={{ gap: 12 }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} className="animate-pulse" style={card}>
                    <div className="flex items-center gap-3">
                      <span style={{ width: 44, height: 44, borderRadius: "50%", background: black(0.06) }} />
                      <div className="flex-1">
                        <span className="block" style={{ width: "40%", height: 12, background: black(0.06), borderRadius: 6 }} />
                        <span className="mt-2 block" style={{ width: "25%", height: 10, background: black(0.04), borderRadius: 6 }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : suggested.length === 0 ? (
              <div className="text-center" style={{ ...card, padding: 32 }}>
                <p style={{ fontSize: 24 }}>🧭</p>
                <p className="mt-2" style={{ fontSize: 14, fontWeight: 500, color: TEXT }}>Pas encore de suggestions</p>
                <p className="mx-auto mt-1" style={{ fontSize: 12, color: DIM, maxWidth: 280, lineHeight: 1.5 }}>
                  Ajoute tes centres d&apos;intérêt dans les paramètres pour découvrir des profils qui te ressemblent.
                </p>
                <Link
                  href="/settings"
                  className="mt-3 inline-block"
                  style={{ fontSize: 12, color: INDIGO, fontWeight: 500 }}
                >
                  Ajouter mes centres d&apos;intérêt →
                </Link>
              </div>
            ) : (
              <div className="flex flex-col" style={{ gap: 12 }}>
                {suggested.map((profile) => (
                  <ProfileCard key={profile.id} profile={profile} userId={userId!} isFollowing={followedIds.has(profile.id)} />
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
