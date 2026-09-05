# Déployer Dream Love sur Render

Le code est déjà prêt pour Render sans aucune modification : `PORT` est lu depuis
l'environnement, les cookies de session s'adaptent automatiquement au HTTPS
(`trust proxy` + `secure` en production), les appels API et Socket.io sont en
same-origin (aucune URL en dur vers `localhost`), et `.env` n'est jamais commité
dans le repo.

## 1. Avant de déployer (sécurité)

- **Change `ADMIN_USER` / `ADMIN_PASS`** — actuellement `admin` / `admin` en local,
  à changer pour un vrai mot de passe avant d'être public.
- **Fais tourner les identifiants MongoDB et Cloudinary** s'ils ont un jour été
  partagés en clair (chat, capture d'écran, etc.) — génère un nouveau mot de passe
  Atlas et une nouvelle clé API Cloudinary, et ne les mets que dans les variables
  d'environnement Render, jamais dans le code.
- **MongoDB Atlas → Network Access** : ajoute `0.0.0.0/0` (autoriser depuis
  n'importe où). Render (plans Free/Starter) n'a pas d'IP de sortie fixe, donc
  whitelister une IP précise ne fonctionnera pas.

## 2. Créer le Web Service sur Render

1. Sur [render.com](https://render.com) → **New +** → **Web Service**
2. Connecte ton compte GitHub → sélectionne le repo `borelkamsu/dreamlove`
3. Configuration :
   - **Name** : `dream-love` (ou ce que tu veux)
   - **Region** : la plus proche de tes utilisateurs
   - **Branch** : `main`
   - **Runtime** : Node
   - **Build Command** : `npm install`
   - **Start Command** : `npm start`
   - **Instance Type** : Free (pour tester) ou Starter (recommandé en prod — le
     plan gratuit met le service en veille après inactivité, ce qui casse les
     sockets ouverts et ajoute un délai de démarrage à froid)

## 3. Variables d'environnement (Render → Environment)

À ajouter manuellement dans le dashboard Render (elles ne sont pas dans le repo,
`.env.example` sert de modèle) :

| Clé | Valeur |
|---|---|
| `NODE_ENV` | `production` |
| `MONGODB_URI` | ton URI Atlas |
| `CLOUDINARY_URL` | ton URL Cloudinary |
| `SESSION_SECRET` | une longue chaîne aléatoire (ex: `openssl rand -hex 32`) |
| `ADMIN_USER` | ton identifiant admin |
| `ADMIN_PASS` | ton mot de passe admin |

Ne mets **pas** `PORT` — Render l'injecte automatiquement et le code le lit déjà
(`process.env.PORT || 3000`).

## 4. Déployer

Clique **Create Web Service**. Render build et démarre automatiquement, et
redéploiera à chaque `git push` sur `main`.

## 5. Vérification post-déploiement

- Teste `https://ton-app.onrender.com/health` → doit renvoyer `{"ok":true}`
- Teste inscription, connexion, upload de photo (Cloudinary), Découvrir, chat en
  temps réel (Socket.io), et `/admin`
- Le manifest PWA et le service worker fonctionnent automatiquement sur le
  nouveau domaine, sans changement de chemin

## Astuce : health check Render

Dans les paramètres du Web Service, tu peux définir `/health` comme **Health
Check Path** — Render l'utilisera pour vérifier que le service est bien
opérationnel après chaque déploiement.
