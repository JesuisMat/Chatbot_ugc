import axios from 'axios';
import mcpClient from './mcpClient.js';
import cinemaService from './cinemaService.js';

class LLMService {
  constructor() {
    this.ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    this.model = process.env.OLLAMA_MODEL || 'qwen2.5:3b';
  }
  
  /**
   * Point d'entrée principal : Traite la requête utilisateur
   */
  async processUserRequest(userInput, providedPostalCode = null) {
    console.log('\n🎬 === NOUVELLE REQUÊTE ===');
    console.log('Message:', userInput);
    console.log('Code postal fourni:', providedPostalCode);
    
    // ÉTAPE 1 : Extraction des informations avec le LLM
    const extractedInfo = await this._extractUserPreferences(userInput, providedPostalCode);
    
    console.log('📊 Informations extraites:', JSON.stringify(extractedInfo, null, 2));
    
    // ÉTAPE 1.1 : Vérification code postal
    if (!extractedInfo.code_postal) {
      return {
        success: false,
        needsMoreInfo: true,
        message: "Pour vous aider au mieux, pourriez-vous m'indiquer votre code postal ? Vous pouvez également préciser vos préférences : genre de film, durée souhaitée, acteurs ou réalisateurs favoris.",
        extractedInfo
      };
    }
    
    // ÉTAPE 1.2 : Recherche des cinémas
    const cinemas = await cinemaService.findByPostalCode(extractedInfo.code_postal);
    
    if (cinemas.length === 0) {
      return {
        success: false,
        message: `Désolé, aucun cinéma UGC trouvé pour le code postal ${extractedInfo.code_postal}. Les cinémas UGC sont principalement situés dans les grandes villes françaises. Pourriez-vous vérifier votre code postal ?`,
        extractedInfo
      };
    }
    
    console.log(`🎥 ${cinemas.length} cinéma(s) trouvé(s)`);
    
    // ÉTAPE 1.2.1 : Scraping via MCP
    const scrapingResult = await this._scrapeViaMCP(cinemas);
    
    if (!scrapingResult.success) {
      return {
        success: false,
        message: "Désolé, je n'ai pas pu récupérer les informations des cinémas. Veuillez réessayer dans quelques instants.",
        error: scrapingResult.error
      };
    }
    
    // ÉTAPE 1.3 : Génération de la recommandation personnalisée
    console.log('📄 Contenu scrapé:', `${scrapingResult.content.length} caractères`);
    console.log('📄 Aperçu (premiers 500 chars):', scrapingResult.content.substring(0, 500));

    const recommendation = await this._generateRecommendation(
      userInput,
      extractedInfo,
      cinemas,
      scrapingResult.content
    );
    
    return {
      success: true,
      extractedInfo,
      cinemas: cinemas.map(c => ({
        id: c._id || c.id,
        nom: c.nom || c.Nom,
        adresse: c.adresse || c.Adresse,
        ville: c.ville || c.Ville,
        code_postal: c.code_postal || c.Code_postal
      })),
      recommendation
    };
  }
  
  /**
   * ÉTAPE 1 : Extraction structurée des préférences utilisateur
   */
  async _extractUserPreferences(userInput, providedPostalCode) {
    const systemPrompt = `Tu es un assistant spécialisé dans l'extraction d'informations de requêtes utilisateur.

Ton rôle : analyser la requête et extraire les informations suivantes au format JSON strict :
{
  "code_postal": "string ou null (5 chiffres)",
  "genre": "string ou null (action, comédie, drame, thriller, science-fiction, animation, etc.)",
  "duree_max": "number ou null (en minutes)",
  "acteurs": ["string"] ou [],
  "realisateur": "string ou null",
  "mots_cles": ["string"] ou []
}

Règles :
- Si une information n'est pas mentionnée, retourne null ou []
- Le code postal doit être extrait même s'il est écrit avec des espaces
- Pour la durée, convertis en minutes (ex: "2h" → 120, "court" → 90, "long" → null)
- Sois flexible sur les synonymes (ex: "film court" → duree_max: 90)
- Les codes postaux français sont 5 chiffres (ex: 75001, 92100)

${providedPostalCode ? `INFO IMPORTANTE: Le code postal ${providedPostalCode} a été fourni directement.` : ''}

Exemples :
Requête: "Je cherche un film d'action à Paris 75001 avec Tom Cruise"
→ {"code_postal":"75001","genre":"action","duree_max":null,"acteurs":["Tom Cruise"],"realisateur":null,"mots_cles":[]}

Requête: "Un bon film de Christopher Nolan pas trop long"
→ {"code_postal":null,"genre":null,"duree_max":120,"acteurs":[],"realisateur":"Christopher Nolan","mots_cles":["bon"]}

Réponds UNIQUEMENT avec le JSON, sans commentaire ni markdown.`;

    try {
      const response = await this._callOllama([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userInput }
      ]);
      
      // Parse le JSON retourné
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const extracted = JSON.parse(jsonMatch[0]);
        
        // Override avec le code postal fourni si présent
        if (providedPostalCode) {
          extracted.code_postal = providedPostalCode;
        }
        
        return extracted;
      }
      
