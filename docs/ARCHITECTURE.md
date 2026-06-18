# docs/ARCHITECTURE.md — Crédit Invisible · GemmaS

## Vue d'ensemble
┌─────────────────────────────────────────────────────────────┐

│                        UTILISATEURS                          │

│   Commerçante (PWA mobile)    IMF Agent (Dashboard web)      │

└──────────────┬───────────────────────────┬───────────────────┘

│                           │

▼                           ▼

┌──────────────────────────┐   ┌───────────────────────────┐

│   apps/mobile (PWA)      │   │   apps/dashboard          │

│   React 18 + Tailwind    │   │   React 18 + Tailwind     │

│   Vercel CDN             │   │   Vercel CDN              │

└──────────────┬───────────┘   └──────────────┬────────────┘

│                              │

└──────────────┬───────────────┘

│ HTTPS + JWT

▼

┌──────────────────────────────┐

│      services/api            │

│      Node.js/Express         │

│      Railway                 │

└────────┬─────────┬───────────┘

│         │

PostgreSQL │         │ HTTP interne

(Supabase) │         ▼

│  ┌──────────────────┐

│  │ services/scoring  │

│  │ Python/Flask      │

│  │ Railway           │

│  └──────┬────────────┘

│         │

│         │ Whisper API

│         ▼

│  ┌──────────────────┐

│  │  OpenAI (externe) │

│  └──────────────────┘

▼

┌──────────────────────────────┐

│      Supabase Free            │

│      PostgreSQL               │

│      + Row Level Security     │

└──────────────────────────────┘

---

## Décisions d'architecture (ADR)

### ADR-001 — Mono-repo avec workspaces npm

**Décision :** Un seul repo Git, workspaces npm pour les packages partagés.

**Pourquoi :** L'équipe est petite (4 personnes), les types TypeScript sont partagés entre `apps/` et `services/api/`. Un mono-repo évite la synchronisation de versions entre repos séparés et simplifie la CI.

**Trade-off :** Déploiements légèrement plus complexes (Vercel + Railway lisent des sous-dossiers), mais géré par la config dans `vercel.json` et `railway.json`.

---

### ADR-002 — Séparation API Node.js / Scoring Python

**Décision :** Le scoring est un microservice Python indépendant, appelé par l'API Node.js.

**Pourquoi :** Les calculs statistiques (pandas, numpy) sont nativement plus expressifs en Python. L'équipe (Gaby) a une expertise Python. Séparer les responsabilités permet à Gaby d'itérer sur les algorithmes sans toucher au backend principal.

**Communication :** HTTP interne sur Railway (réseau privé, pas exposé à internet). L'API Node.js est le seul point d'entrée public.

**Trade-off :** Latence additionnelle (~10ms réseau interne Railway). Acceptable pour un score calculé à la demande (pas en temps réel streaming).

---

### ADR-003 — Supabase Free comme base de données

**Décision :** PostgreSQL via Supabase Free tier.

**Pourquoi :** Contrainte budgétaire 0 FCFA. Supabase offre PostgreSQL managé, Row Level Security (RLS), migrations versionnées, et un SDK JS/Python. Le free tier (500 MB, 2 projets) est suffisant pour le concours.

**Row Level Security :** Activé sur toutes les tables. Une commerçante ne peut lire que ses propres données. Une IMF ne voit que les commerçantes ayant consenti au partage.

**Trade-off :** Pause automatique après 7 jours d'inactivité (free tier). Mitigation : ping cron job toutes les 5 jours via GitHub Actions.

---

### ADR-004 — JWT RS256 côté API Node.js (pas Supabase Auth)

**Décision :** Gestion auth custom avec `jsonwebtoken` RS256, pas Supabase Auth.

**Pourquoi :** Supabase Auth est orienté email/password et OAuth. Notre app nécessite un flow d'inscription spécifique (numéro de téléphone + PIN pour les commerçantes peu alphabétisées). RS256 permet au service scoring de vérifier les tokens sans partager le secret.

**Trade-off :** Plus de code à maintenir vs Supabase Auth clé-en-main. Justifié par le besoin UX spécifique.

---

### ADR-005 — PWA offline-first pour `apps/mobile`

**Décision :** Service Worker avec stratégie cache-first pour les assets, network-first pour les données.

**Pourquoi :** Connectivité intermittente en Afrique de l'Ouest. Une commerçante doit pouvoir saisir ses entrées sans réseau. Les entrées sont stockées en IndexedDB et synchronisées au retour de la connexion.

**Implémentation :**
- `vite-plugin-pwa` génère le Service Worker automatiquement
- Workbox gère les stratégies de cache
- File d'attente de sync (`BackgroundSync API`) pour les entrées hors-ligne

---

## Schéma de base de données

```sql
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
```

---

## Flux de données — Saisie vocale

Commerçante appuie "🎙️ Parler"

└─ apps/mobile enregistre WebM/Opus (MediaRecorder API)
Upload vers services/api

POST /entries/voice  { audio: File, lang: "yo"|"fr" }

└─ Middleware auth vérifie JWT

└─ Rate limit : 10 req/heure/merchant
services/api transfère à services/scoring

POST /transcribe  { audio: base64, lang: "yo"|"fr" }
services/scoring appelle Whisper API

openai.audio.transcriptions.create(model="whisper-1", language="yo")

└─ Retourne texte : "J'ai vendu cinq mille francs aujourd'hui, trois clients"
services/scoring parse la transcription (regex + NLP léger)

└─ Extrait : { sales_amount: 5000, client_count: 3 }

└─ Retourne à services/api
services/api crée l'entrée en base

INSERT INTO merchant_entries (...)

└─ Retourne 201 à apps/mobile
apps/mobile affiche confirmation + met à jour le cache local


---

## Flux de données — Calcul de score

IMF agent ouvre le dashboard

GET /scores/:merchantId  (header: Authorization: Bearer <imf-jwt>)
services/api

└─ Vérifie JWT IMF

└─ Vérifie consentement merchant (consent_imf = true)

└─ Récupère les 90 dernières entrées depuis Supabase
services/api appelle services/scoring

POST /calculate  { merchant_id, entries: [...] }
services/scoring calcule les 5 indicateurs

└─ Retourne { score: 72, breakdown: { regularity: 80, growth: 65, ... } }
services/api persiste le score dans merchant_scores

└─ Retourne le score complet à apps/dashboard


---

## Sécurité

| Couche | Mesure |
|---|---|
| Transport | HTTPS partout (Vercel + Railway fournissent TLS) |
| Auth | JWT RS256, expiration 7j, refresh token rotation |
| API | `helmet` (headers sécurité), `cors` (origines whitelist), `express-rate-limit` |
| BDD | Row Level Security Supabase sur toutes les tables |
| Données | Consentement explicite avant partage IMF (`consent_imf`) |
| Vocal | Audio non stocké — transcription uniquement |
| Secrets | Variables d'environnement uniquement, jamais en code |

---

## Performance & limites free tier

| Ressource | Limite | Mitigation |
|---|---|---|
| Supabase Free | 500 MB, 2 GB bandwidth | Pagination stricte (max 100 rows), pas de JOIN inutiles |
| Railway Free | 500h/mois compute | Services stoppés la nuit (cron restart matin) |
| Vercel Free | 100 GB bandwidth | Assets optimisés, images WebP |
| Whisper API | Pay-per-use (~$0.006/min) | Rate limit 10 req/h/merchant, durée max 30s |
| Supabase pause | Pause après 7j inactivité | Ping cron GitHub Actions toutes les 5 jours |