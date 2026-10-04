// Placeholder social data shown on the dashboard and the profile until the
// matching features (follows, notifications, trends) are backed by Supabase.

export const avatarTones = [
  { background: "#E1F5EE", color: "#0F6E56" },
  { background: "#FAECE7", color: "#993C1D" },
  { background: "#FAEEDA", color: "#854F0B" },
  { background: "#EAF3DE", color: "#3B6D11" },
  { background: "#FBEAF0", color: "#993556" },
  { background: "#EEEDFE", color: "#534AB7" },
];

export const contacts = [
  { initials: "SA", name: "Sophie A.", tags: "Géopo · Histoire", online: true, ...avatarTones[0] },
  { initials: "MK", name: "Marc K.", tags: "Philo · Art", online: true, ...avatarTones[1] },
  { initials: "LR", name: "Léa R.", tags: "Musique", online: false, ...avatarTones[2] },
  { initials: "JD", name: "Jules D.", tags: "Livres · Philo", online: false, ...avatarTones[3] },
  { initials: "NB", name: "Nina B.", tags: "Science · Podcast", online: true, ...avatarTones[4] },
];

export const notifications = [
  { text: "Sophie a commenté ton partage", time: "8 min", unread: true },
  { text: "43 personnes ont répondu au quiz", time: "22 min", unread: true },
  { text: "Nina te suit maintenant", time: "3h", unread: false },
];

// "Who is online" in the dashboard: simulated until presence is tracked.
export const onlineNow = [
  { ...contacts[0], activity: "lit Le Monde" },
  { ...contacts[1], activity: "dans le dashboard" },
  { ...contacts[4], activity: "écoute Spotify" },
];

export const listeningNow = [
  { ...contacts[2], track: "Nespole", artist: "Floating Points" },
  { ...contacts[1], track: "Says", artist: "Nils Frahm" },
  { ...contacts[4], track: "Gymnopédie n°1", artist: "Erik Satie" },
];

export const readingNow = [
  { reader: contacts[3], firstName: "Jules", title: "Sapiens", spine: "#EEEDFE" },
  { reader: contacts[2], firstName: "Léa", title: "Les Années", spine: "#E1F5EE" },
  { reader: contacts[1], firstName: "Marc", title: "L'Étranger", spine: "#FAEEDA" },
  { reader: contacts[4], firstName: "Nina", title: "Le Problème à trois corps", spine: "#FBEAF0" },
];

export const discussions = [
  {
    author: contacts[1],
    excerpt: "Le parallèle avec 1996 est frappant — même si les rapports de force ont radicalement changé.",
    article: "Détroit de Taïwan : une nouvelle grammaire de la tension",
  },
  {
    author: contacts[0],
    excerpt: "Marc Aurèle en pleine crise d'attention, ça fonctionne étonnamment bien.",
    article: "Le stoïcisme comme antidote au monde hyperconnecté",
  },
  {
    author: contacts[4],
    excerpt: "L'épisode sur l'eau est le meilleur de la saison, de loin.",
    article: "L'eau, nouvelle arme géopolitique",
  },
];

export const recentActivity = [
  { icon: "🎵", text: "Léa a partagé « Nespole »", time: "5 min" },
  { icon: "📖", text: "Jules a commencé « Sapiens »", time: "12 min" },
  { icon: "❤️", text: "Marc a liké ton article", time: "18 min" },
  { icon: "🔗", text: "Sophie a partagé un article", time: "32 min" },
  { icon: "📖", text: "Nina a terminé « L'Étranger »", time: "1h" },
];

export const trends = [
  { topic: "Géopolitique de l'eau", count: "2.4k" },
  { topic: "Stoïcisme & burnout", count: "1.8k" },
  { topic: "James Webb", count: "1.2k" },
  { topic: "Prix Goncourt", count: "876" },
  { topic: "Bauhaus & modernité", count: "541" },
];
