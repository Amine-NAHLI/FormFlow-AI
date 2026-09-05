import { describe, it } from 'node:test';
import assert from 'node:assert';
import { studentTPValue, chiSquarePValue, rankData, createMulberry32 } from '../src/lib/stats/math-utils';
import { computeDescriptiveStats, sampleSkewness, sampleExcessKurtosis } from '../src/lib/stats/descriptive';
import { computeCorrelationPair, computeLinearRegressionOLS } from '../src/lib/stats/relations';
import { computeConstructReliability } from '../src/lib/stats/reliability';
import { computeConstructValidity, computeFornellLarckerMatrix } from '../src/lib/stats/validity';
import { bootstrapCorrelation } from '../src/lib/stats/bootstrap';
import { runCompleteStatisticalAnalysis } from '../src/lib/stats/orchestrator';
import { invertLikertItem } from '../src/lib/stats/ingestion';

describe('Statistical Engine Unit & Benchmark Tests', () => {

  describe('1. Math & Distribution Functions', () => {
    it('calculates Student t p-value matching R / SPSS reference', () => {
      // R: 2 * (1 - pt(2.0, 10)) = 0.07338725...
      const p = studentTPValue(2.0, 10);
      assert(Math.abs(p - 0.073387) < 0.001, `Expected ~0.073387, got ${p}`);

      // t = 0 should give p = 1.0
      const pZero = studentTPValue(0, 20);
      assert(Math.abs(pZero - 1.0) < 1e-6, `Expected 1.0 for t=0, got ${pZero}`);
    });

    it('calculates Chi-Square p-value matching reference', () => {
      // Chi2 = 5.991 with df = 2 corresponds to p = 0.05
      const p = chiSquarePValue(5.991, 2);
      assert(Math.abs(p - 0.05) < 0.005, `Expected ~0.05, got ${p}`);
    });

    it('ranks data with fractional tie handling accurately', () => {
      const ranks = rankData([10, 20, 20, 30]);
      assert.deepStrictEqual(ranks, [1, 2.5, 2.5, 4]);
    });

    it('PRNG Mulberry32 generates identical sequence with fixed seed', () => {
      const rng1 = createMulberry32(12345);
      const rng2 = createMulberry32(12345);
      const seq1 = [rng1(), rng1(), rng1()];
      const seq2 = [rng2(), rng2(), rng2()];
      assert.deepStrictEqual(seq1, seq2);
    });
  });

  describe('2. Ingestion & Item Inversion', () => {
    it('reverses Likert scale 1-5 correctly', () => {
      assert.strictEqual(invertLikertItem(1, 1, 5), 5);
      assert.strictEqual(invertLikertItem(2, 1, 5), 4);
      assert.strictEqual(invertLikertItem(3, 1, 5), 3);
      assert.strictEqual(invertLikertItem(4, 1, 5), 2);
      assert.strictEqual(invertLikertItem(5, 1, 5), 1);
    });
  });

  describe('3. Descriptive Statistics', () => {
    it('computes mean, median, stddev and moments for benchmark series', () => {
      const series = [2, 4, 4, 4, 5, 5, 7, 9];
      const stats = computeDescriptiveStats('test_col', series);
      assert.strictEqual(stats.mean, 5);
      assert.strictEqual(stats.median, 4.5);
      assert.strictEqual(stats.min, 2);
      assert.strictEqual(stats.max, 9);
      assert.strictEqual(stats.mode, 4);
      assert(stats.stddev > 2.1 && stats.stddev < 2.2, `Expected std ~2.14, got ${stats.stddev}`);
      assert.strictEqual(stats.isNormalCandidate, true);

      const directSkew = sampleSkewness(series, stats.mean, stats.stddev);
      const directKurt = sampleExcessKurtosis(series, stats.mean, stats.stddev);
      assert(Math.abs(directSkew - stats.skewness) < 0.01);
      assert(Math.abs(directKurt - stats.kurtosis) < 0.01);
    });
  });

  describe('4. Bivariate Relations & Regression', () => {
    it('computes exact Pearson and Spearman correlation for linear relationship', () => {
      const x = [1, 2, 3, 4, 5, 6, 7, 8];
      const y = [2, 4, 6, 8, 10, 12, 14, 16];
      const corr = computeCorrelationPair('X', x, 'Y', y);
      assert(corr !== null);
      assert.strictEqual(corr.coefficient, 1);
      assert.strictEqual(corr.spearmanRho, 1);
      assert(corr.pValue < 0.0001);
    });

    it('computes OLS linear regression parameters accurately', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [3, 5, 7, 9, 11]; // y = 2x + 1
      const model = computeLinearRegressionOLS('Y', y, ['X'], { X: x });
      assert(model !== null);
      assert.strictEqual(model.intercept, 1);
      assert.strictEqual(model.coefficients[0].b, 2);
      assert.strictEqual(model.rSquared, 1);
    });
  });

  describe('5. Reliability (Cronbach Alpha & CR)', () => {
    it('computes Cronbach Alpha and item stats for consistent items', () => {
      const matrix = {
        item1: [4, 5, 4, 5, 3, 5, 4, 5, 4, 5],
        item2: [4, 4, 5, 5, 3, 4, 4, 5, 4, 5],
        item3: [5, 5, 4, 5, 4, 5, 5, 5, 4, 5],
      };
      const result = computeConstructReliability('Satisfaction', ['item1', 'item2', 'item3'], matrix);
      assert(result.cronbachAlpha >= 0.70, `Expected alpha >= 0.70, got ${result.cronbachAlpha}`);
      assert(result.compositeReliability >= 0.70, `Expected CR >= 0.70, got ${result.compositeReliability}`);
      assert.strictEqual(result.itemStats.length, 3);
    });
  });

  describe('6. Validity (AVE & Fornell-Larcker)', () => {
    it('computes AVE and discriminant validity between distinct constructs', () => {
      const matrix = {
        sat1: [5, 4, 5, 4, 5, 5, 3, 5],
        sat2: [5, 4, 5, 3, 5, 4, 3, 5],
        loy1: [2, 1, 2, 3, 1, 2, 1, 2],
        loy2: [2, 1, 2, 2, 1, 2, 1, 1],
      };
      const relSat = computeConstructReliability('Satisfaction', ['sat1', 'sat2'], matrix);
      const relLoy = computeConstructReliability('Loyalty', ['loy1', 'loy2'], matrix);

      const valSat = computeConstructValidity(relSat);
      const valLoy = computeConstructValidity(relLoy);

      assert(valSat.ave > 0.5, `Expected sat AVE > 0.5, got ${valSat.ave}`);
      assert(valLoy.ave > 0.5, `Expected loy AVE > 0.5, got ${valLoy.ave}`);

      const scores = {
        Satisfaction: [5, 4, 5, 3.5, 5, 4.5, 3, 5],
        Loyalty: [2, 1, 2, 2.5, 1, 2, 1, 1.5],
      };

      const fl = computeFornellLarckerMatrix([valSat, valLoy], scores);
      assert.strictEqual(fl.length, 1);
      assert.strictEqual(fl[0].validFornellLarcker, true);
    });
  });

  describe('7. Reproducible Bootstrapping', () => {
    it('returns consistent CI bounds across independent runs with same seed', () => {
      const x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const y = [2, 3, 5, 4, 6, 8, 7, 9, 10, 11];

      const b1 = bootstrapCorrelation('r(X,Y)', x, y, 500, 42);
      const b2 = bootstrapCorrelation('r(X,Y)', x, y, 500, 42);

      assert(b1 !== null && b2 !== null);
      assert.strictEqual(b1.ci95Lower, b2.ci95Lower);
      assert.strictEqual(b1.ci95Upper, b2.ci95Upper);
      assert.strictEqual(b1.bootstrapMean, b2.bootstrapMean);
    });
  });

  describe('8. Master Orchestrator End-to-End', () => {
    it('executes full pipeline on raw survey rows without errors', () => {
      const headers = ['id', 'age', 'satisfaction_1', 'satisfaction_2', 'recommend', 'gender'];
      const rows = [
        { id: '1', age: '25', satisfaction_1: '4', satisfaction_2: '5', recommend: '5', gender: 'F' },
        { id: '2', age: '34', satisfaction_1: '3', satisfaction_2: '4', recommend: '4', gender: 'M' },
        { id: '3', age: '28', satisfaction_1: '5', satisfaction_2: '5', recommend: '5', gender: 'F' },
        { id: '4', age: '45', satisfaction_1: '2', satisfaction_2: '2', recommend: '2', gender: 'M' },
        { id: '5', age: '52', satisfaction_1: '4', satisfaction_2: '4', recommend: '4', gender: 'F' },
        { id: '6', age: '22', satisfaction_1: '5', satisfaction_2: '4', recommend: '5', gender: 'M' },
        { id: '7', age: '39', satisfaction_1: '3', satisfaction_2: '3', recommend: '3', gender: 'F' },
        { id: '8', age: '31', satisfaction_1: '4', satisfaction_2: '5', recommend: '4', gender: 'M' },
      ];

      const result = runCompleteStatisticalAnalysis(rows, headers, {
        bootstrapIterations: 200, // fast for unit test
      });

      assert.strictEqual(result.meta.totalRows, 8);
      assert.strictEqual(result.meta.sampleSizeAnalyzed, 8);
      assert(result.descriptives.length >= 4);
      assert(result.correlations.length > 0);
      assert(result.reliability.length > 0);
      assert(result.bootstrapping.length > 0);
    });
  });
});
