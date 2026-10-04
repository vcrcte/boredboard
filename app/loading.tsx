export default function Loading() {
  return (
    <div role="status" aria-label="Chargement" className="flex min-h-screen items-center justify-center" style={{ background: "#F7F4EE" }}>
      <div
        className="animate-spin"
        style={{ width: 32, height: 32, border: "2px solid rgba(0,0,0,0.08)", borderTopColor: "#2A3560", borderRadius: "50%" }}
      />
    </div>
  );
}
