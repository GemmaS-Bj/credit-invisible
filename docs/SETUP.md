# docs/SETUP.md — Crédit Invisible · GemmaS

> Guide d'installation locale complet.
> Temps estimé : 20–30 minutes pour un premier setup.

---

## Prérequis

| Outil | Version minimale | Vérification |
|---|---|---|
| Node.js | 20 LTS | `node --version` |
| npm | 10+ | `npm --version` |
| Python | 3.11+ | `python --version` |
| Git | 2.40+ | `git --version` |

---

## 1. Cloner le repo

```bash
git clone https://github.com/credit-invisible/gemmas.git
cd credit-invisible
git checkout -b develop 
# -b flag to create the branch
```

---

## 2. Supabase — base de données

### 2.1 Créer le projet

1. Aller sur [supabase.com](https://supabase.com) → New project
2. Nom : `credit-invisible-dev`
3. Mot de passe BDD : générer et sauvegarder
4. Région : **West EU** (latence acceptable depuis Bénin)

### 2.2 Récupérer les credentials

Dans le dashboard Supabase → Settings → API :
SUPABASE_URL        = https://xxxxxxxxxxxx.supabase.co

SUPABASE_ANON_KEY   = eyJ...

Dans Settings → Database → Connection string → **Transaction pooler** :
DATABASE_URL = postgresql://postgres.xxx:[PASSWORD]@aws-0-eu-west-3.pooler.supabase.com:6543/postgres

> ⚠️ Utiliser le **Transaction pooler** (port 6543), pas le Direct connection.
> Railway + Node.js nécessitent le pooler pour les connexions serverless.

### 2.3 Appliquer les migrations

```bash
# Installer Supabase CLI
npm install -g supabase

# Lier le projet local au projet Supabase
cd infra/supabase
supabase link --project-ref <ref-id-dans-url-dashboard>

# Appliquer toutes les migrations
supabase db push
```

Vérifier dans Supabase → Table Editor que les tables existent :
`merchants`, `merchant_entries`, `merchant_scores`, `imf_institutions`

### 2.4 Activer Row Level Security

```bash
# Exécuter dans Supabase → SQL Editor
```

```sql
-- Activer RLS sur toutes les tables
ALTER TABLE merchants         ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_entries  ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_scores   ENABLE ROW LEVEL SECURITY;
ALTER TABLE imf_institutions  ENABLE ROW LEVEL SECURITY;

-- Politique : une commerçante lit uniquement ses données
CREATE POLICY "merchant_self_read" ON merchants
  FOR SELECT USING (auth.uid()::text = id::text);

CREATE POLICY "entries_self_read" ON merchant_entries
  FOR SELECT USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE auth.uid()::text = id::text
    )
  );
```

---

## 3. Variables d'environnement

### services/api/

```bash
cp services/api/.env.example services/api/.env
```

Éditer `services/api/.env` :

```env
DATABASE_URL=postgresql://postgres.xxx:[PASSWORD]@aws-0-eu-west-3.pooler.supabase.com:6543/postgres
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
JWT_SECRET=<générer avec : openssl rand -hex 32>
JWT_EXPIRES_IN=7d
SCORING_SERVICE_URL=http://localhost:5000
NODE_ENV=development
PORT=3000
```

### services/scoring/

```bash
cp services/scoring/.env.example services/scoring/.env
```

Éditer `services/scoring/.env` :

```env
OPENAI_API_KEY=sk-...
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
FLASK_ENV=development
PORT=5000
```

### apps/mobile/

```bash
cp apps/mobile/.env.example apps/mobile/.env
```

```env
VITE_API_URL=http://localhost:3000
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### apps/dashboard/

```bash
cp apps/dashboard/.env.example apps/dashboard/.env
```

```env
VITE_API_URL=http://localhost:3000
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

---

## 4. Installation des dépendances

### Tout installer en une commande (depuis la racine)

```bash
npm install
```

> Le `package.json` racine utilise npm workspaces.
> Installe automatiquement les dépendances de `apps/`, `services/api/` et `packages/`.

### Python — services/scoring/

```bash
cd services/scoring
python -m venv venv

# macOS / Linux
source venv/bin/activate

# Windows
venv\Scripts\activate

pip install -r requirements.txt
```

`requirements.txt` :
flask==3.0.3

pydantic==2.7.1

pandas==2.2.2

numpy==1.26.4

openai==1.30.1

supabase==2.4.6

python-dotenv==1.0.1

pytest==8.2.0

pytest-cov==5.0.0

---

## 5. Lancer les services en local

Ouvrir **4 terminaux** (un par service) :

### Terminal 1 — services/api

```bash
cd services/api
npm run dev
# → API démarrée sur http://localhost:3000
```

### Terminal 2 — services/scoring

```bash
cd services/scoring
source venv/bin/activate   # ou venv\Scripts\activate sur Windows
flask run --port 5000
# → Scoring démarré sur http://localhost:5000
```

### Terminal 3 — apps/mobile

```bash
cd apps/mobile
npm run dev
# → PWA mobile sur http://localhost:5173
```

### Terminal 4 — apps/dashboard

```bash
cd apps/dashboard
npm run dev
# → Dashboard IMF sur http://localhost:5174
```

---

## 6. Vérifier que tout fonctionne

### Health checks

```bash
# API Node.js
curl http://localhost:3000/health
# → { "status": "ok", "service": "api", "version": "1.0.0" }

# Scoring Python
curl http://localhost:5000/health
# → { "status": "ok", "service": "scoring", "version": "1.0.0" }
```

### Test d'inscription

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+22961000001",
    "pin": "1234",
    "name": "Fatima Test",
    "sector": "alimentation",
    "location": "Cotonou, Bénin"
  }'
