"use client";

import { createContext, useContext, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { getInitials } from "@/components/Navbar";
import { contacts } from "@/lib/sample-data";
import { supabase } from "@/lib/supabase";

const CREAM = "#F7F4EE";
const INDIGO = "#2A3560";
const GOLD = "#C4A94A";
const TEXT = "#1C1A15";
const ink = (alpha: number) => `rgba(28,26,21,${alpha})`;
const black = (alpha: number) => `rgba(0,0,0,${alpha})`;
const DIM = ink(0.4);

export const REACTIONS = ["👍", "🔥", "🤔", "❤️"] as const;

/** What the signed-in reader already did on a real post, as stored in public.interactions. */
export type MyInteractions = { like: boolean; reaction: string | null; comment: string | null };

type SocialContextValue = {
  user: User | null;
  viewerName: string | null;
  /** Interactions of the reader on real posts, keyed by post id. */
  mine: Record<string, MyInteractions>;
};

export const SocialContext = createContext<SocialContextValue>({ user: null, viewerName: null, mine: {} });

// Hover and animation rules can't be inline. No quotes in here: React escapes
// them when rendering a <style> on the server.
export const socialCss = `
.sa-btn { color: ${ink(0.55)}; transition: background-color 0.15s; }
.sa-btn:hover { background: ${black(0.05)}; }
.sa-heart { display: inline-block; }
.sa-heart.sa-pop { animation: sa-pop 0.3s ease-out; }
@keyframes sa-pop { 0% { transform: scale(1); } 50% { transform: scale(1.4); } 100% { transform: scale(1); } }
.sa-reactions { opacity: 0; transition: opacity 0.15s; }
.db-card:hover .sa-reactions, .db-card:focus-within .sa-reactions { opacity: 1; }
@media (hover: none) { .sa-reactions { opacity: 1; } }
.sa-emoji { transition: transform 0.15s, background-color 0.15s; }
.sa-emoji:hover { transform: scale(1.15); }
.sa-composer { height: 28px; transition: height 0.2s; resize: none; }
.sa-composer:focus { height: 72px; }
.sa-composer::placeholder { color: ${DIM}; }
.sa-mention:hover, .sa-mention[aria-selected=true] { background: ${black(0.04)}; }
@media (prefers-reduced-motion: reduce) { .sa-heart.sa-pop { animation: none; } .sa-composer { transition: none; } }
`;

type Comment = { initials: string; name: string; text: string; background: string; color: string };

function Avatar({ initials, background, color }: { initials: string; background: string; color: string }) {
  return (
    <span className="flex shrink-0 items-center justify-center" style={{ width: 22, height: 22, background, color, borderRadius: "50%", fontSize: 9, fontWeight: 500 }}>
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

// "@Sophie A." etc.: the contact names, longest first so "@Marc K." wins over a shorter prefix.
const MENTION = new RegExp(
  `(@(?:${contacts
    .map((contact) => contact.name)
    .sort((a, b) => b.length - a.length)
    .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|")}))`,
);

/** Highlights @mentions of known contacts in a comment. */
function withMentions(text: string) {
  return text.split(MENTION).map((part, index) =>
    index % 2 === 1 ? (
      <span key={index} style={{ color: INDIGO, fontWeight: 500 }}>{part}</span>
    ) : (
      part
    ),
  );
}

/**
 * Like, comment, share, save and quick reactions under a feed card. On a real
 * post (postId set) they are written to public.interactions, optimistically;
 * on the sample cards they only live in the page.
 */
export default function SocialActions({
  likes,
  comments,
  postId,
  extra,
  save = "🔖",
  initialComments = [],
}: {
  likes: number;
  comments: number;
  postId?: string;
  /** Optional third action, e.g. "↗ Partager". */
  extra?: string;
  /** Label of the save action; null to leave it out. */
  save?: string | null;
  initialComments?: Comment[];
}) {
  const { user, viewerName, mine } = useContext(SocialContext);
  const existing = postId ? mine[postId] : undefined;
  const live = Boolean(postId && user);

  const [liked, setLiked] = useState(existing?.like ?? false);
  const [pop, setPop] = useState(0);
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
    if (next) setPop((value) => value + 1);
    if (!live) return;
    const { error: writeError } = next
      ? await supabase.from("interactions").insert({ user_id: user!.id, post_id: postId, type: "like" })
      : await supabase.from("interactions").delete().match({ user_id: user!.id, post_id: postId, type: "like" });
    // Optimistic update: silently undone if Supabase refused it.
    if (writeError) setLiked(!next);
  };

  const react = async (emoji: string) => {
    const previous = reaction;
    const next = previous === emoji ? null : emoji;
    setReaction(next);
    if (!live) return;
    // One reaction per reader and post (the table's unique key), replaced on change.
    await supabase.from("interactions").delete().match({ user_id: user!.id, post_id: postId, type: "reaction" });
    const { error: writeError } = next
      ? await supabase.from("interactions").insert({ user_id: user!.id, post_id: postId, type: "reaction", content: next })
      : { error: null };
    if (writeError) setReaction(previous);
  };

  // "@Lé" at the end of the draft → contacts whose name starts with "Lé".
  const mentionQuery = /(?:^|\s)@([A-Za-zÀ-ÖØ-öø-ÿ.\- ]{0,20})$/.exec(draft)?.[1] ?? null;
  const suggestions =
    mentionQuery === null
      ? []
      : contacts.filter((contact) => contact.name.toLowerCase().startsWith(mentionQuery.toLowerCase())).slice(0, 5);

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
    setThread((current) => [...current, comment]);
    setDraft("");
    if (!live) return;
    const { error: writeError } = await supabase
      .from("interactions")
      .insert({ user_id: user!.id, post_id: postId, type: "comment", content: text });
    if (writeError) {
      setThread((current) => current.filter((item) => item !== comment));
      setDraft(text);
      setError(
        writeError.code === "23505"
          ? "Tu as déjà commenté ce post (un commentaire par post pour l'instant)."
          : "Le commentaire n'a pas pu être publié.",
      );
    }
  };

  return (
    <div>
      <div className="mt-3 flex flex-wrap items-center" style={{ gap: 4 }}>
        <Button active={liked} activeStyle={{ color: "#D4537E", background: "rgba(212,83,126,0.06)" }} onClick={toggleLike} label="Aimer">
          <span key={pop} className={`sa-heart ${pop ? "sa-pop" : ""}`}>♥</span>
          {likes + (liked ? 1 : 0)}
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
          💬 {comments + thread.length - initialComments.length}
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
              {thread.map((comment, index) => (
                <li key={index} className="flex gap-2">
                  <Avatar initials={comment.initials} background={comment.background} color={comment.color} />
                  <div className="min-w-0">
                    <p style={{ fontSize: 10, fontWeight: 500, color: DIM }}>{comment.name}</p>
                    <p className="break-words" style={{ fontSize: 11, color: ink(0.6), lineHeight: 1.5 }}>{withMentions(comment.text)}</p>
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
                onChange={(event) => {
                  setDraft(event.target.value);
                  setError(null);
                  setMentionIndex(0);
                }}
                onKeyDown={(event) => {
                  if (suggestions.length > 0 && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
                    event.preventDefault();
                    setMentionIndex((index) => (index + (event.key === "ArrowDown" ? 1 : -1) + suggestions.length) % suggestions.length);
                  } else if (suggestions.length > 0 && (event.key === "Enter" || event.key === "Tab")) {
                    event.preventDefault();
                    insertMention(suggestions[mentionIndex].name);
                  } else if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    submit();
                  }
                }}
                placeholder="Répondre... (@ pour mentionner)"
                aria-label="Écrire un commentaire"
                className="sa-composer min-w-0 flex-1"
                style={{ background: CREAM, border: `1px solid ${black(0.07)}`, borderRadius: 14, padding: "5px 12px", fontSize: 12, color: TEXT, outline: "none", lineHeight: 1.4 }}
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
                  {suggestions.map((contact, index) => (
                    <li key={contact.initials}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={index === mentionIndex}
                        onMouseDown={(event) => {
                          // Keep the textarea focused while picking.
                          event.preventDefault();
                          insertMention(contact.name);
                        }}
                        className="sa-mention flex w-full items-center gap-2 text-left"
                        style={{ padding: "5px 8px", borderRadius: 6 }}
                      >
                        <Avatar initials={contact.initials} background={contact.background} color={contact.color} />
                        <span style={{ fontSize: 12, color: TEXT }}>{contact.name}</span>
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
