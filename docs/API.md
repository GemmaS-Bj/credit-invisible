# docs/API.md — Crédit Invisible · GemmaS

> Spécification complète de l'API REST — `services/api/`
> Base URL production : `https://api.credit-invisible.railway.app`
> Base URL local : `http://localhost:3000`

---

## Conventions générales

### Format des réponses

Toutes les réponses sont en JSON. Structure standard :

```json
// Succès
{
  "success": true,
  "data": { ... }
}

// Erreur
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Le champ amount est requis",
    "details": { "field": "amount" }
  }
}
```

### Codes d'erreur métier

| Code | HTTP | Description |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Corps de requête invalide (Zod) |
| `UNAUTHORIZED` | 401 | Token JWT absent ou expiré |
| `FORBIDDEN` | 403 | Ressource hors périmètre |
| `NOT_FOUND` | 404 | Ressource inexistante |
| `CONFLICT` | 409 | Ressource déjà existante |
| `INSUFFICIENT_DATA` | 422 | Pas assez d'entrées pour scorer |
| `RATE_LIMITED` | 429 | Trop de requêtes |
| `INTERNAL_ERROR` | 500 | Erreur serveur |

### Authentification

Toutes les routes sauf `/auth/*` nécessitent :
Authorization: Bearer <jwt_token>

### Pagination

Routes retournant des listes :
GET /route?page=1&limit=20
```json
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 145,
      "totalPages": 8
    }
  }
}
```

---

## Auth

### POST /auth/register

Inscription d'une nouvelle commerçante.

**Corps**
```json
{
  "phone": "+22961234567",
  "pin": "1234",
  "name": "Fatima Diallo",
  "businessName": "Boutique Fatima",
  "sector": "alimentation",
  "location": "Cotonou, Bénin"
}
```

| Champ | Type | Requis | Validation |
|---|---|---|---|
| `phone` | string | ✅ | Format E.164, unique |
| `pin` | string | ✅ | 4 chiffres exactement |
| `name` | string | ✅ | 2–100 caractères |
| `businessName` | string | ❌ | Max 150 caractères |
| `sector` | string | ❌ | Enum : `alimentation`, `textile`, `cosmetique`, `electronique`, `autre` |
| `location` | string | ❌ | Max 100 caractères |

**Réponse 201**
```json
{
  "success": true,
  "data": {
    "merchant": {
      "id": "uuid",
      "phone": "+22961234567",
      "name": "Fatima Diallo",
      "businessName": "Boutique Fatima",
      "sector": "alimentation",
      "location": "Cotonou, Bénin",
      "createdAt": "2026-06-01T10:00:00Z"
    },
    "token": "eyJ..."
  }
}
```

**Erreurs possibles**
- `409 CONFLICT` — numéro de téléphone déjà enregistré
- `400 VALIDATION_ERROR` — PIN pas 4 chiffres, téléphone format invalide

---

### POST /auth/login

Connexion d'une commerçante existante.

**Corps**
```json
{
  "phone": "+22961234567",
  "pin": "1234"
}
```

**Réponse 200**
```json
{
  "success": true,
  "data": {
    "merchant": {
      "id": "uuid",
      "phone": "+22961234567",
      "name": "Fatima Diallo"
    },
    "token": "eyJ..."
  }
}
```

**Erreurs possibles**
- `401 UNAUTHORIZED` — téléphone inconnu ou PIN incorrect
- `429 RATE_LIMITED` — 5 tentatives échouées → blocage 15 minutes

---

## Merchants

### POST /merchants

Compléter ou mettre à jour le profil d'une commerçante.
🔒 Auth requise — la commerçante ne peut modifier que son propre profil.

**Corps**
```json
{
  "businessName": "Boutique Fatima & Sœurs",
  "sector": "textile",
  "location": "Porto-Novo, Bénin",
  "consentImf": true
}
```

| Champ | Type | Description |
|---|---|---|
| `businessName` | string | Nom du commerce |
| `sector` | string | Secteur d'activité |
| `location` | string | Localisation |
| `consentImf` | boolean | Consentement partage données avec IMF |

**Réponse 200**
```json
{
  "success": true,
  "data": {
    "merchant": {
      "id": "uuid",
      "name": "Fatima Diallo",
      "businessName": "Boutique Fatima & Sœurs",
      "sector": "textile",
      "location": "Porto-Novo, Bénin",
      "consentImf": true,
      "createdAt": "2026-06-01T10:00:00Z"
    }
  }
}
```

---

### GET /merchants/:id

Récupérer le profil d'une commerçante.
🔒 Auth requise — commerçante (son propre profil) ou IMF (si `consentImf: true`).

