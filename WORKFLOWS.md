# 📊 Workflows ClicSal - Diagrammes Techniques

## 🌿 Workflow Git - Développement avec `develop` branch

### Stratégie de Branches

**`main`** : Branche de production, toujours stable
- ✅ Code testé et validé
- ✅ Prêt pour déploiement
- ❌ Pas de commits directs

**`develop`** : Branche de développement active
- ✅ Nouvelles features
- ✅ Fixes et améliorations
- ✅ Tests en cours
- ✅ Commits fréquents autorisés

### Flux de Travail

```bash
# 1. Créer/Basculer sur develop
git checkout develop
# Si develop n'existe pas encore localement:
git checkout -b develop

# 2. Développer une nouvelle feature
# Créer une branche feature depuis develop (optionnel pour grandes features)
git checkout -b feature/checkins-module

# 3. Faire vos modifications
# ... éditer des fichiers ...

# 4. Committer régulièrement
git add .
git commit -m "feat: add check-ins validation logic"

# 5. Pousser vers GitHub
git push origin develop
# Pour une branche feature:
git push origin feature/checkins-module

# 6. Quand la feature est stable et testée
git checkout develop
git merge feature/checkins-module

# 7. Merger dans main (quand prêt pour production)
git checkout main
git merge develop
git push origin main

# 8. Retourner sur develop pour continuer le développement
git checkout develop
```

### Conventions de Commits

```
feat:     Nouvelle fonctionnalité
fix:      Correction de bug
refactor: Refactoring sans changement de comportement
docs:     Documentation uniquement
style:    Formatage, points-virgules manquants, etc.
test:     Ajout de tests
chore:    Maintenance, dépendances, config
```

**Exemples** :
```bash
git commit -m "feat: add QR code auto-refresh cron job"
git commit -m "fix: prevent duplicate check-in entries"
git commit -m "docs: update DATABASE_SETUP.md with pgAdmin steps"
git commit -m "refactor: optimize getCurrentlyInGym query"
```

### Pull Requests (Recommandé pour équipes)

```bash
# 1. Pousser votre branche feature
git push origin feature/ma-feature

# 2. Sur GitHub: Créer Pull Request
#    feature/ma-feature → develop

# 3. Review du code par l'équipe

# 4. Merge via GitHub interface

# 5. Supprimer la branche feature
git branch -d feature/ma-feature
git push origin --delete feature/ma-feature
```

---

## 🔐 Workflow Authentification Magic Link

```mermaid
sequenceDiagram
    participant U as User (Mobile/Web)
    participant API as ClicSal API
    participant DB as PostgreSQL
    participant WA as WhatsApp Business

    U->>API: POST /auth/magic-link/send<br/>{phone: "+221771234567"}
    API->>DB: Créer magic_link<br/>(token, phone, expires_at)
    API->>WA: Envoyer message WhatsApp<br/>"Cliquez: clicsal.app/auth/verify?token=ABC123"
    WA-->>U: Message reçu
    
    U->>API: GET /auth/verify?token=ABC123<br/>(Click sur le lien)
    API->>DB: Vérifier token<br/>(non utilisé, non expiré)
    API->>DB: Marquer magic_link.used = true
    API->>DB: FindOrCreate user by phone
    API->>API: Générer JWT
    API-->>U: {accessToken, user}
    
    Note over U,API: User authentifié ✅
```

---

## 💳 Workflow Paiement & Génération QR Code

```mermaid
sequenceDiagram
    participant U as User
    participant API as ClicSal API
    participant Wave as Wave API
    participant DB as PostgreSQL
    participant WA as WhatsApp

    U->>API: POST /memberships/purchase<br/>{gym_id, type: "monthly", amount: 5000}
    API->>DB: Créer payment (status: pending)
    API->>Wave: POST /initiate-payment<br/>{amount, phone, callback_url}
    Wave-->>U: Notification Wave Mobile<br/>"Validez le paiement"
    U->>Wave: Confirme paiement
    
    Wave->>API: POST /webhooks/wave<br/>{status: "successful", tx_id}
    API->>DB: Update payment (status: paid)
    API->>DB: Créer membership (active)
    API->>DB: Crérer access_code<br/>(code_value, share_token)
    API->>API: Générer QR Code image
    API->>WA: Envoyer WhatsApp:<br/>"Votre QR: clicsal.app/qr/ABC123"
    WA-->>U: Message + Lien QR
    
    Note over U,API: Membership actif + QR reçu ✅
```

