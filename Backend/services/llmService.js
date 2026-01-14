import axios from 'axios';
import cinemaService from './cinemaService.js';
import embeddingService from './embeddingService.js';
import UgcFilm from '../models/ugcFilm.js';

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

    // ÉTAPE 1.3 : Génération de la recommandation personnalisée via RAG
    const recommendation = await this._generateRecommendation(
      userInput,
      extractedInfo,
      cinemas
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
   * Recherche vectorielle RAG : trouve les films pertinents via similarity search
   */
  async _searchRelevantFilms(preferences, cinemaIds, topK = 10) {
    try {
      console.log('🔍 Recherche vectorielle RAG...');
      console.log('   - Cinémas:', cinemaIds);
      console.log('   - Préférences:', preferences);

      // 1. Construire la requête texte basée sur les préférences
      const queryText = this._buildQueryText(preferences);
      console.log('   - Query text:', queryText);

      // 2. Générer l'embedding de la requête
      const queryEmbedding = await embeddingService.generateEmbedding(queryText);

      // 3. Recherche vectorielle dans MongoDB
      // On utilise $lookup si nécessaire, mais ici on fait une recherche simple
      const pipeline = [
        // Filtre par cinémas
        {
          $match: {
            cinema_id: { $in: cinemaIds.map(id => parseInt(id)) }
          }
        },
        // Ajoute un champ calculé de similarité cosinus
        {
          $addFields: {
            similarity: {
              $let: {
                vars: {
                  dotProduct: {
                    $reduce: {
                      input: { $range: [0, 1024] },
                      initialValue: 0,
                      in: {
                        $add: [
                          "$$value",
                          {
                            $multiply: [
                              { $arrayElemAt: ["$film_embedding", "$$this"] },
                              { $arrayElemAt: [queryEmbedding, "$$this"] }
                            ]
                          }
                        ]
                      }
                    }
                  }
                },
                in: "$$dotProduct"
              }
            }
          }
        },
        // Trie par similarité décroissante
        { $sort: { similarity: -1 } },
        // Limite aux top-K résultats
        { $limit: topK },
        // Projette uniquement les champs nécessaires
        {
          $project: {
            film_embedding: 0,  // Exclut l'embedding pour alléger
            __v: 0
          }
        }
      ];

      const relevantFilms = await UgcFilm.aggregate(pipeline);

      console.log(`   ✅ ${relevantFilms.length} films trouvés par RAG`);
      if (relevantFilms.length > 0) {
        console.log(`   📊 Similarités: ${relevantFilms[0].similarity.toFixed(4)} (max) → ${relevantFilms[relevantFilms.length-1].similarity.toFixed(4)} (min)`);
      }

      return relevantFilms;

    } catch (error) {
      console.error('❌ Erreur recherche vectorielle RAG:', error);
      // Fallback : retourne tous les films des cinémas
      return await UgcFilm.find({
        cinema_id: { $in: cinemaIds.map(id => parseInt(id)) }
      }).limit(topK).lean();
    }
  }

  /**
   * Construit la requête texte pour l'embedding basée sur les préférences
   */
  _buildQueryText(preferences) {
    const parts = [];

    if (preferences.genre) {
      parts.push(`Genre: ${preferences.genre}`);
    }

    if (preferences.realisateur) {
      parts.push(`Réalisateur: ${preferences.realisateur}`);
    }

    if (preferences.acteurs && preferences.acteurs.length > 0) {
      parts.push(`Acteurs: ${preferences.acteurs.join(', ')}`);
    }

    if (preferences.duree_max) {
      parts.push(`Durée maximale: ${preferences.duree_max} minutes`);
    }

    if (preferences.mots_cles && preferences.mots_cles.length > 0) {
      parts.push(`Mots-clés: ${preferences.mots_cles.join(', ')}`);
    }

    // Si aucune préférence, requête générique
    if (parts.length === 0) {
      return "Film populaire de qualité avec bonne note";
    }

    return parts.join('\n');
  }

  /**
   * ÉTAPE 1.3 : Génération de la recommandation finale (avec RAG)
   */
  async _generateRecommendation(userInput, preferences, cinemas) {
    console.log(`🧠 Génération recommandation avec RAG + LLM`);
    console.log(`   - Cinémas: ${cinemas.length}`);
    console.log(`   - Préférences:`, preferences);

    // ÉTAPE RAG : Recherche vectorielle des films pertinents
    const cinemaIds = cinemas.map(c => c._id || c.id);
    const relevantFilms = await this._searchRelevantFilms(preferences, cinemaIds, 10);

    if (relevantFilms.length === 0) {
      return "Désolé, aucun film ne correspond à vos critères dans les cinémas trouvés. Pourriez-vous élargir vos préférences ?";
    }

    // Formater les films pour le LLM (structure légère)
    const filmsForPrompt = relevantFilms.map(film => ({
      title: film.title,
      genre: film.genre,
      duration_minutes: film.duration_minutes,
      duration_display: film.duration_display,
      director: film.director,
      actors: film.actors,
      rating: film.rating,
      cinema_id: film.cinema_id,
      cinema_name: film.cinema_name,
      seances: film.seances,
      similarity_score: film.similarity
    }));

    console.log(`   📊 ${filmsForPrompt.length} films sélectionnés par RAG`);

    const systemPrompt = `Tu es un assistant de recommandation de films UGC.

PRÉFÉRENCES UTILISATEUR:
${JSON.stringify({
  genre: preferences.genre || null,
  duree_max_minutes: preferences.duree_max || null,
  acteurs: preferences.acteurs || [],
  realisateur: preferences.realisateur || null,
  mots_cles: preferences.mots_cles || []
}, null, 2)}

FILMS PERTINENTS (sélectionnés par recherche vectorielle RAG):
${JSON.stringify(filmsForPrompt, null, 2)}

INSTRUCTIONS DE MATCHING:
1. CONTEXTE RAG:
   - Les films ci-dessus ont été pré-sélectionnés par recherche vectorielle sémantique
   - Le champ 'similarity_score' indique la pertinence (plus élevé = plus pertinent)
   - Ces films matchent déjà sémantiquement avec les préférences utilisateur

2. TON RÔLE:
   a) Vérifie les contraintes strictes (durée max, séances disponibles)
   b) Priorise les films avec similarity_score élevé ET bon rating
   c) Sélectionne les 2-3 MEILLEURS films

3. FORMATAGE des recommandations:
   📽️ **[Titre du film]** ([durée]) - Note: [rating]/5
   🎭 Genre: [genre]
   👤 Réalisateur: [director]
   ⭐ Pourquoi: [explication du match avec les préférences]

   📍 Où: [cinema_name]
   🕐 Séances: [liste des 3-4 prochaines séances avec dates complètes]

4. Si AUCUN film ne correspond strictement:
   - Propose les films les plus proches (similarity_score élevé)
   - Explique l'écart avec les critères
   - Suggère d'élargir les préférences

RÈGLES IMPORTANTES:
- Utilise le similarity_score comme indicateur de pertinence
- Sois précis sur les horaires (date + heure)
- Ne recommande QUE des films avec séances disponibles
- Reste concis et direct`;

    // Log le prompt pour debug
    console.log('📝 Taille du prompt système:', systemPrompt.length, 'caractères');
    console.log('📝 Nombre de films RAG:', filmsForPrompt.length);

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