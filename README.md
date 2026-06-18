# Crédit Invisible

> Plateforme IA de scoring crédit alternatif pour les commerçantes du secteur informel en Afrique de l'Ouest.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-20-339933?style=flat&logo=nodedotjs)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=flat&logo=python)](https://python.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?style=flat&logo=postgresql)](https://postgresql.org/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

---

## Le problème

Des millions de commerçantes en Afrique de l'Ouest génèrent des revenus réels et documentés dans
leurs carnets papier. Pourtant, les institutions de microfinance (IMF) les rejettent systématiquement —
faute d'historique bancaire exploitable, de données numériques, de garanties formelles.

**Elles existent économiquement. Elles sont invisibles financièrement.**

## La solution

Crédit Invisible numérise le registre papier de la commerçante et génère automatiquement un
score crédit alternatif basé sur ses comportements réels, consultable par les IMF partenaires
sans déplacement physique.

- Interface mobile accessible aux non-lectrices (icônes + chiffres)
- Saisie vocale en Yoruba et français via Whisper API
- Score algorithmique sur 5 indicateurs comportementaux (0–100)
- Dashboard temps réel pour les agents IMF
- Modèle B2B2C : commerçante gratuite, IMF abonnée

---

## Architecture
credit-invisible/

│

├── apps/

│   ├── mobile/          # PWA commerçante — React + TypeScript + Tailwind

│   └── dashboard/       # Interface IMF — React + TypeScript + Recharts

│

├── services/

│   ├── api/             # Backend principal — Node.js + Express + JWT

│   ├── scoring/         # Moteur de scoring — Python + Flask

│   └── voice/           # Interface vocale — Whisper API integration

│

├── packages/

│   ├── types/           # Types TypeScript partagés

│   └── utils/           # Utilitaires communs

│

├── infra/

│   └── supabase/        # Migrations PostgreSQL + seeds

│

├── docs/                # Documentation technique

└── .github/

└── workflows/       # CI/CD GitHub Actions

---

## Stack technique

| Couche | Technologie | Hébergement |
|---|---|---|
| PWA commerçante | React 18 · TypeScript · Tailwind CSS · Vite | Vercel |
| Dashboard IMF | React 18 · TypeScript · Recharts | Vercel |
| API REST | Node.js 20 · Express · JWT · Zod | Railway |
| Moteur scoring | Python 3.11 · Flask · Pandas | Railway |
| Base de données | PostgreSQL 15 · Supabase | Supabase Free |
| Vocal | OpenAI Whisper API · Yoruba + Français | API externe |
| CI/CD | GitHub Actions | GitHub Free |

**Budget hébergement : 0 FCFA**

---

## Démarrage rapide

### Prérequis
- Node.js 20+
- Python 3.11+
- Compte Supabase (gratuit)
- Clé API OpenAI (Whisper)

### Installation

```bash
# Cloner le repo
git clone https://github.com/gemmas-solutions/credit-invisible.git
cd credit-invisible

# Variables d'environnement
cp .env.example .env
# Remplir les valeurs dans .env

# Installer les dépendances
npm install

# Lancer en développement
npm run dev
```

### Variables d'environnement requises

```env
# Base de données
DATABASE_URL=

# Auth
JWT_SECRET=
JWT_EXPIRES_IN=7d

# OpenAI Whisper
OPENAI_API_KEY=

# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
```

---

## Équipe

| Nom | Rôle | Responsabilité |
|---|---|---|
| Prudence | CEO | Stratégie · Pitch jury · Relations IMF |
| Duvalier | CSO / Lead Dev | PWA · Dashboard · Scoring |
| Siméon | CMO / Frontend | PWA · Composants · UI/UX |
| Enock  | CTO / Backend  | API · BDD · Whisper      |
| Gaby   | COO / Backend  | Services · Scoring · Infra |

---

## Contexte

Projet développé dans le cadre du **Sahal Tech Innovation Labs — Appel à Projets IA 2026**
par [GemmaS](https://github.com/gemmas-solutions) · Solutions Digitales pour l'Afrique de l'Ouest.

---

## Licence

MIT © 2026 GemmaS