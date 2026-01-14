import axios from 'axios';

class EmbeddingService {
  constructor() {
    this.ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    this.embeddingModel = 'mxbai-embed-large'; // 1024 dimensions
  }

  /**
   * Génère un embedding pour un texte donné
   * @param {string} text - Texte à vectoriser
   * @returns {Promise<number[]>} - Vecteur de 1024 dimensions
   */
  async generateEmbedding(text) {
    try {
      const response = await axios.post(
        `${this.ollamaUrl}/api/embeddings`,
        {
          model: this.embeddingModel,
          prompt: text
        },
        {
          timeout: 30000 // 30 secondes max
        }
      );

      const embedding = response.data.embedding;

      if (!Array.isArray(embedding) || embedding.length !== 1024) {
        throw new Error(`Invalid embedding dimensions: ${embedding?.length} (expected 1024)`);
      }

      return embedding;

    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        console.error('❌ Impossible de se connecter à Ollama. Est-il bien démarré ?');
        console.error(`   Vérifiez que Ollama tourne sur ${this.ollamaUrl}`);
        console.error(`   Commande: ollama pull ${this.embeddingModel}`);
      } else if (error.response?.status === 404) {
        console.error(`❌ Modèle ${this.embeddingModel} non trouvé.`);
        console.error(`   Installez-le avec: ollama pull ${this.embeddingModel}`);
      } else {
        console.error('❌ Erreur génération embedding:', error.message);
      }
      throw error;
    }
  }

  /**
   * Génère des embeddings pour plusieurs textes (batch)
   * @param {string[]} texts - Liste de textes
   * @returns {Promise<number[][]>} - Liste d'embeddings
   */
  async generateEmbeddings(texts) {
    const embeddings = [];

    for (const text of texts) {
      const embedding = await this.generateEmbedding(text);
      embeddings.push(embedding);

      // Petit délai pour ne pas surcharger Ollama
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return embeddings;
  }

  /**
   * Vérifie que le modèle d'embedding est disponible
   * @returns {Promise<boolean>}
   */
  async checkModelAvailability() {
    try {
      const response = await axios.get(`${this.ollamaUrl}/api/tags`);
      const models = response.data.models || [];
      const hasModel = models.some(m => m.name.includes(this.embeddingModel));

      if (!hasModel) {
        console.warn(`⚠️  Modèle ${this.embeddingModel} non trouvé`);
        console.warn(`   Installez-le avec: ollama pull ${this.embeddingModel}`);
        return false;
      }

      console.log(`✅ Modèle d'embedding ${this.embeddingModel} disponible`);
      return true;

    } catch (error) {
      console.error('❌ Impossible de vérifier la disponibilité du modèle:', error.message);
      return false;
    }
  }
}

export default new EmbeddingService();
