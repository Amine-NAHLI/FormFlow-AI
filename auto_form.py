import os
import sys
import time
import csv
from dotenv import load_dotenv
from openai import OpenAI
from playwright.sync_api import sync_playwright

load_dotenv()
API_KEY = os.getenv("OPENAI_API_KEY")

if not API_KEY:
    print("Erreur: OPENAI_API_KEY non trouvée dans le fichier .env")
    sys.exit(1)

client = OpenAI(api_key=API_KEY)

def analyze_form(url):
    print("Ouverture du navigateur pour l'analyse...")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(url)
        page.wait_for_load_state("networkidle")
        
        # Extraire tout le texte visible pour donner du contexte à l'IA
        form_text = page.evaluate("() => document.body.innerText")
        browser.close()
        
    print("Analyse par l'IA en cours...")
    prompt = f"""
    Voici le texte extrait d'un Google Form. 
    1. Quel est le thème ou le domaine principal de ce formulaire ?
    2. Résume brièvement le type de questions posées.
    
    Texte du formulaire :
    {form_text[:3000]}
    """
    
    response = client.chat.completions.create(
        model="gpt-4o-mini", # Utilisation d'un modèle rapide et performant
        messages=[{"role": "user", "content": prompt}],
        temperature=0.5
    )
    
    analysis = response.choices[0].message.content
    print("\n" + "="*50)
    print("=== Analyse du Formulaire ===")
    print("="*50)
    print(analysis)
    print("="*50 + "\n")
    return analysis

