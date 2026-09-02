# 🚀 FormFlow AI (AutoForm)

FormFlow AI est un outil d'automatisation intelligente permettant de générer des réponses à des formulaires Google Forms en simulant un comportement humain hyper-réaliste. 

Au lieu de remplir des formulaires avec des données aléatoires stupides, **FormFlow AI se connecte à OpenAI (GPT-4o-mini)** pour générer des profils psychologiques distincts ("Personas") et déduire logiquement les réponses de chaque profil au formulaire.

---

## ✨ Fonctionnalités Principales

- **Génération de Personas Uniques** : L'IA se crée une personnalité (âge, métier, opinions, cynisme ou enthousiasme) avant de répondre pour éviter les réponses homogènes.
- **Support des instructions personnalisées** : Vous pouvez guider l'IA (ex: "Tu es un public d'étudiants très critiques", etc.) en tapant du texte ou en uploadant un fichier `.txt` / `.csv`.
- **Architecture Serverless-Friendly** : L'application web bypasse l'ouverture d'un navigateur lourd (Playwright) et lit la structure du Google Form directement via des requêtes HTTP (Cheerio), ce qui rend le processus **10 à 20 fois plus rapide** (2-3 secondes par soumission !).
- **Interface Web "Glassmorphism"** : Une interface Next.js moderne, interactive et fluide pour configurer et suivre les soumissions en temps réel.

---

## 📂 Structure du projet

Ce dépôt contient deux versions de l'outil :

1. **`/autoform-ui` (Recommandé)** : L'application Web complète avec interface graphique (Next.js, React, Tailwind CSS).
2. **`auto_form.py`** : Le script Python originel utilisable en ligne de commande (CLI).

---

## 💻 1. Utilisation de l'Application Web (Next.js)

C'est la méthode recommandée. L'interface est intuitive et très rapide.

### Prérequis
- [Node.js](https://nodejs.org/) installé sur votre machine.
- Une clé API OpenAI.

### Installation et lancement

1. Allez dans le dossier de l'application web :
```bash
cd autoform-ui
```

2. Installez les dépendances :
```bash
npm install
```

3. Lancez le serveur de développement :
```bash
npm run dev
```

4. Ouvrez votre navigateur sur **[http://localhost:3000](http://localhost:3000)**.
5. Saisissez votre clé OpenAI, le lien Google Form, paramétrez l'automatisation, et cliquez sur **Start Automation** !

---

## 🐍 2. Utilisation du Script Python (CLI)

Si vous préférez utiliser la ligne de commande (qui repose sur Playwright pour simuler un vrai navigateur et cliquer visuellement sur les éléments).

### Prérequis
- [Python 3.8+](https://www.python.org/)
- Renseigner votre clé OpenAI dans un fichier `.env` à la racine : `OPENAI_API_KEY=sk-...`

### Installation

```bash
pip install -r requirements.txt
playwright install chromium
```

### Lancement

```bash
python auto_form.py
```
Le script vous demandera d'entrer le lien du formulaire, l'analysera, et vous demandera combien de fois vous souhaitez le remplir. Les réponses générées sont sauvegardées dans `reponses.csv`.

---

## ⚠️ Avertissement

Cet outil a été conçu à des fins éducatives et de tests internes (ex: générer un jeu de données factice de haute qualité pour tester des tableaux de bord RH). L'utilisation de ce script pour spammer ou manipuler des enquêtes publiques est strictement déconseillée.

---
*Fait avec ❤️ par l'IA et l'équipe.*
# FormFlow-AI
