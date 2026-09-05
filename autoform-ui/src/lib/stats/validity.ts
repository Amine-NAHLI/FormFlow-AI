import { sampleCorrelation } from 'simple-statistics';
import { ValidityResult, DiscriminantValidityPair, ReliabilityResult } from './types';

/**
 * Computes convergent validity (AVE and CR) for a construct
 */
export function computeConstructValidity(
  reliabilityResult: ReliabilityResult
): ValidityResult {
  const k = reliabilityResult.itemCount;
  if (k < 1) {
    return {
      constructName: reliabilityResult.constructName,
      ave: 0,
      compositeReliability: 0,
      convergentValidityEstablished: false,
      sqrtAVE: 0,
    };
  }

  let sumSquaredLoadings = 0;
  for (const item of reliabilityResult.itemStats) {
    const loading = item.factorLoading;
    sumSquaredLoadings += loading * loading;
  }

  const ave = Math.round((sumSquaredLoadings / k) * 1000) / 1000;
  const sqrtAVE = Math.round(Math.sqrt(ave) * 1000) / 1000;

  return {
    constructName: reliabilityResult.constructName,
    ave,
    compositeReliability: reliabilityResult.compositeReliability,
    convergentValidityEstablished: ave >= 0.50,
    sqrtAVE,
  };
}

/**
 * Evaluates discriminant validity using the Fornell & Larcker (1981) criterion
 * between multiple constructs.
 */
export function computeFornellLarckerMatrix(
  validityResults: ValidityResult[],
  constructScores: Record<string, number[]>
): DiscriminantValidityPair[] {
  const pairs: DiscriminantValidityPair[] = [];
  const constructs = validityResults.map(v => v.constructName);

  for (let i = 0; i < constructs.length; i++) {
    for (let j = i + 1; j < constructs.length; j++) {
      const c1 = constructs[i];
      const c2 = constructs[j];

      const v1 = validityResults.find(v => v.constructName === c1);
      const v2 = validityResults.find(v => v.constructName === c2);

      const scores1 = constructScores[c1];
      const scores2 = constructScores[c2];

      if (!v1 || !v2 || !scores1 || !scores2 || scores1.length === 0 || scores2.length === 0) {
        continue;
      }

      const paired1: number[] = [];
      const paired2: number[] = [];
      const minLen = Math.min(scores1.length, scores2.length);
      for (let k = 0; k < minLen; k++) {
        if (!isNaN(scores1[k]) && isFinite(scores1[k]) && !isNaN(scores2[k]) && isFinite(scores2[k])) {
          paired1.push(scores1[k]);
          paired2.push(scores2[k]);
        }
      }

      let r = 0;
      if (paired1.length >= 3) {
        try {
          r = sampleCorrelation(paired1, paired2);
          if (isNaN(r)) r = 0;
        } catch {
          r = 0;
        }
      }
      r = Math.round(r * 1000) / 1000;

      const validFornell = v1.sqrtAVE > Math.abs(r) && v2.sqrtAVE > Math.abs(r);

      pairs.push({
        construct1: c1,
        construct2: c2,
        correlation: r,
        sqrtAVE1: v1.sqrtAVE,
        sqrtAVE2: v2.sqrtAVE,
        validFornellLarcker: validFornell,
      });
    }
  }

  return pairs;
}
