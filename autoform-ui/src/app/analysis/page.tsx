"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function AnalysisPage() {
  const [apiKey, setApiKey] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [instructions, setInstructions] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleAnalyze = async () => {
    if (!apiKey || !file) {
      setError("Veuillez fournir la clé API et le fichier CSV.");
      return;
    }
    
    setError('');
    setIsLoading(true);
    setResults(null);

    const formData = new FormData();
    formData.append('apiKey', apiKey);
    formData.append('file', file);
    if (instructions) formData.append('instructions', instructions);

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
    } catch (err: any) {
      setError(err.message);
    }
    
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FE] text-slate-800 font-sans selection:bg-[#6D44F1]/20">
      
      {/* Navbar */}
      <header className="w-full bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#6D44F1] flex items-center gap-2">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
          FormFlow Data Analyst
        </h1>
        <div className="flex gap-4">
          <Link href="/" className="text-sm font-semibold text-slate-500 hover:text-[#6D44F1] transition-colors">Retour au Générateur</Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 md:p-10 flex flex-col gap-8">
        
        {/* Upload Section */}
        <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-8 border border-slate-100 flex flex-col md:flex-row gap-8">
          <div className="flex-1 space-y-5">
            <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
              <svg className="w-5 h-5 text-[#6D44F1]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"></path></svg>
              Données de base
            </h2>
            
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">OpenAI API Key (nécessite Assistant v2)</label>
              <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#6D44F1] focus:ring-1 focus:ring-[#6D44F1] transition-all" placeholder="sk-proj-..." />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Fichier de Résultats (CSV)</label>
              <div className="w-full flex items-center justify-center w-full">
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <svg className="w-8 h-8 mb-2 text-slate-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/></svg>
                    <p className="mb-2 text-sm text-slate-500"><span className="font-semibold">{file ? file.name : "Cliquez pour uploader le CSV"}</span></p>
                  </div>
                  <input type="file" className="hidden" accept=".csv" onChange={handleFileChange} />
                </label>
              </div>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Instructions d&apos;analyse (Optionnel)</label>
              <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#6D44F1] focus:ring-1 focus:ring-[#6D44F1] transition-all resize-none" rows={2} placeholder="Ex: Fais une corrélation entre l'âge et le score de satisfaction..."></textarea>
            </div>
            
            {error && <div className="p-3 bg-red-50 text-red-600 text-sm font-semibold rounded-lg border border-red-100">{error}</div>}

            <button 
              onClick={handleAnalyze} 
              disabled={isLoading || !file || !apiKey}
              className="w-full py-3 bg-[#6D44F1] hover:bg-[#5b38d1] text-white text-sm font-semibold rounded-xl shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>L&apos;IA exécute le code Python (cela peut prendre 30s)...</>
              ) : (
                <>Lancer l&apos;Analyse Scientifique</>
              )}
            </button>
          </div>
          
          <div className="flex-1 bg-[#F4F0FF] rounded-xl p-6 border border-[#E9E1FE] flex flex-col justify-center">
            <h3 className="text-[#6D44F1] font-bold mb-3 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
              Comment ça marche ?
            </h3>
            <p className="text-sm text-[#5b38d1] leading-relaxed mb-4">
              Ce module envoie votre fichier CSV à un environnement sécurisé OpenAI où un script Python (Pandas & Statsmodels) est écrit et exécuté en temps réel.
            </p>
            <ul className="text-sm text-[#5b38d1] space-y-2 font-medium">
              <li>✅ Analyse descriptive automatique</li>
              <li>✅ Matrices de corrélation</li>
              <li>✅ Interprétation vulgarisée des données</li>
              <li>✅ Zéro mathématiques requises de votre côté</li>
            </ul>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="w-full h-64 bg-white rounded-2xl flex flex-col items-center justify-center gap-4 animate-pulse">
            <svg className="w-10 h-10 text-[#6D44F1] animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            <p className="text-slate-500 font-semibold">Analyse du fichier et calcul des modèles statistiques...</p>
          </div>
        )}

        {/* Results Dashboard */}
        {results && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* Summary */}
            <div className="bg-white p-8 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
              <h2 className="text-xl font-bold text-slate-800 mb-4">Rapport du Data Analyst</h2>
              <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{results.summary}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Statistics Cards */}
              <div className="bg-white p-6 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
                <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <svg className="w-5 h-5 text-[#6D44F1]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"></path></svg>
                  Statistiques Clés
                </h3>
                <div className="space-y-4">
                  {results.statistics?.map((stat: any, i: number) => (
                    <div key={i} className="flex flex-col p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-xs font-bold text-slate-400 uppercase">{stat.name}</span>
                      <span className="text-2xl font-black text-[#6D44F1] my-1">{stat.value}</span>
                      <span className="text-sm text-slate-600">{stat.interpretation}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Correlations */}
              <div className="bg-white p-6 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
                <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <svg className="w-5 h-5 text-[#6D44F1]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"></path></svg>
                  Corrélations Détectées
                </h3>
                <div className="space-y-4">
                  {results.correlations?.map((corr: any, i: number) => (
                    <div key={i} className="flex flex-col p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                        <span className="px-2 py-1 bg-white rounded shadow-sm">{corr.var1}</span>
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg>
                        <span className="px-2 py-1 bg-white rounded shadow-sm">{corr.var2}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-600">Coefficient (r): <span className="font-bold text-slate-800">{corr.coefficient}</span></span>
                        <span className="text-xs font-bold px-2 py-1 rounded-full bg-[#E8F0FE] text-[#2D82F6]">{corr.significance}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Basic Chart (Recharts) using the correlations data for visual flare */}
            {results.correlations && results.correlations.length > 0 && (
              <div className="bg-white p-6 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 h-80">
                <h3 className="text-lg font-bold text-slate-800 mb-6">Visualisation des Corrélations (Coefficients)</h3>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={results.correlations.map((c: any) => ({ name: `${c.var1.substring(0,8)}/${c.var2.substring(0,8)}`, value: parseFloat(c.coefficient) }))}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                    <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                    <Bar dataKey="value" fill="#A66BFF" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            
          </div>
        )}
      </main>
    </div>
  );
}
