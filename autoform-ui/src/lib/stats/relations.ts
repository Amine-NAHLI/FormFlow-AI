import { sampleCorrelation, mean, sampleVariance } from 'simple-statistics';
import { CorrelationPair, RegressionModel, ChiSquareResult } from './types';
import { studentTPValue, chiSquarePValue, fDistPValue, rankData } from './math-utils';

/**
 * Fisher z-transform 95% Confidence Interval for Pearson r
 */
export function correlationConfidenceInterval95(r: number, n: number): [number, number] {
  if (n <= 3 || Math.abs(r) >= 1) return [r, r];
  const z = 0.5 * Math.log((1 + r) / (1 - r));
  const seZ = 1 / Math.sqrt(n - 3);
  const zLower = z - 1.96 * seZ;
  const zUpper = z + 1.96 * seZ;
  const rLower = Math.tanh(zLower);
  const rUpper = Math.tanh(zUpper);
  return [
    Math.round(rLower * 1000) / 1000,
    Math.round(rUpper * 1000) / 1000,
  ];
}

/**
 * Computes both Pearson r and Spearman rho for two numeric arrays,
 * with exact Student's t p-value and 95% CI.
 */
export function computeCorrelationPair(
  var1: string,
  values1: number[],
  var2: string,
  values2: number[]
): CorrelationPair | null {
  const rawN = Math.min(values1.length, values2.length);
  const v1: number[] = [];
  const v2: number[] = [];
  for (let i = 0; i < rawN; i++) {
    const val1 = values1[i];
    const val2 = values2[i];
    if (!isNaN(val1) && isFinite(val1) && !isNaN(val2) && isFinite(val2)) {
      v1.push(val1);
      v2.push(val2);
    }
  }
  const n = v1.length;
  if (n < 3) return null;

  let r = 0;
  try {
    r = sampleCorrelation(v1, v2);
  } catch {
    return null;
  }
  if (isNaN(r) || !isFinite(r)) return null;
  r = Math.max(-1, Math.min(1, r));

  // Spearman Rank correlation
  let rho = 0;
  try {
    const ranks1 = rankData(v1);
    const ranks2 = rankData(v2);
    rho = sampleCorrelation(ranks1, ranks2);
    if (isNaN(rho) || !isFinite(rho)) rho = r;
  } catch {
    rho = r;
  }

  const df = n - 2;
  const absR = Math.abs(r);
  let tStat = 0;
  let pValue = 1.0;

  if (absR >= 1.0) {
    tStat = Infinity;
    pValue = 0;
  } else {
    tStat = absR * Math.sqrt(df / (1 - r * r));
    pValue = studentTPValue(tStat, df);
  }

  let sigLabel = 'Non significatif (p > 0.05)';
  if (pValue < 0.001) sigLabel = 'p < 0.001 ***';
  else if (pValue < 0.01) sigLabel = 'p < 0.01 **';
  else if (pValue < 0.05) sigLabel = 'p < 0.05 *';

  const [ci95Lower, ci95Upper] = correlationConfidenceInterval95(r, n);

  return {
    var1,
    var2,
    n,
    coefficient: Math.round(r * 1000) / 1000,
    spearmanRho: Math.round(rho * 1000) / 1000,
    tStat: Math.round(tStat * 1000) / 1000,
    df,
    pValue: Math.round(pValue * 100000) / 100000,
    pValueBonferroni: pValue, // Will be updated after batch correction
    significanceLabel: sigLabel,
    ci95Lower,
    ci95Upper,
  };
}

/**
 * Computes Pearson & Spearman correlations for all numeric column pairs
 * and applies Bonferroni correction for multiple hypothesis testing.
 */
export function computeAllCorrelations(
  numericColumns: Record<string, number[]>
): CorrelationPair[] {
  const keys = Object.keys(numericColumns);
  const pairs: CorrelationPair[] = [];

  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const pair = computeCorrelationPair(keys[i], numericColumns[keys[i]], keys[j], numericColumns[keys[j]]);
      if (pair) pairs.push(pair);
    }
  }

  // Bonferroni correction: p_adj = min(1, p * M)
  const m = pairs.length;
  for (const pair of pairs) {
    pair.pValueBonferroni = Math.min(1.0, Math.round(pair.pValue * m * 100000) / 100000);
  }

  // Sort by absolute Pearson correlation descending
  pairs.sort((a, b) => Math.abs(b.coefficient) - Math.abs(a.coefficient));
  return pairs;
}

/**
 * Multiple / Simple Linear Regression using Ordinary Least Squares (OLS)
 */
