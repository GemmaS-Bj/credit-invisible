# CLAUDE.md — Crédit Invisible · GemmaS

> Fichier de contexte lu automatiquement par Claude Code à chaque session.
> Mis à jour par Duvalier (Lead Dev). Ne pas modifier sans validation en équipe.

---

## 🎯 Mission du projet

**Crédit Invisible** est une PWA de scoring crédit alternatif destinée aux commerçantes informelles d'Afrique de l'Ouest qui n'ont ni historique bancaire ni garantie formelle.

Le produit permet à une commerçante de saisir ses données commerciales quotidiennes (ventes, dettes fournisseurs, clients) — y compris par **commande vocale en Yoruba ou Français** — et génère un score 0–100 consultable par les IMF (Institutions de Microfinance) partenaires.

**Modèle économique :** B2B2C — la commerçante utilise l'app gratuitement ; l'IMF souscrit un abonnement pour accéder au dashboard et aux scores.

**Deadline concours Sahal Tech : 20 juin 2026.**

---

## 🏗️ Architecture mono-repo

```
credit-invisible/
├── apps/
│   ├── mobile/          # PWA commerçante (React 18 + TypeScript + Tailwind)
│   └── dashboard/       # Dashboard IMF (React 18 + TypeScript + Tailwind)
├── services/
│   ├── api/             # Backend REST (Node.js 20 + Express + TypeScript)
│   └── scoring/         # Moteur de scoring (Python 3.11 + Flask)
├── packages/
│   └── types/           # Types TypeScript partagés (interfaces, enums, DTOs)
├── infra/
│   └── supabase/        # Migrations SQL (PostgreSQL via Supabase)
├── docs/
│   ├── ARCHITECTURE.md
│   ├── SCORING.md
│   ├── API.md
│   └── SETUP.md
├── CLAUDE.md            # ← ce fichier
└── CONTRIBUTING.md
```

---

## 👥 Équipe & périmètres stricts

| Personne | Rôle | Périmètre autorisé |
|---|---|---|
| **Duvalier** | Lead Dev | Tout le repo, arbitrage archi |
| **Siméon** | Frontend expert | `apps/` uniquement |
| **Enock** | Backend expert | `services/api/` + `infra/` |
| **Gaby** | Backend expert | `services/scoring/` |

**Règle absolue :** chaque développeur ne touche que son périmètre. Toute modification hors périmètre doit être validée par Duvalier via PR.

---

## 🛠️ Stack technique

### Frontend (`apps/`)
- React 18 + TypeScript strict
- Tailwind CSS 3 (utilitaires uniquement, pas de CSS custom sauf variables)
- Vite (bundler)
- PWA : `vite-plugin-pwa` + Service Worker pour offline-first
- Zustand (state management léger)
- React Query (server state + cache)
- React Hook Form + Zod (formulaires + validation)
- i18next (internationalisation : Yoruba + Français)

### Backend API (`services/api/`)
- Node.js 20 LTS + Express 4 + TypeScript strict
- Supabase JS Client (PostgreSQL)
- `jsonwebtoken` (JWT RS256)
- `zod` (validation des entrées)
- `helmet` + `cors` + `express-rate-limit` (sécurité)
- `winston` (logging structuré JSON)

### Scoring (`services/scoring/`)
- Python 3.11 + Flask 3
- `pandas` + `numpy` (calculs statistiques)
- `openai` SDK (Whisper API pour la transcription vocale)
- `supabase-py` (lecture PostgreSQL)
- `pydantic` (validation des données)

### Infrastructure
- **Hébergement :** Vercel (apps) + Railway (api + scoring) + Supabase Free (BDD)
- **CI/CD :** GitHub Actions
- **Coût : 0 FCFA**

---

## 🔑 Variables d'environnement

### `services/api/.env`
```env
DATABASE_URL=postgresql://...          # URL Supabase pooler (Transaction mode)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
JWT_SECRET=<secret-256-bits-minimum>
JWT_EXPIRES_IN=7d
SCORING_SERVICE_URL=http://localhost:5000
NODE_ENV=development
PORT=3000
```

### `services/scoring/.env`
```env
OPENAI_API_KEY=sk-...                  # Pour Whisper API
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
FLASK_ENV=development
PORT=5000
```

