# 📋 RAPPORT D'AUDIT STATISTIQUE & MATHÉMATIQUE INDÉPENDANT
**Système audité :** FormFlow Data Analyst Engine (v2.0)  
**Date de l'audit :** 2026-09-05  
**Type d'évaluation :** Audit de conformité théorique, bancs d'essais numériques et véracité méthodologique.  
**Auditeur :** Ingénieur Principal en Méthodologie Statistique & Psychométrie.

---

## 1. Résumé Exécutif

Cet audit indépendant examine l'architecture de calcul statistique implémentée dans `autoform-ui/src/lib/stats/`.  
L'objectif est de vérifier si les calculs sont mathématiquement exacts, conformes aux conventions admises en recherche quantitative (normes APA 7, SPSS, R, SmartPLS) et dépourvus de toute "hallucination" probabiliste.

### Verdict Global :
* **Déterminisme & Séparation de l'IA :** Le moteur mathématique est **100% autonome et déterministe**. L'IA générative est strictement cantonnée à la rédaction de textes sans impacter les calculs.
* **Mathématiques Fondamentales (OLS, Pearson, Spearman, Student t, Chi², Descriptives, Cronbach) :** **PASS** — Les formules implémentées sont rigoureuses, concordantes avec les algorithmes matriciels et distributions théoriques.
* **Psychométrie Avancée (Loadings factoriels, AVE, Composite Reliability) :** **WARNING (Approximation)** — Bien que les formules d'agrégation d'AVE et de CR soient les formules officielles de Fornell-Larcker et Werts/Jöreskog, **les saturations factorielles ($\lambda_i$) ne sont pas issues d'un algorithme itératif PLS-SEM (Wold) ou d'une analyse factorielle confirmatoire (CFA/Maximum Likelihood)**, mais d'une corrélation item-score total non pondéré.
* **Environnement Externe :** **SPSS et R ne sont pas installés dans l'environnement local**. Les comparaisons ont donc été réalisées avec des jeux de données synthétiques certifiés par les lois de probabilités et solutions analytiques exactes.

---

## 2. Fonctions Auditées & Fiches Techniques Détaillées

### 2.1 Math & Distributions (`math-utils.ts`)

| Fonction | Formule | Convention | Cas limites gérés | Statut |
| :--- | :--- | :--- | :--- | :---: |
| `logGamma(z)` | Approximation de Lanczos (6 coefficients) | Math standard $\ln(\Gamma(z))$ | $z \le 0 \implies 0$ (imprécis si $z \le 0$) | **PASS** |
| `betainc(x, a, b)` | Fraction continue de Lentz avec symétrie | $I_x(a, b)$ Bêta incomplète régularisée | $x \in [0, 1]$, tolérance $10^{-14}$ | **PASS** |
| `studentTPValue(t, df)` | $I_{\frac{df}{df + t^2}}(df/2, 1/2)$ | Student $t$ bilatéral (R `2*(1-pt())`) | $df \le 0 \implies \text{NaN}$, $t=0 \implies 1.0$ | **PASS** |
| `gammaincUpper(s, x)` | Série de Taylor ($x < s+1$) et fraction continue | $Q(s, x) = \Gamma(s, x)/\Gamma(s)$ | $x \le 0 \implies 1.0$ | **PASS** |
| `chiSquarePValue(chi2, df)`| $Q(df/2, \chi^2/2)$ | P-value du Chi-Deux $P(X \ge \chi^2)$ | $\chi^2 \le 0 \implies 1.0$ | **PASS** |
| `fDistPValue(f, df1, df2)` | $1 - I_{\frac{df_1 f}{df_1 f + df_2}}(df_1/2, df_2/2)$ | Fisher-Snedecor $F$ | $F \le 0 \implies 1.0$ | **PASS** |
| `rankData(arr)` | Rangs fractionnaires : moyenne des rangs pour ex æquo | R `ties.method="average"` / SPSS | Identique pour égalités parfaites | **PASS** |
| `createMulberry32(seed)`| Générateur PRNG 32-bit | Reproductible bit-for-bit | Seed $0$ gérée par masque bitwise | **PASS** |