---

## ✅ Workflow Check-in Entrée (Validation Staff)

```mermaid
sequenceDiagram
    participant U as User (Client)
    participant S as Staff (App Gérant)
    participant API as ClicSal API
    participant DB as PostgreSQL
    participant WS as WebSocket

    U->>U: Ouvre lien QR:<br/>clicsal.app/qr/ABC123
    U->>API: GET /access-codes/qr/:token
    API->>DB: Récupérer access_code + membership
    API->>API: Refresh code_value si > 1h
    API-->>U: Affiche QR dynamique
    
    U->>S: Montre QR à scanner
    S->>S: Scan QR via caméra
    S->>API: POST /check-ins/scan<br/>{code_value, gym_id}
    
    API->>DB: Vérifier access_code:<br/>✓ Existe?<br/>✓ Pas expiré?<br/>✓ check_duplicate_checkin()
    
    alt QR Valide
        API->>DB: Créer check_in<br/>(type: entry, scanned_at)
        API->>WS: Emit "new-entry" event<br/>{user, timestamp}
        WS-->>S: Dashboard update live
        API-->>S: ✅ "Accès autorisé"<br/>{user: {name, photo}}
        S->>S: Affiche ✅ + Son/Vibration
    else QR Invalide
        API-->>S: ❌ "Accès refusé"<br/>{reason: "Déjà en salle"}
        S->>S: Affiche ❌ + Son d'erreur
    end
```

---

## 🚪 Workflow Check-in Sortie (Auto-Validation)

```mermaid
sequenceDiagram
    participant U as User
    participant QR as QR Code Fixe<br/>(Mur à la sortie)
    participant API as ClicSal API
    participant DB as PostgreSQL
    participant WS as WebSocket

    U->>QR: Scan QR exit via smartphone
    QR->>API: GET /check-ins/exit?code=EXIT_GYM_123
    
    API->>DB: Récupérer gym by exit_qr_code
    API->>DB: Vérifier dernière entrée user:<br/>✓ Has entry today?<br/>✓ No exit yet?
    
    alt Sortie Valide
        API->>DB: Créer check_in<br/>(type: exit, validated_by_staff_id: null)
        API->>WS: Emit "exit" event
        API-->>U: ✅ "Bonne journée!"
    else Pas d'Entrée
        API-->>U: ❌ "Aucune entrée active"
    end
```

---

## 🔄 Workflow Refresh QR Code (Cron Job)

```mermaid
sequenceDiagram
    participant Cron as Cron Job (Toutes les 1h)
    participant API as ClicSal API
    participant DB as PostgreSQL
    participant WS as WebSocket
    participant U as User (Si page ouverte)

    Cron->>API: Trigger @Cron('0 * * * *')
    API->>DB: SELECT access_codes<br/>WHERE expires_at > NOW()<br/>AND last_refreshed_at < NOW() - 1h
    
    loop Pour chaque access_code
        API->>API: Générer nouveau code_value<br/>(hash sécurisé 32 chars)
        API->>DB: UPDATE access_code<br/>SET code_value = new_value,<br/>last_refreshed_at = NOW()
        API->>WS: Emit "qr-refresh"<br/>{user_id, new_code}
        
        alt User a la page ouverte
            WS-->>U: Nouveau QR affiché<br/>(transition animée)
        end
    end
    
    Note over Cron,U: ✅ Tous les QR refreshed<br/>Impossible de partager screenshots
```

---

## 📊 Workflow Dashboard Live Feed (WebSocket)

```mermaid
sequenceDiagram
    participant G as Gérant (Dashboard)
    participant WS as WebSocket Server
    participant API as ClicSal API
    participant DB as PostgreSQL

    G->>WS: Connect socket.io<br/>{gym_id, role: 'owner'}
    WS->>WS: Authenticate JWT
    WS->>DB: SELECT check_ins WHERE type='entry'<br/>AND scanned_at > TODAY<br/>AND no exit yet
    WS-->>G: Emit "initial-state"<br/>{current_users: [...], count: 42}
    
    Note over G,WS: Connexion établie, feed live actif
    
    loop Événements en temps réel
        API->>WS: Event "new-entry"<br/>{user, timestamp}
        WS-->>G: Emit "user-entered"<br/>+ Update compteur
        
        API->>WS: Event "exit"<br/>{user, timestamp}
        WS-->>G: Emit "user-exited"<br/>- Update compteur
        
        API->>WS: Event "payment-received"<br/>{amount, type}
        WS-->>G: Emit "revenue-update"<br/>CA du jour ++
    end
```

