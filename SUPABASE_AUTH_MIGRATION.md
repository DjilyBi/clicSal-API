# 🔐 Migration Supabase Auth - Guide Complet

**Date**: 8 février 2026  
**Status**: ✅ Complété

---

## 📊 Changements Architecturaux

### **Avant (Firebase Phone Auth + Magic Links)**
```
User → Firebase Phone Auth → JWT custom → NestJS → PostgreSQL
```

### **Après (Supabase Auth)**
```
User → Supabase Auth (Google/Apple/Magic Link/Phone) → JWT Supabase → NestJS → PostgreSQL
                                                          ↓
                                                    Webhook sync users
```

---

## 🔄 Modifications Effectuées

### **1. Prisma Schema**

#### Changements User table:
- ✅ Ajout `supabaseId` (référence auth.users de Supabase)
- ❌ Suppression `firebaseUid`
- ✅ `phone` devient nullable (peut être null pour OAuth)
- ✅ `authProvider` simplifié en `supabase` uniquement

#### Suppression:
- ❌ Table `MagicLink` (géré par Supabase)

#### Conservation:
- ✅ Table `UserSession` (multi-device lock reste identique)

---

### **2. Nouveaux Services**

#### **SupabaseService** (`src/auth/supabase.service.ts`)
Service wrapper pour le SDK Supabase:
- `verifyToken()` - Vérifier un JWT Supabase
- `getUserById()` - Récupérer un user Supabase
- `sendMagicLink()` - Envoyer Magic Link par email
- `sendPhoneOTP()` - Envoyer OTP par SMS
- `verifyPhoneOTP()` - Vérifier un code OTP

---

### **3. AuthService Refactoré**

#### Nouvelles méthodes:
```typescript
// Magic Link par email (Supabase gère l'envoi)
await authService.sendMagicLink('user@example.com');

// OTP par téléphone (Supabase gère l'envoi SMS)
await authService.sendPhoneOTP('+221771234567');

// Vérifier OTP
await authService.verifyPhoneOTP(phone, token, deviceId, userAgent);

// Vérifier token Supabase (après OAuth callback)
await authService.verifySupabaseToken(supabaseAccessToken, deviceId, userAgent);

// Sync automatique user Supabase → PostgreSQL
private syncUserFromSupabase(supabaseUser);
```

#### Fonctionnalités conservées:
- ✅ Multi-device lock (UserSession)
- ✅ JWT custom pour sessions backend
- ✅ Logout avec invalidation session

---

### **4. Nouveaux Endpoints API**

#### `/auth/magic-link/send` (POST)
```json
{
  "email": "user@example.com"
}
```
→ Supabase envoie un email avec Magic Link

#### `/auth/phone/send-otp` (POST)
```json
{
  "phone": "+221771234567"
}
```
→ Supabase envoie un SMS avec code OTP

#### `/auth/phone/verify-otp` (POST)
```json
{
  "phone": "+221771234567",
  "token": "123456",
  "deviceId": "device-hash-abc"
}
```
→ Vérifie OTP + Crée session + Sync user

#### `/auth/supabase/verify` (POST)
```json
{
  "supabaseAccessToken": "eyJhbG...",
  "deviceId": "device-hash-abc"
}
```
→ Utilisé après callback OAuth (Google, Apple)

#### `/auth/logout` (POST)
```json
{
  "userId": "uuid",
  "deviceId": "device-hash-abc"
}
```
→ Invalide la session backend

---

### **5. Webhook Supabase → NestJS**

#### **Controller** (`src/auth/supabase-webhook.controller.ts`)

Synchronise automatiquement les users depuis Supabase Auth vers PostgreSQL.

**Configuration Supabase Dashboard:**
1. Aller dans **Database > Webhooks**
2. Create webhook:
   - **Events**: `INSERT`, `UPDATE`, `DELETE` on `auth.users`
   - **URL**: `https://your-api.com/webhooks/supabase/auth`
   - **HTTP Headers**: `x-supabase-signature: [auto-généré]`

**Événements gérés:**
- ✅ `INSERT` → Crée user dans PostgreSQL
- ✅ `UPDATE` → Met à jour user existant
- ✅ `DELETE` → Supprime user (hard delete)

---

## 🛠️ Configuration Requise

### **Variables d'environnement (.env)**

```bash
# Supabase Auth
SUPABASE_URL="https://your-project-ref.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
SUPABASE_WEBHOOK_SECRET="your-webhook-secret-for-signature-verification"

# JWT Backend (pour sessions multi-device)
JWT_SECRET="votre_secret_ultra_securise_minimum_32_caracteres"
JWT_EXPIRES_IN="7d"
```

### **Récupérer les clés Supabase:**
1. Dashboard Supabase → **Settings** → **API**
2. Copier `Project URL` → `SUPABASE_URL`
3. Copier `anon public` → `SUPABASE_ANON_KEY`
4. Copier `service_role` → `SUPABASE_SERVICE_ROLE_KEY`

