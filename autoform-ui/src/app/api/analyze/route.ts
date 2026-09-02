import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import Papa from 'papaparse';
import { mean, median, standardDeviation, min, max, mode, sampleCorrelation, linearRegression, linearRegressionLine, rSquared, sampleVariance } from 'simple-statistics';

// ============================================================
// FORMULES MATHÉMATIQUES PURES (Aucune IA ici, que des maths)
// ============================================================

interface ColumnStats {
  name: string;
  count: number;
  mean: number;
  median: number;
  stddev: number;
  min: number;
  max: number;
  mode: number;
}

interface CorrelationResult {
  var1: string;
  var2: string;
  coefficient: number;
  significance: string;
  pValue: string;
}

interface FrequencyItem {
  value: string;
  count: number;
  percentage: number;
}

interface CategoricalStats {
  name: string;
  totalResponses: number;
  uniqueValues: number;
  frequencies: FrequencyItem[];
}

/**
 * Calcule les statistiques descriptives d'une colonne numérique.
 * Formules utilisées :
 * - Moyenne arithmétique : μ = (Σxi) / n
 * - Médiane : valeur centrale de la série triée
 * - Écart-type (population) : σ = √[ Σ(xi - μ)² / n ]
 * - Mode : valeur la plus fréquente
 */
function computeDescriptiveStats(name: string, values: number[]): ColumnStats {
  return {
    name,
    count: values.length,
    mean: Math.round(mean(values) * 1000) / 1000,
    median: Math.round(median(values) * 1000) / 1000,
    stddev: Math.round(standardDeviation(values) * 1000) / 1000,
    min: min(values),
    max: max(values),
    mode: mode(values),
  };
}

/**
 * Calcule le coefficient de corrélation de Pearson entre deux variables.
 * Formule officielle :
 *   r = Σ[(xi - x̄)(yi - ȳ)] / √[Σ(xi - x̄)² × Σ(yi - ȳ)²]
 * 
 * Interprétation standard (Cohen, 1988) :
 *   |r| >= 0.7 → Forte corrélation
 *   |r| >= 0.4 → Corrélation modérée
 *   |r| >= 0.2 → Corrélation faible
 *   |r| <  0.2 → Corrélation négligeable
 *
 * Calcul du t-statistic pour la p-value :
 *   t = r × √(n-2) / √(1-r²)
 *   Avec n-2 degrés de liberté
 */
function computeCorrelation(name1: string, values1: number[], name2: string, values2: number[]): CorrelationResult {
  const n = Math.min(values1.length, values2.length);
  const paired: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    paired.push([values1[i], values2[i]]);
  }

  const r = Math.round(sampleCorrelation(paired.map(p => p[0]), paired.map(p => p[1])) * 1000) / 1000;
  const absR = Math.abs(r);

  // Calcul du t-statistic : t = r * sqrt(n-2) / sqrt(1-r²)
  let pValueLabel = 'Non significatif (p > 0.05)';
  if (n > 2 && absR < 1) {
    const tStat = absR * Math.sqrt((n - 2) / (1 - r * r));
    // Approximation simplifiée de la p-value via le t-statistic
    // Pour n > 30, si |t| > 1.96 → p < 0.05, si |t| > 2.576 → p < 0.01
    if (tStat > 3.291) pValueLabel = 'Très significatif (p < 0.001)';
    else if (tStat > 2.576) pValueLabel = 'Significatif (p < 0.01)';
    else if (tStat > 1.96) pValueLabel = 'Significatif (p < 0.05)';
  }

  let significance = 'Corrélation négligeable';
  if (absR >= 0.7) significance = r > 0 ? 'Forte corrélation positive' : 'Forte corrélation négative';
  else if (absR >= 0.4) significance = r > 0 ? 'Corrélation modérée positive' : 'Corrélation modérée négative';
  else if (absR >= 0.2) significance = r > 0 ? 'Corrélation faible positive' : 'Corrélation faible négative';

  return {
    var1: name1,
    var2: name2,
    coefficient: r,
    significance: `${significance} | ${pValueLabel}`,
    pValue: pValueLabel,
  };
}

