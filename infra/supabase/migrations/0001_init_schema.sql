
-- Commerçantes
CREATE TABLE merchants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone         VARCHAR(20) UNIQUE NOT NULL,
  name          VARCHAR(100) NOT NULL,
  business_name VARCHAR(150),
  sector        VARCHAR(50),          -- alimentation, textile, cosmétique…
  location      VARCHAR(100),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  consent_imf   BOOLEAN DEFAULT FALSE -- consentement partage avec IMF
);

-- Entrées journalières (cœur du scoring)
CREATE TABLE merchant_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id   UUID REFERENCES merchants(id) ON DELETE CASCADE,
  entry_date    DATE NOT NULL,
  sales_amount  NUMERIC(12,2) NOT NULL,  -- ventes du jour en FCFA
  client_count  INTEGER DEFAULT 0,        -- nombre de clients distincts
  debt_paid     NUMERIC(12,2) DEFAULT 0,  -- dette fournisseur remboursée
  debt_new      NUMERIC(12,2) DEFAULT 0,  -- nouvelle dette contractée
  notes         TEXT,
  source        VARCHAR(20) DEFAULT 'manual', -- manual | voice
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(merchant_id, entry_date)         -- 1 entrée par jour par commerçante
);

-- Scores calculés (cache — recalculé à chaque demande IMF)
CREATE TABLE merchant_scores (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id           UUID REFERENCES merchants(id) ON DELETE CASCADE,
  score                 INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  score_regularity      NUMERIC(5,2),   -- sous-score régularité (0-100)
  score_growth          NUMERIC(5,2),   -- sous-score croissance
  score_diversification NUMERIC(5,2),   -- sous-score diversification
  score_debt            NUMERIC(5,2),   -- sous-score dettes
  score_seniority       NUMERIC(5,2),   -- sous-score ancienneté
  entries_count         INTEGER,        -- nb d'entrées utilisées
  calculated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- IMF partenaires
CREATE TABLE imf_institutions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(150) NOT NULL,
  api_key    VARCHAR(64) UNIQUE NOT NULL, -- clé d'accès dashboard
  plan       VARCHAR(20) DEFAULT 'trial', -- trial | standard | premium
  created_at TIMESTAMPTZ DEFAULT NOW()
);