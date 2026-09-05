import { describe, it } from 'node:test';
import assert from 'node:assert';
import { rankData } from '../src/lib/stats/math-utils';
import { computeDescriptiveStats } from '../src/lib/stats/descriptive';
import {
  computeCorrelationPair,
  computeAllCorrelations,
  computeLinearRegressionOLS,
  computeChiSquareTest,
  correlationConfidenceInterval95,
} from '../src/lib/stats/relations';
import { computeConstructReliability } from '../src/lib/stats/reliability';
import { computeFornellLarckerMatrix } from '../src/lib/stats/validity';
import { bootstrapCorrelation } from '../src/lib/stats/bootstrap';
import { processSurveyData } from '../src/lib/stats/ingestion';
import { runCompleteStatisticalAnalysis } from '../src/lib/stats/orchestrator';

describe('EXHAUSTIVE STATISTICAL VALIDATION & AUDIT TEST SUITE', () => {

  // =========================================================================
  // 1. DESCRIPTIVE STATISTICS BENCHMARK
  // =========================================================================
  describe('1. Descriptive Statistics on Known Datasets', () => {
    it('dataset [1, 2, 3, 4, 5]: exact theoretical values', () => {
      const data = [1, 2, 3, 4, 5];
      const stats = computeDescriptiveStats('simple', data);

      // Mean: (1+2+3+4+5)/5 = 3
      assert.strictEqual(stats.mean, 3);
      // Median: 3
      assert.strictEqual(stats.median, 3);
      // Min & Max
      assert.strictEqual(stats.min, 1);
      assert.strictEqual(stats.max, 5);
      // Quartiles & IQR: Q1=2, Q3=4, IQR=2
      assert.strictEqual(stats.q1, 2);
      assert.strictEqual(stats.q3, 4);
      assert.strictEqual(stats.iqr, 2);
      // Sample Variance: sum((x-3)^2)/4 = (4+1+0+1+4)/4 = 10/4 = 2.5
      assert.strictEqual(stats.variance, 2.5);
      // Sample Stddev: sqrt(2.5) = 1.5811388...
      assert.strictEqual(stats.stddev, 1.581);
      // Skewness: symmetric distribution -> 0
      assert.strictEqual(stats.skewness, 0);
      // Sample Excess Kurtosis:
      // sum((x-3)/s)^4: (-2/s)^4 + (-1/s)^4 + 0 + (1/s)^4 + (2/s)^4 = 2*(16 + 1)/6.25 = 34/6.25 = 5.44
      // term1 = 5*6 / (4*3*2) = 30/24 = 1.25. term1 * sum4 = 1.25 * 5.44 = 6.8
      // term2 = 3 * 4^2 / (3*2) = 48/6 = 8.
      // Kurt = 6.8 - 8 = -1.2
      assert.strictEqual(stats.kurtosis, -1.2);
      assert.strictEqual(stats.isNormalCandidate, true);
    });

    it('dataset with negative and decimal numbers [-2.5, -0.5, 0.0, 1.5, 3.5]', () => {
      const data = [-2.5, -0.5, 0.0, 1.5, 3.5];
      const stats = computeDescriptiveStats('neg_dec', data);

      // Sum: -2.5 - 0.5 + 0 + 1.5 + 3.5 = 2.0 -> Mean = 2.0 / 5 = 0.4
      assert.strictEqual(stats.mean, 0.4);
      assert.strictEqual(stats.median, 0.0);
      assert.strictEqual(stats.min, -2.5);
      assert.strictEqual(stats.max, 3.5);
      assert(stats.variance > 5.0 && stats.variance < 5.5);
    });

    it('dataset with repeated values and clear mode [1, 2, 2, 2, 3, 4]', () => {
      const data = [1, 2, 2, 2, 3, 4];
      const stats = computeDescriptiveStats('repeated', data);

      assert.strictEqual(stats.mode, 2);
      assert.strictEqual(stats.n, 6);
      // Mean: (1+6+3+4)/6 = 14/6 = 2.333
      assert.strictEqual(stats.mean, 2.333);
    });
  });

  // =========================================================================
  // 2. PEARSON CORRELATION & INFERENCE BENCHMARK
  // =========================================================================
  describe('2. Pearson Correlation and Exact Student t Inference', () => {
    it('perfect positive correlation X=[1,2,3,4,5], Y=[1,2,3,4,5] -> r=1', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [1, 2, 3, 4, 5];
      const corr = computeCorrelationPair('X', x, 'Y', y);

      assert(corr !== null);
      assert.strictEqual(corr.coefficient, 1);
      assert.strictEqual(corr.pValue, 0);
      assert.strictEqual(corr.df, 3);
    });

    it('perfect negative correlation X=[1,2,3,4,5], Y=[5,4,3,2,1] -> r=-1', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [5, 4, 3, 2, 1];
      const corr = computeCorrelationPair('X', x, 'Y', y);

      assert(corr !== null);
      assert.strictEqual(corr.coefficient, -1);
      assert.strictEqual(corr.pValue, 0);
    });

    it('known intermediate correlation test against statistical theory', () => {
      // X = [1, 2, 3, 4, 5, 6]
      // Y = [2, 1, 4, 3, 6, 5]
      // mean(X) = 3.5, mean(Y) = 3.5
      // Cov(X, Y) = sum((X - 3.5)*(Y - 3.5)) = (-2.5)*(-1.5) + (-1.5)*(-2.5) + (-0.5)*(0.5) + (0.5)*(-0.5) + (1.5)*(2.5) + (2.5)*(1.5)
      // = 3.75 + 3.75 - 0.25 - 0.25 + 3.75 + 3.75 = 14.5
      // Var(X) = Var(Y) = sum((X - 3.5)^2) = 6.25 + 2.25 + 0.25 + 0.25 + 2.25 + 6.25 = 17.5
      // r = 14.5 / 17.5 = 29/35 = 0.828571...
      const x = [1, 2, 3, 4, 5, 6];
      const y = [2, 1, 4, 3, 6, 5];
      const corr = computeCorrelationPair('X', x, 'Y', y);

      assert(corr !== null);
      assert.strictEqual(corr.coefficient, 0.829);
      // t = r * sqrt(df / (1 - r^2)) = 0.828571 * sqrt(4 / (1 - 0.68653)) = 0.828571 * sqrt(4 / 0.31347)
      // t = 0.828571 * sqrt(12.7604) = 0.828571 * 3.57217 = 2.9598
      assert(corr.tStat >= 2.95 && corr.tStat <= 2.97, `Expected t ~2.96, got ${corr.tStat}`);
      // p-value for t=2.96, df=4 (two-tailed): ~ 0.0415
      assert(corr.pValue > 0.035 && corr.pValue < 0.045, `Expected p ~0.0415, got ${corr.pValue}`);
      assert.strictEqual(corr.significanceLabel, 'p < 0.05 *');
    });

    it('Fisher z 95% Confidence Interval for r', () => {
      // For r = 0.80, n = 30
      // z = 0.5 * ln(1.8/0.2) = 0.5 * ln(9) = 1.0986
      // se = 1 / sqrt(27) = 0.19245
      // CI_z = [1.0986 - 1.96*0.19245, 1.0986 + 1.96*0.19245] = [0.7214, 1.4758]
      // CI_r = [tanh(0.7214), tanh(1.4758)] = [0.6178, 0.9007]
      const [lower, upper] = correlationConfidenceInterval95(0.80, 30);
      assert(Math.abs(lower - 0.618) <= 0.005, `Expected lower ~0.618, got ${lower}`);
      assert(Math.abs(upper - 0.901) <= 0.005, `Expected upper ~0.901, got ${upper}`);
    });
  });

  // =========================================================================
  // 3. SPEARMAN CORRELATION & TIES (EX AEQUO) BENCHMARK
  // =========================================================================
  describe('3. Spearman Rank Correlation & Ties Handling', () => {
    it('perfect monotone non-linear relationship (exponential)', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [1, 10, 100, 1000, 10000]; // monotonic, but non-linear
      const corr = computeCorrelationPair('X', x, 'Y', y);

      assert(corr !== null);
      // Pearson should be < 1 because non-linear
      assert(corr.coefficient < 0.95);
      // Spearman should be exactly 1
      assert.strictEqual(corr.spearmanRho, 1);
    });

    it('perfect monotone inverse relationship', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [10000, 1000, 100, 10, 1];
      const corr = computeCorrelationPair('X', x, 'Y', y);

      assert(corr !== null);
      assert.strictEqual(corr.spearmanRho, -1);
    });

    it('fractional ranks assignment for ties', () => {
      // Values: [5, 1, 5, 5, 2]
      // Sorted: [1, 2, 5, 5, 5]
      // Original ranks if no ties: 1, 2, 3, 4, 5
      // Ties at 5: indices 2, 3, 4 -> average rank = (3+4+5)/3 = 4.0
      // Expected ranks: 1->1, 2->2, 5->4.0, 5->4.0, 5->4.0
      // Mapping back to original array [5, 1, 5, 5, 2] -> [4, 1, 4, 4, 2]
      const ranks = rankData([5, 1, 5, 5, 2]);
      assert.deepStrictEqual(ranks, [4, 1, 4, 4, 2]);
    });
  });

  // =========================================================================
  // 4. CRONBACH ALPHA & PSYCHOMETRIC RELIABILITY BENCHMARK
  // =========================================================================
  describe('4. Cronbach Alpha & Scale Reliability', () => {
    it('calculates exact Cronbach Alpha for 3 identical items (alpha = 1.0)', () => {
      const data = {
        q1: [1, 2, 3, 4, 5],
        q2: [1, 2, 3, 4, 5],
        q3: [1, 2, 3, 4, 5],
      };
      // Var(q1)=Var(q2)=Var(q3)=2.5 -> sumVar = 7.5
      // Total = [3, 6, 9, 12, 15] -> Var(Total) = 3^2 * 2.5 = 22.5
      // alpha = (3/2) * (1 - 7.5/22.5) = 1.5 * (1 - 1/3) = 1.5 * (2/3) = 1.0
      const rel = computeConstructReliability('Ideal', ['q1', 'q2', 'q3'], data);
      assert.strictEqual(rel.cronbachAlpha, 1.0);
      assert.strictEqual(rel.compositeReliability, 1.0);
    });

    it('identifies unaligned/problematic item via alpha-if-deleted and item-rest correlation', () => {
      const data = {
        q1: [5, 4, 5, 4, 5, 5],
        q2: [5, 5, 4, 4, 5, 4],
        q_bad: [1, 5, 2, 4, 1, 3], // noisy/unrelated question
      };
      const rel = computeConstructReliability('TestScale', ['q1', 'q2', 'q_bad'], data);
      const badItemStat = rel.itemStats.find(i => i.itemName === 'q_bad');

      assert(badItemStat !== undefined);
      // Item rest correlation should be low for bad item
      assert(badItemStat.itemRestCorrelation < 0.35);
      // Alpha if item deleted should be higher than global alpha!
      assert(badItemStat.alphaIfDeleted > rel.cronbachAlpha,
        `Expected alphaIfDeleted (${badItemStat.alphaIfDeleted}) > globalAlpha (${rel.cronbachAlpha})`);
    });

    it('gracefully handles item with zero variance (constant item)', () => {
      const data = {
        q1: [4, 4, 4, 4, 4], // constant
        q2: [1, 2, 3, 4, 5],
      };
      const rel = computeConstructReliability('ZeroVar', ['q1', 'q2'], data);
      // Should not crash with division by zero or NaN
      assert(!isNaN(rel.cronbachAlpha));
    });
  });

  // =========================================================================
  // 5. CONSTRUCT SEPARATION & REVERSED ITEMS AUDIT
  // =========================================================================
  describe('5. Construct Independence and Reverse-Coded Items', () => {
    it('analyzes multiple constructs separately rather than merging into a single global score', () => {
      const headers = ['id', 'SAT_1', 'SAT_2', 'LOY_1', 'LOY_2'];
      const rows = [
        { id: '1', SAT_1: '5', SAT_2: '4', LOY_1: '2', LOY_2: '1' },
        { id: '2', SAT_1: '4', SAT_2: '5', LOY_1: '1', LOY_2: '2' },
        { id: '3', SAT_1: '5', SAT_2: '5', LOY_1: '2', LOY_2: '2' },
        { id: '4', SAT_1: '2', SAT_2: '3', LOY_1: '4', LOY_2: '5' },
        { id: '5', SAT_1: '1', SAT_2: '2', LOY_1: '5', LOY_2: '4' },
      ];

      const result = runCompleteStatisticalAnalysis(rows, headers);

      // Must have separate reliability entries for SAT and LOY
      assert(result.reliability.length >= 2, `Expected at least 2 constructs, got ${result.reliability.length}`);
      const sat = result.reliability.find(r => r.constructName.includes('SAT'));
      const loy = result.reliability.find(r => r.constructName.includes('LOY'));
      assert(sat !== undefined, 'SAT construct missing');
      assert(loy !== undefined, 'LOY construct missing');
    });

    it('reverses negative items properly in ingestion', () => {
      const rows = [
        { q_pos: '5', q_neg: '1' }, // strongly agree with positive, strongly disagree with negative
        { q_pos: '4', q_neg: '2' },
        { q_pos: '1', q_neg: '5' },
      ];
      const cleaned = processSurveyData(rows, ['q_pos', 'q_neg'], {
        reverseItems: [{ columnName: 'q_neg', isReversed: true, scaleMin: 1, scaleMax: 5 }],
      });

      // q_neg inverted: 1 -> 5, 2 -> 4, 5 -> 1
      assert.deepStrictEqual(cleaned.numericColumns['q_neg'], [5, 4, 1]);
      // Now q_pos and q_neg are perfectly positively aligned!
      assert.deepStrictEqual(cleaned.numericColumns['q_pos'], [5, 4, 1]);
    });
  });

  // =========================================================================
  // 6. AVE & FORNELL-LARCKER DISCRIMINANT VALIDITY AUDIT
  // =========================================================================
  describe('6. AVE & Fornell-Larcker Discriminant Validity Audit', () => {
    it('evaluates Fornell-Larcker matrix across 3 distinct constructs', () => {
      // 3 constructs: A, B, C
      const scores = {
        Construit_A: [5, 4, 5, 4, 5],
        Construit_B: [2, 1, 2, 1, 2],
        Construit_C: [3, 3, 4, 4, 3],
      };

      const validityResults = [
        { constructName: 'Construit_A', ave: 0.70, compositeReliability: 0.85, convergentValidityEstablished: true, sqrtAVE: 0.837 },
        { constructName: 'Construit_B', ave: 0.65, compositeReliability: 0.80, convergentValidityEstablished: true, sqrtAVE: 0.806 },
        { constructName: 'Construit_C', ave: 0.60, compositeReliability: 0.78, convergentValidityEstablished: true, sqrtAVE: 0.775 },
      ];

      const flMatrix = computeFornellLarckerMatrix(validityResults, scores);

      // Number of pairs for 3 constructs: 3*2/2 = 3 pairs (A-B, A-C, B-C)
      assert.strictEqual(flMatrix.length, 3);
      for (const pair of flMatrix) {
        // Since sqrt(AVE) > 0.77 for all, and constructs are distinct, rule should evaluate without error
        assert(typeof pair.validFornellLarcker === 'boolean');
        assert(typeof pair.correlation === 'number');
      }
    });
  });

  // =========================================================================
  // 7. OLS LINEAR REGRESSION BENCHMARK
  // =========================================================================
  describe('7. OLS Linear Regression Mathematical Benchmark', () => {
    it('simple linear regression with deterministic relationship Y = 2X + 5', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [7, 9, 11, 13, 15]; // 2*1+5=7, 2*2+5=9, etc.

      const model = computeLinearRegressionOLS('Y', y, ['X'], { X: x });
      assert(model !== null);
      assert.strictEqual(model.intercept, 5);
      assert.strictEqual(model.coefficients[0].b, 2);
      assert.strictEqual(model.rSquared, 1);
      assert.strictEqual(model.adjRSquared, 1);
      assert.strictEqual(model.coefficients[0].beta, 1);
    });

    it('multiple linear regression with known equation Y = 3 + 2*X1 - 4*X2', () => {
      const x1 = [1, 2, 3, 4, 5, 6, 7, 8];
      const x2 = [2, 1, 4, 3, 5, 2, 1, 3];
      const y = x1.map((v1, i) => 3 + 2 * v1 - 4 * x2[i]);

      const model = computeLinearRegressionOLS('Y', y, ['X1', 'X2'], { X1: x1, X2: x2 });
      assert(model !== null);
      assert.strictEqual(model.intercept, 3);
      const b1 = model.coefficients.find(c => c.variable === 'X1')?.b;
      const b2 = model.coefficients.find(c => c.variable === 'X2')?.b;
      assert.strictEqual(b1, 2);
      assert.strictEqual(b2, -4);
      assert.strictEqual(model.rSquared, 1);
      assert.strictEqual(model.adjRSquared, 1);
    });
  });

  // =========================================================================
  // 8. CHI-SQUARE TEST BENCHMARK
  // =========================================================================
  describe('8. Chi-Square Test of Independence & Cramers V', () => {
    it('classic 2x2 contingency table test', () => {
      // Table:
      //         CatB_1  CatB_2
      // CatA_1    10      20    (Row 1 total = 30)
      // CatA_2    20      10    (Row 2 total = 30)
      // Col totals: 30, 30. Grand total = 60.
      // Expected: 15 everywhere.
      // chi2 = 4 * ( (10-15)^2 / 15 ) = 4 * (25 / 15) = 100 / 15 = 6.6667
      // df = (2-1)*(2-1) = 1
      // Cramers V = sqrt(6.6667 / 60) = sqrt(0.1111) = 0.3333
      const aVals: string[] = [];
      const bVals: string[] = [];
      for (let i = 0; i < 10; i++) { aVals.push('A1'); bVals.push('B1'); }
      for (let i = 0; i < 20; i++) { aVals.push('A1'); bVals.push('B2'); }
      for (let i = 0; i < 20; i++) { aVals.push('A2'); bVals.push('B1'); }
      for (let i = 0; i < 10; i++) { aVals.push('A2'); bVals.push('B2'); }

      const result = computeChiSquareTest('VarA', aVals, 'VarB', bVals);
      assert(result !== null);
      assert.strictEqual(result.df, 1);
      assert(Math.abs(result.chi2 - 6.667) <= 0.01, `Expected chi2 ~6.667, got ${result.chi2}`);
      assert(Math.abs(result.cramersV - 0.333) <= 0.01, `Expected Cramers V ~0.333, got ${result.cramersV}`);
      assert(result.pValue > 0.008 && result.pValue < 0.012, `Expected p ~0.0098, got ${result.pValue}`);
      assert.strictEqual(result.hasLowExpectedFrequencies, false);
      assert.strictEqual(result.warning, undefined);
    });

    it('flags Cochran warning when expected cell frequencies are below 5', () => {
      // Table with small frequencies:
      //         B1   B2
      // A1       1    2   (Row total = 3)
      // A2       2    5   (Row total = 7)
      // Total = 10. Expected E11 = 3 * 3 / 10 = 0.9 < 5
      const aVals = ['A1', 'A1', 'A1', 'A2', 'A2', 'A2', 'A2', 'A2', 'A2', 'A2'];
      const bVals = ['B1', 'B2', 'B2', 'B1', 'B1', 'B2', 'B2', 'B2', 'B2', 'B2'];
      const result = computeChiSquareTest('VarA', aVals, 'VarB', bVals);

      assert(result !== null);
      assert.strictEqual(result.hasLowExpectedFrequencies, true);
      assert(result.warning !== undefined && result.warning.includes('Cochran'));
    });
  });

  // =========================================================================
  // 9. REPRODUCIBLE BOOTSTRAPPING AUDIT
  // =========================================================================
  describe('9. Bootstrapping Sampling & Seed Audit', () => {
    it('strictly bit-for-bit reproducible with identical seed', () => {
      const x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const y = [2, 1, 4, 5, 6, 8, 7, 9, 10, 12];

      const run1 = bootstrapCorrelation('r', x, y, 1000, 777);
      const run2 = bootstrapCorrelation('r', x, y, 1000, 777);

      assert(run1 !== null && run2 !== null);
      assert.strictEqual(run1.ci95Lower, run2.ci95Lower);
      assert.strictEqual(run1.ci95Upper, run2.ci95Upper);
      assert.strictEqual(run1.bootstrapMean, run2.bootstrapMean);
      assert.strictEqual(run1.bootstrapStdErr, run2.bootstrapStdErr);
    });

    it('different seed yields different sample draws within expected confidence bounds', () => {
      const x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const y = [2, 1, 4, 5, 6, 8, 7, 9, 10, 12];

      const runA = bootstrapCorrelation('r', x, y, 1000, 100);
      const runB = bootstrapCorrelation('r', x, y, 1000, 999);

      assert(runA !== null && runB !== null);
      // Both runs must be within statistical proximity
      assert(Math.abs(runA.bootstrapMean - runB.bootstrapMean) < 0.05);
      assert(Math.abs(runA.ci95Lower - runB.ci95Lower) < 0.1);
    });
  });

  // =========================================================================
  // 10. MULTIPLE TESTING CORRECTION AUDIT
  // =========================================================================
  describe('10. Bonferroni Multiple Testing Adjustment', () => {
    it('applies Bonferroni adjustment p_adj = min(1.0, p * M)', () => {
      // 4 variables -> 4*3/2 = 6 pairwise tests
      const data = {
        v1: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        v2: [2, 1, 4, 3, 6, 5, 8, 7, 10, 9],
        v3: [1, 3, 2, 5, 4, 7, 6, 9, 8, 10],
        v4: [10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
      };
      const correlations = computeAllCorrelations(data);
      assert.strictEqual(correlations.length, 6);

      for (const pair of correlations) {
        const expectedAdj = Math.min(1.0, Math.round(pair.pValue * 6 * 100000) / 100000);
        assert.strictEqual(pair.pValueBonferroni, expectedAdj);
      }
    });
  });

  // =========================================================================
  // 11. MISSING DATA STRATEGIES AUDIT
  // =========================================================================
  describe('11. Missing Data Handling Strategies', () => {
    const rawRows = [
      { id: '1', score: '10', extra: 'A' },
      { id: '2', score: '',   extra: 'B' }, // missing score
      { id: '3', score: '20', extra: 'C' },
      { id: '4', score: '30', extra: 'D' },
    ];

    it('listwise strategy preserves rows and filters NaNs per analysis without global deletion', () => {
      const cleaned = processSurveyData(rawRows, ['score'], { missingStrategy: 'listwise' });
      // Row 2 is retained in the dataset with NaN for missing score
      assert.strictEqual(cleaned.validRowCount, 4);
      assert.strictEqual(isNaN(cleaned.numericColumns['score'][1]), true);

      // Descriptives filters out the NaN for score: n=3 valid, missing=1
      const stats = computeDescriptiveStats('score', cleaned.numericColumns['score']);
      assert.strictEqual(stats.n, 3);
      assert.strictEqual(stats.missing, 1);
      assert.strictEqual(stats.mean, 20);
    });

    it('analysis-specific listwise deletion does not penalize unaffected variables/analyses', () => {
      const rawRowsMulti = [
        { id: '1', scoreA: '10', scoreB: '100', scoreC: '5' },
        { id: '2', scoreA: '20', scoreB: '',    scoreC: '6' }, // row 2 missing scoreB, but has scoreA and scoreC!
        { id: '3', scoreA: '30', scoreB: '300', scoreC: '7' },
        { id: '4', scoreA: '40', scoreB: '400', scoreC: '8' },
      ];
      const cleaned = processSurveyData(rawRowsMulti, ['scoreA', 'scoreB', 'scoreC'], { missingStrategy: 'listwise' });

      // Correlation between scoreA and scoreC uses all 4 respondents (scoreB is ignored)
      const corrAC = computeCorrelationPair('scoreA', cleaned.numericColumns['scoreA'], 'scoreC', cleaned.numericColumns['scoreC']);
      assert(corrAC !== null);
      assert.strictEqual(corrAC.n, 4);

      // Correlation between scoreA and scoreB uses 3 respondents (pairwise complete)
      const corrAB = computeCorrelationPair('scoreA', cleaned.numericColumns['scoreA'], 'scoreB', cleaned.numericColumns['scoreB']);
      assert(corrAB !== null);
      assert.strictEqual(corrAB.n, 3);

      // Regression Y=scoreC ~ scoreA uses all 4 respondents
      const regCA = computeLinearRegressionOLS('scoreC', cleaned.numericColumns['scoreC'], ['scoreA'], cleaned.numericColumns);
      assert(regCA !== null);
      assert.strictEqual(regCA.n, 4);
    });

    it('mean imputation strategy replaces missing with average of valid entries', () => {
      // valid: [10, 20, 30] -> mean = 20
      const cleaned = processSurveyData(rawRows, ['score'], { missingStrategy: 'mean' });
      assert.strictEqual(cleaned.validRowCount, 4);
      assert.deepStrictEqual(cleaned.numericColumns['score'], [10, 20, 20, 30]);
    });

    it('median imputation strategy replaces missing with median of valid entries', () => {
      const cleaned = processSurveyData(rawRows, ['score'], { missingStrategy: 'median' });
      assert.strictEqual(cleaned.validRowCount, 4);
      assert.deepStrictEqual(cleaned.numericColumns['score'], [10, 20, 20, 30]);
    });
  });

  // =========================================================================
  // 12. EDGE CASES & NUMERICAL STABILITY AUDIT
  // =========================================================================
  describe('12. Edge Cases and Defensive Programming', () => {
    it('handles N = 0, 1, 2 without unhandled exception or crash', () => {
      const emptyStats = computeDescriptiveStats('empty', []);
      assert.strictEqual(emptyStats.n, 0);
      assert.strictEqual(emptyStats.mean, 0);

      const n1Stats = computeDescriptiveStats('single', [42]);
      assert.strictEqual(n1Stats.n, 1);
      assert.strictEqual(n1Stats.variance, 0);
      assert.strictEqual(n1Stats.stddev, 0);

      const n2Stats = computeDescriptiveStats('pair', [10, 20]);
      assert.strictEqual(n2Stats.n, 2);
      assert.strictEqual(n2Stats.variance, 50);
    });

    it('handles zero variance (constant columns) in regression and correlations gracefully', () => {
      const x = [5, 5, 5, 5, 5];
      const y = [1, 2, 3, 4, 5];
      const corr = computeCorrelationPair('X', x, 'Y', y);
      // Zero variance cannot define Pearson r -> returns null
      assert.strictEqual(corr, null);

      const reg = computeLinearRegressionOLS('Y', y, ['X'], { X: x });
      // Collinear / zero variance matrix -> singular matrix detection returns null
      assert.strictEqual(reg, null);
    });

    it('handles extreme scales without numerical overflow', () => {
      const largeX = [1e8, 2e8, 3e8, 4e8, 5e8];
      const largeY = [2e8, 4e8, 6e8, 8e8, 10e8];
      const corr = computeCorrelationPair('largeX', largeX, 'largeY', largeY);
      assert(corr !== null);
      assert.strictEqual(corr.coefficient, 1);
      assert(!isNaN(corr.tStat));
    });
  });

});
