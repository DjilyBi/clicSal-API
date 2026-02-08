# Check-ins Module

## Overview

The Check-ins Module handles QR code validation for gym entry/exit, including:
- Dynamic QR code scanning at entry (staff action)
- Fixed QR code scanning at exit (user self-service)
- Anti-fraud detection (prevent duplicate entries)
- Live tracking of users in gym
- Real-time statistics

## Architecture

### Service Layer (check-ins.service.ts)

**validateEntry(gymId, codeValue, staffId)**
- 🔐 Verifies QR code exists and is not expired
- 🛡️ Calls anti-fraud check_duplicate_checkin() SQL function
- ✅ Creates CheckIn entry record
- 📱 Returns user details for staff display

**validateExit(gymId, exitQRCode)**
- 🔓 Verifies fixed exit QR code belongs to gym
- ✅ Creates CheckIn exit record automatically
- 📊 Matches with latest unfinished entry

**checkDuplicateEntry(accessCodeId, gymId)** [PRIVATE]
- 🚫 Returns false if user already in gym
- ✅ Returns true if last action was exit or no previous entry
- ⏰ Prevents rapid re-entries (anti-fraud)

**getUserCheckInStatus(userId, gymId)**
- Returns: `not_entered`, `in_gym`, or `exited`
- Used by dashboard to show user real-time status

**getCurrentlyInGym(gymId)**
- Returns list of users currently in gym
- Includes entry time for duration calculation
- Powers live dashboard display

**getDailyStats(gymId)**
- Returns daily entry/exit counts
- Calculates currently in gym (entries - exits)
- Used for analytics and reporting

### Controller Layer (check-ins.controller.ts)

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/check-ins/scan` | POST | ✅ | Staff scans entry QR |
| `/check-ins/exit` | GET | ❌ | User scans exit QR (public, no auth needed) |
| `/check-ins/status/:userId/:gymId` | GET | ✅ | Get user check-in status |
| `/check-ins/live/:gymId` | GET | ✅ | Get users currently in gym |
| `/check-ins/stats/:gymId` | GET | ✅ | Get daily statistics |

## Data Flow

### Entry Flow
```
Staff App
    ↓
  scan QR code (dynamic code_value)
    ↓
POST /check-ins/scan { codeValue }
    ↓
CheckInsService.validateEntry()
    ├─ Find AccessCode by code_value
    ├─ Verify not expired
    ├─ Check anti-fraud (checkDuplicateEntry)
    ├─ Verify membership/pass status
    └─ Create CheckIn(type=entry)
    ↓
Return user details for staff display
```

### Exit Flow
```
User (at gym exit)
    ↓
  scan fixed QR code (exitQrCode)
    ↓
GET /check-ins/exit?gymId=...&exitQRCode=...
    ↓
CheckInsService.validateExit()
    ├─ Verify exit QR belongs to gym
    ├─ Find latest unfinished entry
    └─ Create CheckIn(type=exit)
    ↓
Return goodbye message
```

### Anti-Fraud Logic
```
User scans entry QR
    ↓
checkDuplicateEntry()
    ├─ Find last entry for this code
    ├─ Check if exit exists after that entry
    └─ Return: can_enter = !!exitAfter
    ↓
If can_enter = false → ConflictException("Already in gym")
```

## API Endpoints

### 1. Scan Entry QR (Staff)
```bash
POST /check-ins/scan
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "codeValue": "acc_5f9b8c2k9m3p1q7r9t2u",
  "staffId": "staff_123abc"  // optional
}

Response (201):
{
  "message": "Accès autorisé ✅",
  "user": {
    "id": "user_123",
    "firstName": "Jean",
    "lastName": "Dupont",
    "photoUrl": "https://..."
  }
}
```

### 2. Scan Exit QR (User - No Auth)
```bash
GET /check-ins/exit?gymId=gym_123&exitQRCode=exit_gym_12345

Response (200):
{
  "message": "Bonne journée ! ✅",
  "user": {
    "id": "user_123",
    "firstName": "Jean",
    "lastName": "Dupont"
  }
}
```

### 3. Get User Status
```bash
GET /check-ins/status/:userId/:gymId
Authorization: Bearer <jwt>

