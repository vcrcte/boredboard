"use client";

import { useCallback, useEffect, useState } from "react";
import Navbar from "@/components/Navbar";

const WORD_LENGTH = 5;
const MAX_TRIES = 6;

const words = [
  "MONDE", "LIVRE", "NUAGE", "PLAGE",
  "FLEUR", "TABLE", "PORTE", "ROUTE",
  "SUCRE", "VERRE", "CHIEN", "POMME",
  "TERRE", "LAMPE", "TRAIN", "PIANO",
  "NEIGE", "SABLE", "VILLE", "HIVER",
];

const keyboardRows = [
  ["A", "Z", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["Q", "S", "D", "F", "G", "H", "J", "K", "L", "M"],
  ["ENTRER", "W", "X", "C", "V", "B", "N", "⌫"],
];

type LetterState = "correct" | "present" | "absent";

const stateStyles: Record<LetterState, string> = {
  correct: "border-[#1D9E75] bg-[#1D9E75] text-white",
  present: "border-[#C4A94A] bg-[#C4A94A] text-white",
  absent: "border-[#888780] bg-[#888780] text-white",
};

const statePriority: Record<LetterState, number> = { absent: 0, present: 1, correct: 2 };

function pickWord(previous?: string) {
  const candidates = words.filter((word) => word !== previous);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function evaluate(guess: string, answer: string): LetterState[] {
  const result: LetterState[] = Array(WORD_LENGTH).fill("absent");
  const remaining: Record<string, number> = {};

  // Exact matches first, so a repeated letter is only marked "present" as
  // many times as it is still left in the answer.
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (guess[i] === answer[i]) result[i] = "correct";
    else remaining[answer[i]] = (remaining[answer[i]] ?? 0) + 1;
  }
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (result[i] !== "correct" && remaining[guess[i]] > 0) {
      result[i] = "present";
      remaining[guess[i]]--;
    }
  }
  return result;
}

export default function MotFantome() {
  // Picked after mount: a random word chosen during render would differ
  // between the server and the browser.
  const [answer, setAnswer] = useState<string | null>(null);
  const [guesses, setGuesses] = useState<string[]>([]);
  const [current, setCurrent] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setAnswer(pickWord());
  }, []);

  const won = answer !== null && guesses[guesses.length - 1] === answer;
  const lost = !won && guesses.length === MAX_TRIES;
  const finished = won || lost;

  const pressKey = useCallback(
    (key: string) => {
      if (!answer || finished) return;
      setMessage(null);

      if (key === "ENTRER") {
        if (current.length < WORD_LENGTH) {
          setMessage("Il faut 5 lettres.");
          return;
        }
        setGuesses([...guesses, current]);
        setCurrent("");
      } else if (key === "⌫") {
        setCurrent(current.slice(0, -1));
      } else if (current.length < WORD_LENGTH) {
        setCurrent(current + key);
      }
    },
    [answer, finished, current, guesses],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "Enter") {
        // Let Enter activate a focused button (e.g. "Rejouer") instead.
        if (document.activeElement instanceof HTMLButtonElement) return;
        pressKey("ENTRER");
      } else if (event.key === "Backspace") pressKey("⌫");
      else if (/^[a-zA-Z]$/.test(event.key)) pressKey(event.key.toUpperCase());
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [pressKey]);

  const restart = () => {
    setAnswer(pickWord(answer ?? undefined));
    setGuesses([]);
    setCurrent("");
    setMessage(null);
  };

  const results = answer ? guesses.map((guess) => evaluate(guess, answer)) : [];

  // Best known state of each letter, for the keyboard.
  const keyStates: Record<string, LetterState> = {};
  guesses.forEach((guess, row) => {
    guess.split("").forEach((letter, index) => {
      const state = results[row][index];
      if (!keyStates[letter] || statePriority[state] > statePriority[keyStates[letter]]) {
        keyStates[letter] = state;
      }
    });
  });

  const currentTry = Math.min(guesses.length + 1, MAX_TRIES);

  return (
    <div className="flex min-h-screen flex-col bg-[#F5F4F0] font-sans text-[#1C1B2E] antialiased">
      <Navbar />

      <main className="flex flex-1 items-start justify-center px-4 py-8">
        <div className="w-full max-w-[420px] rounded-[16px] border border-[#E8E8E8] bg-white px-4 py-6 sm:px-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h1 className="font-serif text-[22px] leading-tight text-[#1C1B2E]">
                Mot Fantôme
              </h1>
              <p className="mt-1 text-[13px] text-[#888780]">
                Trouve le mot en 6 essais
              </p>
            </div>
            <p className="shrink-0 rounded-full bg-[#EEF0F8] px-3 py-1 text-[12px] font-medium text-[#2A3560]">
              Essai {currentTry}/{MAX_TRIES}
            </p>
          </div>

          <div className="mt-6 flex flex-col items-center gap-1.5" role="grid" aria-label="Grille de jeu">
            {Array.from({ length: MAX_TRIES }, (_, row) => {
              const word = guesses[row] ?? (row === guesses.length ? current : "");
              return (
                <div key={row} role="row" className="flex gap-1.5">
                  {Array.from({ length: WORD_LENGTH }, (_, index) => {
                    const state = results[row]?.[index];
                    const letter = word[index] ?? "";
                    return (
                      <span
                        key={index}
                        role="gridcell"
                        className={`flex h-[52px] w-[52px] items-center justify-center rounded-[8px] border font-serif text-[22px] font-bold uppercase ${
                          state
                            ? stateStyles[state]
                            : letter
                              ? "border-[#888780] text-[#1C1B2E]"
                              : "border-[#E8E8E8] text-[#1C1B2E]"
                        }`}
                      >
                        {letter}
                      </span>
                    );
                  })}
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex min-h-[60px] flex-col items-center justify-center text-center" aria-live="polite">
            {won && (
              <p className="text-[13px] font-medium text-[#1D9E75]">
                Bravo, trouvé en {guesses.length} essai{guesses.length > 1 ? "s" : ""} !
              </p>
            )}
            {lost && (
              <p className="text-[13px] text-[#888780]">
                Perdu. Le mot était{" "}
                <span className="font-serif font-bold text-[#1C1B2E]">{answer}</span>.
              </p>
            )}
            {message && <p className="text-[13px] text-[#C0392B]">{message}</p>}
            {finished && (
              <button
                type="button"
                onClick={restart}
                className="mt-2 rounded-[20px] bg-[#2A3560] px-5 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-[#3D4F8C]"
              >
                Rejouer
              </button>
            )}
          </div>

          <div className="mt-2 flex flex-col gap-1.5">
            {keyboardRows.map((row) => (
              <div key={row[0]} className="flex justify-center gap-1">
                {row.map((key) => {
                  const isWide = key.length > 1 || key === "⌫";
                  const state = keyStates[key];
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => pressKey(key)}
                      disabled={finished}
                      aria-label={key === "⌫" ? "Effacer" : key === "ENTRER" ? "Entrer" : key}
                      className={`flex h-11 items-center justify-center rounded-[6px] border text-[13px] font-medium transition-colors disabled:cursor-not-allowed ${
                        isWide ? "min-w-[52px] flex-[1.6] px-1 text-[11px]" : "min-w-0 flex-1"
                      } ${
                        state
                          ? stateStyles[state]
                          : "border-[#E8E8E8] bg-[#F5F4F0] text-[#1C1B2E] hover:border-[#2A3560]"
                      }`}
                    >
                      {key}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
