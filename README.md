# Accessa MVP — Vigie Administrative pour TPE & PME

## Lancer en local (sur ton Mac)

### Prérequis
1. Installe Node.js : https://nodejs.org (prends la version LTS)
2. Ouvre le Terminal

### Installation
```bash
cd accessa-mvp
npm install
npm run dev
```
Ouvre http://localhost:5173 dans ton navigateur.

## Déployer sur Vercel (en production)

### Première fois
1. Crée un compte sur https://vercel.com (gratuit)
2. Crée un repo sur https://github.com (gratuit)
3. Push ce dossier sur GitHub :
```bash
git init
git add .
git commit -m "Accessa MVP"
git branch -M main
git remote add origin https://github.com/TON_USERNAME/accessa-mvp.git
git push -u origin main
```
4. Sur Vercel, clique "New Project" → importe le repo GitHub
5. Vercel détecte automatiquement Vite et déploie
6. Tu reçois une URL publique (genre accessa-mvp.vercel.app)

### Mises à jour
Chaque `git push` sur main redéploie automatiquement.

## Structure
```
accessa-mvp/
├── index.html              # Page d'entrée
├── package.json            # Dépendances
├── vite.config.js          # Config Vite
├── vercel.json             # Config Vercel
├── src/
│   ├── main.jsx            # Point d'entrée React
│   ├── App.jsx             # Application (landing + résultat)
│   ├── complianceEngine.js # Moteur de conformité (30+ règles)
│   └── styles.css          # Styles
```

## APIs utilisées
- **Recherche Entreprises** (api.gouv.fr) — gratuit, pas de clé API
  - Identité entreprise (SIREN, SIRET, NAF, dirigeants)
  - Effectifs, forme juridique, date de création
  - Certifications (RGE, etc.)
  - Comptes déposés

## Prochaines étapes
- [ ] Upload de documents + OCR via API Claude
- [ ] Authentification utilisateur (Supabase ou Firebase)
- [ ] Dashboard complet (alertes, coffre-fort)
- [ ] Vue expert-comptable
- [ ] Badge public + page profil
- [ ] Stripe pour le paiement
