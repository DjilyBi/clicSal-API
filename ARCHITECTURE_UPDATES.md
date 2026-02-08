# 📚 ARCHITECTURE UPDATES - ClicSal API v1

Document récapitulatif des derniers ajouts et clarifications.

**Date** : 8 février 2026
**Version** : 1.0

---

## 🔐 1. MULTI-DEVICE LOGIN LOCK (Session Management)

### Problème Résolu
Un utilisateur ne peut être connecté que sur **1 device à la fois**.

### Implémentation

**Table `user_sessions`** :
```sql
user_sessions {
  id uuid pk
  user_id uuid fk -> users
  device_id varchar (hash du User-Agent + IP)
  token varchar unique (JWT)
  expires_at timestamp
  created_at timestamp
}
```

**Unique constraint** : `UNIQUE(user_id, device_id)` → Force la déconnexion de l'ancien device

### Flow : Connexion depuis Device #2 (Mobile)

```
1. User ouvre l'app mobile (Device #2)
2. Authenticate via Magic Link
3. backend.deviceId = hash(User-Agent + IP)

4. SessionService.createSession(userId, deviceId)
   ↓
   DELETE FROM user_sessions 
   WHERE user_id = X AND device_id = hash(deviceId)
   ↓
   INSERT INTO user_sessions 
   VALUES (new_token, userId, deviceId)

5. Device #1 (Web) essaie d'utiliser l'old token
   ↓
   JWT strategy valide mais token n'existe plus en DB
   ↓
   401 Unauthorized "Session terminée sur autre appareil"

6. ✅ User connecté UNIQUEMENT sur Device #2
```

**Token Expiry** : 7 jours (peut être changé via `.env`)

---

## 📊 2. DASHBOARD GÉRANT - Nouvelles Fonctionnalités

### Endpoints Implémentés

#### 2.1 Liste des Membres (avec filtres)

```typescript
GET /api/v1/dashboard/members?filter=active&limit=50&offset=0&search="Ahmed"

Query Params:
- filter: "all" | "active" | "expired" | "expiring_soon" (DefaultL "all")
- search: string (nom/phone)
- limit: number (default: 50)
- offset: number (default: 0)

Response:
{
  "members": [
    {
      "id": "uuid-123",
      "firstName": "Ahmed",
      "lastName": "Sall",
      "phone": "+221771234567",
      "photoUrl": "..."
      "membership": {
        "id": "uuid-mem",
        "type": "monthly",
        "status": "active",
        "startDate": "2026-01-01",
        "endDate": "2026-02-08",
        "daysUntilExpiry": 5  // ← Calculé automatiquement
      },
      "lastCheckIn": {
        "scannedAt": "2026-02-07T10:30:00Z",
        "type": "entry"
      },
      "totalSpent": 45000  // XOF
    }
  ],
  "total": 127,
  "page": 1
}
```

**Use Cases**:
- **active** : Voir qui a un abonnement valide
- **expired** : Pour relance (renouvellement)
- **expiring_soon** : Alertes J-7 : Offres de réabonnement
- **search** : Trouver un client spécifique

---

#### 2.2 Historique des Paiements

```typescript
GET /api/v1/dashboard/payments?type=membership&period=today&status=paid

Query Params:
- type: "membership" | "session_pass" | "product"
- period: "today" | "week" | "month" (default: "today")
- status: "pending" | "paid" | "failed"
- limit: 50, offset: 0

Response:
{
  "payments": [
    {
      "id": "uuid",
      "user": { "id", "firstName", "phone" },
      "paymentType": "membership",
      "amount": 15000,
      "method": "wave",
      "status": "paid",
      "createdAt": "2026-02-08T08:00:00Z"
    }
  ],
  "total": 42,           // Nombre de transactions
  "totalAmount": 630000, // XOF total
  "page": 1
}
```

**Use Cases**:
- Suivre la trésorerie par type
- Voir les paiements en attente (pending = à relancer)
- Rapport financier par période

---

#### 2.3 Membres Actuellement en Salle (Live Feed)

```typescript
GET /api/v1/dashboard/members/current

Response:
[
  {
    "id": "uuid-123",
    "firstName": "Moussa",
    "lastName": "Ba",
    "phone": "+221771234567",
    "photoUrl": "...",
    "enteredAt": "2026-02-08T09:15:00Z",
    "type": "entry"
  },
  {
    "id": "uuid-456",
    "firstName": "Anonyme",  // Pass ponctuel
    "lastName": "",
    "phone": "N/A",
    "enteredAt": "2026-02-08T10:30:00Z",
    "type": "entry"
  }
]
```

**Implémentation optimisée** :
```sql
SELECT DISTINCT c.* FROM check_ins c
WHERE c.gym_id = $1
  AND c.type = 'entry'
  AND c.scanned_at >= TODAY()
  AND NOT EXISTS (
    SELECT 1 FROM check_ins c2
    WHERE c2.gym_id = $1
      AND c2.type = 'exit'
      AND c2.scanned_at >= TODAY()
  )
```

---

#### 2.4 Statistiques Globales du Dashboard

```typescript
GET /api/v1/dashboard/stats

Response:
{
  "totalMembers": 342,
  "activeMembers": 287,
  "expiredMembers": 42,
  "expiringNext7Days": 13,    // ← Alertes
  "totalRevenue": 4567000,     // XOF depuis le début
  "revenueBreakdown": {
    "byType": {
      "membership": 3500000,
      "session_pass": 567000,
      "product": 500000
    },
    "byMethod": {
      "wave": 2000000,
      "orange_money": 1500000,
      "cash": 1067000
    }
  },
  "currentlyInGym": 28,
  "totalCheckinsToday": 145
}
```

