/**
 * Feed scoring algorithm — ranks posts based on user behaviour signals.
 *
 * Signals (and their rough weights):
 *  1. Social proximity   — posts from followed users score higher
 *  2. Category affinity  — categories the viewer interacts with most
 *  3. Type affinity      — post types the viewer engages with most
 *  4. Engagement         — posts with more total interactions
 *  5. Recency            — exponential time-decay (half-life ≈ 24 h)
 *  6. Diversity penalty  — consecutive posts of same category/type get down-ranked
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type ScoredPost = {
  id: string;
  user_id: string;
  type: string;
  content: string;
  url: string | null;
  category: string | null;
  likes_count: number;
  created_at: string;
  metadata?: unknown;
  profiles: {
    id: string;
    name: string | null;
    username: string;
    avatar_url: string | null;
  } | null;
  /** Final score used to sort the feed (higher = shown first). */
  _score: number;
};

export type UserSignals = {
  /** IDs the viewer follows. */
  followingIds: Set<string>;
  /** category → interaction count (likes + comments + saves on posts of that category). */
  categoryAffinity: Record<string, number>;
  /** postType → interaction count. */
  typeAffinity: Record<string, number>;
  /** userId → interaction count (how much the viewer interacts with that author). */
  authorAffinity: Record<string, number>;
  /** Viewer's declared interests from their profile. */
  interests: string[];
};

// ── Weights ──────────────────────────────────────────────────────────────────

const W = {
  /** Boost for posts by someone the viewer follows. */
  following: 3.0,
  /** Boost per interaction the viewer has had with this author. */
  authorAffinity: 0.5,
  /** Max boost from category affinity (scaled by proportion of total interactions). */
  categoryAffinity: 4.0,
  /** Max boost from type affinity. */
  typeAffinity: 2.0,
  /** Boost per "engagement unit" on the post itself (log-scaled). */
  engagement: 1.5,
  /** Half-life for recency decay in hours. */
  recencyHalfLifeHours: 24,
  /** Boost when the post's category matches a viewer interest. */
  interestMatch: 1.5,
};

// ── Scoring ──────────────────────────────────────────────────────────────────

function recencyScore(createdAt: string): number {
  const ageHours = (Date.now() - new Date(createdAt).getTime()) / 3_600_000;
  // Exponential decay: score = 2^(-age/halfLife)  → 1.0 at age=0, 0.5 at 24 h, 0.25 at 48 h …
  return Math.pow(2, -ageHours / W.recencyHalfLifeHours);
}

export function scorePost(
  post: { id: string; user_id: string; type: string; category: string | null; likes_count: number; created_at: string },
  signals: UserSignals,
): number {
  let score = 0;

  // 1. Social proximity
  if (signals.followingIds.has(post.user_id)) {
    score += W.following;
  }

  // 2. Author affinity (how much the viewer interacts with this specific author)
  const authorHits = signals.authorAffinity[post.user_id] ?? 0;
  score += Math.min(authorHits * W.authorAffinity, 5); // cap at 5

  // 3. Category affinity
  if (post.category) {
    const totalInteractions = Object.values(signals.categoryAffinity).reduce((s, n) => s + n, 0);
    if (totalInteractions > 0) {
      const catHits = signals.categoryAffinity[post.category] ?? 0;
      score += (catHits / totalInteractions) * W.categoryAffinity;
    }
  }

  // 4. Type affinity
  const totalTypeInteractions = Object.values(signals.typeAffinity).reduce((s, n) => s + n, 0);
  if (totalTypeInteractions > 0) {
    const typeHits = signals.typeAffinity[post.type] ?? 0;
    score += (typeHits / totalTypeInteractions) * W.typeAffinity;
  }

  // 5. Engagement (log scale so viral posts don't dominate everything)
  const eng = Math.max(post.likes_count ?? 0, 0);
  score += Math.log2(1 + eng) * W.engagement;

  // 6. Recency
  score *= 1 + recencyScore(post.created_at) * 3; // multiplier: fresh posts get up to 4×

  // 7. Interest match
  if (post.category && signals.interests.includes(post.category)) {
    score += W.interestMatch;
  }

  return score;
}

// ── Diversity re-ranking ─────────────────────────────────────────────────────
// After scoring, we penalise long runs of the same category or type so the
// feed feels varied.

export function diversify(posts: ScoredPost[], windowSize = 3): ScoredPost[] {
  if (posts.length <= 1) return posts;

  const result: ScoredPost[] = [];
  const remaining = [...posts];

  while (remaining.length > 0) {
    // Look at the last `windowSize` items in the result
    const recent = result.slice(-windowSize);
    const recentCategories = recent.map((p) => p.category).filter(Boolean);
    const recentTypes = recent.map((p) => p.type);

    // Find the best candidate that doesn't repeat too much
    let bestIdx = 0;
    let bestAdjusted = -Infinity;

    for (let i = 0; i < Math.min(remaining.length, 10); i++) {
      // Only consider top 10 by score to avoid O(n²) and keep relevance
      let adjusted = remaining[i]._score;

      // Penalty if same category appeared in the recent window
      if (remaining[i].category && recentCategories.includes(remaining[i].category)) {
        adjusted *= 0.7;
      }
      // Penalty if same type appeared in the recent window
      if (recentTypes.includes(remaining[i].type)) {
        adjusted *= 0.85;
      }

      if (adjusted > bestAdjusted) {
        bestAdjusted = adjusted;
        bestIdx = i;
      }
    }

    result.push(remaining.splice(bestIdx, 1)[0]);
  }

  return result;
}

// ── Build user signals from interaction history ──────────────────────────────

export type RawInteraction = {
  post_id: string;
  type: string;           // like | comment | save | reaction
  posts: {
    user_id: string;
    type: string;          // article | reflexion | livre | musique
    category: string | null;
  } | null;
};

export function buildSignals(
  interactions: RawInteraction[],
  followingIds: string[],
  interests: string[],
): UserSignals {
  const categoryAffinity: Record<string, number> = {};
  const typeAffinity: Record<string, number> = {};
  const authorAffinity: Record<string, number> = {};

  for (const ix of interactions) {
    if (!ix.posts) continue;
    // Category
    if (ix.posts.category) {
      categoryAffinity[ix.posts.category] = (categoryAffinity[ix.posts.category] ?? 0) + 1;
    }
    // Post type
    typeAffinity[ix.posts.type] = (typeAffinity[ix.posts.type] ?? 0) + 1;
    // Author
    authorAffinity[ix.posts.user_id] = (authorAffinity[ix.posts.user_id] ?? 0) + 1;
  }

  return {
    followingIds: new Set(followingIds),
    categoryAffinity,
    typeAffinity,
    authorAffinity,
    interests,
  };
}
