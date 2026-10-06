"use client";

import { createContext, useContext, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { getInitials } from "@/components/Navbar";
import { supabase } from "@/lib/supabase";

const CREAM = "#F7F4EE";
const INDIGO = "#2A3560";
const GOLD = "#C4A94A";
const TEXT = "#1C1A15";
const ink = (alpha: number) => `rgba(28,26,21,${alpha})`;
const black = (alpha: number) => `rgba(0,0,0,${alpha})`;
const DIM = ink(0.4);

export const REACTIONS = ["\u{1F44D}", "\u{1F525}", "\u{1F914}", "\u{2764}\u{FE0F}"] as const;

/** What the signed-in reader already did on a real post, as stored in public.interactions. */
export type MyInteractions = { like: boolean; reaction: string | null; comment: null | string };

type SocialContextValue = {
  user: User | null;
  viewerName: string | null;
  mine: Record<string, MyInteractions>;
};

export const SocialContext = createContext<SocialContextValue>({ user: null, viewerName: null, mine: {} });

export const socialCss = `
.sa-btn { color: ${ink(0.55)}; transition: background-color 0.15s; }
.sa-btn:hover { background: ${black(0.05)}; }
.sa-heart { display: inline-block; }
.sa-heart.sa-pop { animation: sa-pop 0.4s cubic-bezier(.17,.67,.29,1.5); }
@keyframes sa-pop { 0% { transform: scale(1); } 30% { transform: scale(1.5); } 60% { transform: scale(0.85); } 100% { transform: scale(1); } }
.sa-like-burst { position: relative; }
.sa-like-burst::after {
  content: '';
  position: absolute;
  inset: -6px;
  border-radius: 50%;
  opacity: 0;
  pointer-events: none;
}
.sa-like-burst.sa-burst-active::after {
  animation: sa-burst 0.5s ease-out;
}
@keyframes sa-burst {
  0% { box-shadow: 0 0 0 0 rgba(212,83,126,0.4); opacity: 1; }
  100% { box-shadow: 0 0 0 14px rgba(212,83,126,0); opacity: 0; }
}
.sa-particle {
  position: absolute;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  pointer-events: none;
  animation: sa-fly 0.6s ease-out forwards;
}
@keyframes sa-fly {
  0% { opacity: 1; transform: translate(0,0) scale(1); }
  100% { opacity: 0; transform: var(--fly-to) scale(0); }
}
.sa-reactions { opacity: 0; transition: opacity 0.15s; }
.db-card-social:hover .sa-reactions, .db-card-social:focus-within .sa-reactions { opacity: 1; }
@media (hover: none) { .sa-reactions { opacity: 1; } }
.sa-emoji { transition: transform 0.15s, background-color 0.15s; }
.sa-emoji:hover { transform: scale(1.15); }
.sa-composer { height: 28px; transition: height 0.2s; resize: none; }
.sa-composer:focus { height: 72px; }
.sa-composer::placeholder { color: ${DIM}; }
.sa-mention:hover, .sa-mention[aria-selected=true] { background: ${black(0.04)}; }
.sa-thread-enter { animation: sa-slide-in 0.25s ease-out; }
@keyframes sa-slide-in { 0% { opacity: 0; transform: translateY(8px); } 100% { opacity: 1; transform: translateY(0); } }
@media (prefers-reduced-motion: reduce) { .sa-heart.sa-pop { animation: none; } .sa-composer { transition: none; } .sa-thread-enter { animation: none; } .sa-like-burst.sa-burst-active::after { animation: none; } .sa-particle { animation: none; } }
`;

type Comment = { initials: string; name: string; text: string; background: string; color: string };

function Avatar({ initials, background, color }: { initials: string; background: string; color: string }) {
  return (
    <span className="flex shrink-0 items-center justify-center" style={{ width: 24, height: 24, background, color, borderRadius: "50%", fontSize: 9, fontWeight: 500 }}>
      {initials}
    </span>
  );
}

function Button({
  children,
  active,
  activeStyle,
  onClick,
  label,
  className = "",
}: {
  children: ReactNode;
  active: boolean;
  activeStyle: CSSProperties;
  onClick: () => void;
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      className={`flex items-center ${active ? "" : "sa-btn"} ${className}`}
      style={{ padding: "5px 10px", borderRadius: 8, fontSize: 12, gap: 5, ...(active ? activeStyle : {}) }}
    >
      {children}
    </button>
  );
}

const contacts: { name: string; initials: string; background: string; color: string }[] = [];

const MENTION = contacts.length
  ? new RegExp(
      `(@(?:${contacts
        .map((c) => c.name)
        .sort((a, b) => b.length - a.length)
        .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("|")}))`,
    )
  : null;

function withMentions(text: string) {
  if (!MENTION) return text;
  return text.split(MENTION).map((part, i) =>
    i % 2 === 1 ? (
      <span key={i} style={{ color: INDIGO, fontWeight: 500 }}>{part}</span>
    ) : (
      part
    ),
  );
}

/** Particles that burst from the heart on like */
function LikeParticles({ active }: { active: boolean }) {
  if (!active) return null;
  const colors = ["#D4537E", "#FF6B9D", "#C4A94A", "#FF4081", "#E91E63", "#F06292"];
  const particles = Array.from({ length: 6 }, (_, i) => {
    const angle = (i * 60) * (Math.PI / 180);
    const dist = 16 + Math.random() * 8;
    const x = Math.cos(angle) * dist;
    const y = Math.sin(angle) * dist;
    return { x, y, color: colors[i % colors.length], delay: i * 30 };
  });
  return (
    <>
      {particles.map((p, i) => (
        <span
          key={i}
          className="sa-particle"
          style={{
            background: p.color,
            "--fly-to": `translate(${p.x}px, ${p.y}px)`,
            animationDelay: `${p.delay}ms`,
            top: "50%",
            left: "50%",
            marginTop: -2.5,
            marginLeft: -2.5,
          } as CSSProperties}
        />
      ))}
    </>
  );
}

export default function SocialActions({
  likes,
  comments,
  postId,
  extra,
  save = "\u{1F516}",
  initialComments = [],
}: {
  likes: number;
  comments: number;
  postId?: string;
  extra?: string;
  save?: string | null;
  initialComments?: Comment[];
}) {
  const { user, viewerName, mine } = useContext(SocialContext);
  const existing = postId ? mine[postId] : undefined;
  const live = Boolean(postId && user);

  const [liked, setLiked] = useState(existing?.like ?? false);
  const [pop, setPop] = useState(0);
  const [showParticles, setShowParticles] = useState(false);
  const [reaction, setReaction] = useState<string | null>(existing?.reaction ?? null);
  const [extraOn, setExtraOn] = useState(false);
  const [saved, setSaved] = useState(false);
  const viewer = { initials: getInitials(viewerName, user?.email), name: "Toi", background: INDIGO, color: CREAM };
  const [thread, setThread] = useState<Comment[]>(() =>
    existing?.comment ? [...initialComments, { ...viewer, text: existing.comment }] : initialComments,
  );
  const [composerOpen, setComposerOpen] = useState(initialComments.length > 0);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const toggleLike = async () => {
    const next = !liked;
    setLiked(next);
    if (next) {
      setPop((v) => v + 1);
      setShowParticles(true);
      setTimeout(() => setShowParticles(false), 700);
    }
    if (!live) return;
    const { error: writeError } = next
      ? await supabase.from("interactions").insert({ user_id: user!.id, post_id: postId, type: "like" })
      : await supabase.from("interactions").delete().match({ user_id: user!.id, post_id: postId, type: "like" });
    if (writeError) setLiked(!next);
  };

  const react = async (emoji: string) => {
    const previous = reaction;
    const next = previous === emoji ? null : emoji;
    setReaction(next);
    if (!live) return;
    await supabase.from("interactions").delete().match({ user_id: user!.id, post_id: postId, type: "reaction" });
    const { error: writeError } = next
      ? await supabase.from("interactions").insert({ user_id: user!.id, post_id: postId, type: "reaction", content: next })
      : { error: null };
    if (writeError) setReaction(previous);
  };

  const mentionQuery = /(?:^|\s)@([A-Za-zÀ-ÖØ-öø-ÿ.\- ]{0,20})$/.exec(draft)?.[1] ?? null;
  const suggestions =
    mentionQuery === null
      ? []
      : contacts.filter((c) => c.name.toLowerCase().startsWith(mentionQuery.toLowerCase())).slice(0, 5);

  const insertMention = (name: string) => {
    setDraft(draft.replace(/@([A-Za-zÀ-ÖØ-öø-ÿ.\- ]{0,20})$/, `@${name} `));
    setMentionIndex(0);
    inputRef.current?.focus();
  };

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setError(null);
    const comment = { ...viewer, text };
    setThread((cur) => [...cur, comment]);
    setDraft("");
    if (!live) return;
    const { error: writeError } = await supabase
      .from("interactions")
      .insert({ user_id: user!.id, post_id: postId, type: "comment", content: text });
    if (writeError) {
      setThread((cur) => cur.filter((c) => c !== comment));
      setDraft(text);
      setError(
        writeError.code === "23505"
          ? "Tu as déjà commenté ce post (un commentaire par post pour l'instant)."
          : "Le commentaire n'a pas pu être publié.",
      );
    }
  };

  const likeCount = likes + (liked ? 1 : 0);

  return (
    <div>
      <div className="mt-3 flex flex-wrap items-center" style={{ gap: 4 }}>
        <Button active={liked} activeStyle={{ color: "#D4537E", background: "rgba(212,83,126,0.08)" }} onClick={toggleLike} label="Aimer">
          <span className={`sa-like-burst ${showParticles ? "sa-burst-active" : ""}`} style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
            <span key={pop} className={`sa-heart ${pop ? "sa-pop" : ""}`} style={{ fontSize: liked ? 14 : 12, transition: "font-size 0.2s" }}>
              {liked ? "❤️" : "♡"}
            </span>
            <LikeParticles active={showParticles} />
          </span>
          {likeCount > 0 && <span style={{ fontWeight: liked ? 600 : 400, transition: "font-weight 0.2s" }}>{likeCount}</span>}
        </Button>
        <Button
          active={composerOpen}
          activeStyle={{ color: INDIGO, background: "rgba(42,53,96,0.07)" }}
          onClick={() => {
            setComposerOpen(!composerOpen);
            if (!composerOpen) setTimeout(() => inputRef.current?.focus(), 0);
          }}
          label="Commenter"
        >
          {"\u{1F4AC}"} {comments + thread.length - initialComments.length}
        </Button>
        {extra && (
          <Button active={extraOn} activeStyle={{ color: INDIGO, background: "rgba(42,53,96,0.07)" }} onClick={() => setExtraOn(!extraOn)}>
            {extra}
          </Button>
        )}

        <div className="sa-reactions flex items-center" style={{ gap: 2, marginLeft: 4 }} role="group" aria-label="Réactions rapides">
          {REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => react(emoji)}
              aria-pressed={reaction === emoji}
              aria-label={`Réagir ${emoji}`}
              className="sa-emoji flex items-center"
              style={{ fontSize: 13, padding: "2px 5px", borderRadius: 12, gap: 2, background: reaction === emoji ? "rgba(42,53,96,0.08)" : "transparent" }}
            >
              {emoji}
              {reaction === emoji && <span style={{ fontSize: 10, color: INDIGO }}>1</span>}
            </button>
          ))}
        </div>

        {save && (
          <Button
            active={saved}
            activeStyle={{ color: INDIGO, background: "rgba(42,53,96,0.07)" }}
            onClick={() => setSaved(!saved)}
            label="Sauvegarder"
            className="ml-auto"
          >
            {save}
          </Button>
        )}
      </div>

      {(composerOpen || thread.length > 0) && (
        <div className="mt-3" style={{ paddingTop: 10, borderTop: `1px solid ${black(0.05)}` }}>
          {thread.length > 0 && (
            <ul className="mb-2 flex flex-col gap-2.5">
              {thread.map((comment, i) => (
                <li key={i} className="sa-thread-enter flex gap-2">
                  <Avatar initials={comment.initials} background={comment.background} color={comment.color} />
                  <div className="min-w-0 flex-1" style={{ background: CREAM, borderRadius: 12, padding: "8px 12px" }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: TEXT }}>{comment.name}</p>
                    <p className="break-words" style={{ fontSize: 12, color: ink(0.7), lineHeight: 1.5 }}>{withMentions(comment.text)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {composerOpen && (
            <form onSubmit={submit} className="relative flex items-start gap-2">
              <Avatar {...viewer} />
              <textarea
                ref={inputRef}
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setError(null);
                  setMentionIndex(0);
                }}
                onKeyDown={(e) => {
                  if (suggestions.length > 0 && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
                    e.preventDefault();
                    setMentionIndex((idx) => (idx + (e.key === "ArrowDown" ? 1 : -1) + suggestions.length) % suggestions.length);
                  } else if (suggestions.length > 0 && (e.key === "Enter" || e.key === "Tab")) {
                    e.preventDefault();
                    insertMention(suggestions[mentionIndex].name);
                  } else if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
                placeholder="Écris un commentaire..."
                aria-label="Écrire un commentaire"
                className="sa-composer min-w-0 flex-1"
                style={{ background: CREAM, border: `1px solid ${black(0.07)}`, borderRadius: 14, padding: "6px 12px", fontSize: 12, color: TEXT, outline: "none", lineHeight: 1.4 }}
              />
              <button
                type="submit"
                disabled={!draft.trim()}
                aria-label="Envoyer"
                className="disabled:opacity-30"
                style={{ color: GOLD, fontSize: 16, paddingTop: 2 }}
              >
                ➤
              </button>

              {suggestions.length > 0 && (
                <ul
                  role="listbox"
                  aria-label="Mentionner"
                  className="absolute z-10"
                  style={{ left: 30, top: "100%", marginTop: 4, background: "#FFFFFF", border: `1px solid ${black(0.1)}`, borderRadius: 8, padding: 4, minWidth: 160, boxShadow: "0 8px 24px rgba(0,0,0,0.08)" }}
                >
                  {suggestions.map((c, i) => (
                    <li key={c.initials}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={i === mentionIndex}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          insertMention(c.name);
                        }}
                        className="sa-mention flex w-full items-center gap-2 text-left"
                        style={{ padding: "5px 8px", borderRadius: 6 }}
                      >
                        <Avatar initials={c.initials} background={c.background} color={c.color} />
                        <span style={{ fontSize: 12, color: TEXT }}>{c.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </form>
          )}
          {error && <p role="alert" className="mt-1.5" style={{ fontSize: 11, color: "#C0392B" }}>{error}</p>}
        </div>
      )}
    </div>
  );
}
