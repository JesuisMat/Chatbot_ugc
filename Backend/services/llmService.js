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
        id: c.id,
        nom: c.Nom,
        adresse: c.Adresse,
        ville: c.Ville
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
      const cinemaIds = cinemas.map(c => c.id);
      
      console.log(`🔍 Scraping ${cinemaIds.length} cinéma(s) via MCP...`);
      
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
    const systemPrompt = `Tu es un conseiller cinéma expert et passionné.

PRÉFÉRENCES DE L'UTILISATEUR :
${JSON.stringify(preferences, null, 2)}

CINÉMAS DISPONIBLES :
${cinemas.map(c => `- ${c.Nom} (${c.Ville}) - ${c.Adresse}`).join('\n')}

FILMS ACTUELLEMENT À L'AFFICHE :
${scrapedContent}

Ta mission :
1. Analyser les films disponibles dans les cinémas
2. Recommander 2-3 films qui correspondent le mieux aux préférences de l'utilisateur
3. Expliquer pourquoi chaque film correspond (genre, acteurs, réalisateur, durée...)
4. Indiquer dans quel(s) cinéma(s) voir chaque film
5. Mentionner les horaires si disponibles dans les données

Format de réponse :
- Commence par une phrase d'accroche chaleureuse et personnalisée
- Pour chaque film recommandé :
  * Titre en gras
  * Pourquoi ce film correspond aux préférences
  * Où le voir (cinéma + adresse)
  * Horaires si disponibles
- Termine par une question ouverte pour affiner si besoin

Style :
- Sois enthousiaste mais naturel
- Utilise des emojis avec parcimonie (🎬 🎥 ⭐)
- Sois concis mais engageant
- Si aucun film ne correspond parfaitement, propose les meilleures alternatives en expliquant pourquoi

IMPORTANT : Si les données scrapées sont incomplètes ou illisibles, dis-le honnêtement et propose de consulter directement le site UGC.`;

    try {
      const response = await this._callOllama([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userInput }
      ], {
        temperature: 0.7,
        num_ctx: 16384
      });
      
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