---

## 🗺️ Workflow Géolocalisation Salles à Proximité

```mermaid
sequenceDiagram
    participant U as User (App Mobile)
    participant API as ClicSal API
    participant DB as PostgreSQL (PostGIS)

    U->>U: Activer GPS
    U->>API: GET /gyms/nearby?lat=14.7167&lng=-17.4673&radius=5
    
    API->>DB: SELECT find_nearby_gyms(14.7167, -17.4673, 5)
    Note over DB: Utilise ST_Distance (PostGIS)<br/>Calcul distance géographique
    
    DB-->>API: Liste salles + distances:<br/>[<br/>  {id, name, distance_km: 0.8},<br/>  {id, name, distance_km: 2.3}<br/>]
    
    API-->>U: JSON avec salles triées<br/>par proximité
    U->>U: Affiche sur carte interactive
```

---

## 🔐 Sécurité Anti-Fraude (Check-in Duplicate)

```mermaid
flowchart TD
    A[Staff scanne QR] --> B{Code existe<br/>en DB?}
    B -->|NON| Z[❌ Code invalide]
    B -->|OUI| C{Code expiré?}
    C -->|OUI| Z
    C -->|NON| D{Appeler fonction<br/>check_duplicate_checkin}
    
    D --> E[Récupérer dernière<br/>entrée pour ce code]
    E --> F{Entrée existe<br/>aujourd'hui?}
    F -->|NON| Y[✅ Autoriser entrée]
    F -->|OUI| G{Existe une sortie<br/>après cette entrée?}
    G -->|OUI| Y
    G -->|NON| Z2[❌ Déjà en salle]
    
    Y --> H[Créer check_in entry]
    H --> I[Emit WebSocket event]
    Z --> J[Log tentative fraude]
    Z2 --> J
```

---

## 📈 Architecture Globale du Système

```mermaid
graph TB
    subgraph Clients
        M[App Mobile<br/>Flutter]
        W[Web Admin<br/>Next.js]
        WA[WhatsApp<br/>Business]
    end
    
    subgraph Backend["ClicSal API (NestJS)"]
        AUTH[Auth Module<br/>Magic Links]
        CHECKIN[Check-in Module<br/>QR Validation]
        PAY[Payments Module<br/>Wave/OM]
        DASH[Dashboard Module<br/>Analytics]
        WS[WebSocket Gateway<br/>Real-time]
        CRON[Cron Jobs<br/>QR Refresh]
    end
    
    subgraph Data
        PG[(PostgreSQL<br/>Supabase)]
        REDIS[(Redis<br/>Cache)]
    end
    
    subgraph External
        FIRE[Firebase Auth]
        WAVE[Wave API]
        OM[Orange Money]
        TWILIO[Twilio<br/>WhatsApp]
    end
    
    M --> AUTH
    M --> CHECKIN
    W --> DASH
    W --> CHECKIN
    
    AUTH --> FIRE
    AUTH --> TWILIO
    WA --> TWILIO
    
    CHECKIN --> PG
    CHECKIN --> WS
    PAY --> WAVE
    PAY --> OM
    PAY --> PG
    
    WS --> M
    WS --> W
    
    CRON --> PG
    DASH --> REDIS
    DASH --> PG
    
    style Backend fill:#1e3a8a
    style Data fill:#065f46
    style External fill:#7c2d12
```

---

## 🎯 Métriques de Performance Cibles

| Opération | Target | Critique |
|-----------|--------|----------|
| Check-in scan validation | < 500ms | ✅ Oui |
| QR code generation | < 200ms | ✅ Oui |
| Magic Link send (WhatsApp) | < 2s | ⚠️ Moyen |
| WebSocket event propagation | < 100ms | ✅ Oui |
| Dashboard initial load | < 1s | ⚠️ Moyen |
| Payment webhook processing | < 500ms | ✅ Oui |

---

## 📞 Contact & Support

Pour toute question sur ces workflows, contactez l'équipe technique : **dev@clicsal.app**
