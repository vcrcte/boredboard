/**
 * Like count to display under a post.
 * `likesCount` is posts.likes_count; `likedAtLoad` is whether the viewer's like
 * was already saved when the post loaded; `likedNow` is the button's current state.
 */
export function displayedLikes(likesCount: number, likedAtLoad: boolean, likedNow: boolean): number {
  // likes_count already includes a saved like, so count the others, then add the current state.
  const others = Math.max(likesCount - (likedAtLoad ? 1 : 0), 0);
  return others + (likedNow ? 1 : 0);
}
