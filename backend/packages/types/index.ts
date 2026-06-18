/**
 * packages/types/src/index.ts
 * Types TypeScript partagés — Crédit Invisible · GemmaS
 * Utilisés par : apps/mobile, apps/dashboard, services/api
 */

// ---------------------------------------------------------------------------
// Enums & union types
// ---------------------------------------------------------------------------

/** Secteurs d'activité supportés par la plateforme */
export type MerchantSector =
  | 'alimentation'
  | 'textile'
  | 'cosmetique'
  | 'electronique'
  | 'autre';

/** Source de saisie d'une entrée journalière */
export type EntrySource = 'manual' | 'voice';

/** Rôles possibles pour un utilisateur IMF */
export type IMFRole = 'admin' | 'agent' | 'readonly';

/** Niveaux de plan IMF */
export type IMFPlan = 'trial' | 'standard' | 'premium';

/** Langues supportées pour la saisie vocale */
export type VoiceLang = 'fr' | 'yo';

/** Codes d'erreur métier retournés par l'API */
export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INSUFFICIENT_DATA'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

// ---------------------------------------------------------------------------
// Merchant
// ---------------------------------------------------------------------------

/**
 * Profil complet d'une commerçante.
 * score est optionnel — présent uniquement si calculé et retourné avec le profil.
 */
export interface Merchant {
  id:           string;
  phone:        string;        // Format E.164 — ex: "+22961234567"
  name:         string;
  businessName: string | null;
  sector:       MerchantSector | null;
  location:     string | null;
  consentImf:   boolean;       // Consentement explicite au partage avec les IMF
  createdAt:    string;        // ISO 8601
  entriesCount?: number;       // Présent dans GET /merchants/:id
  score?:       number;        // 0–100, présent si inclus dans la réponse
}

// ---------------------------------------------------------------------------
// DailyEntry
// ---------------------------------------------------------------------------

/**
 * Entrée journalière de données commerciales d'une commerçante.
 * Correspond à la table merchant_entries en base.
 */
export interface DailyEntry {
  id:          string;
  merchantId:  string;
  entryDate:   string;      // Format YYYY-MM-DD
  salesAmount: number;      // Ventes du jour en FCFA (>= 0)
  clientCount: number;      // Nombre de clients distincts (>= 0)
  debtPaid:    number;      // Dette fournisseur remboursée ce jour (>= 0)
  debtNew:     number;      // Nouvelle dette contractée ce jour (>= 0)
  notes:       string | null;
  source:      EntrySource;
  createdAt:   string;      // ISO 8601
}

// ---------------------------------------------------------------------------
// Score
// ---------------------------------------------------------------------------

/**
 * Détail d'un sous-indicateur de scoring.
 * Utilisé pour afficher la décomposition du score dans le dashboard IMF.
 */
export interface ScoreBreakdown {
  label:         string;   // Libellé lisible — ex: "Régularité des ventes"
  score:         number;   // Sous-score brut (0–100)
  weight:        number;   // Poids dans le score final — ex: 0.25
  weightedScore: number;   // score × weight
}

/**
 * Score calculé pour une commerçante.
 * Correspond à la table merchant_scores en base.
 */
export interface Score {
  id:                    string;
  merchantId:            string;
  totalScore:            number;   // Score final arrondi (0–100)
  regularityScore:       number;   // S1 — Régularité des ventes (poids 25%)
  growthScore:           number;   // S2 — Tendance de croissance MoM (poids 20%)
  diversificationScore:  number;   // S3 — Diversification clients (poids 15%)
  debtScore:             number;   // S4 — Gestion dettes fournisseurs (poids 25%)
  ancienneteScore:       number;   // S5 — Ancienneté + saisonnalité (poids 15%)
  entriesCount:          number;   // Nombre d'entrées utilisées pour ce calcul
  calculatedAt:          string;   // ISO 8601
  isFromCache:           boolean;
}

// ---------------------------------------------------------------------------
// IMFUser
// ---------------------------------------------------------------------------

/**
 * Utilisateur d'une institution de microfinance (IMF).
 * Accède au dashboard via X-IMF-Key.
 */
export interface IMFUser {
  id:               string;
  name:             string;
  email:            string;
  organizationName: string;
  plan:             IMFPlan;
  role:             IMFRole;
  createdAt:        string;  // ISO 8601
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

/**
 * Tokens retournés après une authentification réussie.
 * expiresIn : durée en secondes (ex: 604800 pour 7 jours).
 */
export interface AuthTokens {
  accessToken:  string;
  refreshToken: string;
  expiresIn:    number;
}

// ---------------------------------------------------------------------------
// Scoring request / response
// ---------------------------------------------------------------------------

/**
 * Payload envoyé par services/api à services/scoring
 * pour déclencher le calcul d'un score.
 */
export interface ScoreRequest {
  merchantId:      string;
  merchantCreatedAt: string;  // ISO 8601 — requis pour S5 (ancienneté)
  entries:         DailyEntry[];
}

// ---------------------------------------------------------------------------
// API response wrappers
// ---------------------------------------------------------------------------

/**
 * Réponse API en succès.
 * Le champ data est générique pour couvrir tous les endpoints.
 */
export interface ApiResponse<T> {
  success: true;
  data:    T;
}

/**
 * Réponse API en erreur.
 */
export interface ApiError {
  success: false;
  error: {
    code:     ApiErrorCode;
    message:  string;
    details?: Record<string, unknown>;
  };
}

/**
 * Union type pratique pour typer les retours d'appels API
 * sans avoir à différencier manuellement succès/erreur partout.
 */
export type ApiResult<T> = ApiResponse<T> | ApiError;

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export interface PaginationMeta {
  page:       number;
  limit:      number;
  total:      number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  items:      T[];
  pagination: PaginationMeta;
}

// ---------------------------------------------------------------------------
// IMF Dashboard
// ---------------------------------------------------------------------------

/** Distribution des scores dans le dashboard IMF */
export interface ScoreDistribution {
  excellent:    number;   // 80–100
  good:         number;   // 60–79
  average:      number;   // 40–59
  fragile:      number;   // 20–39
  insufficient: number;   // 0–19
}

/** Résumé agrégé affiché en haut du dashboard IMF */
export interface IMFDashboardSummary {
  totalMerchants:    number;
  avgScore:          number;
  scoreDistribution: ScoreDistribution;
}

/** Item de liste dans le dashboard IMF */
export interface IMFMerchantListItem {
  merchantId:    string;
  name:          string;
  businessName:  string | null;
  sector:        MerchantSector | null;
  location:      string | null;
  score:         number;
  entriesCount:  number;
  lastEntryDate: string;   // YYYY-MM-DD
  scoredAt:      string;   // ISO 8601
}

// ---------------------------------------------------------------------------
// Voice entry
// ---------------------------------------------------------------------------

/** Réponse après une saisie vocale réussie */
export interface VoiceEntryResult {
  entry:         DailyEntry;
  transcription: string;
  confidence:    number;   // 0.0 – 1.0
}