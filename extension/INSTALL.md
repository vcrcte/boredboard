# Installer l'extension BoredBoard Music

L'extension détecte ce que tu écoutes sur Spotify Web, Apple Music, Deezer et
YouTube Music, et le partage dans ton feed BoredBoard : depuis l'icône de la
barre d'outils, ou depuis le bouton « 📤 BoredBoard » ajouté au lecteur.

## Avant de commencer

- Le site doit tourner : par défaut l'extension publie sur `http://localhost:3000`
  (`npm run dev`). Pour le site en ligne, remplace `appUrl` dans `config.js` par
  `https://boredboard.vercel.app`, une fois la route `/api/posts/music` déployée.
- Ouvre BoredBoard au moins une fois avec ton compte : c'est cette visite qui crée
  ton profil, nécessaire pour publier.
- Dans le popup, connecte-toi avec l'email et le mot de passe de ton compte
  BoredBoard (l'extension ne peut pas lire la session du site).

## Chrome (et Edge, Brave, Arc)
1. Ouvre chrome://extensions
2. Active "Mode développeur" (toggle en haut à droite)
3. Clique "Charger l'extension non empaquetée"
4. Sélectionne le dossier extension/
5. L'extension apparaît dans ta barre d'outils (épingle-la depuis l'icône puzzle)

## Firefox (121 ou plus récent)
1. Ouvre about:debugging
2. Clique "Ce Firefox"
3. Clique "Charger un module complémentaire temporaire"
4. Sélectionne extension/manifest.json

Le module reste chargé jusqu'à la fermeture de Firefox.

## Safari
Nécessite Xcode. Dans un terminal, depuis la racine du projet :

    xcrun safari-web-extension-converter extension/ --app-name "BoredBoard Music"

Xcode crée un projet d'app qui embarque l'extension : lance-le, puis active
l'extension dans Safari > Réglages > Extensions (et, pendant le développement,
Développement > Autoriser les extensions non signées).

## Si rien n'est détecté

- Recharge l'onglet du lecteur après avoir installé l'extension : les onglets déjà
  ouverts ne la reçoivent pas.
- Lance un titre : sans lecture en cours, seule une page d'album ou de playlist
  ouverte peut être partagée.