def fill_form_n_times(url, n, analysis_context):
    print(f"\nPréparation de {n} soumission(s)...")
    
    with sync_playwright() as p:
        print("Ouverture du navigateur pour l'analyse (en arrière-plan)...")
        # MODE HEADLESS = VRAI pour plus de vitesse
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()
        
        global_personas_history = []
        
        for i in range(1, n + 1):
            print(f"\n--- Soumission {i}/{n} ---")
            
            # --- GÉNÉRATION DU PERSONA ---
            persona_prompt = f"""
            Contexte global du formulaire : {analysis_context}
            
            Tu dois créer un persona (profil détaillé d'un répondant fictif) qui va remplir ce formulaire sur la thématique RH.
            Voici les profils que tu as DÉJÀ générés (pour éviter de les répéter) :
            {global_personas_history}
            
            Tâche :
            Génère un profil RADICALEMENT DIFFÉRENT des précédents. 
            Définis : 
            1. Son âge, son genre, son poste et son ancienneté.
            2. Ses opinions générales : Est-il très satisfait ? Très critique ? Neutre ? Cynique ? Enthousiaste ?
            3. Ses biais de réponse : A-t-il tendance à répondre aux extrêmes (1, 2, 5) ou au milieu (3, 4) ?
            
            Sois très créatif et hyper réaliste. Renvoie uniquement une description textuelle détaillée de cette personne (environ 4-5 phrases).
            """
            
            print("  -> Génération d'un nouveau profil (Persona) unique...")
            try:
                res_persona = client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[{"role": "user", "content": persona_prompt}],
                    temperature=0.9
                )
                current_persona = res_persona.choices[0].message.content.strip()
                global_personas_history.append(current_persona)
                
                # On affiche un résumé court du profil généré
                print(f"  [Profil adopté] : {current_persona.replace(chr(10), ' ')[:120]}...\n")
            except Exception as e:
                print(f"  [!] Erreur lors de la génération du persona : {e}")
                current_persona = "Un employé standard, objectif, qui répond sincèrement."
            
            page.goto(url)
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(500) # Délai très court
            
            # Historique des réponses pour garder une cohérence logique (ex: âge vs expérience)
            submission_history = []
            submission_data = {} # Pour l'export Excel/CSV
            
            # Boucle pour gérer les formulaires à plusieurs pages
            while True:
                page.wait_for_timeout(500) # Laisser le DOM se rafraîchir après une transition
                
                # Récupérer toutes les sections de questions (listitems)
                listitems = page.locator('div[role="listitem"]')
                count = listitems.count()
                
                for j in range(count):
                    item = listitems.nth(j)
                    item_text = item.inner_text().strip()
                    if not item_text:
                        continue
                    
                    # Chercher s'il y a des choix multiples ou des cases à cocher
                    radios = item.locator('div[role="radio"]')
                    checkboxes = item.locator('div[role="checkbox"]')
                    
                    options_elements = None
                    is_radio = False
                    
                    if radios.count() > 0:
                        options_elements = radios
                        is_radio = True
                    elif checkboxes.count() > 0:
                        options_elements = checkboxes
                        
                    if options_elements:
                        options_text = []
                        options_map = {} # Pour stocker la correspondance texte -> élément cliquable
                        
                        for k in range(options_elements.count()):
                            opt = options_elements.nth(k)
                            # data-value contient exactement le texte de l'option sur Google Forms
                            val = opt.get_attribute("data-value")
                            if not val:
                                val = opt.get_attribute("aria-label") or opt.inner_text()
                            
                            clean_val = val.strip()
                            if clean_val:
                                options_text.append(clean_val)
                                options_map[clean_val] = opt
                        
                        q_type = "une seule réponse (bouton radio)" if is_radio else "plusieurs réponses possibles (cases à cocher)"
                        
                        # Demander à OpenAI de choisir intelligemment
                        history_str = "\n".join(submission_history) if submission_history else "Aucune réponse encore (c'est la première question)."
                        
                        prompt = f"""
                        Contexte global du formulaire : {analysis_context}
                        
                        RAPPEL TRÈS IMPORTANT : Tu simules UNE SEULE ET MÊME PERSONNE pour ce formulaire.
                        
                        Voici SON PROFIL DÉTAILLÉ (Adopte complètement sa personnalité et ses opinions) :
                        {current_persona}
                        
                        Voici ce que cette personne a déjà répondu aux questions précédentes :
                        {history_str}
                        
                        Question actuelle : {item_text}
                        Options disponibles : {options_text}
                        Type de question : {q_type}.
                        
                        Tâche : En te glissant totalement dans la peau de ce profil, choisis une option logique pour cette personne. 
                        N'hésite pas à utiliser les extrêmes de l'échelle (1, 2, 5) si cela correspond à sa personnalité et ses opinions. Ne réponds pas toujours 3 ou 4.
                        Règle stricte : Renvoie UNIQUEMENT le texte exact de l'option choisie parmi la liste, sans aucun autre mot. 
                        Si c'est des cases à cocher, tu peux en renvoyer plusieurs séparées par un point-virgule (;).
                        """
                        
                        try:
                            res = client.chat.completions.create(
                                model="gpt-4o-mini",
                                messages=[{"role": "user", "content": prompt}],
                                temperature=0.8
                            )
                            
                            chosen_raw = res.choices[0].message.content.strip()
                            chosen_options = [opt.strip() for opt in chosen_raw.split(';')]
                            
                            q_display = item_text.split('\n')[0][:60]
                            print(f"Question : {q_display}...")
                            print(f"  -> IA choisit : {chosen_options}")
                            
                            # Ajouter à l'historique pour les prochaines questions
                            submission_history.append(f"- Question: {q_display} | Réponse: {chosen_raw}")
                            submission_data[q_display] = chosen_raw # Enregistrement pour l'export Excel
                            
                            # Clic robuste
                            for choice in chosen_options:
                                clicked = False
                                for key, opt_locator in options_map.items():
                                    # Comparaison insensible à la casse
                                    if choice.lower() in key.lower() or key.lower() in choice.lower():
                                        opt_locator.click(force=True) # force=True au cas où un élément invisible bloque le clic
                                        clicked = True
                                        break
                                
                                if not clicked:
                                    print(f"  [!] Impossible de trouver et cliquer sur : '{choice}'")
                                    
                        except Exception as e:
                            print(f"  [!] Erreur lors de la génération ou du clic : {e}")
                
                # Vérifier s'il y a un bouton "Suivant" (formulaire multi-pages)
                next_btn = page.locator('div[role="button"]:has-text("Suivant"), span:has-text("Suivant")').last
                submit_btn = page.locator('div[role="button"]:has-text("Envoyer"), div[role="button"]:has-text("Submit"), span:has-text("Envoyer")').last
                
                if next_btn.count() > 0 and next_btn.is_visible():
                    print("-> Page suivante...")
                    next_btn.click()
                    page.wait_for_timeout(500) # Attente très courte
                elif submit_btn.count() > 0 and submit_btn.is_visible():
                    submit_btn.click()
                    print(f"-> Formulaire {i} soumis avec succès !")
                    page.wait_for_timeout(1000) # Attendre l'enregistrement
                    
                    # --- SAUVEGARDE DANS LE FICHIER CSV (EXCEL) ---
                    fichier_csv = 'reponses.csv'
                    file_exists = os.path.isfile(fichier_csv)
                    
                    try:
                        with open(fichier_csv, 'a', newline='', encoding='utf-8-sig') as csvfile:
                            fieldnames = list(submission_data.keys())
                            writer = csv.DictWriter(csvfile, fieldnames=fieldnames, delimiter=';', extrasaction='ignore')
                            
                            if not file_exists:
                                writer.writeheader()
                                
                            writer.writerow(submission_data)
                        print(f"-> Réponses sauvegardées dans '{fichier_csv}'.")
                    except Exception as e:
                        print(f"-> [!] Erreur lors de la sauvegarde CSV : {e}")
                    # ----------------------------------------------
                    
                    break # Sortir de la boucle while (passage au formulaire suivant)
                else:
                    print("-> [!] Bouton Suivant ou Envoyer introuvable. Fin de cette itération.")
                    break
                
        browser.close()
        print("\nOpération terminée !")

if __name__ == "__main__":
    print("="*50)
    print("🤖 AUTOMATISATION GOOGLE FORM AVEC IA 🤖")
    print("="*50)
    
    if len(sys.argv) > 1:
        form_url = sys.argv[1]
    else:
        # Demander le lien à l'utilisateur s'il n'est pas passé en argument
        form_url = input("Veuillez entrer le lien de votre Google Form : ")
        if not form_url:
            print("Aucun lien fourni, annulation.")
            sys.exit(1)
    if "docs.google.com/forms" not in form_url:
        print("Attention : L'URL ne ressemble pas à un lien Google Form standard.")
        
    print("\n--- PHASE 1 : ANALYSE ---")
    context = analyze_form(form_url)
    
    valider = input("Appuyez sur 'Entrée' pour valider cette analyse et continuer (ou tapez 'non' pour annuler) : ")
    if valider.lower() == 'non':
        sys.exit(0)
    
    print("\n--- PHASE 2 : REMPLISSAGE ---")
    try:
        n_str = input("Combien de fois voulez-vous remplir ce formulaire de manière aléatoire/intelligente ? : ")
        nb_soumissions = int(n_str)
        if nb_soumissions > 0:
            fill_form_n_times(form_url, nb_soumissions, context)
        else:
            print("Nombre invalide.")
    except ValueError:
        print("Veuillez entrer un nombre entier valide.")
