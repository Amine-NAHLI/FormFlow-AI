import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const apiKey = formData.get('apiKey') as string;
    const instructions = formData.get('instructions') as string;

    if (!file || !apiKey) {
      return NextResponse.json({ error: 'Fichier ou clé API manquant' }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey });

    // 1. Upload file to OpenAI
    const uploadedFile = await openai.files.create({
      file: file,
      purpose: 'assistants',
    });

    // 2. Create Assistant
    const assistant = await openai.beta.assistants.create({
      name: "FormFlow Data Analyst",
      instructions: `Tu es un Data Scientist expert (niveau Master SPSS/SmartPLS).
Ton but est d'analyser ce fichier CSV (qui contient des réponses à un formulaire).
Instructions supplémentaires de l'utilisateur : ${instructions || "Fais une analyse descriptive générale et trouve les corrélations principales."}

Règle stricte: Tu dois renvoyer UNIQUEMENT un objet JSON valide (aucun texte avant ou après, pas de markdown \`\`\`json) avec cette structure exacte :
{
  "summary": "Résumé textuel de ton analyse en français (2-3 paragraphes clairs et pros)",
  "statistics": [
    { "name": "Ex: Age moyen", "value": "24.5", "interpretation": "La population est jeune" }
  ],
  "correlations": [
    { "var1": "Nom Colonne 1", "var2": "Nom Colonne 2", "coefficient": 0.85, "significance": "Forte corrélation positive" }
  ]
}
Tu DOIS utiliser l'outil Code Interpreter (Python) pour lire le fichier, nettoyer les données si besoin, et calculer les vraies statistiques (moyennes, écarts-types, corrélations de Pearson) avant de générer le JSON. Ne devine jamais les chiffres, calcule-les.`,
      tools: [{ type: "code_interpreter" }],
      model: "gpt-4o-mini", // Utilisation du modèle mini pour la rapidité
    });

    // 3. Create Thread & Run
    const thread = await openai.beta.threads.create({
      messages: [
        {
          role: "user",
          content: "Analyse ce fichier de données et donne-moi le résultat au format JSON strict comme demandé.",
          attachments: [{ file_id: uploadedFile.id, tools: [{ type: "code_interpreter" }] }]
        }
      ]
    });

    const run = await openai.beta.threads.runs.createAndPoll(
      thread.id,
      { assistant_id: assistant.id }
    );

    if (run.status === 'completed') {
      const messages = await openai.beta.threads.messages.list(thread.id);
      const lastMessage = messages.data[0];
      let content = '';
      if (lastMessage.content[0].type === 'text') {
        content = lastMessage.content[0].text.value;
      }

      // Cleanup
      // @ts-ignore
      await openai.beta.assistants.del(assistant.id);
      // @ts-ignore
      await openai.files.del(uploadedFile.id);

      // Clean markdown if present
      content = content.replace(/```json\n?|\n?```/g, '').trim();

      try {
        const resultJson = JSON.parse(content);
        return NextResponse.json({ success: true, data: resultJson });
      } catch (e) {
        console.error("JSON Parse error. Raw content:", content);
        return NextResponse.json({ error: "L'IA n'a pas renvoyé un JSON valide." }, { status: 500 });
      }

    } else {
      return NextResponse.json({ error: `L'analyse a échoué avec le statut: ${run.status}` }, { status: 500 });
    }

  } catch (error: any) {
    console.error("Analysis Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
