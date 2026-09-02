"use client";

import React, { useState } from 'react';

export default function Home() {
  const [apiKey, setApiKey] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [instructions, setInstructions] = useState('');
  const [numSubmissions, setNumSubmissions] = useState(10);
  const [isAuto, setIsAuto] = useState(true);
  
  const [status, setStatus] = useState('Prêt à démarrer');
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setInstructions(prev => prev ? prev + '\n\n--- Contenu du fichier importé ---\n' + text : text);
    };
    reader.readAsText(file);
  };

  const handleSubmit = async () => {
    if (!apiKey || !formUrl) {
      alert("La clé API et le lien du formulaire sont obligatoires.");
      return;
    }

    setIsLoading(true);
    setStatus('Génération en cours...');
    setLogs([]);

    const personaHistory: string[] = [];

    for (let i = 0; i < numSubmissions; i++) {
      setStatus(`Soumission ${i + 1} sur ${numSubmissions}...`);
      
      try {
        const response = await fetch('/api/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey, formUrl, instructions, personaHistory })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Erreur API');

        personaHistory.push(data.persona);
        
        setLogs(prev => [
          {
            id: i + 1,
            persona: data.persona,
            success: data.success,
            answers: data.answers,
            time: 'À l\'instant'
          },
          ...prev
        ]);

      } catch (err: any) {
        console.error(err);
        break;
      }
    }

    setIsLoading(false);
    setStatus('Terminé !');
  };

  return (
    <div className="min-h-screen bg-[#F8F9FE] text-slate-800 font-sans selection:bg-[#6D44F1]/20">
      
      {/* Header type Dashboard */}
      <header className="w-full bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-center md:justify-start">
        <h1 className="text-xl font-bold text-[#6D44F1]">FormFlow AI</h1>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-6 md:p-10 flex flex-col lg:flex-row gap-8">
        
        {/* Left Column: Settings Card */}
        <div className="w-full lg:w-[400px] flex-shrink-0">
          <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 border border-slate-100">
            <h2 className="text-lg font-bold flex items-center gap-2 mb-6">
              <svg className="w-5 h-5 text-[#6D44F1]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"></path></svg>
              Automation Settings
            </h2>

            <div className="space-y-5">
              {/* API Key */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">OpenAI API Key</label>
                <div className="relative">
                  <svg className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"></path></svg>
                  <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#6D44F1] focus:ring-1 focus:ring-[#6D44F1] transition-all" defaultValue="••••••••••••••••••••••••••" />
                </div>
              </div>

              {/* Form URL */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Google Form URL</label>
                <div className="relative">
                  <svg className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
                  <input type="url" value={formUrl} onChange={(e) => setFormUrl(e.target.value)} className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#6D44F1] focus:ring-1 focus:ring-[#6D44F1] transition-all" placeholder="https://docs.google.com/forms/..." />
                </div>
              </div>

              {/* Instructions */}
              <div className="space-y-1.5 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">AI Instructions (Persona Rules)</label>
                  <label className="cursor-pointer text-xs font-medium text-[#6D44F1] hover:underline flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg>
                    Upload File
                    <input type="file" accept=".txt,.csv,.md,.json" className="hidden" onChange={handleFileUpload} />
                  </label>
                </div>
                <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#6D44F1] focus:ring-1 focus:ring-[#6D44F1] transition-all resize-none" rows={4} placeholder="Define the persona base rules here... e.g. 'Act as a diverse set of tech industry professionals...'"></textarea>
              </div>

              {/* Counts & Toggles */}
              <div className="flex items-center gap-4 pt-2">
                <div className="flex-1 space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Submission Count</label>
                  <input type="number" value={numSubmissions} onChange={(e) => setNumSubmissions(Number(e.target.value))} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-center focus:outline-none focus:border-[#6D44F1] focus:ring-1 focus:ring-[#6D44F1] transition-all" />
                </div>
                <div className="flex-1 flex flex-col items-end justify-center space-y-2 pt-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Auto-Submit</label>
                  <button 
                    onClick={() => setIsAuto(!isAuto)} 
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isAuto ? 'bg-[#6D44F1]' : 'bg-slate-300'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isAuto ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>

              {/* Start Button */}
              <div className="pt-4">
                <button 
                  onClick={handleSubmit} 
                  disabled={isLoading}
                  className="w-full py-3 bg-gradient-to-r from-[#6D44F1] to-[#A66BFF] hover:from-[#5b38d1] hover:to-[#9154ea] text-white text-sm font-semibold rounded-xl shadow-[0_4px_14px_0_rgba(109,68,241,0.39)] transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <><svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Processing...</>
                  ) : (
                    <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> Start Automation</>
                  )}
                </button>
              </div>

            </div>
          </div>
        </div>

        {/* Right Column: Real-time Feed */}
        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-800">Real-time Feed</h2>
            <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 text-[#2D82F6] rounded-full text-xs font-semibold">
              <span className={`w-2 h-2 rounded-full ${isLoading ? 'bg-[#2D82F6] animate-ping' : 'bg-slate-300'}`}></span>
              {status}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pb-10">
            {logs.length === 0 && !isLoading && (
              <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center flex flex-col items-center shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
                <div className="w-16 h-16 bg-[#F4F0FF] rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-[#A66BFF]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                </div>
                <h3 className="text-slate-800 font-bold mb-1">Aucune activité</h3>
                <p className="text-slate-500 text-sm max-w-sm">Les profils générés et leurs réponses apparaîtront ici en temps réel lorsque l'automatisation démarrera.</p>
              </div>
            )}

            {logs.map((log, idx) => (
              <div key={idx} className="bg-white rounded-2xl border border-slate-100 shadow-[0_4px_20px_rgb(0,0,0,0.03)] overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="p-5 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-[#F8F7FA] border border-slate-100 flex items-center justify-center flex-shrink-0 mt-1">
                    <svg className="w-5 h-5 text-[#6D44F1]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-slate-800 mb-0.5 leading-snug">{log.persona}</h3>
                        <p className="text-xs text-slate-400">Submitted {log.time}</p>
                      </div>
                      <div className="ml-4 flex-shrink-0">
                        {log.success ? (
                          <span className="px-2.5 py-1 bg-[#E8F0FE] text-[#2D82F6] text-xs font-bold rounded-full">Success</span>
                        ) : (
                          <span className="px-2.5 py-1 bg-red-50 text-red-600 text-xs font-bold rounded-full">Failed</span>
                        )}
                      </div>
                    </div>
                    
                    {log.answers && log.answers.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-slate-50">
                        <details className="group">
                          <summary className="text-xs font-semibold text-[#6D44F1] cursor-pointer list-none flex items-center gap-1 hover:text-[#5b38d1]">
                            <svg className="w-4 h-4 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                            Voir les réponses détaillées
                          </summary>
                          <ul className="mt-3 space-y-2">
                            {log.answers.map((ans: any, i: number) => (
                              <li key={i} className="text-xs bg-slate-50 p-2 rounded-lg border border-slate-100 flex flex-col gap-1">
                                <span className="font-semibold text-slate-700">{ans.question}</span>
                                <span className="text-slate-600 pl-2 border-l-2 border-[#A66BFF]">{ans.answer}</span>
                              </li>
                            ))}
                          </ul>
                        </details>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </main>
    </div>
  );
}