/**
 * Calcule les fréquences d'une colonne catégorielle (texte, choix multiples).
 * - Comptage de chaque valeur unique
 * - Pourcentage = (count / total) × 100
 */
function computeCategoricalStats(name: string, values: string[]): CategoricalStats {
  const freq: Record<string, number> = {};
  for (const v of values) {
    const trimmed = v.trim();
    if (trimmed) {
      freq[trimmed] = (freq[trimmed] || 0) + 1;
    }
  }
  
  const total = values.filter(v => v.trim()).length;
  const frequencies: FrequencyItem[] = Object.entries(freq)
    .map(([value, count]) => ({
      value,
      count,
      percentage: Math.round((count / total) * 10000) / 100,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    name,
    totalResponses: total,
    uniqueValues: frequencies.length,
    frequencies: frequencies.slice(0, 10), // Top 10
  };
}

/**
 * Régression Linéaire Simple (Moindres Carrés Ordinaires / OLS)
 * Formules :
 *   b = Σ[(xi - x̄)(yi - ȳ)] / Σ(xi - x̄)²
 *   a = ȳ - b × x̄
 *   R² = 1 - (SS_res / SS_tot)
 */
function computeLinearRegression(xValues: number[], yValues: number[]): {
  slope: number;
  intercept: number;
  rSquared: number;
} {
  const regression = linearRegression(xValues.map((x, i) => [x, yValues[i]]));
  const regressionLine = linearRegressionLine(regression);
  const rSq = rSquared(xValues.map((x, i) => [x, yValues[i]]), regressionLine);
  
  return {
    slope: Math.round(regression.m * 1000) / 1000,
    intercept: Math.round(regression.b * 1000) / 1000,
    rSquared: Math.round(rSq * 1000) / 1000,
  };
}

/**
 * Alpha de Cronbach (Fiabilité interne d'une échelle)
 * Formule officielle (Cronbach, 1951) :
 *   α = (k / (k-1)) × (1 - Σσ²ᵢ / σ²total)
 * Où :
 *   k = nombre d'items (colonnes numériques)
 *   σ²ᵢ = variance de chaque item
 *   σ²total = variance de la somme de tous les items
 * 
 * Interprétation (Nunnally & Bernstein, 1994) :
 *   α >= 0.9 → Excellent
 *   α >= 0.8 → Bon
 *   α >= 0.7 → Acceptable
 *   α >= 0.6 → Questionnable
 *   α <  0.6 → Inacceptable
 */
function computeCronbachAlpha(columns: number[][]): { alpha: number; interpretation: string } {
  const k = columns.length;
  if (k < 2) return { alpha: 0, interpretation: 'Minimum 2 items requis' };

  // Aligner les longueurs
  const minLen = Math.min(...columns.map(c => c.length));
  const trimmed = columns.map(c => c.slice(0, minLen));

  // Variance de chaque item
  const itemVariances = trimmed.map(col => sampleVariance(col));
  const sumItemVariances = itemVariances.reduce((a, b) => a + b, 0);

  // Calculer le score total (somme de chaque ligne)
  const totalScores: number[] = [];
  for (let i = 0; i < minLen; i++) {
    let sum = 0;
    for (let j = 0; j < k; j++) {
      sum += trimmed[j][i];
    }
    totalScores.push(sum);
  }
  const totalVariance = sampleVariance(totalScores);

  // α = (k / (k-1)) × (1 - Σσ²ᵢ / σ²total)
  const alpha = totalVariance === 0 ? 0 : Math.round(((k / (k - 1)) * (1 - sumItemVariances / totalVariance)) * 1000) / 1000;

  let interpretation = 'Inacceptable';
  if (alpha >= 0.9) interpretation = 'Excellent';
  else if (alpha >= 0.8) interpretation = 'Bon';
  else if (alpha >= 0.7) interpretation = 'Acceptable';
  else if (alpha >= 0.6) interpretation = 'Questionnable';

  return { alpha, interpretation };
}

/**
 * AVE (Average Variance Extracted) — Variance Moyenne Extraite
 * Formule (Fornell & Larcker, 1981) :
 *   AVE = Σ(loadingᵢ²) / k
 * Où loadingᵢ = corrélation de chaque item avec le score total
 * 
 * Seuil : AVE >= 0.5 → La validité convergente est établie
 */
function computeAVE(columns: number[][]): { ave: number; interpretation: string } {
  const k = columns.length;
  if (k < 2) return { ave: 0, interpretation: 'Minimum 2 items requis' };

  const minLen = Math.min(...columns.map(c => c.length));
  const trimmed = columns.map(c => c.slice(0, minLen));

  // Score total
  const totalScores: number[] = [];
  for (let i = 0; i < minLen; i++) {
    let sum = 0;
    for (let j = 0; j < k; j++) sum += trimmed[j][i];
    totalScores.push(sum);
  }

  // Loading = corrélation de chaque item avec le total
  let sumSquaredLoadings = 0;
  for (let j = 0; j < k; j++) {
    const loading = sampleCorrelation(trimmed[j], totalScores);
    sumSquaredLoadings += loading * loading;
  }

  const ave = Math.round((sumSquaredLoadings / k) * 1000) / 1000;
  return {
    ave,
    interpretation: ave >= 0.5 ? 'Validité convergente établie (AVE >= 0.5)' : 'Validité convergente insuffisante (AVE < 0.5)',
  };
}

/**
 * Validité Discriminante de Fornell-Larcker
 * Règle : La racine carrée de l'AVE d'un construit doit être
 *         supérieure à toutes ses corrélations avec les autres construits.
 * √AVE > max(rᵢⱼ) → Validité discriminante confirmée
 */
function computeFornellLarcker(aveValue: number, maxCorrelation: number): { sqrtAVE: number; maxCorr: number; valid: boolean; interpretation: string } {
  const sqrtAVE = Math.round(Math.sqrt(aveValue) * 1000) / 1000;
  return {
    sqrtAVE,
    maxCorr: maxCorrelation,
    valid: sqrtAVE > Math.abs(maxCorrelation),
    interpretation: sqrtAVE > Math.abs(maxCorrelation)
      ? `√AVE (${sqrtAVE}) > Corr max (${maxCorrelation}) → Validité discriminante CONFIRMÉE`
      : `√AVE (${sqrtAVE}) ≤ Corr max (${maxCorrelation}) → Validité discriminante NON CONFIRMÉE`,
  };
}

/**
 * Bootstrapping (Rééchantillonnage)
 * Méthode : Tirage aléatoire avec remise de n observations,
 *           répété N fois (5000 itérations standard).
 * Pour chaque itération, on recalcule la corrélation.
 * On obtient un intervalle de confiance à 95% et un écart-type bootstrap.
 */
function computeBootstrap(xValues: number[], yValues: number[], iterations: number = 5000): {
  originalR: number;
  bootstrapMean: number;
  bootstrapStdErr: number;
  ci95Lower: number;
  ci95Upper: number;
} {
  const n = Math.min(xValues.length, yValues.length);
  const xTrimmed = xValues.slice(0, n);
  const yTrimmed = yValues.slice(0, n);

  const originalR = Math.round(sampleCorrelation(xTrimmed, yTrimmed) * 1000) / 1000;
  const bootstrapCorrelations: number[] = [];

  // Générateur pseudo-aléatoire simple (Mulberry32)
  let seed = 42;
  const random = () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };

  for (let iter = 0; iter < iterations; iter++) {
    const xSample: number[] = [];
    const ySample: number[] = [];
    for (let i = 0; i < n; i++) {
      const idx = Math.floor(random() * n);
      xSample.push(xTrimmed[idx]);
      ySample.push(yTrimmed[idx]);
    }
    try {
      const r = sampleCorrelation(xSample, ySample);
      if (!isNaN(r)) bootstrapCorrelations.push(r);
    } catch { /* skip invalid samples */ }
  }

  bootstrapCorrelations.sort((a, b) => a - b);
  const bLen = bootstrapCorrelations.length;
  const ci95Lower = Math.round(bootstrapCorrelations[Math.floor(bLen * 0.025)] * 1000) / 1000;
  const ci95Upper = Math.round(bootstrapCorrelations[Math.floor(bLen * 0.975)] * 1000) / 1000;
  const bootstrapMean = Math.round(mean(bootstrapCorrelations) * 1000) / 1000;
  const bootstrapStdErr = Math.round(standardDeviation(bootstrapCorrelations) * 1000) / 1000;

  return { originalR, bootstrapMean, bootstrapStdErr, ci95Lower, ci95Upper };
}


// ============================================================
// API ROUTE
// ============================================================

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const apiKey = formData.get('apiKey') as string;
    const instructions = formData.get('instructions') as string;

    if (!file || !apiKey) {
      return NextResponse.json({ error: 'Fichier ou clé API manquant' }, { status: 400 });
    }

    // ---- ÉTAPE A : Lire le CSV localement ----
    const csvText = await file.text();
    const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
    const rows = parsed.data as Record<string, string>[];
    const headers = parsed.meta.fields || [];

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Le fichier CSV est vide ou mal formaté.' }, { status: 400 });
    }

    // ---- ÉTAPE B : Séparer colonnes numériques / catégorielles ----
    const numericColumns: Record<string, number[]> = {};
    const categoricalColumns: Record<string, string[]> = {};

    for (const header of headers) {
      const rawValues = rows.map(r => r[header]?.trim()).filter(v => v !== undefined && v !== '');
      const numericValues = rawValues.map(v => parseFloat(v.replace(',', '.'))).filter(v => !isNaN(v));

      // Si >50% des valeurs sont numériques, on la considère numérique
      if (numericValues.length > rawValues.length * 0.5 && numericValues.length >= 3) {
        numericColumns[header] = numericValues;
      } else if (rawValues.length > 0) {
        categoricalColumns[header] = rawValues;
      }
    }

    // ---- ÉTAPE C : Calculs Mathématiques Purs ----
    
    // C1. Statistiques descriptives
    const descriptiveStats: ColumnStats[] = [];
    for (const [name, values] of Object.entries(numericColumns)) {
      descriptiveStats.push(computeDescriptiveStats(name, values));
    }

    // C2. Analyse des fréquences (catégoriel)
    const categoricalResults: CategoricalStats[] = [];
    for (const [name, values] of Object.entries(categoricalColumns)) {
      categoricalResults.push(computeCategoricalStats(name, values));
    }

    // C3. Matrice de corrélations (toutes les paires numériques)
    const numericKeys = Object.keys(numericColumns);
    const correlations: CorrelationResult[] = [];
    for (let i = 0; i < numericKeys.length; i++) {
      for (let j = i + 1; j < numericKeys.length; j++) {
        const corr = computeCorrelation(
          numericKeys[i], numericColumns[numericKeys[i]],
          numericKeys[j], numericColumns[numericKeys[j]]
        );
        if (!isNaN(corr.coefficient)) {
          correlations.push(corr);
        }
      }
    }
    // Trier par force de corrélation
    correlations.sort((a, b) => Math.abs(b.coefficient) - Math.abs(a.coefficient));

    // C4. Régression linéaire (sur la paire la plus corrélée si elle existe)
    let regressionResult = null;
    if (correlations.length > 0) {
      const best = correlations[0];
      const xVals = numericColumns[best.var1];
      const yVals = numericColumns[best.var2];
      const minLen = Math.min(xVals.length, yVals.length);
      regressionResult = {
        ...computeLinearRegression(xVals.slice(0, minLen), yVals.slice(0, minLen)),
        xVar: best.var1,
        yVar: best.var2,
      };
    }

    // C5. Alpha de Cronbach (fiabilité globale)
    const allNumericArrays = Object.values(numericColumns);
    const cronbach = computeCronbachAlpha(allNumericArrays);

    // C6. AVE (Average Variance Extracted)
    const aveResult = computeAVE(allNumericArrays);

    // C7. Validité Discriminante (Fornell-Larcker)
    const maxCorr = correlations.length > 0 ? Math.abs(correlations[0].coefficient) : 0;
    const fornellLarcker = computeFornellLarcker(aveResult.ave, maxCorr);

    // C8. Bootstrapping (5000 itérations sur la corrélation la plus forte)
    let bootstrapResult = null;
    if (correlations.length > 0) {
      const best = correlations[0];
      const xVals = numericColumns[best.var1];
      const yVals = numericColumns[best.var2];
      const minLen = Math.min(xVals.length, yVals.length);
      bootstrapResult = {
        ...computeBootstrap(xVals.slice(0, minLen), yVals.slice(0, minLen), 5000),
        var1: best.var1,
        var2: best.var2,
      };
    }

    // ---- ÉTAPE D : Construire le résumé mathématique ----
    const mathReport = {
      totalRows: rows.length,
      totalColumns: headers.length,
      numericColumnsCount: numericKeys.length,
      categoricalColumnsCount: Object.keys(categoricalColumns).length,
      descriptiveStats,
      categoricalResults: categoricalResults.slice(0, 5),
      correlations: correlations.slice(0, 10),
      regression: regressionResult,
      cronbachAlpha: cronbach,
      ave: aveResult,
      fornellLarcker,
      bootstrap: bootstrapResult,
    };

    // ---- ÉTAPE E : Envoyer les résultats exacts à l'IA pour rédaction ----
    const openai = new OpenAI({ apiKey });
    
    const interpretationPrompt = `Tu es un Data Scientist expert. Voici les résultats EXACTS d'une analyse statistique calculée mathématiquement sur un jeu de données de ${rows.length} réponses à un formulaire.

RÉSULTATS MATHÉMATIQUES OFFICIELS (calculés par le code, tu ne dois PAS les modifier) :
${JSON.stringify(mathReport, null, 2)}

Instructions supplémentaires de l'utilisateur : ${instructions || "Fais une interprétation générale."}

Tâche : Rédige un rapport d'analyse en français (3-4 paragraphes) qui INTERPRÈTE ces résultats pour un humain non-expert. Explique ce que signifient les corrélations trouvées, les tendances dans les données, et les conclusions qu'on peut en tirer. Ne modifie JAMAIS les chiffres, cite-les exactement comme donnés.`;

    const aiResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: interpretationPrompt }],
      temperature: 0.3,
    });

    const summary = aiResponse.choices[0].message.content || "Rapport non disponible.";

    // ---- RÉPONSE FINALE ----
    return NextResponse.json({
      success: true,
      data: {
        summary,
        statistics: descriptiveStats.map(s => ({
          name: s.name,
          value: `μ=${s.mean} | σ=${s.stddev} | Med=${s.median}`,
          interpretation: `Min: ${s.min} → Max: ${s.max} | n=${s.count} | Mode: ${s.mode}`,
        })),
        correlations: correlations.slice(0, 10).map(c => ({
          var1: c.var1,
          var2: c.var2,
          coefficient: c.coefficient,
          significance: c.significance,
        })),
        categorical: categoricalResults.slice(0, 5),
        regression: regressionResult,
        cronbach,
        ave: aveResult,
        fornellLarcker,
        bootstrap: bootstrapResult,
        meta: {
          totalRows: rows.length,
          totalColumns: headers.length,
          numericColumns: numericKeys.length,
          categoricalColumns: Object.keys(categoricalColumns).length,
        },
      },
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue';
    console.error("Analysis Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