export function computeLinearRegressionOLS(
  dependentVar: string,
  yValues: number[],
  independentVars: string[],
  xMatrix: Record<string, number[]>
): RegressionModel | null {
  const p = independentVars.length;
  if (p === 0) return null;

  const rawN = Math.min(yValues.length, ...independentVars.map(v => (xMatrix[v] ? xMatrix[v].length : 0)));

  // Model-specific listwise complete cases
  const validIndices: number[] = [];
  for (let i = 0; i < rawN; i++) {
    const yVal = yValues[i];
    if (isNaN(yVal) || !isFinite(yVal)) continue;
    let allXValid = true;
    for (const v of independentVars) {
      const xVal = xMatrix[v]?.[i];
      if (xVal === undefined || isNaN(xVal) || !isFinite(xVal)) {
        allXValid = false;
        break;
      }
    }
    if (allXValid) {
      validIndices.push(i);
    }
  }

  const n = validIndices.length;
  if (n <= p + 1) return null;

  const Y = validIndices.map(idx => yValues[idx]);
  const yMean = mean(Y);
  const yStd = Math.sqrt(sampleVariance(Y));

  // Build design matrix X with intercept: n rows x (p + 1) cols
  const X: number[][] = [];
  for (const idx of validIndices) {
    const row = [1.0]; // intercept
    for (let j = 0; j < p; j++) {
      row.push(xMatrix[independentVars[j]][idx]);
    }
    X.push(row);
  }

  // Compute X^T * X: (p+1) x (p+1)
  const k = p + 1;
  const XtX: number[][] = Array.from({ length: k }, () => new Array(k).fill(0));
  for (let r = 0; r < k; r++) {
    for (let c = 0; c < k; c++) {
      let sum = 0;
      for (let i = 0; i < n; i++) {
        sum += X[i][r] * X[i][c];
      }
      XtX[r][c] = sum;
    }
  }

  // Invert (X^T * X) using Gauss-Jordan elimination
  const invXtX: number[][] = Array.from({ length: k }, (_, r) =>
    Array.from({ length: k }, (_, c) => (r === c ? 1.0 : 0.0))
  );
  const A = XtX.map(row => [...row]);

  for (let col = 0; col < k; col++) {
    let pivot = col;
    for (let row = col + 1; row < k; row++) {
      if (Math.abs(A[row][col]) > Math.abs(A[pivot][col])) {
        pivot = row;
      }
    }
    if (Math.abs(A[pivot][col]) < 1e-12) {
      // Matrix is singular / multicollinear
      return null;
    }
    // Swap rows
    [A[col], A[pivot]] = [A[pivot], A[col]];
    [invXtX[col], invXtX[pivot]] = [invXtX[pivot], invXtX[col]];

    const diag = A[col][col];
    for (let j = 0; j < k; j++) {
      A[col][j] /= diag;
      invXtX[col][j] /= diag;
    }

    for (let row = 0; row < k; row++) {
      if (row !== col) {
        const factor = A[row][col];
        for (let j = 0; j < k; j++) {
          A[row][j] -= factor * A[col][j];
          invXtX[row][j] -= factor * invXtX[col][j];
        }
      }
    }
  }

  // Compute X^T * Y: k x 1
  const XtY: number[] = new Array(k).fill(0);
  for (let r = 0; r < k; r++) {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += X[i][r] * Y[i];
    }
    XtY[r] = sum;
  }

  // Beta = (X^T X)^-1 * (X^T Y)
  const beta: number[] = new Array(k).fill(0);
  for (let r = 0; r < k; r++) {
    let sum = 0;
    for (let c = 0; c < k; c++) {
      sum += invXtX[r][c] * XtY[c];
    }
    beta[r] = sum;
  }

  // Predictions and Residuals
  let ssTot = 0;
  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    let yPred = 0;
    for (let j = 0; j < k; j++) {
      yPred += X[i][j] * beta[j];
    }
    const res = Y[i] - yPred;
    ssRes += res * res;
    ssTot += Math.pow(Y[i] - yMean, 2);
  }

  const rSq = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;
  const dfResidual = n - p - 1;
  const adjRSq = dfResidual > 0 ? Math.max(0, 1 - ((1 - rSq) * (n - 1)) / dfResidual) : rSq;
  const sResidual = dfResidual > 0 ? Math.sqrt(ssRes / dfResidual) : 0;

  // ANOVA F-statistic
  let fStat = 0;
  let fPVal = 1.0;
  if (p > 0 && dfResidual > 0 && ssRes > 0) {
    const msReg = (ssTot - ssRes) / p;
    const msRes = ssRes / dfResidual;
    fStat = msReg / msRes;
    fPVal = fDistPValue(fStat, p, dfResidual);
  }

  // Coefficients stats
  const coefResults = [];
  for (let j = 0; j < p; j++) {
    const varName = independentVars[j];
    const b = beta[j + 1];
    const seB = sResidual * Math.sqrt(Math.max(0, invXtX[j + 1][j + 1]));
    const tStat = seB > 0 ? b / seB : 0;
    const pVal = dfResidual > 0 ? studentTPValue(tStat, dfResidual) : 1.0;

    // Standardized beta
    const xVals = validIndices.map(idx => xMatrix[varName][idx]);
    const xStd = Math.sqrt(sampleVariance(xVals));
    const stdBeta = yStd > 0 ? b * (xStd / yStd) : 0;

    coefResults.push({
      variable: varName,
      b: Math.round(b * 1000) / 1000,
      stdError: Math.round(seB * 1000) / 1000,
      tStat: Math.round(tStat * 1000) / 1000,
      pValue: Math.round(pVal * 100000) / 100000,
      beta: Math.round(stdBeta * 1000) / 1000,
    });
  }

  return {
    dependentVar,
    independentVars,
    n,
    r: Math.round(Math.sqrt(rSq) * 1000) / 1000,
    rSquared: Math.round(rSq * 1000) / 1000,
    adjRSquared: Math.round(adjRSq * 1000) / 1000,
    fStat: Math.round(fStat * 1000) / 1000,
    fPValue: Math.round(fPVal * 100000) / 100000,
    intercept: Math.round(beta[0] * 1000) / 1000,
    coefficients: coefResults,
  };
}

