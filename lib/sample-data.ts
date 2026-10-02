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

export const trends = [
  { topic: "Géopolitique de l'eau", count: "2.4k" },
  { topic: "Stoïcisme & burnout", count: "1.8k" },
  { topic: "James Webb", count: "1.2k" },
  { topic: "Prix Goncourt", count: "876" },
  { topic: "Bauhaus & modernité", count: "541" },
];
