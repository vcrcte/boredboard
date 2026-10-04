import Link from "next/link";

export default function NotFound() {
  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center px-5 text-center"
      style={{ background: "#F7F4EE", fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}
    >
      <p style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 80, lineHeight: 1, color: "rgba(28,26,21,0.08)" }}>
        404
      </p>
      <h1 className="mt-4" style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 28, fontWeight: 400, color: "#1C1A15" }}>
        Page introuvable.
      </h1>
      <p className="mt-2" style={{ fontSize: 13, color: "rgba(28,26,21,0.4)" }}>
        Cette page n&apos;existe pas ou a été déplacée.
      </p>
      <Link
        href="/"
        className="mt-6 transition hover:brightness-125"
        style={{ background: "#2A3560", color: "#F7F4EE", borderRadius: 20, padding: "10px 24px", fontSize: 13, fontWeight: 500 }}
      >
        Retour à l&apos;accueil
      </Link>
    </main>
  );
}