**Paramètres URL**
- `id` : UUID de la commerçante

**Réponse 200**
```json
{
  "success": true,
  "data": {
    "merchant": {
      "id": "uuid",
      "name": "Fatima Diallo",
      "businessName": "Boutique Fatima & Sœurs",
      "sector": "textile",
      "location": "Porto-Novo, Bénin",
      "consentImf": true,
      "createdAt": "2026-06-01T10:00:00Z",
      "entriesCount": 47
    }
  }
}
```

**Erreurs possibles**
- `403 FORBIDDEN` — IMF demande une commerçante sans consentement
- `404 NOT_FOUND` — UUID inexistant

---

## Entries

### POST /entries

Saisie journalière manuelle.
🔒 Auth requise — commerçante uniquement.

**Corps**
```json
{
  "entryDate": "2026-06-15",
  "salesAmount": 45000,
  "clientCount": 8,
  "debtPaid": 5000,
  "debtNew": 0,
  "notes": "Bonne journée, marché hebdomadaire"
}
```

| Champ | Type | Requis | Validation |
|---|---|---|---|
| `entryDate` | string (ISO date) | ✅ | Format YYYY-MM-DD, pas dans le futur |
| `salesAmount` | number | ✅ | >= 0, max 10 000 000 FCFA |
| `clientCount` | integer | ❌ | >= 0, défaut 0 |
| `debtPaid` | number | ❌ | >= 0, défaut 0 |
| `debtNew` | number | ❌ | >= 0, défaut 0 |
| `notes` | string | ❌ | Max 500 caractères |

**Réponse 201**
```json
{
  "success": true,
  "data": {
    "entry": {
      "id": "uuid",
      "merchantId": "uuid",
      "entryDate": "2026-06-15",
      "salesAmount": 45000,
      "clientCount": 8,
      "debtPaid": 5000,
      "debtNew": 0,
      "notes": "Bonne journée, marché hebdomadaire",
      "source": "manual",
      "createdAt": "2026-06-15T18:30:00Z"
    }
  }
}
```

**Erreurs possibles**
- `409 CONFLICT` — entrée déjà existante pour cette date
- `400 VALIDATION_ERROR` — date future, montant négatif

---

### POST /entries/voice

Saisie journalière par commande vocale.
🔒 Auth requise — commerçante uniquement.
⚠️ Rate limit : 10 requêtes/heure/commerçante.

**Corps** — `multipart/form-data`
audio: <fichier WebM/Opus, max 10 MB, max 30 secondes>

lang:  "yo" | "fr"

