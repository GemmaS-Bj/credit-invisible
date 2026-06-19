import math
import numpy as np
import pandas as pd
from datetime import date, timedelta, datetime, timezone

from models import Entry, ScoreResult, InsufficientDataError
from engine.weights import WEIGHTS
from engine.normalizer import clamp

# S1
def calculate_regularity(entries: list[Entry]) -> float:
    """
    Retourne un score de régularité entre 0 et 100.
    100 = ventes parfaitement stables semaine après semaine.
    0   = variance extrême (coefficient de variation >= 100%).
    """
    df = pd.DataFrame([e.model_dump() for e in entries])
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

    return round(clamp(100.0 * (1 - cv)), 2)

# S2
def calculate_growth(entries: list[Entry]) -> float:
    """
    Retourne un score de croissance entre 0 et 100.
    Basé sur la régression linéaire des ventes mensuelles.
    100 = croissance MoM >= +20%.
    50  = stabilité (croissance ~ 0%).
    0   = déclin MoM <= -20%.
    """
    df = pd.DataFrame([e.model_dump() for e in entries])
    df['month'] = pd.to_datetime(df['entry_date']).dt.to_period('M')

    monthly_sales = df.groupby('month')['sales_amount'].sum().reset_index()
    monthly_sales['month_idx'] = range(len(monthly_sales))

    if len(monthly_sales) < 2:
        return 50.0  # Données insuffisantes — score neutre

    # Régression linéaire simple
    x = monthly_sales['month_idx'].values
    y = monthly_sales['sales_amount'].values
    slope, _ = np.polyfit(x, y, 1)

    # Taux de croissance moyen mensuel relatif à la moyenne des ventes
    mean_sales = y.mean()
    if mean_sales == 0:
        return 50.0

    growth_rate = slope / mean_sales
    return round(clamp(50.0 + (growth_rate / 0.20) * 50.0), 2)

def calculate_diversification(entries: list[Entry]) -> float:
    """
    Retourne un score de diversification entre 0 et 100.
    Basé sur la moyenne des clients distincts par jour de vente.
    100 = >= 10 clients distincts/jour en moyenne.
    0   = 0 ou 1 client/jour en moyenne.
    """
    df = pd.DataFrame([e.model_dump() for e in entries])
    active_days = df[df['sales_amount'] > 0]

    if len(active_days) == 0:
        return 0.0

    avg_clients = active_days['client_count'].mean()

    if avg_clients <= 1:
        return 0.0

    return round(clamp((math.log10(avg_clients) / math.log10(10)) * 100.0), 2)

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

    if total_paid == 0 and total_new == 0:
        return 75.0

    ratio = total_paid / (total_paid + total_new)
    return round(clamp(ratio * 100.0), 2)

def calculate_seniority(entries: list[Entry], merchant_created_at: date) -> float:
    """
    Retourne un score d'ancienneté/saisonnalité entre 0 et 100.
    Composé de deux sous-composantes :
      - Ancienneté (60%) : durée depuis la création du compte
      - Régularité de saisie (40%) : % de jours actifs avec une entrée
    """
    today = date.today()
    days_since_creation = (today - merchant_created_at).days

    seniority_score = clamp((days_since_creation / 365) * 100.0)

    window_start = max(merchant_created_at, today - timedelta(days=90))
    expected_days = sum(
        1 for i in range((today - window_start).days + 1)
        if (window_start + timedelta(days=i)).weekday() < 6
    )

    actual_entries = len([e for e in entries if e.entry_date >= window_start])

    if expected_days == 0:
        submission_score = 0.0
    else:
        submission_rate = min(1.0, actual_entries / expected_days)
        submission_score = submission_rate * 100.0

    return round((seniority_score * 0.60) + (submission_score * 0.40), 2)


def calculate_final_score(
    entries: list[Entry],
    merchant_created_at: date
) -> ScoreResult:
    MIN_ENTRIES = 14

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
        s1 * WEIGHTS["regularity"] +
        s2 * WEIGHTS["growth"] +
        s3 * WEIGHTS["diversification"] +
        s4 * WEIGHTS["debt"] +
        s5 * WEIGHTS["seniority"]
    )

    return ScoreResult(
        score=round(final),
        score_regularity=s1,
        score_growth=s2,
        score_diversification=s3,
        score_debt=s4,
        score_seniority=s5,
        entries_count=len(entries),
        calculated_at=datetime.now(timezone.utc)
    )