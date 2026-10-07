import Link from "next/link";

export default function NotFound() {
  return (
    <main
      className="page-enter flex min-h-screen flex-col items-center justify-center px-5 text-center"
      style={{ background: "#F5F1E8" }}
    >
      <p style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 80, lineHeight: 1, color: "rgba(28,26,21,0.06)" }}>
        404
      </p>
      <h1 className="mt-4" style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 28, fontWeight: 400, color: "#1C1A15" }}>
        Page introuvable.
      </h1>
      <p className="mt-2" style={{ fontSize: 13, color: "rgba(28,26,21,0.4)" }}>
        Cette page n&apos;existe pas ou a été déplacée.
      </p>
      <Link href="/" className="bb-btn-primary mt-6">
        Retour à l&apos;accueil
      </Link>
    </main>
  );
}
