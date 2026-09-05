import { ColumnTypeInfo, MissingValueStrategy, ConstructItem } from './types';
import { mean, median } from 'simple-statistics';

export interface CleanedDataset {
  headers: string[];
  columnTypes: ColumnTypeInfo[];
  numericColumns: Record<string, number[]>;
  categoricalColumns: Record<string, string[]>;
  validRowCount: number;
  totalRowCount: number;
  warnings: string[];
}

/**
 * Invert an item on a Likert scale:
 * inverted = (scaleMax + scaleMin) - value
 */
export function invertLikertItem(val: number, minScale: number = 1, maxScale: number = 5): number {
  return (maxScale + minScale) - val;
}

/**
 * Parses and cleans survey tabular data, detecting types,
 * missing values, and applying handling strategy.
 */
export function processSurveyData(
  rows: Record<string, string>[],
  headers: string[],
  options: {
    missingStrategy?: MissingValueStrategy;
    reverseItems?: ConstructItem[];
  } = {}
): CleanedDataset {
  const strategy = options.missingStrategy || 'listwise';
  const reverseMap = new Map<string, ConstructItem>();
  if (options.reverseItems) {
    for (const item of options.reverseItems) {
      if (item.isReversed) {
        reverseMap.set(item.columnName, item);
      }
    }
  }

  const warnings: string[] = [];
  const totalRowCount = rows.length;

  // 1. Initial Column Type Detection
  const columnTypes: ColumnTypeInfo[] = [];
  const rawNumericCandidates = new Set<string>();
  const rawCategoricalCandidates = new Set<string>();

  for (const header of headers) {
    const rawValues = rows.map(r => (r[header] !== undefined && r[header] !== null ? String(r[header]).trim() : ''));
    const nonEmpty = rawValues.filter(v => v !== '');
    const parsedNums: number[] = [];
    let isAllInteger = true;

    for (const v of nonEmpty) {
      const parsed = parseFloat(v.replace(',', '.'));
      if (!isNaN(parsed) && isFinite(parsed)) {
        parsedNums.push(parsed);
        if (!Number.isInteger(parsed)) isAllInteger = false;
      }
    }

    const missingCount = totalRowCount - nonEmpty.length;
    const missingRatio = totalRowCount > 0 ? missingCount / totalRowCount : 0;
    const uniqueValues = new Set(nonEmpty);

    let inferredType: ColumnTypeInfo['inferredType'] = 'categorical';
    let minVal: number | undefined;
    let maxVal: number | undefined;

    if (uniqueValues.size <= 1 && nonEmpty.length > 0) {
      inferredType = 'constant';
      warnings.push(`La colonne "${header}" est constante (aucune variance).`);
    } else if (parsedNums.length >= nonEmpty.length * 0.8 && parsedNums.length >= 3) {
      minVal = Math.min(...parsedNums);
      maxVal = Math.max(...parsedNums);

      // Check if Likert scale (discrete integers within 1..10 with small range)
      if (isAllInteger && minVal >= 0 && maxVal <= 10 && uniqueValues.size <= 11) {
        inferredType = 'likert';
      } else {
        inferredType = 'numeric';
      }
      rawNumericCandidates.add(header);
    } else {
      // Check if identifier
      if (uniqueValues.size === nonEmpty.length && nonEmpty.length > 10) {
        inferredType = 'identifier';
      } else {
        inferredType = 'categorical';
      }
      rawCategoricalCandidates.add(header);
    }

    columnTypes.push({
      name: header,
      inferredType,
      totalCount: totalRowCount,
      validCount: nonEmpty.length,
      missingCount,
      missingRatio: Math.round(missingRatio * 1000) / 1000,
      min: minVal,
      max: maxVal,
      uniqueCount: uniqueValues.size,
    });
  }

  // 2. Filter / Impute Data across Rows
  const numericHeaders = Array.from(rawNumericCandidates);
  const categoricalHeaders = Array.from(rawCategoricalCandidates);

  // Pre-calculate column means/medians for imputation if needed
  const colMeans: Record<string, number> = {};
  const colMedians: Record<string, number> = {};
  if (strategy === 'mean' || strategy === 'median') {
    for (const col of numericHeaders) {
      const validNums = rows
        .map(r => parseFloat(String(r[col] || '').replace(',', '.')))
        .filter(n => !isNaN(n) && isFinite(n));
      if (validNums.length > 0) {
        colMeans[col] = mean(validNums);
        colMedians[col] = median(validNums);
      }
    }
  }

  const finalNumeric: Record<string, number[]> = {};
  const finalCategorical: Record<string, string[]> = {};

  for (const h of numericHeaders) finalNumeric[h] = [];
  for (const h of categoricalHeaders) finalCategorical[h] = [];

  let validRowCount = 0;

  for (let rowIndex = 0; rowIndex < totalRowCount; rowIndex++) {
    const row = rows[rowIndex];
    const rowHasContent = Object.values(row).some(v => v !== undefined && v !== null && String(v).trim() !== '');

    // Append numeric values (or NaN in listwise mode for analysis-specific deletion)
    for (const col of numericHeaders) {
      const raw = row[col];
      let val = parseFloat(String(raw ?? '').replace(',', '.'));

      if (isNaN(val) || !isFinite(val)) {
        if (strategy === 'mean') val = colMeans[col] ?? 0;
        else if (strategy === 'median') val = colMedians[col] ?? 0;
        else val = NaN; // In listwise mode, keep NaN so that individual analyses can filter per-analysis!
      }

      // Handle item reversal if configured and not NaN
      const reverseConfig = reverseMap.get(col);
      if (reverseConfig && reverseConfig.isReversed && !isNaN(val)) {
        const minS = reverseConfig.scaleMin ?? 1;
        const maxS = reverseConfig.scaleMax ?? 5;
        val = invertLikertItem(val, minS, maxS);
      }

      finalNumeric[col].push(val);
    }

    // Append categorical values
    for (const col of categoricalHeaders) {
      const val = row[col] !== undefined && row[col] !== null ? String(row[col]).trim() : '';
      finalCategorical[col].push(val);
    }

    if (rowHasContent) {
      validRowCount++;
    }
  }

  if (validRowCount < 10) {
    warnings.push(`Taille d'échantillon très faible (N = ${validRowCount}). Les inférences statistiques ont une puissance statistique limitée.`);
  }

  return {
    headers,
    columnTypes,
    numericColumns: finalNumeric,
    categoricalColumns: finalCategorical,
    validRowCount,
    totalRowCount,
    warnings,
  };
}