Response (200):
{
  "status": "in_gym",  // or "not_entered" | "exited"
  "message": "Actuellement dans la salle",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### 4. Get Live Users
```bash
GET /check-ins/live/:gymId
Authorization: Bearer <jwt>

Response (200):
{
  "count": 24,
  "users": [
    {
      "id": "user_123",
      "firstName": "Jean",
      "lastName": "Dupont",
      "photoUrl": "https://...",
      "enteredAt": "2024-01-15T08:00:00Z",
      "lastAction": "entry"
    },
    ...
  ]
}
```

### 5. Get Daily Stats
```bash
GET /check-ins/stats/:gymId
Authorization: Bearer <jwt>

Response (200):
{
  "date": "2024-01-15T00:00:00Z",
  "totalEntries": 45,
  "totalExits": 41,
  "currentlyInGym": 4
}
```

## Database Schema

### CheckIn Table
```typescript
model CheckIn {
  id                 String      @id @default(cuid())
  gymId              String
  gym                Gym         @relation(fields: [gymId], references: [id])
  
  userId             String
  user               User        @relation(fields: [userId], references: [id])
  
  accessCodeId       String
  accessCode         AccessCode  @relation(fields: [accessCodeId], references: [id])
  
  type               CheckInType // 'entry' | 'exit'
  scannedAt          DateTime    @default(now())
  validatedByStaffId String?     // Staff who scanned (for audit)
  
  createdAt          DateTime    @default(now())
  updatedAt          DateTime    @updatedAt()
  
  @@index([gymId, scannedAt])
  @@index([userId, scannedAt])
  @@index([type, scannedAt])
}

enum CheckInType {
  entry
  exit
}
```

## Security Considerations

### 1. QR Code Expiration
- Default: 1 hour (configured in AccessCode.expiresAt)
- Prevents stale QR codes from being used
- User gets new code each time they refresh

### 2. Anti-Fraud Checks
- **Duplicate Entry Prevention**: checkDuplicateEntry() ensures user has exited before can re-enter
- **Prevention Method**: Last entry must have a corresponding exit record
- **Time-based Safety**: SQL function validates in real-time

### 3. Exit QR Code
- Fixed per gym (stored in Gym.exitQrCode)
- Cannot be forged by users (assigned by admin)
- Public endpoint (no auth) but indexed by gymId for validation

### 4. Staff Validation
- Entry scan requires JWT authentication
- staffId captured for audit trail
- Prevents unauthorized staff from scanning

### 5. Membership Status Check
- Verifies membership is `active` before allowing entry
- Prevents expired subscriptions from entering
- Returns helpful message with renewal status

## Integration with Other Modules

### AccessCode Module (Prerequisite)
- Check-ins depends on dynamic QR codes from AccessCode
- Each scan references an AccessCode record
- Must implement `/access-codes` endpoints first:
  - `GET /access-codes/qr/:token` - Display current code_value
  - `POST /access-codes/refresh` - User refreshes QR code

### Membership Module
- Validates membership status (active/paused/expired)
- Access control based on membership tier
- Refund/suspension logic affects check-in permissions

### Dashboard Module
- `/dashboard/members` - Shows all members with check-in history
- `/dashboard/live-feed` - Real-time entry/exit feed
- `/dashboard/stats` - Uses CheckIn aggregations

### WebSocket Module
- Real-time event emission on check-in
- Events: `user-entry`, `user-exit`, `staff-scanned`
- Powers live dashboard refresh without polling

## Testing Scenarios

### Scenario 1: Valid Entry
```
1. User has active membership
2. QR code not expired
3. User had previous exit (or first entry ever)
4. ✅ Entry created, staff sees user details
```

### Scenario 2: Duplicate Entry (Anti-Fraud)
```
1. User already in gym (no exit yet)
2. Staff tries to scan same/different QR
3. ❌ ConflictException: "Already in gym"
4. Staff must record manual exit first
```

### Scenario 3: Expired Membership
```
1. Membership.status = 'expired'
2. User tries to enter
3. ❌ ConflictException: "Membership expired - Renew to continue"
4. User must renew subscription
```

### Scenario 4: Expired QR Code
```
1. AccessCode.expiresAt < now()
2. User/staff tries to scan
3. ❌ BadRequestException: "QR code expired"
4. User must refresh QR code
```

### Scenario 5: Happy Path Exit
```
1. User scans exit QR at gym door
2. Latest entry exists with no exit
3. ✅ Exit created, goodbye message
4. User can now re-enter
```

## Performance Optimization

### Database Indexes
```sql
-- In Prisma migration, ensure:
@@index([gymId, scannedAt])      -- Access by gym + time range
@@index([userId, scannedAt])     -- User history queries
@@index([type, scannedAt])       -- Entry/exit statistics
@@index([accessCodeId])          -- AccessCode lookup
```

### Query Optimization
- `getCurrentlyInGym()` only queries last 24h (not all-time)
- Uses single `Map` to deduplicate users instead of joins
- Filters in-memory for speed

### Caching Considerations (Future)
- Live user list could be cached for 1min
- Daily stats could be cached with invalidation on check-in
- User status could be cached for 30sec

## Future Enhancements

1. **Manual Check-in Override**
   - Admin can manually create entries for lost/damaged QRs
   - Audit trail with reason + timestamp

2. **Geofencing**
   - Verify GPS location within gym radius
   - Prevent remote QR scanning from outside

3. **Attendance Patterns**
   - Track peak hours
   - Generate member engagement reports
   - Predict no-shows

4. **Offline Mode**
   - Cache recent QR codes on staff tablet
   - Sync when network returns

5. **Integration with Equipment**
   - Scanners auto-upload entries
   - Turnstile gate integration
   - IP camera triggers

6. **Behavioral Analytics**
   - Average session duration
   - Member retention scoring
   - Churn prediction

## Development Checklist

- [x] Service layer (validateEntry, validateExit, stats)
- [x] Controller endpoints (scan, exit, status, live, stats)
- [x] DTOs for validation
- [x] Module configuration
- [x] Anti-fraud logic
- [ ] Integration tests
- [ ] Error handling edge cases
- [ ] Performance load testing
- [ ] WebSocket event emission
- [ ] Cron job for QR refresh

## Debugging Tips

### "QR code not found"
- Check AccessCode record exists in DB
- Verify code_value matches exactly (case-sensitive)
- Check expiresAt timestamp

### "Already in gym"
- Query CheckIn table: `SELECT * FROM "CheckIn" WHERE "userId"='...' AND "type"='entry' ORDER BY "scannedAt" DESC LIMIT 1`
- Should have a corresponding exit record
- If not, admin must manually create exit

### "Membership invalid for this gym"
- Verify Membership.gymId matches scan gymId
- Check Membership.status = 'active'
- Verify subscription not paused/frozen

### Live Users Not Updating
- Check WebSocket connection is established
- Verify socket.io rooms are correctly subscribed
- Check for N+1 query issues in getCurrentlyInGym()