entryDate: "2026-06-15"  (optionnel, défaut = aujourd'hui)

**Flux interne**
1. Validation du fichier audio (format, taille, durée)
2. Transfert à `services/scoring POST /transcribe`
3. Whisper retourne la transcription
4. Parse NLP : extraction `salesAmount`, `clientCount`, `debtPaid`, `debtNew`
5. Création de l'entrée en base (`source: "voice"`)
6. Retour de l'entrée + transcription pour confirmation UI

**Réponse 201**
```json
{
  "success": true,
  "data": {
    "entry": {
      "id": "uuid",
      "merchantId": "uuid",
      "entryDate": "2026-06-15",
      "salesAmount": 5000,
      "clientCount": 3,
      "debtPaid": 0,
      "debtNew": 0,
      "source": "voice",
      "createdAt": "2026-06-15T18:30:00Z"
    },
    "transcription": "J'ai vendu cinq mille francs aujourd'hui, trois clients",
    "confidence": 0.94
  }
}
```

**Erreurs possibles**
- `400 VALIDATION_ERROR` — fichier trop grand, format non supporté
- `422 UNPROCESSABLE` — transcription impossible à parser (valeurs non détectées)
- `429 RATE_LIMITED` — quota horaire dépassé

---

### GET /entries

Historique des entrées d'une commerçante.
🔒 Auth requise.

**Query params**
?merchantId=uuid    (requis pour IMF, ignoré pour commerçante — utilise son propre ID)

&from=2026-01-01    (optionnel, ISO date)

&to=2026-06-30      (optionnel, ISO date)

&page=1

&limit=30

**Réponse 200**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "entryDate": "2026-06-15",
        "salesAmount": 45000,
        "clientCount": 8,
        "debtPaid": 5000,
        "debtNew": 0,
        "source": "manual"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 30,
      "total": 47,
      "totalPages": 2
    }
  }
}
```

---

## Scores

### GET /scores/:merchantId

Calcul et retour du score d'une commerçante.
🔒 Auth requise — commerçante (son propre score) ou IMF (si `consentImf: true`).

**Paramètres URL**
- `merchantId` : UUID de la commerçante

**Query params**
?refresh=true    (optionnel — force recalcul, sinon retourne le score caché < 24h)

**Réponse 200**
```json
{
  "success": true,
  "data": {
    "merchantId": "uuid",
    "score": 72,
    "breakdown": {
      "regularity":      80.5,
      "growth":          65.2,
      "diversification": 70.0,
      "debt":            85.0,
      "seniority":       48.3
    },
    "entriesCount": 47,
    "calculatedAt": "2026-06-15T18:30:00Z",
    "isFromCache": false
  }
}
```

**Erreurs possibles**
- `403 FORBIDDEN` — IMF sans consentement commerçante
- `422 INSUFFICIENT_DATA` — moins de 14 entrées disponibles

**Réponse 422**
```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_DATA",
    "message": "Minimum 14 entrées requises pour calculer un score.",
    "details": {
      "entriesCount": 9,
      "required": 14,
      "missingDays": 5
    }
  }
}
```

---

## IMF Dashboard

### GET /imf/dashboard

Vue agrégée de toutes les commerçantes ayant consenti au partage.
🔒 Auth IMF requise — header `X-IMF-Key: <api_key>`.

**Query params**
?page=1

&limit=20

&sector=alimentation          (optionnel — filtrer par secteur)

&scoreMin=60                  (optionnel — filtrer par score minimum)

&scoreMax=100                 (optionnel)

&location=Cotonou             (optionnel — filtrer par localisation)

&sortBy=score                 (optionnel — score | createdAt | name)

&sortOrder=desc               (optionnel — asc | desc)

**Réponse 200**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalMerchants": 124,
      "avgScore": 61.4,
      "scoreDistribution": {
        "excellent": 18,
        "good": 42,
        "average": 37,
        "fragile": 20,
        "insufficient": 7
      }
    },
    "items": [
      {
        "merchantId": "uuid",
        "name": "Fatima Diallo",
        "businessName": "Boutique Fatima",
        "sector": "textile",
        "location": "Porto-Novo, Bénin",
        "score": 72,
        "entriesCount": 47,
        "lastEntryDate": "2026-06-14",
        "scoredAt": "2026-06-15T18:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 124,
      "totalPages": 7
    }
  }
}
```

---

## Middleware & sécurité

### Rate limiting
POST /auth/login          → 5 req / 15 min / IP

POST /entries/voice       → 10 req / heure / merchant

GET  /scores/:merchantId  → 30 req / heure / IMF key

Autres routes             → 100 req / 15 min / IP

### Validation Zod — exemple implémentation

```typescript
// services/api/src/validators/entryValidator.ts
import { z } from 'zod';

export const createEntrySchema = z.object({
  entryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD requis')
    .refine(d => new Date(d) <= new Date(), 'Date future non autorisée'),
  salesAmount: z.number().min(0).max(10_000_000),
  clientCount: z.number().int().min(0).default(0),
  debtPaid:    z.number().min(0).default(0),
  debtNew:     z.number().min(0).default(0),
  notes:       z.string().max(500).optional(),
});

export type CreateEntryDto = z.infer<typeof createEntrySchema>;
```

### Auth middleware

```typescript
// services/api/src/middleware/authMiddleware.ts
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Token manquant' }
    });
  }

  try {
    const token = header.split(' ')[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET!);
    req.user = payload as JwtPayload;
    next();
  } catch {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Token invalide ou expiré' }
    });
  }
}
```

---

## Types partagés (`packages/types/`)

```typescript
// packages/types/src/index.ts

export interface Merchant {
  id:           string;
  phone:        string;
  name:         string;
  businessName: string | null;
  sector:       MerchantSector | null;
  location:     string | null;
  consentImf:   boolean;
  createdAt:    string;
}

export type MerchantSector =
  | 'alimentation'
  | 'textile'
  | 'cosmetique'
  | 'electronique'
  | 'autre';

export interface MerchantEntry {
  id:          string;
  merchantId:  string;
  entryDate:   string;
  salesAmount: number;
  clientCount: number;
  debtPaid:    number;
  debtNew:     number;
  notes:       string | null;
  source:      'manual' | 'voice';
  createdAt:   string;
}

export interface ScoreResult {
  merchantId:   string;
  score:        number;
  breakdown: {
    regularity:      number;
    growth:          number;
    diversification: number;
    debt:            number;
    seniority:       number;
  };
  entriesCount: number;
  calculatedAt: string;
  isFromCache:  boolean;
}

export interface ApiResponse<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: {
    code:     string;
    message:  string;
    details?: Record<string, unknown>;
  };
}
```