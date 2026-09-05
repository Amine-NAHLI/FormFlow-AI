import { sampleVariance, sampleCorrelation, mean, standardDeviation } from 'simple-statistics';
import { ReliabilityResult } from './types';

/**
 * Evaluates internal consistency and reliability for a set of items belonging to a construct.
 */
export function computeConstructReliability(
  constructName: string,
  itemNames: string[],
  dataMatrix: Record<string, number[]>
): ReliabilityResult {
  const k = itemNames.length;
  if (k < 2) {
    return {
      constructName,
      itemCount: k,
      n: 0,
      cronbachAlpha: 0,
      compositeReliability: 0,
      interpretation: 'Au moins 2 items sont nécessaires pour calculer la fiabilité',
      itemStats: [],
    };
  }

  // Ensure items exist and have same length
  const sampleLengths = itemNames.map(name => (dataMatrix[name] ? dataMatrix[name].length : 0));
  const rawN = Math.min(...sampleLengths);

  // Construct-specific complete cases
  const validIndices: number[] = [];
  for (let i = 0; i < rawN; i++) {
    let allValid = true;
    for (const name of itemNames) {
      const val = dataMatrix[name][i];
      if (isNaN(val) || !isFinite(val)) {
        allValid = false;
        break;
      }
    }
    if (allValid) {
      validIndices.push(i);
    }
  }

  const n = validIndices.length;
  if (n < 3) {
    return {
      constructName,
      itemCount: k,
      n,
      cronbachAlpha: 0,
      compositeReliability: 0,
      interpretation: 'Échantillon insuffisant (N < 3)',
      itemStats: [],
    };
  }

  const itemsData: number[][] = itemNames.map(name => validIndices.map(idx => dataMatrix[name][idx]));

  // Compute item variances
  const itemVariances = itemsData.map(col => sampleVariance(col));
  const sumItemVariances = itemVariances.reduce((acc, v) => acc + v, 0);

  // Compute sum score for each observation
  const totalScores: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < k; j++) {
      totalScores[i] += itemsData[j][i];
    }
  }

  const totalVariance = sampleVariance(totalScores);

  // Raw Cronbach's Alpha
  let cronbachAlpha = 0;
  if (totalVariance > 0) {
    const rawAlpha = (k / (k - 1)) * (1 - sumItemVariances / totalVariance);
    cronbachAlpha = Math.round(rawAlpha * 1000) / 1000;
  }

  // Interpretation according to Nunnally (1978) / George & Mallery (2003)
  let interpretation = 'Inacceptable (α < 0.50)';
  if (cronbachAlpha >= 0.90) interpretation = 'Excellente fiabilité (α ≥ 0.90)';
  else if (cronbachAlpha >= 0.80) interpretation = 'Bonne fiabilité (α ≥ 0.80)';
  else if (cronbachAlpha >= 0.70) interpretation = 'Fiabilité acceptable (α ≥ 0.70)';
  else if (cronbachAlpha >= 0.60) interpretation = 'Fiabilité discutable (0.60 ≤ α < 0.70)';
  else if (cronbachAlpha >= 0.50) interpretation = 'Fiabilité médiocre (0.50 ≤ α < 0.60)';

  // Calculate Item-Rest Correlations and Alpha if Item Deleted
  const itemStats = [];
  const loadings: number[] = [];

  for (let j = 0; j < k; j++) {
    const currentItem = itemsData[j];
    const itemName = itemNames[j];

    // Total score excluding current item
    const restScores: number[] = new Array(n);
    for (let i = 0; i < n; i++) {
      restScores[i] = totalScores[i] - currentItem[i];
    }

    // Item-rest correlation (corrected item-total correlation)
    let itemRestCorr = 0;
    try {
      itemRestCorr = sampleCorrelation(currentItem, restScores);
      if (isNaN(itemRestCorr)) itemRestCorr = 0;
    } catch {
      itemRestCorr = 0;
    }

    // Factor loading approximation (correlation with overall total score)
    let loading = 0;
    try {
      loading = sampleCorrelation(currentItem, totalScores);
      if (isNaN(loading)) loading = 0;
    } catch {
      loading = 0;
    }
    loadings.push(Math.max(-1, Math.min(1, loading)));

    // Alpha if item deleted
    let alphaIfDeleted = 0;
    if (k > 2) {
      const restVariances = itemVariances.filter((_, idx) => idx !== j);
      const sumRestVariances = restVariances.reduce((acc, v) => acc + v, 0);
      const restTotalVariance = sampleVariance(restScores);

      if (restTotalVariance > 0) {
        const rawRestAlpha = ((k - 1) / (k - 2)) * (1 - sumRestVariances / restTotalVariance);
        alphaIfDeleted = Math.round(rawRestAlpha * 1000) / 1000;
      }
    }

    itemStats.push({
      itemName,
      mean: Math.round(mean(currentItem) * 1000) / 1000,
      stddev: Math.round(standardDeviation(currentItem) * 1000) / 1000,
      itemRestCorrelation: Math.round(itemRestCorr * 1000) / 1000,
      alphaIfDeleted,
      factorLoading: Math.round(loading * 1000) / 1000,
    });
  }

  // Composite Reliability (CR, Dillon-Goldstein's rho)
  // CR = (Σ λ_i)² / [ (Σ λ_i)² + Σ (1 - λ_i²) ]
  let sumLoadings = 0;
  let sumErrorVariances = 0;
  for (const l of loadings) {
    const absL = Math.abs(l);
    sumLoadings += absL;
    sumErrorVariances += (1 - absL * absL);
  }

  const numerator = sumLoadings * sumLoadings;
  const denominator = numerator + sumErrorVariances;
  const compositeReliability = denominator > 0 ? Math.round((numerator / denominator) * 1000) / 1000 : 0;

  return {
    constructName,
    itemCount: k,
    n,
    cronbachAlpha,
    compositeReliability,
    interpretation,
    itemStats,
  };
}
