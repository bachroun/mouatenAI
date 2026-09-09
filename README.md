# Nadhafa — déploiement

Suivez ces étapes dans l'ordre. Comptez environ 10-15 minutes, aucune compétence
technique avancée requise. Tout est gratuit sur les paliers d'essai.

## 1. Créer la base de données (Supabase)

1. Allez sur https://supabase.com et créez un compte gratuit.
2. Cliquez sur **New project**, donnez-lui un nom (ex. `nadhafa`), choisissez
   un mot de passe de base de données et une région proche (Europe).
3. Une fois le projet créé, ouvrez **SQL Editor** (menu de gauche) > **New query**.
4. Collez le contenu du fichier `supabase-setup.sql` fourni dans ce dossier,
   puis cliquez sur **Run**. Cela crée la table `reports` et les autorisations.
5. Allez dans **Project Settings > API**. Notez deux valeurs :
   - **Project URL** (ex. `https://xxxxx.supabase.co`)
   - **anon public** key (une longue clé qui commence par `eyJ...`)

## 2. Configurer le projet

1. Dans ce dossier, dupliquez `.env.example` en un fichier nommé `.env`.
2. Collez-y vos deux valeurs Supabase :
   ```
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```

## 3. Déployer sur Vercel (le plus simple)

**Option A — sans terminal, avec un compte GitHub**
1. Créez un dépôt sur GitHub et déposez-y tout le contenu de ce dossier
   (ne déposez pas le fichier `.env`, il est ignoré automatiquement).
2. Allez sur https://vercel.com, connectez-vous avec GitHub, cliquez sur
   **Add New > Project**, sélectionnez votre dépôt.
3. Dans les réglages du projet Vercel, section **Environment Variables**,
   ajoutez `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` avec vos valeurs.
4. Cliquez sur **Deploy**. Vercel détecte Vite automatiquement.
5. Après ~1 minute, vous obtenez une URL publique du type
   `nadhafa-xxxx.vercel.app` — c'est votre application en ligne.

**Option B — avec un terminal**
```bash
npm install
npm install -g vercel
vercel
```
Suivez les invites ; ajoutez les deux variables d'environnement quand demandé
(ou via `vercel env add`), puis `vercel --prod` pour la mise en ligne finale.

## 4. Tester

- Ouvrez l'URL fournie sur votre téléphone (le HTTPS de Vercel active le GPS).
- Publiez un signalement test, changez son statut, ouvrez le lien depuis un
  autre appareil pour vérifier que tout le monde voit les mêmes données.

## Notes importantes

- **Sécurité** : les règles SQL fournies ouvrent la lecture/écriture à tout
  le monde (pratique pour une démo publique). Avant un vrai lancement,
  ajoutez une authentification Supabase et restreignez les policies.
- **Photos** : elles sont stockées en base64 directement dans la base de
  données — simple à mettre en place, mais moins efficace à grande échelle
  qu'un vrai stockage de fichiers (Supabase Storage). Pour un usage pilote
  avec quelques centaines de signalements, ça suffit largement.
- **Aperçu IA** : la transformation "avant/après propre" reste une
  simulation visuelle locale (filtres canvas), pas une vraie génération
  d'image. Pour un rendu réaliste, il faudrait brancher un modèle
  d'édition d'image générative côté serveur.
