-- Migration SQL pour Supabase PostgreSQL
-- ClicSal API - Généré le 8 février 2026

-- ========================================
-- EXTENSION POSTGIS (Géolocalisation)
-- ========================================
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================
-- ENUMS
-- ========================================

CREATE TYPE "UserRole" AS ENUM ('member', 'staff', 'owner', 'super_admin');
CREATE TYPE "MembershipType" AS ENUM ('daily', 'weekly', 'monthly', 'quarterly', 'yearly');
CREATE TYPE "MembershipStatus" AS ENUM ('active', 'expired', 'suspended', 'cancelled');
CREATE TYPE "PaymentMethod" AS ENUM ('wave', 'orange_money', 'cash', 'credit_card');
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'paid', 'failed', 'refunded');
CREATE TYPE "PaymentType" AS ENUM ('membership', 'session_pass', 'product');
CREATE TYPE "CheckInType" AS ENUM ('entry', 'exit');
CREATE TYPE "AuthProvider" AS ENUM ('firebase_phone', 'google', 'apple', 'email', 'magic_link');

-- ========================================
-- TABLES
-- ========================================

CREATE TABLE "users" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "first_name" VARCHAR,
    "last_name" VARCHAR,
    "email" VARCHAR UNIQUE,
    "phone" VARCHAR UNIQUE NOT NULL,
    "photo_url" VARCHAR,
    "role" "UserRole" DEFAULT 'member' NOT NULL,
    "auth_provider" "AuthProvider" DEFAULT 'magic_link' NOT NULL,
    "firebase_uid" VARCHAR UNIQUE,
    "is_verified" BOOLEAN DEFAULT false NOT NULL,
    "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
    "updated_at" TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE "magic_links" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "token" VARCHAR UNIQUE NOT NULL,
    "phone" VARCHAR NOT NULL,
    "user_id" UUID,
    "used" BOOLEAN DEFAULT false NOT NULL,
    "expires_at" TIMESTAMP NOT NULL,
    "used_at" TIMESTAMP,
    "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE TABLE "gyms" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "name" VARCHAR NOT NULL,
    "address" VARCHAR NOT NULL,
    "city" VARCHAR NOT NULL,
    "latitude" DECIMAL(10, 8) NOT NULL,
    "longitude" DECIMAL(11, 8) NOT NULL,
    "owner_id" UUID NOT NULL,
    "exit_qr_code" VARCHAR UNIQUE NOT NULL,
    "is_active" BOOLEAN DEFAULT true NOT NULL,
    "deleted_at" TIMESTAMP,
    "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
    "updated_at" TIMESTAMP DEFAULT NOW() NOT NULL,
    FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE TABLE "gym_staff" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "gym_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "permissions" JSONB DEFAULT '{}' NOT NULL,
    "is_active" BOOLEAN DEFAULT true NOT NULL,
    "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
    FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE CASCADE,
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
    UNIQUE ("gym_id", "user_id")
);

CREATE TABLE "memberships" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "gym_id" UUID NOT NULL,
    "type" "MembershipType" NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" "MembershipStatus" DEFAULT 'active' NOT NULL,
    "remaining_sessions" INTEGER,
    "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
    "updated_at" TIMESTAMP DEFAULT NOW() NOT NULL,
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
    FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE CASCADE
);

CREATE TABLE "session_passes" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "user_id" UUID,
    "gym_id" UUID NOT NULL,
    "validity_type" VARCHAR NOT NULL,
    "expires_at" TIMESTAMP NOT NULL,
    "used" BOOLEAN DEFAULT false NOT NULL,
    "used_at" TIMESTAMP,
    "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL,
    FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE CASCADE
);

