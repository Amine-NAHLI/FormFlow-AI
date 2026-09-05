import { sampleCorrelation, mean, standardDeviation } from 'simple-statistics';
import { BootstrapEstimate } from './types';
import { createMulberry32 } from './math-utils';

/**
 * Performs non-parametric bootstrap resampling for Pearson correlation
 */
export function bootstrapCorrelation(
  parameterName: string,
  xValues: number[],
  yValues: number[],
  iterations: number = 5000,
  seed: number = 42
): BootstrapEstimate | null {
  const rawN = Math.min(xValues.length, yValues.length);
  const x: number[] = [];
  const y: number[] = [];
  for (let i = 0; i < rawN; i++) {
    const valX = xValues[i];
    const valY = yValues[i];
    if (!isNaN(valX) && isFinite(valX) && !isNaN(valY) && isFinite(valY)) {
      x.push(valX);
      y.push(valY);
    }
  }
  const n = x.length;
  if (n < 4) return null;

  let originalR = 0;
  try {
    originalR = sampleCorrelation(x, y);
    if (isNaN(originalR)) return null;
  } catch {
    return null;
  }

  const rng = createMulberry32(seed);
  const estimates: number[] = [];

  for (let b = 0; b < iterations; b++) {
    const sampleX: number[] = new Array(n);
    const sampleY: number[] = new Array(n);

    for (let i = 0; i < n; i++) {
      const idx = Math.floor(rng() * n);
      sampleX[i] = x[idx];
      sampleY[i] = y[idx];
    }

    try {
      const rBoot = sampleCorrelation(sampleX, sampleY);
      if (!isNaN(rBoot) && isFinite(rBoot)) {
        estimates.push(rBoot);
      }
    } catch {
      // Ignore degenerate samples
    }
  }

  if (estimates.length < 50) return null;

  estimates.sort((a, b) => a - b);
  const validB = estimates.length;

  // Percentile 95% CI
  const lowerIndex = Math.max(0, Math.floor(validB * 0.025));
  const upperIndex = Math.min(validB - 1, Math.floor(validB * 0.975));

  const ci95Lower = Math.round(estimates[lowerIndex] * 1000) / 1000;
  const ci95Upper = Math.round(estimates[upperIndex] * 1000) / 1000;
  const bMean = Math.round(mean(estimates) * 1000) / 1000;
  const bStdErr = Math.round(standardDeviation(estimates) * 1000) / 1000;

  // Empirical p-value against H0: theta = 0
  const countNegative = estimates.filter(v => v <= 0).length;
  const countPositive = estimates.filter(v => v >= 0).length;
  const pVal = 2 * Math.min(countNegative, countPositive) / validB;

  return {
    parameter: parameterName,
    originalValue: Math.round(originalR * 1000) / 1000,
    iterations: validB,
    seed,
    bootstrapMean: bMean,
    bootstrapStdErr: bStdErr,
    ci95Lower,
    ci95Upper,
    pValueEstimated: Math.round(Math.min(1.0, pVal) * 10000) / 10000,
  };
}
