# CONTRIBUTING.md — Crédit Invisible · GemmaS

## Périmètres stricts

Chaque développeur ne touche **que** son périmètre :

| Développeur | Périmètre |
|---|---|
| **Siméon** | `apps/` uniquement |
| **Enock** | `services/api/` + `infra/` |
| **Gaby** | `services/scoring/` |
| **Duvalier** | Tout le repo |

Toute modification hors périmètre = PR avec validation Duvalier obligatoire.

---

## Workflow Git
main          ← production (deploy auto Vercel/Railway)

develop       ← intégration (base de toutes les branches)

feature/xxx   ← travail quotidien

### Cycle de travail

```bash
# 1. Toujours partir de develop à jour
git checkout develop
git pull origin develop

# 2. Créer sa branche
git checkout -b feature/<initiales>-<description-courte>
# Exemples :
# feature/sim-onboarding-screen
# feature/enock-auth-jwt
# feature/gaby-scoring-regularite

# 3. Commits atomiques en Conventional Commits
git commit -m "feat(mobile): ajout écran saisie vocale"
git commit -m "fix(api): validation manquante sur POST /entries"
git commit -m "docs(scoring): mise à jour formule régularité"

# 4. Push + PR vers develop (jamais vers main directement)
git push origin feature/sim-onboarding-screen
```

### Types de commits

| Préfixe | Usage |
|---|---|
| `feat` | Nouvelle fonctionnalité |
| `fix` | Correction de bug |
| `docs` | Documentation uniquement |
| `chore` | Config, dépendances, build |
| `refactor` | Refacto sans changement de comportement |
| `test` | Ajout/modification de tests |
| `perf` | Amélioration de performance |

### Règles PR

- Titre = message du commit principal (`feat(api): POST /entries avec validation Zod`)
- Description : ce qui change, pourquoi, comment tester
- Au moins 1 reviewer (Duvalier par défaut)
- Pas de merge si CI rouge

---

## Installation locale

Voir `docs/SETUP.md` pour le détail complet.

```bash
git clone https://github.com/credit-invisible/gemmas.git
cd credit-invisible
cp services/api/.env.example services/api/.env
cp services/scoring/.env.example services/scoring/.env
cp apps/mobile/.env.example apps/mobile/.env
cp apps/dashboard/.env.example apps/dashboard/.env
```

---

## Standards de code

### TypeScript (Siméon + Enock)

```typescript
// ✅ Types de retour explicites
async function getScore(merchantId: string): Promise<ScoreResult> { ... }

// ✅ Interfaces pour les objets (pas type alias)
interface MerchantEntry {
  id: string;
  merchantId: string;
  amount: number;
  date: string;
  clientCount: number;
}

// ✅ Zod pour valider les entrées API
const entrySchema = z.object({
  amount: z.number().positive(),
  date: z.string().datetime(),
  clientCount: z.number().int().min(0),
});

// ❌ Interdit
const data: any = req.body;
```

### Python (Gaby)

```python
# ✅ Type hints partout
def calculate_regularity(entries: list[Entry]) -> float:
    ...

# ✅ Pydantic pour la validation
class ScoringRequest(BaseModel):
    merchant_id: str
    entries: list[Entry]
    
# ✅ Docstring sur chaque fonction publique
def normalize_score(raw: float, min_val: float, max_val: float) -> float:
    """Normalise une valeur brute vers [0, 1].
    
    Args:
        raw: Valeur brute calculée
        min_val: Minimum observé ou théorique
        max_val: Maximum observé ou théorique
    
    Returns:
        Float entre 0.0 et 1.0
    """

# ❌ Interdit
def calc(x):
    return x * 2
```

### CSS / Tailwind (Siméon)

```tsx
// ✅ Classes Tailwind uniquement — pas de style inline ni fichier .css custom
<div className="flex flex-col gap-4 p-6 bg-white rounded-2xl shadow-sm">

// ✅ Variables CSS pour les couleurs métier (dans index.css uniquement)
// --color-primary: #1B4D3E;
// --color-accent: #F59E0B;

// ❌ Interdit
<div style={{ backgroundColor: '#1B4D3E' }}>
```

---

## Structure des fichiers par service

### `apps/mobile/src/`
components/       # Composants réutilisables (Button, Input, Card…)

pages/            # Pages/routes (Onboarding, Dashboard, Entry…)

hooks/            # Custom hooks (useVoiceEntry, useScore…)

stores/           # Zustand stores (authStore, entryStore…)

services/         # Appels API (api.ts, whisper.ts…)

locales/          # Traductions (fr.json, yo.json)

types/            # Types locaux (importer depuis packages/types si partagé)

### `services/api/src/`
routes/           # Fichiers de routes Express (auth.ts, merchants.ts…)

controllers/      # Logique métier (authController.ts…)

middleware/       # Auth, validation, rate-limit (authMiddleware.ts…)

services/         # Couche service (scoringService.ts, supabaseService.ts…)

validators/       # Schémas Zod (entryValidator.ts…)

utils/            # Helpers (jwt.ts, logger.ts…)

types/            # Types locaux API

### `services/scoring/`
app.py            # Entry point Flask

routes/           # Blueprints Flask (scoring.py, transcribe.py)

calculators/      # Un fichier par indicateur (regularity.py, growth.py…)

models/           # Modèles Pydantic (entry.py, score_result.py)

utils/            # Helpers (normalizer.py, date_utils.py)

tests/            # Tests unitaires pytest

---

## Tests

### Node.js (Enock)
```bash
cd services/api
npm test                  # Jest — tous les tests
npm run test:watch        # Mode watch
npm run test:coverage     # Rapport de couverture
```

Couverture minimale requise : **70%** sur `controllers/` et `services/`.

### Python (Gaby)
```bash
cd services/scoring
pytest                    # Tous les tests
pytest -v tests/calculators/  # Tests d'un dossier
pytest --cov=. --cov-report=term-missing  # Couverture
```

Couverture minimale requise : **80%** sur `calculators/` (logique de scoring critique).

### Frontend (Siméon)
```bash
cd apps/mobile
npm test                  # Vitest
npm run test:ui           # Interface graphique Vitest
```

---

## Règles absolues (non négociables)

1. **0 clé API dans le code** — uniquement dans `.env` (jamais commité)
2. **0 `any` TypeScript** — utiliser `unknown` + type guard
3. **0 migration SQL supprimée** — toujours ajouter une nouvelle migration
4. **0 dépendance payante** — budget hébergement = 0 FCFA
5. **0 merge direct sur `main`** — toujours passer par `develop` + PR
6. **0 modification de `docs/SCORING.md`** sans validation de Gaby + Duvalier

---

## Contacts & escalade

Bloqué sur un problème cross-périmètre ? Ouvre une issue GitHub avec le label `cross-team` et tag `@duvalier`.