CREATE TABLE "access_codes" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "code_value" VARCHAR UNIQUE NOT NULL,
    "user_id" UUID,
    "membership_id" UUID,
    "session_pass_id" UUID,
    "share_token" VARCHAR UNIQUE NOT NULL,
    "last_refreshed_at" TIMESTAMP DEFAULT NOW() NOT NULL,
    "expires_at" TIMESTAMP NOT NULL,
    "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL,
    FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE,
    FOREIGN KEY ("session_pass_id") REFERENCES "session_passes"("id") ON DELETE CASCADE
);

CREATE TABLE "check_ins" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "gym_id" UUID NOT NULL,
    "user_id" UUID,
    "access_code_id" UUID NOT NULL,
    "validated_by_staff_id" UUID,
    "type" "CheckInType" NOT NULL,
    "scanned_at" TIMESTAMP DEFAULT NOW() NOT NULL,
    FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE CASCADE,
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL,
    FOREIGN KEY ("access_code_id") REFERENCES "access_codes"("id") ON DELETE CASCADE,
    FOREIGN KEY ("validated_by_staff_id") REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE TABLE "products" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "gym_id" UUID NOT NULL,
    "name" VARCHAR NOT NULL,
    "price" DECIMAL(10, 2) NOT NULL,
    "stock_quantity" INTEGER DEFAULT 0 NOT NULL,
    "photo_url" VARCHAR,
    "is_active" BOOLEAN DEFAULT true NOT NULL,
    "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
    FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE CASCADE
);

CREATE TABLE "product_sales" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "product_id" UUID NOT NULL,
    "user_id" UUID,
    "gym_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "total_price" DECIMAL(10, 2) NOT NULL,
    "payment_method" "PaymentMethod" NOT NULL,
    "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE,
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL,
    FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE CASCADE
);

CREATE TABLE "payments" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "user_id" UUID,
    "gym_id" UUID NOT NULL,
    "payment_type" "PaymentType" NOT NULL,
    "reference_id" UUID NOT NULL,
    "amount" DECIMAL(10, 2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "provider_tx_id" VARCHAR UNIQUE,
    "status" "PaymentStatus" DEFAULT 'pending' NOT NULL,
    "webhook_payload" JSONB,
    "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
    "updated_at" TIMESTAMP DEFAULT NOW() NOT NULL,
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL,
    FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE CASCADE
);

-- ========================================
-- INDEXES (Performance)
-- ========================================

-- Users
CREATE INDEX "idx_users_phone" ON "users"("phone");
CREATE INDEX "idx_users_email" ON "users"("email");
CREATE INDEX "idx_users_firebase_uid" ON "users"("firebase_uid");

-- Magic Links
CREATE INDEX "idx_magic_links_token" ON "magic_links"("token");
CREATE INDEX "idx_magic_links_phone" ON "magic_links"("phone");
CREATE INDEX "idx_magic_links_expires" ON "magic_links"("expires_at");

-- Gyms (Géolocalisation)
CREATE INDEX "idx_gyms_lat_lng" ON "gyms"("latitude", "longitude");
CREATE INDEX "idx_gyms_owner" ON "gyms"("owner_id");

-- Gym Staff
CREATE INDEX "idx_gym_staff_user" ON "gym_staff"("user_id");

-- Memberships
CREATE INDEX "idx_memberships_user_status" ON "memberships"("user_id", "status");
CREATE INDEX "idx_memberships_gym_status" ON "memberships"("gym_id", "status");
CREATE INDEX "idx_memberships_end_date" ON "memberships"("end_date");

-- Session Passes
CREATE INDEX "idx_session_passes_gym_expires" ON "session_passes"("gym_id", "expires_at");
CREATE INDEX "idx_session_passes_user" ON "session_passes"("user_id");

-- Access Codes (ULTRA CRITIQUE pour performance check-in)
CREATE INDEX "idx_access_codes_code_value" ON "access_codes"("code_value");
CREATE INDEX "idx_access_codes_share_token" ON "access_codes"("share_token");
CREATE INDEX "idx_access_codes_expires" ON "access_codes"("expires_at");
CREATE INDEX "idx_access_codes_user" ON "access_codes"("user_id");