      throw new Error('Format JSON invalide dans la réponse LLM');
      
    } catch (error) {
      console.error('❌ Erreur extraction préférences:', error);
      return {
        code_postal: providedPostalCode || null,
        genre: null,
        duree_max: null,
        acteurs: [],
        realisateur: null,
        mots_cles: []
      };
    }
  }
  
  /**
   * ÉTAPE 1.2.1 : Scraping via MCP
   */
  async _scrapeViaMCP(cinemas) {
    try {
      // Les cinémas en base ont un champ _id (string)
      const cinemaIds = cinemas.map(c => c._id || c.id);

      console.log(`🔍 Scraping ${cinemaIds.length} cinéma(s) via MCP...`);
      console.log('Cinema IDs:', cinemaIds);

      // Utilise l'outil multiple pour optimiser
      const result = await mcpClient.scrapeMultipleCinemas(cinemaIds);

      return result;

    } catch (error) {
      console.error('❌ Erreur scraping MCP:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * ÉTAPE 1.3 : Génération de la recommandation finale
   */
  async _generateRecommendation(userInput, preferences, cinemas, scrapedContent) {
    console.log(`🧠 Génération recommandation avec LLM`);
    console.log(`   - Contenu scrapé: ${scrapedContent.length} caractères`);
    console.log(`   - Cinémas: ${cinemas.length}`);
    console.log(`   - Préférences:`, preferences);

    // Parse le JSON scrapé
    let filmsData;
    try {
      filmsData = JSON.parse(scrapedContent);
    } catch (error) {
      console.error('❌ Erreur parsing JSON scrapé:', error);
      return "Désolé, une erreur s'est produite lors du traitement des données cinéma.";
    }

    const systemPrompt = `Tu es un assistant de recommandation de films UGC.

PRÉFÉRENCES UTILISATEUR:
${JSON.stringify({
  genre: preferences.genre || null,
  duree_max_minutes: preferences.duree_max || null,
  acteurs: preferences.acteurs || [],
  realisateur: preferences.realisateur || null,
  mots_cles: preferences.mots_cles || []
}, null, 2)}

DONNÉES CINÉMAS ET FILMS (JSON structuré):
${JSON.stringify(filmsData, null, 2)}

INSTRUCTIONS DE MATCHING:
1. ANALYSE les préférences utilisateur et les films disponibles
2. FILTRE les films selon ces critères (dans l'ordre de priorité):
   a) Genre: si spécifié, le film.genre doit contenir le genre demandé
   b) Durée: si duree_max spécifiée, film.duration_minutes <= duree_max
   c) Acteurs: si spécifiés, au moins un acteur doit être dans film.actors
   d) Réalisateur: si spécifié, film.director doit correspondre
   e) Note: privilégie les films avec rating >= 3.5

3. SÉLECTIONNE les 2-3 MEILLEURS films qui correspondent

4. Pour chaque film recommandé, FORMATE ainsi:
   📽️ **[Titre du film]** ([durée]) - Note: [rating]/5
   🎭 Genre: [genre]
   👤 Réalisateur: [director]
   ⭐ Pourquoi: [explication courte du match avec les préférences]

   📍 Où: [cinema_name]
   🕐 Séances: [liste des 3-4 prochaines séances avec dates]

5. Si AUCUN film ne correspond parfaitement:
   - Propose les films les plus proches des critères
   - Explique pourquoi ils ne correspondent pas exactement
   - Suggère de modifier les préférences

RÈGLES IMPORTANTES:
- Sois précis sur les horaires (date + heure de début)
- Ne recommande QUE des films avec des séances disponibles
- Reste concis et direct
- Ne propose jamais de film sans séance programmée`;

    // Log le prompt pour debug
    console.log('📝 Taille du prompt système:', systemPrompt.length, 'caractères');
    console.log('📝 Nombre de cinémas:', filmsData.cinemas?.length || (filmsData.cinema_id ? 1 : 0));

    try {
      const response = await this._callOllama([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userInput }
      ], {
        temperature: 0.5,  // Réduit pour plus de précision
        num_ctx: 16384
      });

      console.log('✅ Réponse LLM reçue:', response.substring(0, 200));

      return response;

    } catch (error) {
      console.error('❌ Erreur génération recommandation:', error);
      return "Désolé, une erreur s'est produite lors de la génération de ma recommandation. Pourriez-vous reformuler votre demande ?";
    }
  }
  
  /**
   * Appel API Ollama
   */
  async _callOllama(messages, options = {}) {
    try {
      const response = await axios.post(
        `${this.ollamaUrl}/api/chat`,
        {
          model: this.model,
          messages,
          stream: false,
          options: {
            temperature: options.temperature || 0.3,
            num_ctx: options.num_ctx || 8192,
            ...options
          }
        },
        {
          timeout: 120000 // 2 minutes max
        }
      );
      
      return response.data.message.content;
      
    } catch (error) {
      if (error.response) {
        console.error('❌ Erreur Ollama:', error.response.data);
      } else if (error.code === 'ECONNREFUSED') {
        console.error('❌ Impossible de se connecter à Ollama. Est-il bien démarré ?');
      } else {
        console.error('❌ Erreur réseau Ollama:', error.message);
      }
      throw error;
    }
  }
}

export default new LLMService();