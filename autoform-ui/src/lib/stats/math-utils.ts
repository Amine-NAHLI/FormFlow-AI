/**
 * Numerical and statistical distribution utilities
 * Provides exact p-values for Student's t, Snedecor's F, and Chi-Square distributions,
 * rank transformations for Spearman, and seeded PRNG.
 */

/**
 * Lanczos approximation for log-Gamma function ln(Γ(z))
 */
export function logGamma(z: number): number {
  if (z <= 0) return 0;
  const c = [
    76.18009172947146,
    -86.50532032941677,
    24.01409824083091,
    -1.231739572450155,
    0.1208650973866179e-2,
    -0.5395239384953e-5
  ];
  const x = z;
  let y = z;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j <= 5; j++) {
    ser += c[j] / ++y;
  }
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}

/**
 * Regularized incomplete beta function I_x(a, b) using continued fractions
 */
export function betainc(x: number, a: number, b: number): number {
  if (x < 0 || x > 1) return NaN;
  if (x === 0) return 0;
  if (x === 1) return 1;

  // Symmetry transformation
  if (x > (a + 1) / (a + b + 2)) {
    return 1 - betainc(1 - x, b, a);
  }

  const factor = Math.exp(
    a * Math.log(x) + b * Math.log(1 - x) - logGamma(a) - logGamma(b) + logGamma(a + b)
  ) / a;

  // Lentz's method for continued fraction
  const MAXIT = 200;
  const EPS = 1e-14;
  const FPMIN = 1e-30;

  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1.0;
  let d = 1.0 - qab * x / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1.0 / d;
  let h = d;

  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1.0 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1.0 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1.0 / d;
    h *= d * c;

    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1.0 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1.0 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1.0 / d;
    const del = d * c;
    h *= del;

    if (Math.abs(del - 1.0) <= EPS) break;
  }

  return factor * h;
}

/**
 * Two-tailed p-value for Student's t-distribution with df degrees of freedom
 * Equivalent to R: 2 * (1 - pt(abs(t), df))
 */
export function studentTPValue(t: number, df: number): number {
  if (df <= 0 || isNaN(t) || isNaN(df)) return NaN;
  const absT = Math.abs(t);
  const x = df / (df + absT * absT);
  const p = betainc(x, df / 2, 0.5);
  return Math.max(0, Math.min(1, p));
}

/**
 * Upper regularized incomplete gamma function Q(s, x) = Γ(s, x) / Γ(s)
 */
export function gammaincUpper(s: number, x: number): number {
  if (x < 0 || s <= 0) return NaN;
  if (x === 0) return 1.0;

  // Use series for x < s + 1, continued fraction otherwise
  if (x < s + 1) {
    // P(s, x) via series, then Q = 1 - P
    let sum = 1 / s;
    let term = sum;
    for (let n = 1; n < 200; n++) {
      term *= x / (s + n);
      sum += term;
      if (Math.abs(term) < Math.abs(sum) * 1e-14) break;
    }
    const p = Math.exp(s * Math.log(x) - x - logGamma(s)) * sum;
    return Math.max(0, Math.min(1, 1 - p));
  } else {
    // Continued fraction for Q(s, x)
    let b = x + 1 - s;
    let c = 1e30;
    let d = 1 / b;
    let h = d;
    for (let i = 1; i < 200; i++) {
      const an = -i * (i - s);
      b += 2;
      d = an * d + b;
      if (Math.abs(d) < 1e-30) d = 1e-30;
      c = b + an / c;
      if (Math.abs(c) < 1e-30) c = 1e-30;
      d = 1 / d;
      const del = d * c;
      h *= del;
      if (Math.abs(del - 1) < 1e-14) break;
    }
    const q = Math.exp(s * Math.log(x) - x - logGamma(s)) * h;
    return Math.max(0, Math.min(1, q));
  }
}

/**
 * P-value for Chi-Square distribution with df degrees of freedom
 * P(X >= chi2)
 */
export function chiSquarePValue(chi2: number, df: number): number {
  if (chi2 <= 0 || df <= 0) return 1.0;
  return gammaincUpper(df / 2, chi2 / 2);
}

/**
 * P-value for Snedecor's F-distribution with df1, df2 degrees of freedom
 */
export function fDistPValue(f: number, df1: number, df2: number): number {
  if (f <= 0 || df1 <= 0 || df2 <= 0) return 1.0;
  const x = (df1 * f) / (df1 * f + df2);
  const p = 1 - betainc(x, df1 / 2, df2 / 2);
  return Math.max(0, Math.min(1, p));
}

/**
 * Convert an array of numbers into fractional ranks (handles ties correctly)
 * Example: [10, 20, 20, 30] -> [1, 2.5, 2.5, 4]
 */
export function rankData(arr: number[]): number[] {
  const indexed = arr.map((val, idx) => ({ val, idx }));
  indexed.sort((a, b) => a.val - b.val);

  const ranks = new Array<number>(arr.length);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    while (j < indexed.length - 1 && indexed[j].val === indexed[j + 1].val) {
      j++;
    }
    const averageRank = (i + 1 + j + 1) / 2;
    for (let k = i; k <= j; k++) {
      ranks[indexed[k].idx] = averageRank;
    }
    i = j + 1;
  }
  return ranks;
}

/**
 * Mulberry32 seeded pseudo-random number generator
 * Ensures exact reproducibility across runs.
 */
export function createMulberry32(seed: number = 42) {
  let s = seed >>> 0;
  return function next(): number {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
