# ⚡ Quick Start - ClicSal API

Guide rapide pour démarrer le projet en 5 minutes.

---

## 📋 Prérequis

Avant de commencer, assurez-vous d'avoir :

- ✅ **Node.js** >= 18.x → [Télécharger](https://nodejs.org/)
- ✅ **pnpm** >= 8.x → `npm install -g pnpm`
- ✅ **Compte Supabase** → [Créer gratuitement](https://supabase.com/)
- ✅ **Git** configuré → `git --version`

---

## 🚀 Installation en 5 Étapes

### 1️⃣ Cloner le Projet

```bash
git clone https://github.com/DjilyBi/clicSal-API.git
cd clicSal-API
```

### 2️⃣ Installer les Dépendances

```bash
pnpm install
```

⏱️ **Temps estimé** : 2-3 minutes

---

### 3️⃣ Configurer l'Environnement

```bash
cp .env.example .env
```

Ouvrir `.env` et remplir **au minimum** :

```env
# BASE DE DONNÉES (Supabase)
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres"

# JWT (Générer un secret aléatoire)
JWT_SECRET="votre_secret_securise_32_caracteres_minimum"

# FRONTEND (Pour Magic Links)
FRONTEND_URL="http://localhost:3001"
```

#### 🔑 Obtenir DATABASE_URL depuis Supabase :

1. Aller sur [app.supabase.com](https://app.supabase.com/)
2. Créer un nouveau projet
3. Aller dans **Settings** → **Database**
4. Copier la **Connection String (URI)**

---

### 4️⃣ Setup Base de Données

```bash
# Générer le client Prisma
pnpm prisma generate

# Exécuter la migration
pnpm prisma migrate deploy
```

Si erreur, exécuter manuellement la migration :

```bash
# Copier le contenu de prisma/migrations/001_initial_setup.sql
# Et l'exécuter dans le SQL Editor de Supabase
```

---

### 5️⃣ Lancer le Serveur

```bash
pnpm start:dev
```

✅ **Serveur lancé !**

```
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   🏋️  ClicSal API - Gym Management Platform         ║
║                                                       ║
║   🚀 Server running on: http://localhost:3000        ║
║   📚 Swagger docs: http://localhost:3000/api/docs    ║
║   🌍 Environment: development                        ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
```

---

## 🧪 Tester l'API

### 1. Ouvrir Swagger

👉 **http://localhost:3000/api/docs**

### 2. Tester Magic Link

```bash
curl -X POST http://localhost:3000/api/v1/auth/magic-link/send \
  -H "Content-Type: application/json" \
  -d '{"phone": "+221771234567"}'
```

**Réponse attendue** :

```json
{
  "message": "Magic link envoyé",
  "magicLinkUrl": "http://localhost:3001/auth/verify?token=ABC123..."
}
```

### 3. Vérifier le Token

Copier le `token` de la réponse précédente :

```bash
curl http://localhost:3000/api/v1/auth/verify?token=ABC123...
```

**Réponse attendue** :

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid-123",
    "phone": "+221771234567",
    "role": "member"
  }
}
```

✅ **Authentification fonctionnelle !**

---

## 🔧 Commandes Utiles

| Commande | Description |
|----------|-------------|
| `pnpm start:dev` | Lancer en mode développement (hot-reload) |
| `pnpm build` | Compiler pour production |
| `pnpm start:prod` | Lancer en production |
| `pnpm prisma studio` | Interface visuelle de la DB |
| `pnpm test` | Lancer les tests unitaires |
| `pnpm lint` | Vérifier le code |
| `pnpm format` | Formatter le code |

---

## 🐛 Problèmes Courants

### ❌ Erreur : "Cannot connect to database"

**Solution** :
1. Vérifier que `DATABASE_URL` est correct dans `.env`
2. Tester la connexion depuis Supabase Dashboard
3. Vérifier le firewall/VPN

### ❌ Erreur : "Port 3000 already in use"

**Solution** :
```bash
# Trouver le processus
lsof -i :3000

# Killer le processus
kill -9 [PID]

# Ou changer le port dans .env
PORT=3001
```

### ❌ Erreur : "Prisma Client not generated"

**Solution** :
```bash
pnpm prisma generate
```

---

## 📚 Prochaines Étapes

Maintenant que l'API fonctionne, vous pouvez :

1. ✅ **Lire la documentation complète** → [README.md](./README.md)
2. ✅ **Comprendre les workflows** → [WORKFLOWS.md](./WORKFLOWS.md)
3. ✅ **Implémenter les modules** :
   - [ ] Module Check-ins (QR Code scanning)
   - [ ] Module Memberships (Abonnements)
   - [ ] Module Payments (Wave/Orange Money)
   - [ ] WebSocket Gateway (Real-time)
   - [ ] Dashboard Analytics

4. ✅ **Déployer** :
   - [ ] Railway (le plus simple)
   - [ ] Render
   - [ ] VPS Hetzner

---

## 💡 Besoin d'Aide ?

- 📖 **Documentation** : [README.md](./README.md)
- 🐛 **Issues** : [GitHub Issues](https://github.com/DjilyBi/clicSal-API/issues)
- 💬 **Contact** : dev@clicsal.app

---

## 🎯 Checklist MVP

Utilisez cette checklist pour suivre votre progression :

### Backend (API)
- [x] ✅ Setup projet NestJS
- [x] ✅ Schema Prisma
- [x] ✅ Migration Supabase
- [x] ✅ Auth Magic Links
- [ ] ⏳ Module Check-ins (Entry/Exit)
- [ ] ⏳ Module Memberships
- [ ] ⏳ Module Session Passes
- [ ] ⏳ QR Code dynamique (Refresh cron)
- [ ] ⏳ Integration Wave API
- [ ] ⏳ Integration Orange Money
- [ ] ⏳ WebSocket Gateway
- [ ] ⏳ Dashboard Analytics

### Frontend (Next.js)
- [ ] ⏳ Setup Next.js App Router
- [ ] ⏳ Page authentification
- [ ] ⏳ Dashboard gérant
- [ ] ⏳ Scan QR interface
- [ ] ⏳ Live Feed temps réel

### Mobile (Flutter)
- [ ] ⏳ Setup Flutter projet
- [ ] ⏳ QR Code display
- [ ] ⏳ Auth flow
- [ ] ⏳ Membership management

---

**🚀 Bon développement avec ClicSal !**