---

#### 2.5 Résumé Financier

```typescript
GET /api/v1/dashboard/finance/summary

Response:
{
  "date": "2026-02-08T00:00:00Z",
  "totalRevenue": 4567000,
  "revenueByType": { ... },
  "revenueByMethod": { ... },
  "membershipRevenue": 3500000,
  "sessionRevenue": 567000,
  "productRevenue": 500000,
  "wavePayments": 2000000,
  "orangeMoneyPayments": 1500000,
  "cashPayments": 1067000
}
```

---

## 🎯 3. CLARIFICATION : WORKFLOW QR CODE

### Workflow Récapitulatif (Votre clarification)

#### **Cas 1 : User avec App** ✅

```
1️⃣ User paie abonnement IN-APP
   ↓
2️⃣ Backend crée membership + access_code
   ↓
3️⃣ ✅ NOTIFICATION PUSH (dans l'app)
   ↓
4️⃣ Frontend récupère QR depuis: GET /access-codes/qr/:token
   ↓
5️⃣ ✅ QR affiché directement à l'accueil (SANS email)
   ↓
6️⃣ (Optionnel) Email de confirmation simple
       BUT: NOT pour accéder, juste pour trace
```

**Code** :
```typescript
// Dashboard retourne directement le QR
GET /api/v1/access-codes/qr/:shareToken
Response: {
  code_value: "NEW_QR_VALUE_123", // Refresh Hourly
  expiresAt: "2026-02-09T...",
  qrImage: "data:image/png;base64,..."
}

// Frontend affiche ce QR
// L'utilise directement pour scans entry
```

**Pas de dépendance email** = Meilleure UX

---

#### **Cas 2 : User SANS App (Pass Ponctuel)** ✅

```
1️⃣ Gérant crée un pass ponctuel (2h, 4h, demi-journée)
   ↓
2️⃣ Backend crée session_pass + access_code
   ↓
3️⃣ ❌ NO notification push (pas d'app)
   ↓
4️⃣ ✅ ENVOI WhatsApp/Email OBLIGATOIRE
   ↓
5️⃣ Message: "Cliquez pour accéder: https://clicsal.app/qr/:shareToken"
   ↓
6️⃣ User clique → WebView affiche QR dynamique
   ↓
7️⃣ Staff scanne ce QR pour autoriser l'entrée
```

**Code** :
```typescript
// Générer et envoyer le pass
POST /api/v1/session-passes
{
  phone: "+221771234567", // Destinataire
  validity_type: "2h"
}
Response: {
  id: "uuid-pass",
  share_token: "ABC123",  // Link permanent
  qr_url: "https://clicsal.app/qr/ABC123"
}

// Backend envoie automatiquement via WhatsApp
// "Accedez ici: https://clicsal.app/qr/ABC123"

// User clique → Frontend affiche:
GET /api/v1/access-codes/qr/:shareToken?public=true
Response: {
  code_value: "XYZ789",  // Change chaque heure
  expiresAt: "2026-02-08T15:00:00Z"
  qrImage: "data:image/png..."
}
```

---

### Résumé des Différences

| Aspect | avec App | sans App (Pass) |
|--------|----------|-----------------|
| **Delivery** | Push notification | WhatsApp/Email |
| **Access** | App homepage | WebView/Browser |
| **QR Origin** | App state | Remote URL |
| **Duration** | 7 jours (membership) | Limitée (2h, 4h, etc) |
| **User Flow** | Auto, instant | Click + scan |

---

## 🛠️ 4. INDEXES DE PERFORMANCE OPTIMISÉS

**Nouveau sur Payment** :
```sql
CREATE INDEX idx_payments_gym_status ON payments(gym_id, status);
CREATE INDEX idx_payments_paymenttype ON payments(payment_type);
```

**Impact** :
- Dashboard filtres ultra-rapides
- Aggregations (groupBy) optimisées
- Queries complexes < 200ms

---

## 📝 5. SUMMARY : Ces changements en action

### Scénario Complet

```
⏰ 08:00 - Owner ouvre son dashboard
   ↓
   GET /dashboard/stats
   → 28 clients en salle, CA du jour: 500k XOF
   ↓
   GET /dashboard/members?filter=expiring_soon
   → 5 clients expirant J-7
   ↓
   Action: Créer pass 2h pour client anonyme
   ↓
   POST /session-passes { phone, validity_type: "2h" }
   ↓
09:15 - Client reçoit WhatsApp avec QR
   ↓
   Clique sur lien
   ↓
10:00 - Client arrive à la salle, staff scanne → Entrée autorisée
   ↓
10:01 - Dashboard met à jour : 29 clients in-gym
   ↓
10:30 - Client scanne QR exit → Sortie enregistrée
   ↓
10:31 - Dashboard : 28 clients in-gym
```

---

## 🚀 Prochaines Étapes

- [ ] Implémentation Check-ins (validation QR)
- [ ] Cron job QR refresh (toutes les 1h)
- [ ] WebSocket real-time pour dashboard live
- [ ] Notifications WhatsApp/Email automatiques
- [ ] Tests e2e pour tous les endpoints
- [ ] Déploiement Supabase + Railway

---

## 📞 Questions ?

Pour clarifications : dev@clicsal.app
