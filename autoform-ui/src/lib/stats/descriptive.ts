import { mean, median, min, max, mode, sampleVariance, quantile } from 'simple-statistics';
import { DescriptiveStats, CategoricalStats, FrequencyItem } from './types';

/**
 * Calculates sample skewness (Fisher-Pearson adjusted coefficient, consistent with SPSS / R / e1071)
 */
export function sampleSkewness(values: number[], avg: number, std: number): number {
  const n = values.length;
  if (n < 3 || std === 0) return 0;
  const m3 = values.reduce((acc, x) => acc + Math.pow(x - avg, 3), 0) / n;
  const s3 = Math.pow(std, 3);
  const unadjusted = m3 / s3;
  // Adjustment factor: sqrt(n * (n - 1)) / (n - 2)
  const adj = Math.sqrt(n * (n - 1)) / (n - 2);
  return unadjusted * adj;
}

/**
 * Calculates sample excess kurtosis (SPSS / SAS / Excel convention, normal distribution = 0)
 */
export function sampleExcessKurtosis(values: number[], avg: number, std: number): number {
  const n = values.length;
  if (n < 4 || std === 0) return 0;

  let sum4 = 0;
  for (const x of values) {
    sum4 += Math.pow((x - avg) / std, 4);
  }

  const term1 = (n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3));
  const term2 = (3 * Math.pow(n - 1, 2)) / ((n - 2) * (n - 3));
  return term1 * sum4 - term2;
}

/**
 * Computes complete descriptive statistics for a single numeric column
 */
export function computeDescriptiveStats(name: string, rawValues: number[], explicitMissingCount: number = 0): DescriptiveStats {
  const values = rawValues.filter(v => !isNaN(v) && isFinite(v));
  const missingCount = explicitMissingCount + (rawValues.length - values.length);
  const n = values.length;
  if (n === 0) {
    return {
      name,
      n: 0,
      missing: missingCount,
      mean: 0,
      median: 0,
      stddev: 0,
      variance: 0,
      min: 0,
      max: 0,
      mode: 0,
      q1: 0,
      q3: 0,
      iqr: 0,
      skewness: 0,
      kurtosis: 0,
      isNormalCandidate: false,
    };
  }

  const avg = mean(values);
  const med = median(values);
  const varianceVal = n > 1 ? sampleVariance(values) : 0;
  const stdVal = Math.sqrt(varianceVal);
  const minVal = min(values);
  const maxVal = max(values);
  const modeVal = mode(values);

  // Quartiles (Q1 = 25th percentile, Q3 = 75th percentile, IQR = Q3 - Q1)
  const q1Raw = n === 1 ? minVal : quantile(values, 0.25);
  const q3Raw = n === 1 ? maxVal : quantile(values, 0.75);
  const q1 = Math.round(q1Raw * 1000) / 1000;
  const q3 = Math.round(q3Raw * 1000) / 1000;
  const iqr = Math.round((q3 - q1) * 1000) / 1000;

  const skew = Math.round(sampleSkewness(values, avg, stdVal) * 1000) / 1000;
  const kurt = Math.round(sampleExcessKurtosis(values, avg, stdVal) * 1000) / 1000;

  // George & Mallery (2010): Skewness and Kurtosis between -1 and +1 (or -2 and +2) indicates approximate normality
  const isNormalCandidate = Math.abs(skew) <= 1.0 && Math.abs(kurt) <= 2.0;

  return {
    name,
    n,
    missing: missingCount,
    mean: Math.round(avg * 1000) / 1000,
    median: Math.round(med * 1000) / 1000,
    stddev: Math.round(stdVal * 1000) / 1000,
    variance: Math.round(varianceVal * 1000) / 1000,
    min: minVal,
    max: maxVal,
    mode: modeVal,
    q1,
    q3,
    iqr,
    skewness: skew,
    kurtosis: kurt,
    isNormalCandidate,
  };
}

/**
 * Computes categorical frequencies and percentages
 */
export function computeCategoricalStats(name: string, values: string[]): CategoricalStats {
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
      percentage: total > 0 ? Math.round((count / total) * 10000) / 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    name,
    totalResponses: total,
    uniqueValues: frequencies.length,
    frequencies: frequencies.slice(0, 15), // Top 15 values
  };
}
