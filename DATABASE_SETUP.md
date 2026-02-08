# 🚀 Configuration de la Base de Données

## Étape 1: Configurer PostgreSQL Local

Vous avez PostgreSQL 17 installé à `/Library/PostgreSQL/17/`.

### Option A: Via pgAdmin4 (Recommandé)
1. Ouvrir pgAdmin4
2. Créer une nouvelle base de données:
   - Nom: `clicsal`
   - Owner: `postgres` (ou votre utilisateur)
3. Noter vos credentials

### Option B: Via Terminal
```bash
# Se connecter à PostgreSQL
/Library/PostgreSQL/17/bin/psql -U postgres

# Créer la base de données et l'utilisateur
CREATE DATABASE clicsal;
CREATE USER clicsal_user WITH ENCRYPTED PASSWORD 'votre_mot_de_passe_securise';
GRANT ALL PRIVILEGES ON DATABASE clicsal TO clicsal_user;

# Activer l'extension PostGIS (pour géolocalisation)
\c clicsal
CREATE EXTENSION IF NOT EXISTS postgis;
\q
```

## Étape 2: Configurer le fichier .env

Le fichier `.env` a été créé automatiquement. **Mettez à jour votre DATABASE_URL** :

```bash
# Éditer .env
nano .env

# Remplacer cette ligne:
DATABASE_URL="postgresql://user:password@localhost:5432/clicsal"

# Par vos vraies credentials, exemple:
DATABASE_URL="postgresql://postgres:votre_mot_de_passe@localhost:5432/clicsal"
# OU si vous avez créé clicsal_user:
DATABASE_URL="postgresql://clicsal_user:votre_mot_de_passe@localhost:5432/clicsal"
```

## Étape 3: Installer les dépendances

```bash
cd /Users/djilybi/Documents/clicrek/clicsal/Api-clicsal
pnpm install
```

## Étape 4: Exécuter la migration Prisma

Une fois le .env configuré avec vos vrais credentials :

```bash
# Générer le client Prisma
pnpm prisma generate

# Créer toutes les tables dans la base de données
pnpm prisma migrate dev --name initial_schema

# Optionnel: Ouvrir Prisma Studio pour voir les tables
pnpm prisma studio
# Accessible sur http://localhost:5555
```

## ✅ Vérification

Après la migration, vous devriez avoir **16 tables** créées :

### Tables d'authentification
- ✅ `users` - Utilisateurs avec supabaseId
- ✅ `user_sessions` - Sessions multi-device

### Tables de gyms
- ✅ `gyms` - Salles de sport
- ✅ `gym_staff` - Personnel des salles

### Tables d'accès
- ✅ `memberships` - Abonnements
- ✅ `session_passes` - Pass journée/semaine
- ✅ `access_codes` - QR codes dynamiques
- ✅ `check_ins` - Entrées/sorties

### Tables de paiements
- ✅ `payments` - Transactions (Wave, OM, Cash)
- ✅ `products` - Produits à vendre
- ✅ `product_sales` - Ventes

### Autres
- ✅ Tables d'enums et relations

## 🐛 Dépannage

### Erreur "Connection refused"
```bash
# Vérifier que PostgreSQL est démarré
/Library/PostgreSQL/17/bin/pg_ctl -D /Library/PostgreSQL/17/data status

# Si arrêté, démarrer (peut nécessiter sudo):
sudo /Library/PostgreSQL/17/bin/pg_ctl -D /Library/PostgreSQL/17/data start
```

### Erreur "Permission denied"
Utilisez pgAdmin4 ou demandez les droits sudo :
```bash
sudo -u postgres /Library/PostgreSQL/17/bin/psql
```

### Erreur "database does not exist"
Créez la base d'abord via pgAdmin4 ou psql.

### Vérifier la connexion
```bash
# Test rapide
pnpm prisma db push --skip-generate
```

## 📌 Prochaines étapes

Une fois la migration réussie :

1. ✅ Committer les fichiers de migration sur `develop`
2. ✅ Tester les endpoints avec Postman/Thunder Client
3. ✅ Pousser `develop` vers GitHub
4. ✅ Continuer le développement sur `develop`
5. ✅ Merger vers `main` quand la feature est stable

Voir [WORKFLOWS.md](./WORKFLOWS.md) pour le workflow Git complet.
