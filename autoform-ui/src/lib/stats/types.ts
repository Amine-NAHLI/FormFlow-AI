/**
 * Types and interfaces for FormFlow Statistical Analysis Engine
 */

export type MissingValueStrategy = 'listwise' | 'mean' | 'median';

export interface ColumnTypeInfo {
  name: string;
  inferredType: 'numeric' | 'likert' | 'categorical' | 'identifier' | 'constant';
  totalCount: number;
  validCount: number;
  missingCount: number;
  missingRatio: number;
  min?: number;
  max?: number;
  uniqueCount: number;
}

export interface ConstructItem {
  columnName: string;
  isReversed?: boolean;
  scaleMin?: number;
  scaleMax?: number;
}

export interface ConstructDefinition {
  name: string;
  description?: string;
  items: ConstructItem[];
}

export interface DescriptiveStats {
  name: string;
  n: number;
  missing: number;
  mean: number;
  median: number;
  stddev: number;
  variance: number;
  min: number;
  max: number;
  mode: number;
  q1: number;
  q3: number;
  iqr: number;
  skewness: number;
  kurtosis: number;
  isNormalCandidate: boolean; // |skewness| < 1 && |kurtosis| < 2
}

export interface FrequencyItem {
  value: string;
  count: number;
  percentage: number;
}

export interface CategoricalStats {
  name: string;
  totalResponses: number;
  uniqueValues: number;
  frequencies: FrequencyItem[];
}

export interface CorrelationPair {
  var1: string;
  var2: string;
  n: number;
  coefficient: number; // Pearson r
  spearmanRho: number;
  tStat: number;
  df: number;
  pValue: number;
  pValueBonferroni: number;
  significanceLabel: string;
  ci95Lower: number;
  ci95Upper: number;
}

export interface RegressionModel {
  dependentVar: string;
  independentVars: string[];
  n: number;
  r: number;
  rSquared: number;
  adjRSquared: number;
  fStat: number;
  fPValue: number;
  intercept: number;
  coefficients: {
    variable: string;
    b: number; // unstandardized coefficient
    stdError: number;
    tStat: number;
    pValue: number;
    beta: number; // standardized coefficient
  }[];
}

export interface ReliabilityResult {
  constructName: string;
  itemCount: number;
  n: number;
  cronbachAlpha: number;
  compositeReliability: number; // CR (Dillon-Goldstein rho)
  interpretation: string;
  itemStats: {
    itemName: string;
    mean: number;
    stddev: number;
    itemRestCorrelation: number; // corrected item-total correlation
    alphaIfDeleted: number;
    factorLoading: number;
  }[];
}

export interface ValidityResult {
  constructName: string;
  ave: number; // Average Variance Extracted
  compositeReliability: number;
  convergentValidityEstablished: boolean; // AVE >= 0.5
  sqrtAVE: number;
}

export interface DiscriminantValidityPair {
  construct1: string;
  construct2: string;
  correlation: number;
  sqrtAVE1: number;
  sqrtAVE2: number;
  validFornellLarcker: boolean; // sqrt(AVE) > |correlation| for both
}

export interface ChiSquareResult {
  var1: string;
  var2: string;
  chi2: number;
  df: number;
  pValue: number;
  cramersV: number;
  interpretation: string;
  hasLowExpectedFrequencies: boolean;
  warning?: string;
}

export interface BootstrapEstimate {
  parameter: string;
  originalValue: number;
  iterations: number;
  seed: number;
  bootstrapMean: number;
  bootstrapStdErr: number;
  ci95Lower: number;
  ci95Upper: number;
  pValueEstimated: number;
}

export interface AnalysisPayload {
  meta: {
    totalRows: number;
    totalColumns: number;
    sampleSizeAnalyzed: number;
    columnTypes: ColumnTypeInfo[];
    missingHandlingStrategy: MissingValueStrategy;
    warnings: string[];
  };
  descriptives: DescriptiveStats[];
  categoricals: CategoricalStats[];
  correlations: CorrelationPair[];
  chiSquareTests?: ChiSquareResult[];
  regression?: RegressionModel | null;
  reliability: ReliabilityResult[];
  validity: ValidityResult[];
  discriminantValidity: DiscriminantValidityPair[];
  bootstrapping: BootstrapEstimate[];
  constructScores?: Record<string, number[]>;
}