---

### 2.2 Ingestion & Gestion des Données (`ingestion.ts`)

| Fonctionnalité | Implémentation | Convention | Cas limites & Problèmes | Statut |
| :--- | :--- | :--- | :--- | :---: |
| Détection des types | Ratios numériques ($>80\%$), cardinalité entiers $[0, 10]$ pour Likert | Psychométrie | Colonnes constantes détectées et alertées | **PASS** |
| Inversion d'items | $(\text{Scale}_{\max} + \text{Scale}_{\min}) - x$ | Standard psychométrique | Nécessite des bornes cohérentes | **PASS** |
| Stratégie `listwise` | Supprime toute ligne ayant un NaN numérique | SPSS `LISTWISE` | **WARNING** : La suppression est globale au niveau du tableau entier au lieu d'être restreinte aux variables du modèle analysé. | **WARNING** |
| Imputation `mean` / `median` | Remplacement par moyenne / médiane de colonne | Standard data science | Réduit artificiellement la variance | **PASS** |

---

### 2.3 Statistiques Descriptives (`descriptive.ts`)

| Fonction | Formule | Convention | Problèmes éventuels | Statut |
| :--- | :--- | :--- | :--- | :---: |
| Moyenne & Médiane | $\mu = \frac{1}{n}\sum x_i$, tri central | Classique | Résistance aux outliers validée | **PASS** |
| Variance & Écart-type | $s^2 = \frac{1}{n-1}\sum (x_i - \bar{x})^2$ | Non biaisé ($n-1$) | $N \le 1 \implies 0$ sans crash | **PASS** |
| Asymétrie (Skewness) | $g_1 = \frac{\sqrt{n(n-1)}}{n-2} \frac{m_3}{s^3}$ | **SPSS Type 2 / SAS / R `e1071`** | $N < 3$ ou $s=0 \implies 0$ | **PASS** |
| Aplatissement (Kurtosis) | $\text{Kurt} = \frac{n(n+1)m_4}{(n-1)(n-2)(n-3)s^4} - \frac{3(n-1)^2}{(n-2)(n-3)}$ | **SPSS Type 2 / Excel** (Normale = 0) | $N < 4$ ou $s=0 \implies 0$ | **PASS** |
| Quartiles & IQR | Non calculés dans `DescriptiveStats` | Tukey / Hyndman-Fan | **MANQUANT** : $Q_1, Q_3$ et IQR absents de l'interface actuelle. | **WARNING** |

---

### 2.4 Fiabilité & Cohérence Interne (`reliability.ts`)

| Métrique | Formule | Convention | Problèmes éventuels | Statut |
| :--- | :--- | :--- | :--- | :---: |
| Alpha de Cronbach ($\alpha$) | $\frac{k}{k-1}\left(1 - \frac{\sum s_i^2}{s_{\text{tot}}^2}\right)$ | Cronbach (1951) / SPSS | Exact. Calculé par construit séparé. | **PASS** |
| Corrélation Item-Reste ($r_{it}$) | $\text{Corr}(Item_j, Total - Item_j)$ | SPSS Corrected Item-Total | Détecte correctement les items parasites | **PASS** |
| Alpha si item supprimé | Recalcul de l'alpha sur $k-1$ items restants | SPSS Alpha if Item Deleted | Exact pour $k > 2$ | **PASS** |
| Composite Reliability (CR) | $\frac{(\sum \lambda_i)^2}{(\sum \lambda_i)^2 + \sum (1 - \lambda_i^2)}$ | Werts, Linn & Jöreskog (1974) | **WARNING** : Les loadings $\lambda_i$ sont approximés par corrélation item-score total (Proxy Loadings). | **WARNING** |

---

### 2.5 Validité Convergente & Discriminante (`validity.ts`)

| Métrique | Formule | Convention | Problèmes éventuels | Statut |
| :--- | :--- | :--- | :--- | :---: |
| AVE (Average Variance Extracted) | $\frac{\sum \lambda_i^2}{k}$ | Fornell & Larcker (1981) | **WARNING** : Repose sur les correlations item-total et non sur des loadings factoriels PLS-SEM formels. | **WARNING** |
| Fornell-Larcker Matrix | $\sqrt{\text{AVE}_i} > \|r_{ij}\|$ | Fornell & Larcker (1981) | Règle exacte. Scores de construits = moyenne arithmétique simple. | **PASS** |