/**
 * Chi-Square test of independence between two categorical variables
 */
export function computeChiSquareTest(
  var1: string,
  vals1: string[],
  var2: string,
  vals2: string[]
): ChiSquareResult | null {
  const n = Math.min(vals1.length, vals2.length);
  if (n < 5) return null;

  // Build contingency table
  const table: Record<string, Record<string, number>> = {};
  const cat1Set = new Set<string>();
  const cat2Set = new Set<string>();

  for (let i = 0; i < n; i++) {
    const c1 = vals1[i].trim();
    const c2 = vals2[i].trim();
    if (!c1 || !c2) continue;

    cat1Set.add(c1);
    cat2Set.add(c2);

    if (!table[c1]) table[c1] = {};
    table[c1][c2] = (table[c1][c2] || 0) + 1;
  }

  const rows = Array.from(cat1Set);
  const cols = Array.from(cat2Set);
  const rCount = rows.length;
  const cCount = cols.length;

  if (rCount < 2 || cCount < 2 || rCount > 20 || cCount > 20) return null;

  const rowSums: Record<string, number> = {};
  const colSums: Record<string, number> = {};
  let grandTotal = 0;

  for (const r of rows) {
    rowSums[r] = 0;
    for (const c of cols) {
      const count = table[r][c] || 0;
      rowSums[r] += count;
      colSums[c] = (colSums[c] || 0) + count;
      grandTotal += count;
    }
  }

  if (grandTotal === 0) return null;

  let chi2 = 0;
  let lowExpectedCount = 0;
  const totalCells = rCount * cCount;

  for (const r of rows) {
    for (const c of cols) {
      const observed = table[r][c] || 0;
      const expected = (rowSums[r] * colSums[c]) / grandTotal;
      if (expected < 5) {
        lowExpectedCount++;
      }
      if (expected > 0) {
        chi2 += Math.pow(observed - expected, 2) / expected;
      }
    }
  }

  const df = (rCount - 1) * (cCount - 1);
  const pVal = chiSquarePValue(chi2, df);

  // Cramér's V: sqrt(chi2 / (n * min(r-1, c-1)))
  const minDim = Math.min(rCount - 1, cCount - 1);
  const cramersV = minDim > 0 ? Math.sqrt(chi2 / (grandTotal * minDim)) : 0;

  let interpretation = 'Indépendance non rejetée (p > 0.05)';
  if (pVal < 0.001) interpretation = 'Association très significative (p < 0.001)';
  else if (pVal < 0.01) interpretation = 'Association significative (p < 0.01)';
  else if (pVal < 0.05) interpretation = 'Association modérément significative (p < 0.05)';

  const hasLowExpectedFrequencies = lowExpectedCount > 0;
  const pctLow = totalCells > 0 ? Math.round((lowExpectedCount / totalCells) * 100) : 0;
  const warning = hasLowExpectedFrequencies
    ? `Attention (Règle de Cochran) : ${lowExpectedCount} cellule(s) (${pctLow}%) ont un effectif théorique inférieur à 5. La p-value asymptotique doit être interprétée avec prudence.`
    : undefined;

  return {
    var1,
    var2,
    chi2: Math.round(chi2 * 1000) / 1000,
    df,
    pValue: Math.round(pVal * 100000) / 100000,
    cramersV: Math.round(cramersV * 1000) / 1000,
    interpretation,
    hasLowExpectedFrequencies,
    warning,
  };
}
