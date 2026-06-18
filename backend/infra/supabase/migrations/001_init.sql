-- =============================================================================
-- 001_init.sql — Crédit Invisible · GemmaS
-- Schéma initial PostgreSQL via Supabase
-- Ne jamais modifier ce fichier — créer une nouvelle migration si besoin
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- Merchants — commerçantes
-- ---------------------------------------------------------------------------

CREATE TABLE merchants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone         VARCHAR(20) UNIQUE NOT NULL,
  pin_hash      VARCHAR(255) NOT NULL,               -- bcrypt hash du PIN 4 chiffres
  name          VARCHAR(100) NOT NULL,
  business_name VARCHAR(150),
  sector        VARCHAR(50)
                  CHECK (sector IN (
                    'alimentation', 'textile',
                    'cosmetique', 'electronique', 'autre'
                  )),
  location      VARCHAR(100),
  consent_imf   BOOLEAN NOT NULL DEFAULT FALSE,      -- consentement explicite partage IMF
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_merchants_phone ON merchants (phone);
CREATE INDEX idx_merchants_sector ON merchants (sector);
CREATE INDEX idx_merchants_consent ON merchants (consent_imf);

-- ---------------------------------------------------------------------------
-- Merchant entries — saisies journalières
-- ---------------------------------------------------------------------------

CREATE TABLE merchant_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id   UUID NOT NULL REFERENCES merchants (id) ON DELETE CASCADE,
  entry_date    DATE NOT NULL,
  sales_amount  NUMERIC(12, 2) NOT NULL CHECK (sales_amount >= 0),
  client_count  INTEGER NOT NULL DEFAULT 0 CHECK (client_count >= 0),
  debt_paid     NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (debt_paid >= 0),
  debt_new      NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (debt_new >= 0),
  notes         TEXT,
  source        VARCHAR(20) NOT NULL DEFAULT 'manual'
                  CHECK (source IN ('manual', 'voice')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Une seule entrée par jour par commerçante
  UNIQUE (merchant_id, entry_date)
);

CREATE INDEX idx_entries_merchant_id   ON merchant_entries (merchant_id);
CREATE INDEX idx_entries_entry_date    ON merchant_entries (entry_date DESC);
CREATE INDEX idx_entries_merchant_date ON merchant_entries (merchant_id, entry_date DESC);

-- ---------------------------------------------------------------------------
-- Merchant scores — cache des scores calculés
-- ---------------------------------------------------------------------------

CREATE TABLE merchant_scores (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id            UUID NOT NULL REFERENCES merchants (id) ON DELETE CASCADE,
  score                  INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  score_regularity       NUMERIC(5, 2) NOT NULL CHECK (score_regularity BETWEEN 0 AND 100),
  score_growth           NUMERIC(5, 2) NOT NULL CHECK (score_growth BETWEEN 0 AND 100),
  score_diversification  NUMERIC(5, 2) NOT NULL CHECK (score_diversification BETWEEN 0 AND 100),
  score_debt             NUMERIC(5, 2) NOT NULL CHECK (score_debt BETWEEN 0 AND 100),
  score_seniority        NUMERIC(5, 2) NOT NULL CHECK (score_seniority BETWEEN 0 AND 100),
  entries_count          INTEGER NOT NULL,
  calculated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Un seul score actif par commerçante — le plus récent est utilisé
CREATE INDEX idx_scores_merchant_id    ON merchant_scores (merchant_id);
CREATE INDEX idx_scores_calculated_at  ON merchant_scores (calculated_at DESC);

-- ---------------------------------------------------------------------------
-- IMF institutions — partenaires microfinance
-- ---------------------------------------------------------------------------

CREATE TABLE imf_institutions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(150) NOT NULL,
  api_key    VARCHAR(64) UNIQUE NOT NULL,  -- clé d'accès dashboard IMF
  plan       VARCHAR(20) NOT NULL DEFAULT 'trial'
               CHECK (plan IN ('trial', 'standard', 'premium')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_imf_api_key ON imf_institutions (api_key);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE merchants         ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_entries  ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_scores   ENABLE ROW LEVEL SECURITY;
ALTER TABLE imf_institutions  ENABLE ROW LEVEL SECURITY;

-- Commerçante : lecture de son propre profil uniquement
CREATE POLICY merchant_self_select ON merchants
  FOR SELECT
  USING (auth.uid()::text = id::text);

-- Commerçante : mise à jour de son propre profil uniquement
CREATE POLICY merchant_self_update ON merchants
  FOR UPDATE
  USING (auth.uid()::text = id::text);

-- Entrées : une commerçante lit et écrit uniquement ses propres entrées
CREATE POLICY entries_self_select ON merchant_entries
  FOR SELECT
  USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE auth.uid()::text = id::text
    )
  );

CREATE POLICY entries_self_insert ON merchant_entries
  FOR INSERT
  WITH CHECK (
    merchant_id IN (
      SELECT id FROM merchants WHERE auth.uid()::text = id::text
    )
  );

-- Scores : une commerçante lit uniquement son propre score
CREATE POLICY scores_self_select ON merchant_scores
  FOR SELECT
  USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE auth.uid()::text = id::text
    )
  );

-- ---------------------------------------------------------------------------
-- Fonction trigger : updated_at automatique
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER merchants_updated_at
  BEFORE UPDATE ON merchants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();