# → 201 avec token JWT
```

### Test de saisie d'entrée

```bash
# Récupérer le token depuis l'étape précédente
TOKEN="eyJ..."

curl -X POST http://localhost:3000/entries \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "entryDate": "2026-06-01",
    "salesAmount": 25000,
    "clientCount": 5,
    "debtPaid": 2000,
    "debtNew": 0
  }'
# → 201 avec l'entrée créée
```

---

## 7. Structure des scripts npm

### Racine `package.json`

```json
{
  "scripts": {
    "dev":         "concurrently \"npm run dev -w services/api\" \"npm run dev -w apps/mobile\" \"npm run dev -w apps/dashboard\"",
    "build":       "npm run build --workspaces",
    "test":        "npm run test --workspaces --if-present",
    "lint":        "eslint . --ext .ts,.tsx",
    "format":      "prettier --write ."
  }
}
```

> `npm run dev` depuis la racine lance API + mobile + dashboard simultanément.
> Le scoring Python se lance séparément (runtime différent).

### services/api scripts

```json
{
  "scripts": {
    "dev":         "tsx watch src/index.ts",
    "build":       "tsc",
    "start":       "node dist/index.js",
    "test":        "jest",
    "test:watch":  "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

### apps/mobile & apps/dashboard scripts

```json
{
  "scripts": {
    "dev":    "vite",
    "build":  "tsc && vite build",
    "preview":"vite preview",
    "test":   "vitest"
  }
}
```

---

## 8. Déploiement (production)

### Vercel — apps/mobile + apps/dashboard

```bash
npm install -g vercel
cd apps/mobile
vercel --prod
```

Dans le dashboard Vercel :
- Root directory : `apps/mobile`
- Build command : `npm run build`
- Output directory : `dist`
- Ajouter toutes les variables `VITE_*` dans Environment Variables

Répéter pour `apps/dashboard`.

### Railway — services/api + services/scoring

```bash
npm install -g @railway/cli
railway login
```

**Service API :**
```bash
cd services/api
railway init          # Créer nouveau projet
railway up            # Déployer
railway variables set DATABASE_URL=... JWT_SECRET=... SUPABASE_URL=... SUPABASE_ANON_KEY=... SCORING_SERVICE_URL=https://scoring.railway.app JWT_EXPIRES_IN=7d NODE_ENV=production
```

`Procfile` dans `services/api/` :
web: node dist/index.js

**Service Scoring :**
```bash
cd services/scoring
railway init
railway up
railway variables set OPENAI_API_KEY=... SUPABASE_URL=... SUPABASE_ANON_KEY=... FLASK_ENV=production
```

`Procfile` dans `services/scoring/` :
web: flask run --host=0.0.0.0 --port=$PORT

### Cron anti-pause Supabase (GitHub Actions)

Créer `.github/workflows/keep-alive.yml` :

```yaml
name: Keep Supabase Alive
on:
  schedule:
    - cron: '0 8 */5 * *'   # Toutes les 5 jours à 8h UTC
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping API
        run: curl -f ${{ secrets.API_URL }}/health
```

Ajouter `API_URL` dans les secrets GitHub du repo.

---

## 9. Problèmes fréquents

### "Cannot connect to database"

```bash
# Vérifier que DATABASE_URL pointe sur le Transaction Pooler (port 6543)
# et non le Direct Connection (port 5432)
echo $DATABASE_URL | grep "6543"
```

### "Supabase project paused"

Le free tier se met en pause après 7 jours sans requête.

```bash
# Réactiver manuellement
# Supabase Dashboard → Project → Restore
# Puis attendre ~2 minutes
```

### "Module not found" Python

```bash
# Vérifier que le venv est activé
which python   # doit pointer vers venv/bin/python
pip install -r requirements.txt
```

### "Whisper API error"

```bash
# Vérifier la clé OpenAI
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
# → liste des modèles si clé valide
```

### Port déjà utilisé

```bash
# macOS / Linux
lsof -ti:3000 | xargs kill -9
lsof -ti:5000 | xargs kill -9

# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### PWA ne se met pas à jour

```bash
# Vider le cache Service Worker dans Chrome DevTools
# Application → Storage → Clear site data
cd apps/mobile && npm run build && npm run preview
```

---

## 10. Checklist avant demo Sahal Tech

- [ ] Supabase projet actif (pas en pause)
- [ ] Variables d'environnement production configurées sur Vercel + Railway
- [ ] Au moins 1 commerçante de test avec 20+ entrées (pour score valide)
- [ ] Au moins 1 compte IMF de test dans `imf_institutions`
- [ ] Saisie vocale testée en Yoruba ET Français
- [ ] PWA installable testée sur Android Chrome
- [ ] Dashboard IMF accessible et affichant les scores
- [ ] Health checks API + Scoring retournent 200
- [ ] Cron GitHub Actions activé (anti-pause Supabase)