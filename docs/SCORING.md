# docs/SCORING.md — Crédit Invisible · GemmaS

> Référence algorithmique du moteur de scoring.
> Toute modification de formule doit être validée par Gaby + Duvalier
> et reflétée dans ce fichier dans le même commit.

---

## Vue d'ensemble

Le score final est un entier **0–100** calculé à partir de 5 indicateurs
pondérés. Il reflète la fiabilité commerciale d'une commerçante sur la base
de ses données déclaratives des **90 derniers jours** (minimum 14 jours
d'entrées requis pour un score valide).
Score Final = round(

S1 × 0.25 +   # Régularité des ventes

S2 × 0.20 +   # Tendance de croissance

S3 × 0.15 +   # Diversification clients

S4 × 0.25 +   # Gestion dettes fournisseurs

S5 × 0.15     # Ancienneté + saisonnalité

)

Chaque sous-score **S1…S5** est normalisé sur **0–100** avant pondération.

---

## Données d'entrée requises

```python
class Entry(BaseModel):
    entry_date:   date
    sales_amount: float   # ventes du jour en FCFA (>= 0)
    client_count: int     # nombre de clients distincts (>= 0)
    debt_paid:    float   # dette fournisseur remboursée ce jour (>= 0)
    debt_new:     float   # nouvelle dette contractée ce jour (>= 0)
```

Entrées filtrées : `sales_amount < 0` rejetées. Jours manquants = `sales_amount: 0` (absence de saisie ≠ absence de ventes — voir note ci-dessous).

> **Note importante :** Un jour sans entrée est ambigu (pas de vente ou oubli
> de saisie). L'algorithme pénalise la *variance* des jours saisis, pas
> l'absence de saisie. L'ancienneté (S5) tient compte de la régularité de
> saisie séparément.

---

## S1 — Régularité des ventes (poids 25%)

**Objectif :** Mesurer la stabilité hebdomadaire des ventes. Une commerçante
avec des ventes régulières est moins risquée qu'une commerçante avec de
fortes variations imprévisibles.

### Formule

```python
import numpy as np
import pandas as pd

def calculate_regularity(entries: list[Entry]) -> float:
    """
    Retourne un score de régularité entre 0 et 100.
    100 = ventes parfaitement stables semaine après semaine.
    0   = variance extrême (coefficient de variation >= 100%).
    """
    df = pd.DataFrame([e.dict() for e in entries])
    df['week'] = pd.to_datetime(df['entry_date']).dt.isocalendar().week

    # Somme des ventes par semaine
    weekly_sales = df.groupby('week')['sales_amount'].sum()

    if len(weekly_sales) < 2:
        return 50.0  # Données insuffisantes — score neutre

    mean = weekly_sales.mean()
    if mean == 0:
        return 0.0

    # Coefficient de variation (CV) = écart-type / moyenne
    cv = weekly_sales.std() / mean

    # Normalisation : CV=0 → score=100, CV>=1 → score=0
    # Formule : score = max(0, 100 × (1 - cv))
    score = max(0.0, 100.0 * (1 - cv))
    return round(score, 2)
```

### Seuils d'interprétation

| CV | Score S1 | Interprétation |
|---|---|---|
| 0.00 – 0.10 | 90 – 100 | Excellente régularité |
| 0.10 – 0.30 | 70 – 90 | Bonne régularité |
| 0.30 – 0.60 | 40 – 70 | Régularité moyenne |
| 0.60 – 1.00 | 0 – 40 | Irrégularité marquée |
| > 1.00 | 0 | Irrégularité sévère |

---

## S2 — Tendance de croissance MoM (poids 20%)

**Objectif :** Détecter si l'activité est en croissance, stable ou en déclin
sur les 3 derniers mois. Une croissance positive signale un business sain.

### Formule

```python
def calculate_growth(entries: list[Entry]) -> float:
    """
    Retourne un score de croissance entre 0 et 100.
    Basé sur la régression linéaire des ventes mensuelles.
    100 = croissance MoM >= +20%.
    50  = stabilité (croissance ~ 0%).
    0   = déclin MoM <= -20%.
    """
    df = pd.DataFrame([e.dict() for e in entries])
    df['month'] = pd.to_datetime(df['entry_date']).dt.to_period('M')

    monthly_sales = df.groupby('month')['sales_amount'].sum().reset_index()
    monthly_sales['month_idx'] = range(len(monthly_sales))

    if len(monthly_sales) < 2:
        return 50.0  # Données insuffisantes — score neutre

    # Régression linéaire simple
    x = monthly_sales['month_idx'].values
    y = monthly_sales['sales_amount'].values
    slope, intercept = np.polyfit(x, y, 1)

    # Taux de croissance moyen mensuel relatif à la moyenne des ventes
    mean_sales = y.mean()
    if mean_sales == 0:
        return 50.0

    growth_rate = slope / mean_sales  # ex: 0.05 = +5%/mois

    # Normalisation : -20% → 0, 0% → 50, +20% → 100
    # Formule : score = 50 + (growth_rate / 0.20) × 50
    score = 50.0 + (growth_rate / 0.20) * 50.0
    return round(max(0.0, min(100.0, score)), 2)
```

### Seuils d'interprétation

| Croissance MoM | Score S2 | Interprétation |
|---|---|---|
| > +20% | 100 | Croissance forte |
| +10% à +20% | 75 – 100 | Croissance soutenue |
| 0% à +10% | 50 – 75 | Croissance modérée |
| -10% à 0% | 25 – 50 | Légère décroissance |
| < -20% | 0 | Déclin sévère |

---

## S3 — Diversification clients (poids 15%)

**Objectif :** Évaluer si la commerçante dépend d'un petit nombre de clients
(risque de concentration) ou dispose d'une clientèle diversifiée (résilience).

### Formule

```python
def calculate_diversification(entries: list[Entry]) -> float:
    """
    Retourne un score de diversification entre 0 et 100.
    Basé sur la moyenne des clients distincts par jour de vente.
    100 = >= 10 clients distincts/jour en moyenne.
    0   = 0 ou 1 client/jour en moyenne.
    """
    df = pd.DataFrame([e.dict() for e in entries])

    # Ne considérer que les jours avec des ventes (évite biais jours fermés)
    active_days = df[df['sales_amount'] > 0]

    if len(active_days) == 0:
        return 0.0

    avg_clients = active_days['client_count'].mean()

    # Normalisation logarithmique : 1 client → 0, 10+ clients → 100
    # Justification log : la différence entre 1 et 2 clients est plus
    # significative que entre 9 et 10.
    if avg_clients <= 1:
        return 0.0

    import math
    score = min(100.0, (math.log10(avg_clients) / math.log10(10)) * 100.0)
    return round(score, 2)
```

### Seuils d'interprétation

| Clients/jour (moy.) | Score S3 | Interprétation |
|---|---|---|
| >= 10 | 100 | Excellente diversification |
| 5 – 10 | 70 – 100 | Bonne diversification |
| 3 – 5 | 48 – 70 | Diversification moyenne |
| 2 – 3 | 30 – 48 | Faible diversification |
| <= 1 | 0 | Concentration extrême |

---

## S4 — Gestion dettes fournisseurs (poids 25%)

**Objectif :** Évaluer la capacité de la commerçante à rembourser ses dettes
fournisseurs. C'est l'indicateur le plus proche d'un historique de crédit
traditionnel.

### Formule

```python
def calculate_debt_management(entries: list[Entry]) -> float:
    """
    Retourne un score de gestion de dettes entre 0 et 100.
    Basé sur le ratio remboursement / dette contractée.
    100 = rembourse plus qu'elle ne contracte (ratio >= 1.0)
    50  = rembourse autant que contracté (ratio = 0.5 sur période)
    0   = ne rembourse rien (ratio = 0)

    Formule : ratio = total_debt_paid / (total_debt_paid + total_debt_new)
    Score   = ratio × 100
    """
    total_paid = sum(e.debt_paid for e in entries)
    total_new  = sum(e.debt_new  for e in entries)

    # Aucune dette = comportement prudent, score élevé mais pas parfait
    if total_paid == 0 and total_new == 0:
        return 75.0  # Pas de dette = bonne gestion, mais pas de preuve de remboursement

    total_activity = total_paid + total_new
    if total_activity == 0:
        return 75.0

    ratio = total_paid / total_activity
    score = ratio * 100.0
    return round(score, 2)
```

### Seuils d'interprétation

| Ratio remb. | Score S4 | Interprétation |
|---|---|---|
| >= 0.80 | 80 – 100 | Excellente gestion |
| 0.60 – 0.80 | 60 – 80 | Bonne gestion |
| 0.40 – 0.60 | 40 – 60 | Gestion correcte |
| 0.20 – 0.40 | 20 – 40 | Gestion fragile |
| < 0.20 | 0 – 20 | Risque élevé |
| Aucune dette | 75 | Profil prudent |

---

## S5 — Ancienneté + saisonnalité (poids 15%)

**Objectif :** Valoriser l'expérience commerciale et la capacité à traverser
les cycles saisonniers (fêtes, périodes creuses). Une commerçante avec plus
d'un an d'historique et une saisie régulière est plus fiable à évaluer.

### Formule

```python
def calculate_seniority(entries: list[Entry], merchant_created_at: date) -> float:
    """
    Retourne un score d'ancienneté/saisonnalité entre 0 et 100.
    Composé de deux sous-composantes :
      - Ancienneté (60%) : durée depuis la création du compte
      - Régularité de saisie (40%) : % de jours actifs avec une entrée
    """
    from datetime import date, timedelta

    today = date.today()
    days_since_creation = (today - merchant_created_at).days

    # Sous-score ancienneté : 0 jour → 0, >= 365 jours → 100
    seniority_score = min(100.0, (days_since_creation / 365) * 100.0)

    # Sous-score régularité de saisie
    # Jours ouvrables attendus (lundi–samedi) depuis création, max 90 jours
    window_start = max(merchant_created_at, today - timedelta(days=90))
    expected_days = sum(
        1 for i in range((today - window_start).days + 1)
        if (window_start + timedelta(days=i)).weekday() < 6  # lundi=0, samedi=5
    )

    actual_entries = len([
        e for e in entries
        if e.entry_date >= window_start
    ])

    if expected_days == 0:
        submission_score = 0.0
    else:
        submission_rate = min(1.0, actual_entries / expected_days)
        submission_score = submission_rate * 100.0

    # Score combiné
    score = (seniority_score * 0.60) + (submission_score * 0.40)
    return round(score, 2)
```

### Seuils d'interprétation

| Ancienneté | Saisie | Score S5 approx. | Interprétation |
|---|---|---|---|
| > 1 an | > 80% | 85 – 100 | Profil mature et discipliné |
| 6–12 mois | > 70% | 60 – 85 | Profil en développement |
| 3–6 mois | > 60% | 35 – 60 | Profil récent |
| < 3 mois | Quelconque | 0 – 35 | Historique insuffisant |

---

## Assemblage final

```python
def calculate_final_score(
    entries: list[Entry],
    merchant_created_at: date
) -> ScoreResult:
    """
    Point d'entrée principal du moteur de scoring.
    Retourne le score final et le détail des sous-scores.
    """
    MIN_ENTRIES = 14  # Minimum absolu pour un score valide

    if len(entries) < MIN_ENTRIES:
        raise InsufficientDataError(
            f"Minimum {MIN_ENTRIES} entrées requises, {len(entries)} fournies."
        )

    s1 = calculate_regularity(entries)
    s2 = calculate_growth(entries)
    s3 = calculate_diversification(entries)
    s4 = calculate_debt_management(entries)
    s5 = calculate_seniority(entries, merchant_created_at)

    final = (
        s1 * 0.25 +
        s2 * 0.20 +
        s3 * 0.15 +
        s4 * 0.25 +
        s5 * 0.15
    )

    return ScoreResult(
        score=round(final),
        score_regularity=s1,
        score_growth=s2,
        score_diversification=s3,
        score_debt=s4,
        score_seniority=s5,
        entries_count=len(entries),
        calculated_at=datetime.utcnow()
    )
```

---

## Modèles Pydantic

```python
from pydantic import BaseModel, Field
from datetime import date, datetime

class Entry(BaseModel):
    entry_date:   date
    sales_amount: float = Field(ge=0)
    client_count: int   = Field(ge=0, default=0)
    debt_paid:    float = Field(ge=0, default=0.0)
    debt_new:     float = Field(ge=0, default=0.0)

class ScoreResult(BaseModel):
    score:                 int   = Field(ge=0, le=100)
    score_regularity:      float
    score_growth:          float
    score_diversification: float
    score_debt:            float
    score_seniority:       float
    entries_count:         int
    calculated_at:         datetime

class InsufficientDataError(Exception):
    pass
```

---

## Grille de lecture du score final

| Score | Niveau | Recommandation IMF |
|---|---|---|
| 80 – 100 | ⭐⭐⭐ Excellent | Crédit recommandé, conditions favorables |
| 60 – 79 | ⭐⭐ Bon | Crédit possible, analyse complémentaire légère |
| 40 – 59 | ⭐ Moyen | Crédit prudent, garantie partielle conseillée |
| 20 – 39 | ⚠️ Fragile | Crédit déconseillé, accompagnement requis |
| 0 – 19 | ❌ Insuffisant | Refus recommandé ou microcrédit d'amorçage |

---

## Tests unitaires requis (pytest)

Chaque fonction de calcul doit avoir au minimum :
- 1 test cas nominal
- 1 test données insuffisantes
- 1 test cas limite (0 ventes, 0 clients, 0 dettes)
- 1 test cohérence (score dans [0, 100])

```python
# Exemple — tests/calculators/test_regularity.py
def test_perfect_regularity():
    entries = [Entry(entry_date=..., sales_amount=10000, ...) for _ in range(30)]
    assert calculate_regularity(entries) == 100.0

def test_insufficient_data():
    entries = [Entry(...) for _ in range(1)]
    assert calculate_regularity(entries) == 50.0  # score neutre

def test_score_bounds():
    # Peu importe les données, le score reste dans [0, 100]
    assert 0 <= calculate_regularity(any_entries) <= 100
```