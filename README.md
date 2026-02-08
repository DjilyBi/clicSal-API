# 🏋️ ClicSal API - Gym Management SaaS

> **Plateforme complète de gestion de salles de sport pour l'Afrique de l'Ouest**  
> Anti-fraude • Paiements mobiles • Contrôle d'accès QR Code dynamique

[![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)](https://nestjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

---

## 📋 Table des Matières

- [🎯 Vision du Projet](#-vision-du-projet)
- [✨ Fonctionnalités Clés](#-fonctionnalités-clés)
- [🏗️ Architecture Technique](#️-architecture-technique)
- [🚀 Installation & Setup](#-installation--setup)
- [📊 Schéma de Base de Données](#-schéma-de-base-de-données)
- [🔐 Authentification](#-authentification)
- [💳 Paiements Mobiles](#-paiements-mobiles)
- [📡 API Documentation](#-api-documentation)
- [🧪 Tests](#-tests)
- [🌍 Déploiement](#-déploiement)

---

## 🎯 Vision du Projet

**ClicSal** est un SaaS B2B qui digitalise la gestion des salles de sport au Sénégal et en Afrique de l'Ouest. 

### Problèmes Résolus :
- ❌ **Fraude à l'entrée** : QR codes partagés, screenshots
- ❌ **Paiements inefficaces** : Cash non tracé, carnets papier
- ❌ **Contrôle d'accès manuel** : Staff débordé, erreurs humaines

### Solutions Apportées :
- ✅ **QR Codes Dynamiques** : Refresh automatique toutes les 1h
- ✅ **Paiements Digitaux** : Wave + Orange Money intégrés
- ✅ **Dashboard Temps Réel** : WebSockets pour suivi live
- ✅ **Magic Links WhatsApp** : Zéro friction pour les clients

---

## ✨ Fonctionnalités Clés

### 🔐 Authentification Multi-Canal
- **Magic Link WhatsApp** : Click pour se connecter (sans code)
- **Google OAuth** : Connexion sociale
- **Apple Sign In** : Connexion iOS native
- **Firebase Auth** : Backend sécurisé

### 🎫 Gestion des Accès
- **Memberships** : Abonnements mensuels/annuels
- **Session Passes** : Pass ponctuels (1h, 2h, demi-journée)
- **QR Codes Dynamiques** : Refresh toutes les 1h (anti-screenshot)
- **Check-in Entry/Exit** : Traçabilité complète

### 💰 Paiements Locaux
- **Wave API** : Paiement mobile #1 au Sénégal
- **Orange Money** : Alternative populaire
- **Webhooks** : Validation instantanée des transactions

### 📊 Dashboard Gérant
- **Live Feed** : Qui est dans la salle en temps réel
- **Analytics** : CA du jour, taux de remplissage
- **Alertes** : Abonnements expirant sous 7 jours

---

## 🏗️ Architecture Technique

### Stack Backend
```
┌─────────────────────────────────────────┐
│        NestJS API (TypeScript)          │
├─────────────────────────────────────────┤
│  Prisma ORM → PostgreSQL (Supabase)    │
├─────────────────────────────────────────┤
│  Socket.io (WebSockets Real-time)      │
├─────────────────────────────────────────┤
│  Firebase Admin SDK (Auth)             │
├─────────────────────────────────────────┤
│  Wave API + Orange Money (Paiements)   │
└─────────────────────────────────────────┘
```

### Bases de Données
- **PostgreSQL** : Base principale (Supabase)
- **PostGIS** : Extension géospatiale (salles à proximité)
- **Prisma** : ORM type-safe

### Performance Targets
- ⚡ Check-in validation : **< 500ms**
- ⚡ QR code generation : **< 200ms**
- ⚡ WebSocket latency : **< 100ms**

---

## 🚀 Installation & Setup

### Prérequis
- Node.js >= 18.x
- PostgreSQL >= 14.x (ou compte Supabase)
- pnpm >= 8.x (recommandé)

### 1. Cloner le Projet
```bash
git clone https://github.com/DjilyBi/clicsal-API.git
cd clicsal-API
```

### 2. Installer les Dépendances
```bash
pnpm install
```

### 3. Configuration Environnement
```bash
cp .env.example .env
```

Remplir les variables :
```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/clicsal"

# Firebase
FIREBASE_PROJECT_ID="clicsal-prod"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----..."
FIREBASE_CLIENT_EMAIL="firebase-adminsdk@clicsal.iam.gserviceaccount.com"

# Wave API
WAVE_API_KEY="wave_live_xxxx"
WAVE_SECRET_KEY="sk_live_xxxx"

# Orange Money
OM_API_KEY="om_xxxx"
OM_MERCHANT_ID="xxxx"

# JWT
JWT_SECRET="votre_secret_ultra_securise"
JWT_EXPIRES_IN="7d"

# Frontend URL (pour Magic Links)
FRONTEND_URL="https://clicsal.app"

# WhatsApp Business API (Twilio)
TWILIO_ACCOUNT_SID="ACxxxx"
TWILIO_AUTH_TOKEN="xxxx"
TWILIO_WHATSAPP_NUMBER="+14155238886"
```

### 4. Setup Base de Données
```bash
# Générer le Prisma Client
pnpm prisma generate

# Exécuter les migrations
pnpm prisma migrate deploy

# (Optionnel) Seed avec données de test
pnpm prisma db seed
```

### 5. Lancer en Dev
```bash
pnpm start:dev
```

API disponible sur : **http://localhost:3000**  
Swagger docs : **http://localhost:3000/api/docs**

---

## 📊 Schéma de Base de Données

### Entités Principales

```
users ─────┬──── memberships ──── access_codes ──── check_ins
           │                                            │
           ├──── session_passes                        │
           │                                            │
           └──── gyms (owner) ───────────────────────────┘
```

### Tables Critiques

**`users`** : Membres, staff, gérants
```sql
- id (UUID)
- phone (unique, format +221...)
- role (member | staff | owner)
- auth_provider (firebase_phone | google | apple)
```

**`access_codes`** : QR Codes dynamiques
```sql
- code_value (unique, refreshed hourly)
- share_token (permanent pour Magic Link)
- expires_at (expiration du pass/membership)
```

**`check_ins`** : Traçabilité entrées/sorties
```sql
- type (entry | exit)
- validated_by_staff_id (nullable si exit auto)
- scanned_at (timestamp)
```

**Voir le schéma complet** : [prisma/schema.prisma](./prisma/schema.prisma)

---

## 🔐 Authentification

### Magic Link WhatsApp (Recommandé)

**Flow complet** :
```typescript
// 1. User demande un Magic Link
POST /auth/magic-link/send
{
  "phone": "+221771234567"
}

// 2. Backend génère token et envoie WhatsApp
// Message: "Connectez-vous ici: https://clicsal.app/auth/verify?token=ABC123"

// 3. User clique sur le lien
GET /auth/verify?token=ABC123

// 4. Backend valide et retourne JWT
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { ... }
}
```

### Firebase Auth (Alternative)
```typescript
// Frontend envoie Firebase ID Token
POST /auth/firebase
{
  "idToken": "eyJhbGciOiJSUzI1NiIsImtpZCI6..."
}

// Backend vérifie via Firebase Admin SDK
const decodedToken = await admin.auth().verifyIdToken(idToken);
```

---

## 💳 Paiements Mobiles

### Wave Payment Flow

```typescript
// 1. Initier le paiement
POST /payments/wave/initiate
{
  "amount": 5000,
  "currency": "XOF",
  "phone": "+221771234567",
  "type": "membership",
  "referenceId": "membership-uuid-123"
}

// 2. Wave webhook (callback automatique)
POST /webhooks/wave
{
  "status": "successful",
  "transaction_id": "wave_tx_12345",
  "amount": 5000
}

// 3. Backend génère QR code et envoie par WhatsApp
```

### Orange Money (Similaire)
```typescript
POST /payments/orange-money/initiate
```

---

## 📡 API Documentation

### Endpoints Principaux

#### Authentification
```
POST   /auth/magic-link/send      - Envoyer Magic Link
GET    /auth/verify                - Vérifier Magic Link
POST   /auth/firebase              - Login via Firebase
POST   /auth/google                - Login via Google
POST   /auth/apple                 - Login via Apple
```

#### Check-ins
```
GET    /check-ins                  - Liste check-ins
POST   /check-ins/scan             - Scanner QR code entrée
POST   /check-ins/exit             - Scanner QR code sortie
GET    /check-ins/live/:gymId      - Live feed d'une salle
```

#### Memberships
```
GET    /memberships                - Mes abonnements
POST   /memberships                - Créer abonnement
PATCH  /memberships/:id            - Modifier abonnement
GET    /memberships/:id/qr         - Obtenir QR code
```

#### Gyms
```
GET    /gyms                       - Liste salles
GET    /gyms/nearby                - Salles à proximité
GET    /gyms/:id                   - Détails salle
POST   /gyms                       - Créer salle (owner)
```

#### Dashboard
```
GET    /dashboard/stats            - Stats générales
GET    /dashboard/live-feed/:gymId - Entrées temps réel
GET    /dashboard/revenue/:gymId   - CA du jour
```

### Documentation Interactive
Accéder à Swagger UI : **http://localhost:3000/api/docs**

---

## 🧪 Tests

### Lancer les Tests
```bash
# Unit tests
pnpm test

# E2E tests
pnpm test:e2e

# Coverage
pnpm test:cov
```

### Tests Critiques à Valider

✅ **Check-in < 500ms** :
```typescript
it('should validate QR code in less than 500ms', async () => {
  const start = Date.now();
  await checkInService.validateQRCode('QR_CODE_123');
  expect(Date.now() - start).toBeLessThan(500);
});
```

✅ **QR Code Anti-Replay** :
```typescript
it('should reject reused QR code', async () => {
  await checkInService.scan('QR_CODE_123');
  await expect(checkInService.scan('QR_CODE_123'))
    .rejects.toThrow('Already checked in');
});
```

---

## 🌍 Déploiement

### Option 1 : Railway (Recommandé MVP)
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Deploy
railway up
```

**Coût estimé** : $5-20/mois

### Option 2 : Render
```bash
# Créer render.yaml
services:
  - type: web
    name: clicsal-api
    env: docker
    plan: starter
```

**Coût estimé** : $7/mois

### Option 3 : VPS (Hetzner)
```bash
# Setup avec Docker
docker-compose up -d
```

**Coût estimé** : €4.5/mois

---

## 📞 Support & Contribution

- **Documentation** : [docs.clicsal.app](https://docs.clicsal.app)
- **Issues** : [GitHub Issues](https://github.com/DjilyBi/clicsal-API/issues)
- **Email** : dev@clicsal.app

---

## 📄 License

MIT License - voir [LICENSE](./LICENSE)

---

## 🙏 Crédits

Construit avec ❤️ pour révolutionner le fitness en Afrique.

**Powered by** :
- [NestJS](https://nestjs.com/)
- [Prisma](https://www.prisma.io/)
- [Supabase](https://supabase.com/)
- [Firebase](https://firebase.google.com/)
