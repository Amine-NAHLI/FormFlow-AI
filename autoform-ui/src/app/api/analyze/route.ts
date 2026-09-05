import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import Papa from 'papaparse';
import { runCompleteStatisticalAnalysis } from '@/lib/stats/orchestrator';
import { ConstructDefinition, MissingValueStrategy } from '@/lib/stats/types';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const apiKey = formData.get('apiKey') as string;
    const instructions = (formData.get('instructions') as string) || '';
    const missingStrategy = ((formData.get('missingStrategy') as string) || 'listwise') as MissingValueStrategy;
    const constructsRaw = formData.get('constructs') as string | null;

    if (!file || !apiKey) {
      return NextResponse.json({ error: 'Fichier CSV et clé API OpenAI requis.' }, { status: 400 });
    }

    // Optional user-defined constructs
    let constructs: ConstructDefinition[] | undefined = undefined;
    if (constructsRaw) {
      try {
        constructs = JSON.parse(constructsRaw);
      } catch {
        console.warn("Invalid constructs JSON, fallback to automatic detection.");
      }
    }

    // 1. Ingestion CSV
    const csvText = await file.text();
    const parsed = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: 'greedy',
      dynamicTyping: false, // Keep raw strings to preserve decimals with commas
    });

    const rows = parsed.data as Record<string, string>[];
    const headers = parsed.meta.fields || [];

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'Le fichier CSV est vide ou mal formaté.' }, { status: 400 });
    }

    // 2. Pure Deterministic Mathematical Computation
    const analysisPayload = runCompleteStatisticalAnalysis(rows, headers, {
      missingStrategy,
      constructs,
      bootstrapIterations: 5000,
      bootstrapSeed: 42,
    });

    // 3. AI Interpretation (Strictly descriptive, no math calculation)
    const openai = new OpenAI({ apiKey });

    // Compact summary of math for LLM context
    const mathSummaryForAI = {
      meta: analysisPayload.meta,
      topCorrelations: analysisPayload.correlations.slice(0, 8).map(c => ({
        relation: `${c.var1} <-> ${c.var2}`,
        pearson_r: c.coefficient,
        spearman_rho: c.spearmanRho,
        p_value: c.pValue,
        p_bonferroni: c.pValueBonferroni,
        significance: c.significanceLabel,
        ci95: [c.ci95Lower, c.ci95Upper],
      })),
      regression: analysisPayload.regression ? {
        dependent: analysisPayload.regression.dependentVar,
        independents: analysisPayload.regression.independentVars,
        rSquared: analysisPayload.regression.rSquared,
        adjRSquared: analysisPayload.regression.adjRSquared,
        fStat: analysisPayload.regression.fStat,
        fPValue: analysisPayload.regression.fPValue,
        coefficients: analysisPayload.regression.coefficients,
      } : null,
      reliabilityAndValidity: analysisPayload.reliability.map((rel, idx) => {
        const val = analysisPayload.validity[idx];
        return {
          construct: rel.constructName,
          itemsCount: rel.itemCount,
          cronbachAlpha: rel.cronbachAlpha,
          compositeReliability: rel.compositeReliability,
          interpretation: rel.interpretation,
          ave: val?.ave,
          convergentValidity: val?.convergentValidityEstablished,
          sqrtAVE: val?.sqrtAVE,
          problematicItems: rel.itemStats
            .filter(i => i.itemRestCorrelation < 0.3)
            .map(i => `${i.itemName} (r_rest=${i.itemRestCorrelation}, alpha_if_del=${i.alphaIfDeleted})`),
        };
      }),
      discriminantValidityFL: analysisPayload.discriminantValidity,
      bootstrapping: analysisPayload.bootstrapping.map(b => ({
        parameter: b.parameter,
        iterations: b.iterations,
        original: b.originalValue,
        ci95: [b.ci95Lower, b.ci95Upper],
        pValEstimated: b.pValueEstimated,
      })),
    };

    const prompt = `Tu es un Data Scientist et Méthodologue senior en psychométrie et statistiques appliquées (SPSS / SmartPLS).
Voici les résultats EXACTS d'une analyse statistique calculée mathématiquement (moteur déterministe) sur ${analysisPayload.meta.sampleSizeAnalyzed} réponses valides.

RÉSULTATS MATHÉMATIQUES OFFICIELS :
${JSON.stringify(mathSummaryForAI, null, 2)}

Instructions utilisateur : ${instructions || "Interprétation statistique académique et managériale."}

RÈGLES ABSOLUES :
1. Tu ne dois JAMAIS recalculer ou inventer de chiffres. Cite UNIQUEMENT les valeurs fournies ci-dessus.
2. Structure ton rapport avec des sections claires en Markdown :
   - ## 1. Qualité Métrologique (Fiabilité et Validité - SmartPLS) : évalue l'Alpha de Cronbach, le CR, l'AVE et commente les éventuels items problématiques à supprimer ou inverser.
   - ## 2. Analyse des Relations Bivariées & Régression : commente les corrélations significatives (avec mention des p-values exactes et ajustement Bonferroni), et la qualité prédictive du modèle (R², R² ajusté, coefficients β).
   - ## 3. Robustesse par Bootstrapping : explique si les intervalles de confiance à 95% (5000 tirages) excluent zéro et ce que cela garantit.
   - ## 4. Recommandations Méthodologiques & Managériales : rappelle expressément que "Corrélation n'est pas Causalité", commente la taille de l'échantillon (N = ${analysisPayload.meta.sampleSizeAnalyzed}) et donne des conseils pratiques.`;

    const aiResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
    });

    const summary = aiResponse.choices[0]?.message?.content || 'Rapport généré.';

    return NextResponse.json({
      success: true,
      data: {
        summary,
        analysis: analysisPayload,
      },
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue';
    console.error("Statistical Pipeline Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
