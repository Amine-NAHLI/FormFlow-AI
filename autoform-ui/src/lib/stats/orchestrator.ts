import {
  AnalysisPayload,
  ConstructDefinition,
  MissingValueStrategy,
  ReliabilityResult,
  ValidityResult,
  DiscriminantValidityPair,
  BootstrapEstimate,
  ChiSquareResult,
} from './types';
import { processSurveyData } from './ingestion';
import { computeDescriptiveStats, computeCategoricalStats } from './descriptive';
import {
  computeAllCorrelations,
  computeLinearRegressionOLS,
  computeChiSquareTest,
} from './relations';
import { computeConstructReliability } from './reliability';
import { computeConstructValidity, computeFornellLarckerMatrix } from './validity';
import { bootstrapCorrelation } from './bootstrap';

export interface OrchestrationOptions {
  missingStrategy?: MissingValueStrategy;
  constructs?: ConstructDefinition[];
  bootstrapIterations?: number;
  bootstrapSeed?: number;
  dependentVar?: string;
  independentVars?: string[];
}

/**
 * Auto-detects construct groups from column names (e.g. SAT_1, SAT_2 -> SAT)
 */
function autoDetectConstructs(numericKeys: string[]): ConstructDefinition[] {
  const groups: Record<string, string[]> = {};

  for (const key of numericKeys) {
    // Try patterns like VAR_1, VAR_2 or VAR.1 or VAR1
    const match = key.match(/^([a-zA-Z\u00C0-\u017F_-]+?)[_.\s]?(\d+)$/);
    if (match) {
      const prefix = match[1].replace(/[_-]+$/, '');
      if (!groups[prefix]) groups[prefix] = [];
      groups[prefix].push(key);
    }
  }

  const result: ConstructDefinition[] = [];
  for (const [prefix, items] of Object.entries(groups)) {
    if (items.length >= 2) {
      result.push({
        name: `Construit: ${prefix}`,
        description: `Regroupement automatique d'items (${items.join(', ')})`,
        items: items.map(col => ({ columnName: col })),
      });
    }
  }

  // If no prefix-based groups found, create a global scale group if >= 2 numeric items exist
  if (result.length === 0 && numericKeys.length >= 2) {
    result.push({
      name: 'Échelle Globale',
      description: 'Ensemble des indicateurs numériques',
      items: numericKeys.slice(0, 15).map(col => ({ columnName: col })),
    });
  }

  return result;
}

/**
 * Master statistical analysis orchestrator.
 * 100% deterministic pure mathematics.
 */
