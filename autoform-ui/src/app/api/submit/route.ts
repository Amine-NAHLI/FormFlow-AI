import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import * as cheerio from 'cheerio';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      apiKey, 
      formUrl, 
      instructions, 
      personaHistory, 
      generateOnly, 
      submitOnly, 
      answersRaw 
    } = body;

    // --- MODE 1: SOUMISSION MANUELLE UNIQUEMENT ---
    if (submitOnly) {
      if (!formUrl || !answersRaw) {
        return NextResponse.json({ error: 'Missing formUrl or answersRaw' }, { status: 400 });
      }

      const response = await fetch(formUrl);
      const html = await response.text();

      const formActionMatch = html.match(/action="([^"]*formResponse)"/);
      if (!formActionMatch) {
        return NextResponse.json({ error: 'Cannot find form action URL' }, { status: 500 });
      }
      const formSubmitUrl = formActionMatch[1];

      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(answersRaw)) {
        if (Array.isArray(value)) {
          value.forEach((v) => params.append(key, String(v)));
        } else {
          params.append(key, String(value));
        }
      }
      
      const fbzxMatch = html.match(/name="fbzx" value="([^"]*)"/);
      const pageHistoryMatch = html.match(/name="pageHistory" value="([^"]*)"/);
      if (fbzxMatch) params.append('fbzx', fbzxMatch[1]);
      if (pageHistoryMatch) params.append('pageHistory', pageHistoryMatch[1]);

      const submitResponse = await fetch(formSubmitUrl, {
        method: 'POST',
        body: params,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      return NextResponse.json({
        success: submitResponse.ok,
        status: submitResponse.status
      });
    }

    // --- MODE 2: GÉNÉRATION (et soumission optionnelle) ---
    if (!apiKey || !formUrl) {
      return NextResponse.json({ error: 'Missing apiKey or formUrl' }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey });

    // 1. Fetch Google Form HTML
    const response = await fetch(formUrl);
    const html = await response.text();
    const $ = cheerio.load(html);

    // 2. Extract FB_PUBLIC_LOAD_DATA_
    const scriptTag = $('script').filter((_, el) => {
      return $(el).html()?.includes('var FB_PUBLIC_LOAD_DATA_ =') || false;
    }).html();

    if (!scriptTag) {
      return NextResponse.json({ error: 'Cannot parse Google Form data' }, { status: 500 });
    }

    const jsonStringMatch = scriptTag.match(/var FB_PUBLIC_LOAD_DATA_ = (\[.*\]);/s);
    if (!jsonStringMatch) {
      return NextResponse.json({ error: 'Failed to extract form JSON' }, { status: 500 });
    }

    const formData = JSON.parse(jsonStringMatch[1]);
    const formTitle = formData[8] || 'Google Form';
    const formDescription = formData[0] || '';
    
    // Parse Questions
    const questionsList = formData[1]?.[1] || [];
    const questions: any[] = [];
    
    questionsList.forEach((q: any) => {
      const qTitle = q[1];
      const qType = q[3]; 
      const qData = q[4]?.[0];
      if (!qData) return;
      
      const entryId = qData[0];
      const optionsData = qData[1] || [];
      const options = optionsData.map((opt: any) => opt[0]);

      if (qTitle && entryId) {
        questions.push({
          title: qTitle,
          type: qType,
          entryId: `entry.${entryId}`,
          options: options.length > 0 ? options : null
        });
      }
    });

    // 3. Generate Persona
    const personaPrompt = `
      Tu dois créer un persona fictif qui va remplir ce formulaire : "${formTitle}".
      Instructions globales de l'utilisateur : ${instructions}
      Historique des profils (pour éviter les doublons) : ${JSON.stringify(personaHistory)}
      
      Tâche : Génère un profil (Âge, Genre, Poste, Humeur, Biais) complètement différent des précédents.
      Renvoie juste 2 ou 3 phrases décrivant le profil.
    `;

    const personaRes = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: personaPrompt }],
      temperature: 0.9,
    });
    const persona = personaRes.choices[0].message.content || 'Un utilisateur classique';

    // 4. Generate Answers based on Persona
    const answersPrompt = `
      Formulaire : ${formTitle}
      Description : ${formDescription}
      
      Ton profil : ${persona}
      
      Questions :
      ${JSON.stringify(questions, null, 2)}
      
      Tâche :
      Réponds à TOUTES les questions en te basant sur ton profil. 
      Règle STRICTE : Renvoie UNIQUEMENT un objet JSON valide où les clés sont les "entryId" et les valeurs sont les textes exacts des réponses choisies (ou un tableau pour les Checkboxes).
      Exemple: { "entry.123": "Option A", "entry.456": "Ma réponse texte" }
    `;

    const answersRes = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: answersPrompt }],
      temperature: 0.8,
      response_format: { type: "json_object" }
    });

    const answersJson = JSON.parse(answersRes.choices[0].message.content || '{}');

    // Formatter pour l'affichage
    const formattedAnswers = questions.map(q => {
      const answer = answersJson[q.entryId];
      return {
        question: q.title,
        answer: Array.isArray(answer) ? answer.join(', ') : answer || 'Non répondu'
      };
    });

    // Si on demande juste la génération (Manual Mode)
    if (generateOnly) {
      return NextResponse.json({
        success: true, // Génération réussie
        persona,
        answers: formattedAnswers,
        answersRaw: answersJson, // Nécessaire pour la soumission future
        status: 200
      });
    }

    // --- MODE 3: GÉNÉRATION ET SOUMISSION (Auto Mode) ---
    const formActionMatch = html.match(/action="([^"]*formResponse)"/);
    if (!formActionMatch) {
      return NextResponse.json({ error: 'Cannot find form action URL' }, { status: 500 });
    }
    const formSubmitUrl = formActionMatch[1];

    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(answersJson)) {
      if (Array.isArray(value)) {
        value.forEach((v) => params.append(key, String(v)));
      } else {
        params.append(key, String(value));
      }
    }
    
    const fbzxMatch = html.match(/name="fbzx" value="([^"]*)"/);
    const pageHistoryMatch = html.match(/name="pageHistory" value="([^"]*)"/);
    if (fbzxMatch) params.append('fbzx', fbzxMatch[1]);
    if (pageHistoryMatch) params.append('pageHistory', pageHistoryMatch[1]);

    const submitResponse = await fetch(formSubmitUrl, {
      method: 'POST',
      body: params,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    return NextResponse.json({
      success: submitResponse.ok,
      persona,
      answers: formattedAnswers,
      status: submitResponse.status
    });

  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
