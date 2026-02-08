# Check-ins & Access Codes Implementation Guide

## ✅ Completed

This document describes the complete implementation of Check-ins Module and Access Codes Module for ClicSal gym management system.

### Phase 1: Access Codes Module

**Location**: `src/access-codes/`

#### Files Created
- ✅ `access-codes.service.ts` - Dynamic QR generation and cron jobs
- ✅ `access-codes.controller.ts` - Public QR endpoints
- ✅ `access-codes.module.ts` - Module configuration

#### Key Features

**1. Cron Jobs (Automated QR Refresh)**
```typescript
@Cron(CronExpression.EVERY_HOUR)
async expireOldAccessCodes() 
  // Removes expired codes every hour

@Cron('*/30 * * * *')
async autoRefreshExpiringCodes()
  // Auto-refreshes codes expiring in 10 min every 30 min
```

**2. API Endpoints**
| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/access-codes/display` | GET | ✅ | Get current QR code to display |
| `/access-codes/refresh` | POST | ❌ | Refresh QR code manually |
| `/access-codes/:userId` | GET | ✅ | Get all active codes for user |
| `/access-codes/:codeId` | DELETE | ✅ | Revoke a code |

**3. QR Code Structure**
```
code_value: acc_knopqrst1234567890  // Unique per refresh (changes hourly)
shareToken: token_abc123xyz...      // Permanent, used to refresh code
expiresAt: 2024-01-15T11:30:00Z     // 1 hour from generation
```

#### Integration with Check-ins
- Check-ins service receives `code_value` from QR scan
- Validates `code_value` exists and hasn't expired
- Creates CheckIn record linked to AccessCode

### Phase 2: Check-ins Module

**Location**: `src/check-ins/`

#### Files Created
- ✅ `check-ins.service.ts` - QR validation logic
- ✅ `check-ins.controller.ts` - Entry/exit/stats endpoints
- ✅ `check-ins.module.ts` - Module configuration
- ✅ `dto/check-in.dto.ts` - Request/response DTOs
- ✅ `CHECK_INS.md` - Comprehensive module documentation

#### Key Features

**1. Entry Validation (Staff Scans QR)**
```typescript
async validateEntry(gymId, codeValue, staffId?) {
  // 1. Find AccessCode by code_value
  // 2. Verify not expired
  // 3. Call anti-fraud checkDuplicateEntry()
  // 4. Verify membership/pass is active
  // 5. Create CheckIn(type: 'entry')
  // Return user details for staff display
}
```

**2. Exit Validation (User Scans Fixed QR)**
```typescript
async validateExit(gymId, exitQRCode) {
  // 1. Verify exit QR belongs to this gym
  // 2. Find latest unfinished entry
  // 3. Create CheckIn(type: 'exit')
  // Return goodbye message
}
```

**3. Anti-Fraud Logic**
```typescript
private async checkDuplicateEntry(accessCodeId, gymId) {
  // Find last entry for this code
  // Check if exit exists after that entry
  // Return: can_enter = !!exitAfter
  // Prevents "double entry" fraud
}
```

**4. Real-Time Stats**
- `getUserCheckInStatus()` - Is user in gym or not? (3 states)
- `getCurrentlyInGym()` - Live list of occupants with entry times
- `getDailyStats()` - Entry/exit counts and occupancy

#### API Endpoints

**Entry Scan (Staff)**
```bash
POST /check-ins/scan
Authorization: Bearer <token>
{
  "codeValue": "acc_5f9b8c2k9m3p1q7r9t2u",
  "staffId": "staff_optional_id"
}

✅ 201 Created:
{
  "message": "Accès autorisé ✅",
  "user": { "id": "...", "firstName": "Jean", "lastName": "Dupont" }
}

❌ 409 Conflict: "Already in gym"
❌ 400 Bad Request: "QR code expired"
```

**Exit Scan (User)**
```bash
GET /check-ins/exit?gymId=gym_123&exitQRCode=exit_code_123
  // No auth required (public endpoint)

✅ 200 OK:
{
  "message": "Bonne journée ! ✅",
  "user": { "id": "...", "firstName": "Jean" }
}
```

**Status Check**
```bash
GET /check-ins/status/:userId/:gymId
Authorization: Bearer <token>