-- Check-ins (Dashboard live)
CREATE INDEX "idx_check_ins_gym_scanned" ON "check_ins"("gym_id", "scanned_at");
CREATE INDEX "idx_check_ins_user_scanned" ON "check_ins"("user_id", "scanned_at");
CREATE INDEX "idx_check_ins_access_code" ON "check_ins"("access_code_id");

-- Products
CREATE INDEX "idx_products_gym" ON "products"("gym_id");

-- Product Sales
CREATE INDEX "idx_product_sales_gym_created" ON "product_sales"("gym_id", "created_at");
CREATE INDEX "idx_product_sales_product" ON "product_sales"("product_id");

-- Payments
CREATE INDEX "idx_payments_gym_created" ON "payments"("gym_id", "created_at");
CREATE INDEX "idx_payments_user" ON "payments"("user_id");
CREATE INDEX "idx_payments_provider_tx" ON "payments"("provider_tx_id");
CREATE INDEX "idx_payments_status" ON "payments"("status");

-- ========================================
-- FONCTIONS UTILITAIRES
-- ========================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers pour updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON "users"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gyms_updated_at BEFORE UPDATE ON "gyms"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_memberships_updated_at BEFORE UPDATE ON "memberships"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON "payments"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- FONCTION GÉOLOCALISATION (Nearby Gyms)
-- ========================================

CREATE OR REPLACE FUNCTION find_nearby_gyms(
    user_lat DECIMAL,
    user_lng DECIMAL,
    radius_km INTEGER DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    name VARCHAR,
    address VARCHAR,
    city VARCHAR,
    distance_km DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        g.id,
        g.name,
        g.address,
        g.city,
        ROUND(
            CAST(
                ST_Distance(
                    ST_MakePoint(g.longitude, g.latitude)::geography,
                    ST_MakePoint(user_lng, user_lat)::geography
                ) / 1000 AS NUMERIC
            ), 2
        ) AS distance_km
    FROM gyms g
    WHERE 
        g.is_active = true 
        AND g.deleted_at IS NULL
        AND ST_DWithin(
            ST_MakePoint(g.longitude, g.latitude)::geography,
            ST_MakePoint(user_lng, user_lat)::geography,
            radius_km * 1000
        )
    ORDER BY distance_km ASC;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- FONCTION ANTI-FRAUDE (Détection QR dupliqués)
-- ========================================

CREATE OR REPLACE FUNCTION check_duplicate_checkin(
    p_access_code_id UUID,
    p_gym_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    last_entry TIMESTAMP;
    has_exit BOOLEAN;
BEGIN
    -- Récupérer la dernière entrée
    SELECT scanned_at INTO last_entry
    FROM check_ins
    WHERE access_code_id = p_access_code_id
      AND gym_id = p_gym_id
      AND type = 'entry'
    ORDER BY scanned_at DESC
    LIMIT 1;

    -- Si pas d'entrée précédente, OK
    IF last_entry IS NULL THEN
        RETURN TRUE;
    END IF;

    -- Vérifier s'il y a une sortie après la dernière entrée
    SELECT EXISTS(
        SELECT 1
        FROM check_ins
        WHERE access_code_id = p_access_code_id
          AND gym_id = p_gym_id
          AND type = 'exit'
          AND scanned_at > last_entry
    ) INTO has_exit;

    -- Si sortie trouvée, OK pour re-rentrer
    -- Sinon, refus (déjà inside)
    RETURN has_exit;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- SEED DATA (Optionnel - Dev uniquement)
-- ========================================

-- Super Admin (ClicSal Support)
INSERT INTO "users" (id, phone, role, first_name, last_name, is_verified)
VALUES (
    uuid_generate_v4(),
    '+221771234567',
    'super_admin',
    'Support',
    'ClicSal',
    true
);

-- Exemple de salle (Owner Dakar)
-- À adapter avec vraies données