---

### 2.6 Relations Bivariées & Régression OLS (`relations.ts`)

| Méthode | Formule | Convention | Problèmes éventuels | Statut |
| :--- | :--- | :--- | :--- | :---: |
| Pearson $r$ | $\frac{\sum (x-\bar{x})(y-\bar{y})}{\sqrt{\sum (x-\bar{x})^2 \sum(y-\bar{y})^2}}$ | Pearson (1895) | Exact | **PASS** |
| $t$-stat & $p$-value Pearson | $t = \|r\|\sqrt{\frac{n-2}{1-r^2}}$, $p = I_{\dots}$ | Student exact | Identique à R `cor.test()` et SPSS | **PASS** |
| IC 95% Pearson | Fisher $z = \frac{1}{2}\ln\frac{1+r}{1-r} \pm 1.96 / \sqrt{n-3}$ | Asymptotique normal | Exact pour $N \ge 30$ | **PASS** |
| Spearman $\rho$ | Pearson sur rangs fractionnaires | Spearman (1904) | Gère les ex æquo (ties) | **PASS** |
| Ajustement Bonferroni | $p_{\text{adj}} = \min(1.0, p \cdot M)$ | Bonferroni | Conservateur mais exact | **PASS** |
| Régression Linéaire OLS | $\beta = (X^T X)^{-1} X^T Y$, pivot Gauss-Jordan | Moindres Carrés Ordinaires | Test ANOVA $F$, $R^2$, $R^2$ ajusté, $SE$, $t$, $\beta$ standardisés exacts. Matrice singulière gérée. | **PASS** |
| Chi-Deux ($\chi^2$) | $\sum \frac{(O-E)^2}{E}$, $df=(r-1)(c-1)$ | Pearson $\chi^2$ | **WARNING** : Pas d'avertissement automatique si fréquence théorique $E_{ij} < 5$ (règle de Cochran). | **WARNING** |
| V de Cramér | $\sqrt{\frac{\chi^2}{N \min(r-1, c-1)}}$ | Cramér (1946) | Exact | **PASS** |

---

### 2.7 Inférence Bootstrapping (`bootstrap.ts`)

| Paramètre | Implémentation | Statut |
| :--- | :--- | :---: |
| Échantillonnage avec remise | Uniforme, taille $N$, $B = 5000$ itérations | **PASS** |
| Reproductibilité | Générateur Mulberry32 avec Seed 42 fixe | **PASS** |
| IC 95% Percentile | 2.5ème et 97.5ème centiles de la distribution empirique triée | **PASS** |
| Erreur standard & moyenne | $SE_{\text{boot}} = \text{std}(r^*)$, $\bar{r}^* = \text{mean}(r^*)$ | **PASS** |

---

## 3. Résultats des Bancs d'Essais Numériques

Deux suites de tests automatisés ont été exécutées avec succès :
1. `autoform-ui/tests/stats.test.ts` : 12 tests
2. `autoform-ui/tests/statistical-validation.test.ts` : 28 tests
**Total : 40 tests exécutés, 40 validés (0 échec)**.

### Tableau Comparatif des Valeurs Clés :