✅ 200 OK:
{
  "status": "in_gym",  // or "not_entered" | "exited"
  "message": "Actuellement dans la salle",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Live Users**
```bash
GET /check-ins/live/:gymId
Authorization: Bearer <token>

✅ 200 OK:
{
  "count": 24,
  "users": [
    {
      "id": "...",
      "firstName": "Jean",
      "lastName": "Dupont",
      "enteredAt": "2024-01-15T08:00:00Z",
      "lastAction": "entry"
    }
  ]
}
```

**Daily Stats**
```bash
GET /check-ins/stats/:gymId
Authorization: Bearer <token>

✅ 200 OK:
{
  "date": "2024-01-15T00:00:00Z",
  "totalEntries": 45,
  "totalExits": 41,
  "currentlyInGym": 4
}
```

## 🔄 Data Flow Diagrams

### Entry Flow
```
User Opens Mobile App
    ↓
Display QR Code (GET /access-codes/display)
    ✓ Shows code_value + expiration
    ↓
Staff Scans with Tablet
    ↓
POST /check-ins/scan { codeValue }
    ├─ Lookup AccessCode by code_value
    ├─ Verify expiresAt > now
    ├─ Call checkDuplicateEntry() → must have exit after last entry
    ├─ Verify Membership.status = 'active'
    └─ CREATE CheckIn(type='entry', userId, accessCodeId, staffId)
    ↓
Return user photo + name to staff display
    ↓
Staff sees: "Jean Dupont ✅ 08:00 AM"
```

### Exit Flow
```
User at Gym Door (Exit)
    ↓
Scan Fixed QR Code (EXIT_QR_CODE)
    ↓
GET /check-ins/exit?gymId=...&exitQRCode=...
    ├─ Verify exitQRCode matches Gym.exitQrCode
    ├─ Find latest CheckIn(type='entry', today) without exit
    └─ CREATE CheckIn(type='exit', same userId + accessCodeId)
    ↓
Return "Bonne journée ✅"
    ↓
User can now re-enter (anti-fraud reset)
```

### QR Refresh Flow
```
App Detects Code Expiring Soon (< 10 min)
    ↓
Option 1: MANUAL
    └─ POST /access-codes/refresh?shareToken=...
       ├─ Generate new code_value
       ├─ Update expiresAt = now + 1h
       └─ Return new code to display

Option 2: AUTOMATIC (Cron)
    └─ Every 30 min, cron checks expiring codes
       ├─ Find codes expiring in < 10 min
       ├─ Generate new code_value for each
       └─ Update DB → Mobile polls display endpoint
```

### Anti-Fraud Check
```
Staff tries to scan same code twice
    ↓
validateEntry() called with same codeValue
    ↓
checkDuplicateEntry(accessCodeId) {
  last_entry = SELECT * WHERE accessCodeId=... ORDER BY scannedAt DESC LIMIT 1
  
  IF NO previous entry → ✅ ALLOW (first time)
  ELSE {
    exit_after = SELECT * WHERE scannedAt > last_entry.scannedAt AND type='exit'
    IF exit_after EXISTS → ✅ ALLOW (user exited, can re-enter)
    ELSE → ❌ BLOCK (user still inside, prevent fraud)
  }
}
    ↓
Result: ConflictException("Already in gym")
```

## 📋 Database Schema Integration

### AccessCode Model
```prisma
model AccessCode {
  id          String      @id @default(cuid())
  userId      String
  user        User        @relation(fields: [userId], references: [id])
  
  // User can have membership OR session pass
  membershipId   String?
  membership     Membership? @relation(fields: [membershipId], references: [id])
  
  sessionPassId  String?
  sessionPass    SessionPass? @relation(fields: [sessionPassId], references: [id])
  
  // QR code details
  codeValue   String      @unique         // Changes hourly (acc_xxx)
  shareToken  String      @unique         // Permanent (token_xxx)
  expiresAt   DateTime                    // 1h from creation
  
  // Relationship to check-ins
  checkIns    CheckIn[]
  
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt()
}

model CheckIn {
  id                  String      @id @default(cuid())
  gymId               String
  gym                 Gym         @relation(fields: [gymId], references: [id])
  
  userId              String
  user                User        @relation(fields: [userId], references: [id])
  
  accessCodeId        String
  accessCode          AccessCode  @relation(fields: [accessCodeId], references: [id])
  
  type                CheckInType  // 'entry' | 'exit'
  scannedAt           DateTime    @default(now())
  validatedByStaffId  String?     // Audit trail
  
  createdAt           DateTime    @default(now())
  updatedAt           DateTime    @updatedAt()
  
  @@index([gymId, scannedAt])     // Fast gym stats queries
  @@index([userId, scannedAt])    // User history
  @@index([type, scannedAt])      // Stats by type
}

enum CheckInType {
  entry
  exit
}
```

### Gym Model Extension
```prisma
model Gym {
  // ... existing fields ...
  exitQrCode    String      @unique  // Fixed exit QR code per gym
  checkIns      CheckIn[]
}
```

## 🔐 Security Architecture

### 1. Authentication & Authorization
```
Staff Entry Scan:
  ✅ Requires JWT Bearer token
  ✅ Staff must have gymId claim
  ❌ Only staff can scan entries
  
User Exit Scan:
  ❌ No auth required (public)
  ✅ Validates exitQRCode against Gym.exitQrCode
  ✅ Validates gymId in query param
  
Access Code Endpoints:
  ✅ Display: Requires auth (own userId only)
  ✅ Refresh: No auth (uses permanent shareToken)
  ✅ List: Requires auth (admin/self only)
  ✅ Revoke: Requires auth (admin/self only)
```

### 2. QR Code Security
```
code_value: Unique per refresh, random string
  ✅ Changes every 1 hour
  ❌ Cannot be reused (expires)
  ✅ Verifiable in real-time
  
shareToken: Permanent identifier for user
  ✅ Used to refresh code (not in JSON response)
  ✅ Sent via secure channel (HTTPS query param)
  ✅ Enables private refresh without full auth
  
expiresAt: Unix timestamp
  ✅ Validated server-side on every scan
  ✅ No client-side trust
```

### 3. Anti-Fraud Mechanisms
```
Duplicate Entry Prevention:
  ✅ SQL query checks: has user exited after last entry?
  ✅ Real-time validation (not based on timestamps)
  ✅ Staff cannot bypass (business logic enforced)
  
Membership Status Validation:
  ✅ Must be 'active' to enter
  ✅ Prevents expired subscriptions
  ✅ Returns helpful error message
  
Access Code Validation:
  ✅ Exists in database
  ✅ Not expired
  ✅ Linked to valid membership/pass
  ✅ User matches
```

### 4. Audit Trail
```
Each CheckIn record stores:
  ✅ userId - who entered/exited
  ✅ gymId - which location
  ✅ type - entry or exit
  ✅ scannedAt - exact timestamp
  ✅ validatedByStaffId - who scanned (if entry)
  ✅ accessCodeId - which QR code
    
Enables:
  ✅ User login history
  ✅ Staff audit trail
  ✅ Fraud investigation
  ✅ Occupancy reports
```

## 🚀 Implementation Checklist

### Prerequisite Setup
- [x] Prisma schema updated with AccessCode & CheckIn models
- [x] Database connection configured (.env)
- [x] nanoid package installed (for random ID generation)

### Access Codes Module
- [x] Service with cron jobs
- [x] Controller with 4 endpoints
- [x] Module configuration
- [x] Integrated into app.module.ts
- [ ] Unit tests
- [ ] Integration tests

### Check-ins Module
- [x] Service with 6 methods (entry, exit, stats, etc.)
- [x] Controller with 5 endpoints
- [x] DTOs for validation
- [x] Module configuration
- [x] Anti-fraud logic
- [ ] Unit tests
- [ ] Integration tests
- [ ] WebSocket event emission (future)

### Next Steps
1. **Run Prisma Migration** (if not done)
   ```bash
   npx prisma migrate dev --name add_access_codes_and_checkins
   ```

2. **Test Access Code Endpoints**
   ```bash
   # Create member first
   POST /memberships { userId, gymId, startDate, endDate }
   
   # Generate QR code
   POST /access-codes/generate { userId, membershipId }
   
   # Display QR
   GET /access-codes/display
   ```

3. **Test Entry Scan**
   ```bash
   POST /check-ins/scan { codeValue, staffId }
   # Should return {"message": "Accès autorisé ✅", "user": {...}}
   ```

4. **Test Exit Scan**
   ```bash
   GET /check-ins/exit?gymId=...&exitQRCode=...
   # Should return {"message": "Bonne journée ✅", "user": {...}}
   ```

5. **Monitor Cron Jobs**
   - Check logs for "[QR Cleanup]" messages (hourly)
   - Check logs for "[QR Auto-Refresh]" messages (every 30 min)

6. **Dashboard Integration**
   - `/dashboard/live-feed` - Real-time entry/exit events
   - `/check-ins/live/:gymId` - Current occupancy
   - `/check-ins/stats/:gymId` - Daily metrics

7. **WebSocket Integration** (Phase 3)
   - Emit "user-entry" / "user-exit" events
   - Enable real-time dashboard updates
   - Remove polling, use push notifications

## 📊 Testing Scenarios

### Scenario 1: Happy Path Entry
```
1. User has active membership
2. QR code valid and not expired
3. No previous entry (or previous exit exists)
✅ Staff sees user details
✅ CheckIn record created
✅ Dashboard updated
```

### Scenario 2: Duplicate Entry Block
```
1. User already in gym (entry exists, no exit)
2. Staff tries to scan (any QR)
❌ ConflictException: "Already in gym"
✅ User must exit first via exit QR
```

### Scenario 3: Expired Membership
```
1. User's subscription expired
2. App shows "Membership expired" message
3. Staff cannot scan entry
❌ ConflictException: "Membership expired - Please renew"
```

### Scenario 4: Expired QR Code
```
1. QR code older than 1 hour
2. Staff scans
❌ BadRequestException: "QR code expired"
✅ App should auto-refresh or offer manual refresh
```

### Scenario 5: Auto-Refresh Cron
```
1. QR code expires in 10 minutes
2. Every 30 minutes, cron checks
3. Finds expiring codes and generates new code_value
4. Next time user opens app, shows refreshed code
✅ No user action needed
```

### Scenario 6: Happy Path Exit
```
1. User at gym door
2. Scans fixed exit QR code
3. System finds latest entry without exit
4. Creates exit CheckIn
✅ Returns "Bonne journée ✅"
✅ User can now re-enter
```

## 📈 Performance Considerations

### Database Indexes
- `@@index([gymId, scannedAt])` - Fast gym stats queries
- `@@index([userId, scannedAt])` - User history lookups
- `@@index([type, scannedAt])` - Entry/exit filtering
- `AccessCode.codeValue` - @unique for fast lookups

### Query Optimization
- `getCurrentlyInGym()` queries only today (not all-time)
- Uses in-memory Map to deduplicate (not SQL GROUP BY)
- Avoids N+1 queries with proper Prisma includes

### Caching Strategy (Future)
```typescript
// Live list could be cached 1 minute
CACHE_KEY = `gym:${gymId}:live`
TTL = 60 seconds
Invalidate on every check-in

// Daily stats cached with soft-expiry
CACHE_KEY = `gym:${gymId}:stats:${date}`
TTL = 5 minutes
Invalidate on new check-in
```

### Scalability Notes
- Each gym can have 1000+ users per day
- CheckIn table will grow large (archive old records quarterly)
- Consider dedicated reporting database in future
- WebSocket events replace polling (lower DB load)

## 🐛 Debugging Tips

**"QR code not found"**
- Verify AccessCode.codeValue matches exactly (case-sensitive)
- Check expiresAt timestamp in database
- Confirm user has active membership

**"Already in gym"**
- Query CheckIn: `SELECT * FROM "CheckIn" WHERE "userId"='...' ORDER BY "scannedAt" DESC LIMIT 2`
- Look for entry without corresponding exit
- Admin must manually create exit via API

**"Membership invalid"**
- Check Membership.status = 'active'
- Verify Membership.gymId matches scan gymId
- Confirm subscription didn't expire

**Live users not updating**
- Check cron job logs for errors
- Verify WebSocket connection established
- Monitor N+1 queries in getCurrentlyInGym()

## 📄 Related Documentation
- See [src/check-ins/CHECK_INS.md](./CHECK_INS.md) for detailed module docs
- See [SUPABASE_AUTH_MIGRATION.md](../SUPABASE_AUTH_MIGRATION.md) for auth setup
- See [QUICKSTART.md](../../QUICKSTART.md) for development setup