export function runCompleteStatisticalAnalysis(
  rows: Record<string, string>[],
  headers: string[],
  options: OrchestrationOptions = {}
): AnalysisPayload {
  const missingStrategy = options.missingStrategy || 'listwise';
  const bootstrapIters = options.bootstrapIterations ?? 5000;
  const bootstrapSeed = options.bootstrapSeed ?? 42;

  // Flatten reverse items from constructs if present
  const reverseItems = (options.constructs || [])
    .flatMap(c => c.items)
    .filter(i => i.isReversed);

  // 1. Ingestion and Cleaning
  const cleaned = processSurveyData(rows, headers, {
    missingStrategy,
    reverseItems,
  });

  const numericKeys = Object.keys(cleaned.numericColumns);
  const categoricalKeys = Object.keys(cleaned.categoricalColumns);

  // 2. Descriptive Stats
  const descriptives = numericKeys.map(k => {
    const colInfo = cleaned.columnTypes.find(c => c.name === k);
    return computeDescriptiveStats(k, cleaned.numericColumns[k], colInfo?.missingCount ?? 0);
  });

  const categoricals = categoricalKeys.slice(0, 10).map(k => {
    return computeCategoricalStats(k, cleaned.categoricalColumns[k]);
  });

  // 3. Correlations
  const correlations = computeAllCorrelations(cleaned.numericColumns);

  // 4. Chi-Square tests (categorical pairs)
  const chiSquareTests: ChiSquareResult[] = [];
  if (categoricalKeys.length >= 2) {
    for (let i = 0; i < Math.min(3, categoricalKeys.length); i++) {
      for (let j = i + 1; j < Math.min(4, categoricalKeys.length); j++) {
        const test = computeChiSquareTest(
          categoricalKeys[i],
          cleaned.categoricalColumns[categoricalKeys[i]],
          categoricalKeys[j],
          cleaned.categoricalColumns[categoricalKeys[j]]
        );
        if (test) chiSquareTests.push(test);
      }
    }
  }

  // 5. Linear Regression (OLS)
  let regression = null;
  if (options.dependentVar && options.independentVars && options.independentVars.length > 0) {
    if (cleaned.numericColumns[options.dependentVar]) {
      regression = computeLinearRegressionOLS(
        options.dependentVar,
        cleaned.numericColumns[options.dependentVar],
        options.independentVars.filter(v => cleaned.numericColumns[v]),
        cleaned.numericColumns
      );
    }
  } else if (correlations.length > 0) {
    // Automatically select the strongest correlation pair
    const best = correlations[0];
    regression = computeLinearRegressionOLS(
      best.var2,
      cleaned.numericColumns[best.var2],
      [best.var1],
      cleaned.numericColumns
    );
  }

  // 6. Constructs, Reliability, and Validity
  const constructsToAnalyze = (options.constructs && options.constructs.length > 0)
    ? options.constructs
    : autoDetectConstructs(numericKeys);

  const reliabilityList: ReliabilityResult[] = [];
  const validityList: ValidityResult[] = [];
  const constructScores: Record<string, number[]> = {};

  for (const construct of constructsToAnalyze) {
    const validItems = construct.items
      .map(i => i.columnName)
      .filter(name => cleaned.numericColumns[name] !== undefined);

    if (validItems.length >= 2) {
      const rel = computeConstructReliability(construct.name, validItems, cleaned.numericColumns);
      const val = computeConstructValidity(rel);
      reliabilityList.push(rel);
      validityList.push(val);

      // Compute average score for this construct per observation
      const totalObs = cleaned.totalRowCount;
      const scores = new Array(totalObs).fill(NaN);
      for (let i = 0; i < totalObs; i++) {
        let sum = 0;
        let isComplete = true;
        for (const item of validItems) {
          const val = cleaned.numericColumns[item]?.[i];
          if (val === undefined || isNaN(val) || !isFinite(val)) {
            isComplete = false;
            break;
          }
          sum += val;
        }
        if (isComplete && validItems.length > 0) {
          scores[i] = sum / validItems.length;
        }
      }
      constructScores[construct.name] = scores;
    }
  }

  // Fornell-Larcker Discriminant Validity across constructs
  const discriminantValidity: DiscriminantValidityPair[] = computeFornellLarckerMatrix(
    validityList,
    constructScores
  );

  // 7. Bootstrapping
  const bootstrapping: BootstrapEstimate[] = [];
  if (correlations.length > 0) {
    // Bootstrap strongest correlation
    const topPair = correlations[0];
    const bEst = bootstrapCorrelation(
      `Corrélation r(${topPair.var1}, ${topPair.var2})`,
      cleaned.numericColumns[topPair.var1],
      cleaned.numericColumns[topPair.var2],
      bootstrapIters,
      bootstrapSeed
    );
    if (bEst) bootstrapping.push(bEst);

    // Bootstrap second strongest correlation if exists
    if (correlations.length > 1) {
      const secondPair = correlations[1];
      const bEst2 = bootstrapCorrelation(
        `Corrélation r(${secondPair.var1}, ${secondPair.var2})`,
        cleaned.numericColumns[secondPair.var1],
        cleaned.numericColumns[secondPair.var2],
        bootstrapIters,
        bootstrapSeed
      );
      if (bEst2) bootstrapping.push(bEst2);
    }
  }

  return {
    meta: {
      totalRows: cleaned.totalRowCount,
      totalColumns: headers.length,
      sampleSizeAnalyzed: cleaned.validRowCount,
      columnTypes: cleaned.columnTypes,
      missingHandlingStrategy: missingStrategy,
      warnings: cleaned.warnings,
    },
    descriptives,
    categoricals,
    correlations,
    chiSquareTests: chiSquareTests.length > 0 ? chiSquareTests : undefined,
    regression,
    reliability: reliabilityList,
    validity: validityList,
    discriminantValidity,
    bootstrapping,
    constructScores,
  };
}