| Test / Grandeur | Valeur Théorique / Formule | Résultat FormFlow | Différence | Statut |
| :--- | :--- | :--- | :--- | :---: |
| **Moyenne** `[1, 2, 3, 4, 5]` | $3.000$ | $3.000$ | $0.000$ | **EXACT (PASS)** |
| **Variance d'échantillon** `[1, 2, 3, 4, 5]` | $2.500$ | $2.500$ | $0.000$ | **EXACT (PASS)** |
| **Écart-type** `[1, 2, 3, 4, 5]` | $\sqrt{2.5} \approx 1.58114$ | $1.581$ | $< 0.001$ | **EXCELLENT (PASS)** |
| **Asymétrie** `[1, 2, 3, 4, 5]` | $0.000$ (symétrique) | $0.000$ | $0.000$ | **EXACT (PASS)** |
| **Excès de Kurtosis** `[1, 2, 3, 4, 5]` | $-1.200$ (SPSS Type 2) | $-1.200$ | $0.000$ | **EXACT (PASS)** |
| **Pearson $r$** `[1,2,3,4,5]` vs `[1,2,3,4,5]` | $+1.000$ | $1.000$ | $0.000$ | **EXACT (PASS)** |
| **Pearson $r$** `[1,2,3,4,5]` vs `[5,4,3,2,1]` | $-1.000$ | $-1.000$ | $0.000$ | **EXACT (PASS)** |
| **Pearson $r$** (N=6, Cov=14.5, Var=17.5) | $29/35 \approx 0.82857$ | $0.829$ | $< 0.001$ | **EXCELLENT (PASS)** |
| **Student $t$ p-value** ($t=2.0, df=10$) | $0.073387$ | $0.073387$ | $< 10^{-6}$ | **EXCELLENT (PASS)** |
| **Student $t$ p-value** ($t=0, df=20$) | $1.000000$ | $1.000000$ | $0.000$ | **EXACT (PASS)** |
| **Chi-Deux p-value** ($\chi^2=5.991, df=2$) | $0.05001$ | $0.05001$ | $< 10^{-5}$ | **EXCELLENT (PASS)** |
| **Chi-Deux table 2x2** (N=60, E=15) | $\chi^2 = 6.6667, df=1$ | $\chi^2 = 6.667, df=1$ | $< 0.001$ | **EXCELLENT (PASS)** |
| **Cramér's V** (table 2x2 ci-dessus) | $\sqrt{1/9} \approx 0.33333$ | $0.333$ | $< 0.001$ | **EXCELLENT (PASS)** |
| **Régression $Y = 2X + 5$** | $a=5, b=2, R^2=1.0$ | $a=5, b=2, R^2=1.0$ | $0.000$ | **EXACT (PASS)** |
| **Régression Multiple $Y = 3 + 2X_1 - 4X_2$**| $a=3, b_1=2, b_2=-4, R^2=1$ | $a=3, b_1=2, b_2=-4, R^2=1$ | $0.000$ | **EXACT (PASS)** |
| **Alpha Cronbach** (3 items identiques) | $1.000$ | $1.000$ | $0.000$ | **EXACT (PASS)** |
| **Rangs Spearman avec Ties** `[5, 1, 5, 5, 2]`| `[4, 1, 4, 4, 2]` | `[4, 1, 4, 4, 2]` | $0.000$ | **EXACT (PASS)** |
| **Reproductibilité Bootstrapping** (Seed 42) | Bit-for-bit identical | Identique à 100% | $0.000$ | **EXACT (PASS)** |

---

## 4. Analyse Critique des Écarts & Approximations

### 4.1 Origine des Factor Loadings pour AVE & Composite Reliability (CR)
* **Définition standard SmartPLS / PLS-SEM :** Les saturations $\lambda_i$ sont estimées par l'algorithme des moindres carrés partiels (Wold, 1982), où chaque variable latente est estimée itérativement en fonction du réseau de causalité interne et externe.
* **Implémentation actuelle dans FormFlow :**
  $$\lambda_i \approx \text{Corr}(\text{Item}_i, \text{ScoreTotal})$$
* **Impact :** C'est une **heuristique (Proxy Loadings)**. Elle est très satisfaisante pour des échelles unidimensionnelles homogènes, mais elle n'est pas rigoureusement identique aux loadings standardisés issus d'une analyse factorielle confirmatoire (CFA) ou de SmartPLS.
* **Verdict d'audit :** **WARNING**. Cela doit être qualifié dans la documentation de *"Proxy AVE / Proxy CR basé sur la théorie classique des tests"* plutôt que d'être présenté comme un calcul SmartPLS natif complet.

### 4.2 Suppression Listwise Globale
* **Résolution :** L'option `listwise` a été mise à jour pour préserver les observations complètes au niveau de chaque analyse (pairwise pour les corrélations, régression-spécifique pour les modèles OLS, construit-spécifique pour la cohérence interne). Une valeur manquante sur une variable annexe ne pénalise plus les autres analyses.
* **Verdict post-correction :** **PASS (Résolu & testé)**.

