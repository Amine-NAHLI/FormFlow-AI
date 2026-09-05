"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import Papa from 'papaparse';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  ShieldCheck, BrainCircuit, Activity, BarChart3, Sliders, ChevronDown,
  ChevronUp, CheckCircle2, AlertTriangle, Layers, FileDown,
  Sparkles, RefreshCw, ArrowRightLeft
} from 'lucide-react';
import { AnalysisPayload, ConstructDefinition, MissingValueStrategy } from '@/lib/stats/types';

export default function AnalysisPage() {
  const [apiKey, setApiKey] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [instructions, setInstructions] = useState('');
  const [missingStrategy, setMissingStrategy] = useState<MissingValueStrategy>('listwise');
  
  // Parsed columns from CSV for configuration
  const [detectedColumns, setDetectedColumns] = useState<string[]>([]);
  const [showConfig, setShowConfig] = useState(false);
  const [constructs, setConstructs] = useState<ConstructDefinition[]>([]);
  const [newConstructName, setNewConstructName] = useState('');
  const [selectedItemsForConstruct, setSelectedItemsForConstruct] = useState<string[]>([]);
  const [reversedItems, setReversedItems] = useState<Record<string, boolean>>({});

  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<{ summary: string; analysis: AnalysisPayload } | null>(null);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState<'beginner' | 'research'>('research');

  // Handle CSV file selection and extract headers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      
      Papa.parse(selected, {
        header: true,
        preview: 3,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.meta.fields) {
            setDetectedColumns(results.meta.fields);
            setShowConfig(true);
          }
        },
      });
    }
  };

  const handleAddConstruct = () => {
    if (!newConstructName.trim() || selectedItemsForConstruct.length === 0) return;
    const newConst: ConstructDefinition = {
      name: newConstructName.trim(),
      items: selectedItemsForConstruct.map(col => ({
        columnName: col,
        isReversed: !!reversedItems[col],
        scaleMin: 1,
        scaleMax: 5,
      })),
    };
    setConstructs([...constructs, newConst]);
    setNewConstructName('');
    setSelectedItemsForConstruct([]);
  };

  const handleRemoveConstruct = (index: number) => {
    setConstructs(constructs.filter((_, i) => i !== index));
  };

  const handleAnalyze = async () => {
    if (!apiKey || !file) {
      setError("Veuillez fournir votre clé API OpenAI et le fichier CSV.");
      return;
    }

    setError('');
    setIsLoading(true);
    setResults(null);

    const formData = new FormData();
    formData.append('apiKey', apiKey);
    formData.append('file', file);
    formData.append('missingStrategy', missingStrategy);
    if (instructions) formData.append('instructions', instructions);
    if (constructs.length > 0) {
      formData.append('constructs', JSON.stringify(constructs));
    }

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (data.success) {
        setResults(data.data);
      } else {
        setError(data.error || "Une erreur s'est produite lors de l'analyse.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur de connexion');
    }

    setIsLoading(false);
  };

  const analysis = results?.analysis;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans selection:bg-[#6D44F1]/20">

      {/* Header */}
      <header className="w-full bg-white border-b border-slate-200 sticky top-0 z-30 px-6 py-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#6D44F1] to-[#906BFF] flex items-center justify-center text-white shadow-md shadow-[#6D44F1]/20">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 leading-tight">FormFlow Statistical Engine</h1>
            <p className="text-xs text-slate-500 font-medium">Conforme aux standards SPSS, SmartPLS &amp; APA 7</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Mode Switcher */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center text-xs font-semibold">
            <button
              onClick={() => setViewMode('beginner')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'beginner'
                  ? 'bg-white text-[#6D44F1] shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Mode Décideur
            </button>
            <button
              onClick={() => setViewMode('research')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'research'
                  ? 'bg-white text-[#6D44F1] shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Mode Recherche (SPSS/PLS)
            </button>
          </div>

          <Link
            href="/"
            className="text-xs font-semibold px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Retour Formulaires
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 md:p-8 flex flex-col gap-8">

        {/* Input & Methodology Setup Box */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 md:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left Col: Upload & Inputs */}
            <div className="lg:col-span-7 space-y-5">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#6D44F1]" />
                1. Configuration des Données &amp; Clé API
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Clé API OpenAI
                  </label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#6D44F1] focus:ring-1 focus:ring-[#6D44F1]"
                    placeholder="sk-proj-..."
                  />
                  <span className="text-[11px] text-slate-400">Utilisée strictement pour la synthèse textuelle.</span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Traitement des Valeurs Manquantes
                  </label>
                  <select
                    value={missingStrategy}
                    onChange={(e) => setMissingStrategy(e.target.value as MissingValueStrategy)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#6D44F1]"
                  >
                    <option value="listwise">Exclusion par observation (Listwise deletion - Recommandé)</option>
                    <option value="mean">Imputation par la moyenne</option>
                    <option value="median">Imputation par la médiane</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Fichier de Données (CSV)
                </label>
                <div className="w-full">
                  <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-slate-200 border-dashed rounded-xl cursor-pointer bg-slate-50/50 hover:bg-slate-50 hover:border-[#6D44F1]/50 transition-all">
                    <div className="flex flex-col items-center justify-center py-3">
                      <FileDown className="w-7 h-7 mb-1.5 text-slate-400" />
                      <p className="text-sm font-semibold text-slate-700">
                        {file ? file.name : "Importer le fichier CSV"}
                      </p>
                      <p className="text-xs text-slate-400">
                        Séparateur virgule ou point-virgule, décimales avec virgule acceptées
                      </p>
                    </div>
                    <input type="file" className="hidden" accept=".csv" onChange={handleFileChange} />
                  </label>
                </div>
              </div>

              {/* Advanced Construct Builder */}
              {detectedColumns.length > 0 && (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/70 space-y-3">
                  <div
                    onClick={() => setShowConfig(!showConfig)}
                    className="flex items-center justify-between cursor-pointer"
                  >
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-[#6D44F1]" />
                      Définition des Construits Psychométriques (Optionnel)
                    </span>
                    {showConfig ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>

                  {showConfig && (
                    <div className="space-y-4 pt-2">
                      <p className="text-xs text-slate-500">
                        Par défaut, FormFlow regroupe automatiquement les items similaires (ex: SAT_1, SAT_2). Vous pouvez aussi définir manuellement vos construits ci-dessous :
                      </p>

                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          placeholder="Nom du construit (ex: Satisfaction Globale)"
                          value={newConstructName}
                          onChange={(e) => setNewConstructName(e.target.value)}
                          className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                        />
                        <button
                          type="button"
                          onClick={handleAddConstruct}
                          className="px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-700 transition-colors"
                        >
                          Ajouter Construit
                        </button>
                      </div>

                      {/* Select items for construct */}
                      <div className="space-y-1">
                        <span className="text-[11px] font-semibold text-slate-500">Sélectionner les items du construit :</span>
                        <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 bg-white rounded-lg border border-slate-200">
                          {detectedColumns.map((col) => (
                            <button
                              type="button"
                              key={col}
                              onClick={() => {
                                if (selectedItemsForConstruct.includes(col)) {
                                  setSelectedItemsForConstruct(selectedItemsForConstruct.filter(c => c !== col));
                                } else {
                                  setSelectedItemsForConstruct([...selectedItemsForConstruct, col]);
                                }
                              }}
                              className={`text-xs px-2.5 py-1 rounded-md border transition-all ${
                                selectedItemsForConstruct.includes(col)
                                  ? 'bg-[#6D44F1] text-white border-[#6D44F1]'
                                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              {col}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Toggle reversed items */}
                      {selectedItemsForConstruct.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[11px] font-semibold text-slate-500">Items inversés dans ce construit (formulation négative) :</span>
                          <div className="flex flex-wrap gap-1.5">
                            {selectedItemsForConstruct.map((col) => (
                              <button
                                type="button"
                                key={col}
                                onClick={() => setReversedItems(prev => ({ ...prev, [col]: !prev[col] }))}
                                className={`text-[11px] px-2 py-0.5 rounded border transition-all ${
                                  reversedItems[col]
                                    ? 'bg-amber-100 text-amber-800 border-amber-300 font-bold'
                                    : 'bg-white text-slate-500 border-slate-200'
                                }`}
                              >
                                {reversedItems[col] ? `✓ ${col} (Inversé)` : `${col} (Normal)`}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Display configured constructs */}
                      {constructs.length > 0 && (
                        <div className="space-y-1.5">
                          <span className="text-[11px] font-semibold text-slate-500">Construits actifs :</span>
                          <div className="space-y-1">
                            {constructs.map((c, idx) => (
                              <div key={idx} className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200 text-xs">
                                <div>
                                  <span className="font-bold text-[#6D44F1]">{c.name}</span> : {c.items.map(i => i.columnName).join(', ')}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveConstruct(idx)}
                                  className="text-red-500 hover:underline text-[11px] font-semibold"
                                >
                                  Supprimer
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Instructions Spécifiques pour le Data Scientist IA (Optionnel)
                </label>
                <textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#6D44F1] resize-none"
                  rows={2}
                  placeholder="Ex: Analyse la relation entre l'ancienneté et la recommandation de l'entreprise..."
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 text-red-700 text-xs font-semibold rounded-lg border border-red-200 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                  {error}
                </div>
              )}

              <button
                onClick={handleAnalyze}
                disabled={isLoading || !file || !apiKey}
                className="w-full py-3 bg-[#6D44F1] hover:bg-[#5b38d1] text-white text-sm font-semibold rounded-xl shadow-md shadow-[#6D44F1]/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Calculs mathématiques &amp; rédaction scientifique en cours...
                  </>
                ) : (
                  <>
                    <BrainCircuit className="w-4 h-4" />
                    Lancer l&apos;Analyse Scientifique Complète
                  </>
                )}
              </button>
            </div>

            {/* Right Col: Rigorous Methodology Info */}
            <div className="lg:col-span-5 bg-gradient-to-br from-[#F5F2FF] to-[#FAF8FF] rounded-xl p-6 border border-[#E4DCFF] flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-[#6D44F1] font-bold text-sm">
                  <ShieldCheck className="w-5 h-5" />
                  Architecture Déterministe Certifiée
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Contrairement aux outils génératifs qui &quot;hallucinent&quot; des calculs, FormFlow applique une stricte séparation des responsabilités :
                </p>

                <div className="space-y-2.5 text-xs">
                  <div className="p-2.5 bg-white/80 rounded-lg border border-[#E4DCFF] flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-slate-900">Moteur Déterministe Pure Math :</span>
                      <p className="text-slate-500">Statistiques descriptives (asymétrie, aplatissement), Pearson, Spearman, régression OLS avec ANOVA, p-values exactes Student&apos;s t.</p>
                    </div>
                  </div>

                  <div className="p-2.5 bg-white/80 rounded-lg border border-[#E4DCFF] flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-slate-900">Fiabilité &amp; Validité SmartPLS :</span>
                      <p className="text-slate-500">Alpha de Cronbach, Fiabilité Composée (CR), AVE et matrice Fornell-Larcker calculés par construit.</p>
                    </div>
                  </div>

                  <div className="p-2.5 bg-white/80 rounded-lg border border-[#E4DCFF] flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-slate-900">Bootstrapping (5000 itérations) :</span>
                      <p className="text-slate-500">Générateur pseudo-aléatoire fixé (Seed 42) pour une reproductibilité scientifique absolue.</p>
                    </div>
                  </div>

                  <div className="p-2.5 bg-white/80 rounded-lg border border-[#E4DCFF] flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-slate-900">Rôle de l&apos;IA :</span>
                      <p className="text-slate-500">Strictement limitée à la vulgarisation textuelle et recommandations méthodologiques. Zéro calcul par le LLM.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[#E4DCFF] text-[11px] text-slate-500 flex items-center justify-between">
                <span>Algorithmes : SPSS v28 &amp; SmartPLS 4</span>
                <span className="font-mono text-[#6D44F1] font-bold">100% Reproductible</span>
              </div>
            </div>

          </div>
        </div>

        {/* Results Area */}
        {results && analysis && (
          <div className="space-y-6">

            {/* Meta diagnostic bar */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="px-3.5 py-1.5 bg-white rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 shadow-xs">
                N total : <strong className="text-slate-900">{analysis.meta.totalRows}</strong>
              </span>
              <span className="px-3.5 py-1.5 bg-white rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 shadow-xs">
                N analysé : <strong className="text-slate-900">{analysis.meta.sampleSizeAnalyzed}</strong>
              </span>
              <span className="px-3.5 py-1.5 bg-white rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 shadow-xs">
                Colonnes : <strong className="text-slate-900">{analysis.meta.totalColumns}</strong>
              </span>
              <span className="px-3.5 py-1.5 bg-purple-50 rounded-lg border border-purple-200 text-xs font-semibold text-[#6D44F1] shadow-xs">
                Stratégie valeurs manquantes : <strong>{analysis.meta.missingHandlingStrategy}</strong>
              </span>
              {analysis.meta.sampleSizeAnalyzed < 30 && (
                <span className="px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-xs font-medium flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  Échantillon faible (N &lt; 30) : Puissance statistique limitée
                </span>
              )}
            </div>

            {/* AI Synthesized Report */}
            <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#6D44F1]" />
                  Rapport Synthétique d&apos;Expertise Méthodologique &amp; Managériale
                </h2>
                <button
                  onClick={() => window.print()}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  Imprimer / PDF
                </button>
              </div>
              <div className="prose prose-slate max-w-none text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">
                {results.summary}
              </div>
            </div>

            {/* SECTION 1: Psychométrie & SmartPLS (Fiabilité & Validité) */}
            <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-[#6D44F1]" />
                    Fiabilité &amp; Validité des Construits (Standards SmartPLS / Psychométrie)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Mesure la cohérence interne et la validité convergente / discriminante des échelles de mesure.
                  </p>
                </div>
              </div>

              {analysis.reliability.length === 0 ? (
                <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-500">
                  Aucun construit psychométrique détecté (nécessite au moins 2 indicateurs numériques reliés).
                </div>
              ) : (
                <div className="space-y-6">
                  {analysis.reliability.map((rel, idx) => {
                    const val = analysis.validity[idx];
                    return (
                      <div key={idx} className="p-5 bg-slate-50/70 rounded-xl border border-slate-200/80 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/70 pb-3">
                          <div>
                            <span className="font-bold text-sm text-slate-900">{rel.constructName}</span>
                            <span className="text-xs text-slate-500 ml-2">({rel.itemCount} items | N={rel.n})</span>
                          </div>
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                            rel.cronbachAlpha >= 0.70 ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {rel.interpretation}
                          </span>
                        </div>

                        {/* Metric Indicators */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="p-3 bg-white rounded-lg border border-slate-200">
                            <span className="text-[11px] font-bold text-slate-400 uppercase block">Alpha de Cronbach</span>
                            <span className="text-xl font-bold font-mono text-[#6D44F1]">{rel.cronbachAlpha}</span>
                            <span className="text-[10px] text-slate-400 block mt-0.5">Seuil standard : ≥ 0.70</span>
                          </div>

                          <div className="p-3 bg-white rounded-lg border border-slate-200">
                            <span className="text-[11px] font-bold text-slate-400 uppercase block">Fiabilité Composée (CR)</span>
                            <span className="text-xl font-bold font-mono text-[#6D44F1]">{rel.compositeReliability}</span>
                            <span className="text-[10px] text-slate-400 block mt-0.5">Dillon-Goldstein rho ≥ 0.70</span>
                          </div>

                          <div className="p-3 bg-white rounded-lg border border-slate-200">
                            <span className="text-[11px] font-bold text-slate-400 uppercase block">AVE (Variance Extraite)</span>
                            <span className="text-xl font-bold font-mono text-[#6D44F1]">{val?.ave ?? 'N/A'}</span>
                            <span className="text-[10px] text-slate-400 block mt-0.5">Validité convergente si ≥ 0.50</span>
                          </div>

                          <div className="p-3 bg-white rounded-lg border border-slate-200">
                            <span className="text-[11px] font-bold text-slate-400 uppercase block">Racine Carrée AVE (√AVE)</span>
                            <span className="text-xl font-bold font-mono text-[#6D44F1]">{val?.sqrtAVE ?? 'N/A'}</span>
                            <span className="text-[10px] text-slate-400 block mt-0.5">Pour critère Fornell-Larcker</span>
                          </div>
                        </div>

                        {/* Item Details Table (Research mode) */}
                        {viewMode === 'research' && (
                          <div className="mt-3 overflow-x-auto">
                            <table className="w-full text-left text-xs bg-white rounded-lg border border-slate-200">
                              <thead className="bg-slate-100/75 text-slate-700 font-semibold border-b border-slate-200">
                                <tr>
                                  <th className="p-2.5">Item</th>
                                  <th className="p-2.5">Moyenne (μ)</th>
                                  <th className="p-2.5">Écart-Type (σ)</th>
                                  <th className="p-2.5">Corr. Item-Reste (r_it)</th>
                                  <th className="p-2.5">Alpha si item supprimé</th>
                                  <th className="p-2.5">Loading (λ)</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {rel.itemStats.map((item, iIdx) => (
                                  <tr key={iIdx} className="hover:bg-slate-50/50">
                                    <td className="p-2.5 font-medium text-slate-900">{item.itemName}</td>
                                    <td className="p-2.5 font-mono">{item.mean}</td>
                                    <td className="p-2.5 font-mono">{item.stddev}</td>
                                    <td className="p-2.5 font-mono">
                                      <span className={item.itemRestCorrelation < 0.3 ? 'text-amber-600 font-bold' : 'text-slate-700'}>
                                        {item.itemRestCorrelation}
                                      </span>
                                    </td>
                                    <td className="p-2.5 font-mono">
                                      <span className={item.alphaIfDeleted > rel.cronbachAlpha ? 'text-blue-600 font-bold' : 'text-slate-700'}>
                                        {item.alphaIfDeleted}
                                      </span>
                                    </td>
                                    <td className="p-2.5 font-mono">{item.factorLoading}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            <p className="text-[11px] text-slate-400 mt-1">
                              * Si &quot;Alpha si supprimé&quot; est nettement supérieur à l&apos;Alpha global, l&apos;item affaiblit la cohérence et devrait être reformulé ou inversé.
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Fornell-Larcker Discriminant Validity Matrix */}
                  {analysis.discriminantValidity.length > 0 && (
                    <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-3">
                      <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                        Validité Discriminante (Critère de Fornell &amp; Larcker, 1981)
                      </span>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs bg-slate-50/50 rounded-lg border border-slate-200">
                          <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                            <tr>
                              <th className="p-2.5">Paire de Construits</th>
                              <th className="p-2.5">Corrélation (r)</th>
                              <th className="p-2.5">√AVE Construit 1</th>
                              <th className="p-2.5">√AVE Construit 2</th>
                              <th className="p-2.5">Règle Validée ?</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200/60">
                            {analysis.discriminantValidity.map((fl, flIdx) => (
                              <tr key={flIdx}>
                                <td className="p-2.5 font-semibold text-slate-900">{fl.construct1} ↔ {fl.construct2}</td>
                                <td className="p-2.5 font-mono">{fl.correlation}</td>
                                <td className="p-2.5 font-mono">{fl.sqrtAVE1}</td>
                                <td className="p-2.5 font-mono">{fl.sqrtAVE2}</td>
                                <td className="p-2.5">
                                  <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                    fl.validFornellLarcker ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                  }`}>
                                    {fl.validFornellLarcker ? 'Validité Confirmée (√AVE > r)' : 'Non confirmée'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* SECTION 2: Bivariate Correlations & Regression (SPSS) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Correlations Table */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-[#6D44F1]" />
                    Corrélations de Pearson (r) &amp; Spearman (ρ)
                  </h3>
                  <span className="text-xs text-slate-400 font-mono">Student&apos;s t exact</span>
                </div>

                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 sticky top-0">
                      <tr>
                        <th className="p-2.5">Variables</th>
                        <th className="p-2.5">r (Pearson)</th>
                        {viewMode === 'research' && <th className="p-2.5">ρ (Spearman)</th>}
                        <th className="p-2.5">p-value</th>
                        {viewMode === 'research' && <th className="p-2.5">p-Bonferroni</th>}
                        <th className="p-2.5">IC 95%</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {analysis.correlations.slice(0, 10).map((c, i) => (
                        <tr key={i} className="hover:bg-slate-50/50">
                          <td className="p-2.5 font-sans font-medium text-slate-800">{c.var1} ↔ {c.var2}</td>
                          <td className="p-2.5 font-bold text-[#6D44F1]">{c.coefficient}</td>
                          {viewMode === 'research' && <td className="p-2.5 text-slate-600">{c.spearmanRho}</td>}
                          <td className="p-2.5">
                            <span className={`px-1.5 py-0.5 rounded text-[11px] ${
                              c.pValue < 0.05 ? 'bg-green-50 text-green-700 font-semibold' : 'text-slate-500'
                            }`}>
                              {c.pValue < 0.001 ? '< 0.001 ***' : c.pValue}
                            </span>
                          </td>
                          {viewMode === 'research' && <td className="p-2.5 text-slate-500">{c.pValueBonferroni}</td>}
                          <td className="p-2.5 text-[11px] text-slate-500">[{c.ci95Lower} ; {c.ci95Upper}]</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {analysis.correlations.length > 0 && (
                  <div className="h-44 pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analysis.correlations.slice(0, 6).map(c => ({
                        name: `${c.var1.slice(0, 8)}/${c.var2.slice(0, 8)}`,
                        value: c.coefficient,
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} />
                        <YAxis domain={[-1, 1]} tick={{ fontSize: 10, fill: '#64748b' }} />
                        <Tooltip />
                        <Bar dataKey="value" fill="#6D44F1" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Regression Model (OLS) */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <ArrowRightLeft className="w-5 h-5 text-[#6D44F1]" />
                    Régression Linéaire OLS (Moindres Carrés)
                  </h3>
                  <span className="text-xs text-slate-400 font-mono">ANOVA F-test</span>
                </div>

                {analysis.regression ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                        <span className="text-[11px] font-bold text-slate-400 uppercase block">R² (Variance Expliquée)</span>
                        <span className="text-xl font-bold font-mono text-[#6D44F1]">{analysis.regression.rSquared}</span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                        <span className="text-[11px] font-bold text-slate-400 uppercase block">R² Ajusté</span>
                        <span className="text-xl font-bold font-mono text-[#6D44F1]">{analysis.regression.adjRSquared}</span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                        <span className="text-[11px] font-bold text-slate-400 uppercase block">F-statistic (p-value)</span>
                        <span className="text-sm font-bold font-mono text-slate-800">
                          F={analysis.regression.fStat} (p={analysis.regression.fPValue < 0.001 ? '<0.001' : analysis.regression.fPValue})
                        </span>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600">
                      <strong>Modèle : </strong>
                      {analysis.regression.dependentVar} = {analysis.regression.intercept} + {analysis.regression.coefficients.map(c => `${c.b} × (${c.variable})`).join(' + ')}
                    </div>

                    {/* Coefficients table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs bg-slate-50/50 rounded-lg border border-slate-200">
                        <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                          <tr>
                            <th className="p-2">Variable</th>
                            <th className="p-2">B (non std)</th>
                            <th className="p-2">Erreur Std</th>
                            <th className="p-2">Beta (β std)</th>
                            <th className="p-2">t-stat</th>
                            <th className="p-2">p-value</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/60 font-mono">
                          {analysis.regression.coefficients.map((c, cIdx) => (
                            <tr key={cIdx}>
                              <td className="p-2 font-sans font-medium text-slate-900">{c.variable}</td>
                              <td className="p-2 font-bold text-[#6D44F1]">{c.b}</td>
                              <td className="p-2 text-slate-600">{c.stdError}</td>
                              <td className="p-2 font-bold text-slate-800">{c.beta}</td>
                              <td className="p-2 text-slate-600">{c.tStat}</td>
                              <td className="p-2">
                                <span className={c.pValue < 0.05 ? 'text-green-600 font-bold' : 'text-slate-500'}>
                                  {c.pValue < 0.001 ? '<0.001 ***' : c.pValue}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 text-center py-8">Aucune variable suffisante pour estimer la régression.</p>
                )}
              </div>

            </div>

            {/* SECTION 3: Robustesse par Bootstrapping (5000 itérations) */}
            <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <RefreshCw className="w-5 h-5 text-[#6D44F1]" />
                    Validation de Robustesse par Bootstrapping (5000 Itérations Rééchantillonnées)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Estime la distribution empirique sans supposer la normalité stricte. Reproductible à 100% via Mulberry32 (Seed: 42).
                  </p>
                </div>
                <span className="text-xs font-mono font-bold px-2.5 py-1 bg-purple-50 text-[#6D44F1] rounded-lg border border-purple-100">
                  5 000 itérations | Seed 42
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {analysis.bootstrapping.map((b, bIdx) => (
                  <div key={bIdx} className="p-4 bg-slate-50/70 rounded-xl border border-slate-200 space-y-3">
                    <span className="text-xs font-bold text-slate-800">{b.parameter}</span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                      <div className="p-2 bg-white rounded-lg border border-slate-200">
                        <span className="text-[10px] text-slate-400 uppercase block">Valeur Initiale</span>
                        <span className="text-sm font-bold font-mono text-slate-800">{b.originalValue}</span>
                      </div>
                      <div className="p-2 bg-white rounded-lg border border-slate-200">
                        <span className="text-[10px] text-slate-400 uppercase block">Moyenne Boot</span>
                        <span className="text-sm font-bold font-mono text-[#6D44F1]">{b.bootstrapMean}</span>
                      </div>
                      <div className="p-2 bg-white rounded-lg border border-slate-200">
                        <span className="text-[10px] text-slate-400 uppercase block">Erreur Std Boot</span>
                        <span className="text-sm font-bold font-mono text-slate-700">{b.bootstrapStdErr}</span>
                      </div>
                      <div className="p-2 bg-white rounded-lg border border-slate-200">
                        <span className="text-[10px] text-slate-400 uppercase block">IC 95% Percentile</span>
                        <span className="text-xs font-bold font-mono text-green-700">[{b.ci95Lower} ; {b.ci95Upper}]</span>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {b.ci95Lower > 0 || b.ci95Upper < 0
                        ? "✅ L'intervalle à 95% n'inclut pas 0 : La relation est statistiquement robuste et significative."
                        : "⚠️ L'intervalle à 95% inclut 0 : L'effet pourrait être dû à l'échantillonnage."}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* SECTION 4: Statistiques Descriptives & Normalité (Asymétrie, Kurtosis & Quartiles) */}
            {viewMode === 'research' && (
              <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-[#6D44F1]" />
                  Statistiques Descriptives &amp; Vérification de la Normalité
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs bg-slate-50/50 rounded-lg border border-slate-200">
                    <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">Variable</th>
                        <th className="p-2.5">N valide</th>
                        <th className="p-2.5">Moyenne (μ)</th>
                        <th className="p-2.5">Médiane</th>
                        <th className="p-2.5">Quartiles [Q1 ; Q3]</th>
                        <th className="p-2.5">IQR</th>
                        <th className="p-2.5">Écart-Type (σ)</th>
                        <th className="p-2.5">Min - Max</th>
                        <th className="p-2.5">Asymétrie (Skewness)</th>
                        <th className="p-2.5">Aplatissement (Kurtosis)</th>
                        <th className="p-2.5">Normalité Approximative</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/60 font-mono">
                      {analysis.descriptives.map((d, dIdx) => (
                        <tr key={dIdx} className="hover:bg-white">
                          <td className="p-2.5 font-sans font-medium text-slate-900">{d.name}</td>
                          <td className="p-2.5">{d.n}</td>
                          <td className="p-2.5 font-bold text-[#6D44F1]">{d.mean}</td>
                          <td className="p-2.5">{d.median}</td>
                          <td className="p-2.5">[{d.q1} ; {d.q3}]</td>
                          <td className="p-2.5 font-bold text-slate-700">{d.iqr}</td>
                          <td className="p-2.5">{d.stddev}</td>
                          <td className="p-2.5">[{d.min} ; {d.max}]</td>
                          <td className="p-2.5">{d.skewness}</td>
                          <td className="p-2.5">{d.kurtosis}</td>
                          <td className="p-2.5 font-sans">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                              d.isNormalCandidate ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {d.isNormalCandidate ? 'Normale candidate' : 'Non-normale'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SECTION 5: Tests d'Association du Chi-Deux (Variables Catégorielles) */}
            {analysis.chiSquareTests && analysis.chiSquareTests.length > 0 && (
              <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-[#6D44F1]" />
                    Tests d&apos;Indépendance du Chi-Deux (χ²) &amp; V de Cramér
                  </h3>
                  <span className="text-xs text-slate-400 font-mono">Association catégorielle</span>
                </div>

                <div className="space-y-3">
                  {analysis.chiSquareTests.map((chi, idx) => (
                    <div key={idx} className="p-4 bg-slate-50/70 rounded-xl border border-slate-200 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-800">{chi.var1} ↔ {chi.var2}</span>
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                          {chi.interpretation}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs">
                        <div className="p-2 bg-white rounded-lg border border-slate-200">
                          <span className="text-[10px] text-slate-400 uppercase block font-sans">Statistique χ²</span>
                          <span className="font-bold text-[#6D44F1]">{chi.chi2}</span> (df={chi.df})
                        </div>
                        <div className="p-2 bg-white rounded-lg border border-slate-200">
                          <span className="text-[10px] text-slate-400 uppercase block font-sans">p-value</span>
                          <span className="font-bold text-slate-800">{chi.pValue < 0.001 ? '< 0.001 ***' : chi.pValue}</span>
                        </div>
                        <div className="p-2 bg-white rounded-lg border border-slate-200">
                          <span className="text-[10px] text-slate-400 uppercase block font-sans">V de Cramér</span>
                          <span className="font-bold text-slate-800">{chi.cramersV}</span>
                        </div>
                        <div className="p-2 bg-white rounded-lg border border-slate-200">
                          <span className="text-[10px] text-slate-400 uppercase block font-sans">Validité Cochran</span>
                          <span className={`text-[11px] font-sans font-bold ${chi.hasLowExpectedFrequencies ? 'text-amber-600' : 'text-green-600'}`}>
                            {chi.hasLowExpectedFrequencies ? 'Effectifs faibles' : 'Conforme (E ≥ 5)'}
                          </span>
                        </div>
                      </div>

                      {chi.warning && (
                        <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-amber-800 text-[11px] flex items-start gap-1.5 font-sans">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                          <span>{chi.warning}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

      </main>
    </div>
  );
}