---

## 🚀 Installation & Migration

### **1. Installer Supabase SDK**
```bash
pnpm install @supabase/supabase-js
```

### **2. Migrer le schema Prisma**
```bash
npx prisma migrate dev --name add_supabase_auth
```

### **3. Configurer Supabase Auth Providers**

#### Dashboard Supabase → **Authentication** → **Providers**

**Enable:**
- ✅ **Email** (Magic Links)
- ✅ **Phone** (SMS OTP via Twilio)
- ✅ **Google OAuth**
- ✅ **Apple OAuth**

**Redirect URLs:**
```
https://clicsal.app/auth/callback
http://localhost:3000/auth/callback (dev)
```

---

## 🔄 Flux d'Authentification

### **Scénario 1: Magic Link Email**
```
1. User entre email → POST /auth/magic-link/send
2. Supabase envoie email avec lien
3. User clique → Redirigé vers frontend /auth/callback?access_token=...
4. Frontend → POST /auth/supabase/verify {supabaseAccessToken, deviceId}
5. Backend vérifie token + Sync user + Crée session
6. Return {accessToken (JWT custom), user}
```

### **Scénario 2: Phone OTP**
```
1. User entre téléphone → POST /auth/phone/send-otp
2. Supabase envoie SMS avec code 6 chiffres
3. User entre code → POST /auth/phone/verify-otp {phone, token, deviceId}
4. Backend vérifie OTP + Sync user + Crée session
5. Return {accessToken (JWT custom), user}
```

### **Scénario 3: Google OAuth**
```
1. User clique "Sign in with Google"
2. Supabase gère OAuth flow
3. Callback → /auth/callback?access_token=...
4. Frontend → POST /auth/supabase/verify {supabaseAccessToken, deviceId}
5. Backend vérifie token + Sync user + Crée session
6. Return {accessToken (JWT custom), user}
```

---

## ⚡ Avantages de Supabase Auth

| Feature | Before (Firebase) | After (Supabase) |
|---------|-------------------|------------------|
| **Magic Links** | ❌ Custom (WhatsApp via Twilio) | ✅ Built-in (Email) |
| **Phone OTP** | ✅ Firebase Phone Auth | ✅ Supabase Phone (Twilio) |
| **Google OAuth** | ❌ À implémenter | ✅ Built-in |
| **Apple OAuth** | ❌ À implémenter | ✅ Built-in |
| **User Management UI** | ❌ Firebase Console | ✅ Supabase Dashboard |
| **Webhooks** | ❌ Manual | ✅ Built-in |
| **Rate Limiting** | ❌ Custom | ✅ Built-in |
| **Email Templates** | ❌ Custom | ✅ Built-in customizable |
| **Row Level Security** | N/A | ✅ Avec policies |

---

## 🔒 Sécurité

### **Multi-Device Lock conservé**
- ✅ `UserSession` table avec `UNIQUE(user_id, device_id)`
- ✅ Un seul device actif par user
- ✅ JWT custom avec device ID dans payload

### **Webhook Signature Verification**
```typescript
verifyWebhookSignature(payload, signature) {
  const expected = crypto
    .createHmac('sha256', SUPABASE_WEBHOOK_SECRET)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  if (signature !== expected) throw new UnauthorizedException();
}
```

---

## 📝 TODO Frontend

### **Next.js Admin Dashboard**
```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Magic Link
await supabase.auth.signInWithOtp({ email });

// Google OAuth
await supabase.auth.signInWithOAuth({ provider: 'google' });

// Phone OTP
await supabase.auth.signInWithOtp({ phone });
await supabase.auth.verifyOtp({ phone, token });
```

### **Flutter Mobile App**
```dart
import 'package:supabase_flutter/supabase_flutter.dart';

final supabase = Supabase.instance.client;

// Google Sign-In
await supabase.auth.signInWithOAuth(Provider.google);

// Phone OTP
await supabase.auth.signInWithOtp(phone: '+221771234567');
await supabase.auth.verifyOTP(
  phone: '+221771234567',
  token: '123456',
  type: OtpType.sms,
);
```

---

## 🎯 Migration Checklist

- [x] ✅ Prisma schema adapté
- [x] ✅ SupabaseService créé
- [x] ✅ AuthService refactoré
- [x] ✅ AuthController mis à jour
- [x] ✅ Webhook controller créé
- [x] ✅ .env.example configuré
- [x] ✅ Multi-device lock conservé
- [ ] ⏳ Tests E2E à écrire
- [ ] ⏳ Frontend Next.js à implémenter
- [ ] ⏳ Flutter app à implémenter
- [ ] ⏳ Configurer Twilio pour Phone OTP dans Supabase
- [ ] ⏳ Customiser email templates Supabase

---

## 📞 Support

Pour questions sur Supabase Auth : **dev@clicsal.app**