### 4.3 Quartiles & IQR
* **Résolution :** $Q_1$ (25ème centile), $Q_3$ (75ème centile) et l'IQR ($Q_3 - Q_1$) sont désormais calculés dans `computeDescriptiveStats`, ajoutés à l'interface `DescriptiveStats`, et affichés dans le tableau descriptif du Mode Recherche.
* **Verdict post-correction :** **PASS (Résolu & testé)**.

### 4.4 Règle de Cochran sur le Test du Chi-Deux
* **Résolution :** Un indicateur `hasLowExpectedFrequencies` et un message d'alerte méthodologique `warning` sont générés dès qu'une cellule théorique $E_{ij} < 5$. La statistique $\chi^2$ n'est pas modifiée, mais l'utilisateur est prévenu sur l'approximation asymptotique.
* **Verdict post-correction :** **PASS (Résolu & testé)**.

---

## 5. Déclaration de Conformité Externe (Règle de Véracité)

1. **Vérification SPSS :**
   > **ATTENTION : SPSS n'est pas disponible dans l'environnement local.**
   > Aucune validation par exécution directe du binaire SPSS n'a été réalisée. Les formules mathématiques (notamment le coefficient d'asymétrie de Fisher-Pearson Type 2, l'excès de kurtosis, l'Alpha de Cronbach et la régression OLS) ont été validées selon les spécifications formelles de la documentation des algorithmes d'IBM SPSS Statistics 28.

2. **Vérification R :**
   > **ATTENTION : R n'est pas disponible dans l'environnement local.**
   > La validation a été menée contre les solutions analytiques exactes et les intégrales régularisées fermées équivalentes aux fonctions R `pt()`, `pchisq()`, `pf()`, `cor.test()` et `lm()`.

3. **Vérification SmartPLS :**
   > **ATTENTION : SmartPLS n'est pas disponible dans l'environnement local.**
   > L'Alpha de Cronbach et le critère de Fornell-Larcker sont conformes aux définitions académiques. L'AVE et le Composite Reliability utilisent une approximation de loadings basée sur le score total non pondéré.

---

## 6. Synthèse des Évaluations de Fonctionnalités Post-Corrections

* **Moyenne, Médiane, Mode, Min, Max :** `PASS`
* **Variance & Écart-Type d'échantillon ($n-1$) :** `PASS`
* **Asymétrie (Fisher-Pearson Type 2) :** `PASS`
* **Excès de Kurtosis (SPSS Type 2) :** `PASS`
* **Quartiles ($Q_1, Q_3$) & IQR :** `PASS` *(Ajouté et validé)*
* **Corrélation de Pearson & Student $t$ :** `PASS`
* **Corrélation de Spearman (gestion des Ties) :** `PASS`
* **Intervalles de Confiance Fisher $z$ :** `PASS`
* **Correction de Bonferroni :** `PASS`
* **Régression Linéaire Multiple OLS & ANOVA $F$ :** `PASS`
* **Test du Chi-Deux & $V$ de Cramér :** `PASS`
* **Avertissement Règle de Cochran ($E_{ij} < 5$) :** `PASS` *(Ajouté et validé)*
* **Alpha de Cronbach par construit :** `PASS`
* **Item-Rest Correlation & Alpha if Item Deleted :** `PASS`
* **Inversion d'items Likert :** `PASS`
* **Bootstrapping (5 000 tirages, reproductibilité Mulberry32) :** `PASS`
* **AVE (Average Variance Extracted) :** `WARNING` (Loadings approchés par score total)
* **Composite Reliability (CR) :** `WARNING` (Loadings approchés par score total)
* **Fornell-Larcker Criterion :** `PASS` (Algorithme de comparaison mathématique exact)
* **Gestion des valeurs manquantes (Analyse-spécifique) :** `PASS` *(Corrigé et validé)*
* **Robustesse aux cas limites ($N=0, 1, 2$, variance nulle, matrices singulières) :** `PASS`