### `apps/mobile/.env` & `apps/dashboard/.env`
```env
VITE_API_URL=http://localhost:3000
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

**Ne jamais committer de valeurs réelles.** Utiliser `.env.example` pour partager la structure.

---

## 📡 Routes API principales

| Méthode | Route | Service | Description |
|---|---|---|---|
| POST | `/auth/register` | api | Inscription commerçante |
| POST | `/auth/login` | api | Authentification JWT |
| POST | `/merchants` | api | Créer profil commerçante |
| GET | `/merchants/:id` | api | Récupérer profil |
| POST | `/entries` | api | Saisie journalière (ventes, dettes) |
| GET | `/scores/:merchantId` | api → scoring | Score calculé en temps réel |
| GET | `/imf/dashboard` | api | Vue agrégée pour IMF |

Voir `docs/API.md` pour la spécification complète (corps, réponses, codes erreur).

---

## 📊 Les 5 indicateurs de scoring

Le score final est un entier **0–100** calculé par `services/scoring/`.

| # | Indicateur | Poids |
|---|---|---|
| 1 | Régularité des ventes (variance hebdomadaire) | 25% |
| 2 | Tendance de croissance (MoM) | 20% |
| 3 | Diversification clients | 15% |
| 4 | Gestion dettes fournisseurs | 25% |
| 5 | Ancienneté + saisonnalité | 15% |

Voir `docs/SCORING.md` pour les formules exactes, les seuils et la logique de normalisation.

---

## 🎙️ Saisie vocale

- **API :** OpenAI Whisper (`whisper-1`)
- **Langues supportées :** Yoruba (`yo`), Français (`fr`)
- **Flux :** `apps/mobile` enregistre un `.webm` → envoie à `services/api/POST /entries/voice` → l'API transfère à `services/scoring/POST /transcribe` → Whisper retourne la transcription → l'API parse et crée l'entrée
- **Fallback :** si Whisper échoue (réseau, quota), la commerçante est redirigée vers le formulaire texte
- **Coût Whisper :** ~$0.006/min — prévoir un rate-limit de 10 req/heure/commerçante

---

## ✅ Conventions de code

### Général
- TypeScript strict mode (`"strict": true` dans `tsconfig.json`)
- ESLint + Prettier configurés à la racine
- Commits : format Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`)
- Branches : `feature/<ticket>-<description>` depuis `develop`
- PRs obligatoires vers `develop`; merge vers `main` = deploy production

### Naming
- **Variables/fonctions :** camelCase
- **Composants React :** PascalCase
- **Fichiers React :** PascalCase (`MerchantCard.tsx`)
- **Fichiers utilitaires :** kebab-case (`score-calculator.py`)
- **Tables SQL :** snake_case pluriel (`merchant_entries`)
- **Colonnes SQL :** snake_case (`created_at`, `merchant_id`)

### TypeScript
```typescript
// ✅ Toujours typer les retours de fonction
async function getMerchant(id: string): Promise<Merchant | null> { ... }

// ✅ Préférer les interfaces aux types pour les objets
interface MerchantEntry { ... }

// ❌ Jamais de `any` — utiliser `unknown` + guard
```

### Python
```python
# ✅ Type hints partout
def calculate_score(entries: list[Entry]) -> ScoreResult:

# ✅ Pydantic pour la validation
class Entry(BaseModel):
    amount: float
    date: date
```

---

## 🚫 Ce que Claude NE DOIT PAS faire

1. **Modifier des fichiers hors périmètre** d'un développeur sans demande explicite de Duvalier
2. **Générer du SQL de migration** sans le placer dans `infra/supabase/migrations/`
3. **Hardcoder des clés API** ou des valeurs d'environnement dans le code
4. **Supprimer des migrations existantes** — toujours ajouter une nouvelle migration
5. **Changer le schéma de scoring** sans mettre à jour `docs/SCORING.md`
6. **Installer des dépendances npm payantes** — budget hébergement 0 FCFA
7. **Casser la compatibilité offline** de `apps/mobile` — la PWA doit fonctionner sans réseau

---

## 🔗 Références rapides

| Ressource | Lien |
|---|---|
| Architecture | `docs/ARCHITECTURE.md` |
| Algorithme scoring | `docs/SCORING.md` |
| Spec API | `docs/API.md` |
| Installation locale | `docs/SETUP.md` |
| Guide contribution | `CONTRIBUTING.md` |

---

*Dernière mise à jour : juin 2026 — Duvalier*