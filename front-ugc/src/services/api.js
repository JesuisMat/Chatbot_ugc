// front-ugc/src/services/api.js
import axios from 'axios';

// Configuration de base
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Instance axios avec configuration par défaut
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000, // 2 minutes pour les requêtes LLM
  headers: {
    'Content-Type': 'application/json'
  }
});

// Intercepteur de requête (pour debug)
apiClient.interceptors.request.use(
  (config) => {
    console.log(`🌐 API Request: ${config.method.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('❌ API Request Error:', error);
    return Promise.reject(error);
  }
);

// Intercepteur de réponse
apiClient.interceptors.response.use(
  (response) => {
    console.log(`✅ API Response: ${response.config.url}`, response.data);
    return response;
  },
  (error) => {
    console.error('❌ API Response Error:', error.response?.data || error.message);

    // Gestion centralisée des erreurs
    if (error.response) {
      // Erreur de la réponse du serveur
      const { status, data } = error.response;

      if (status === 400) {
        throw new Error(data.message || 'Requête invalide');
      } else if (status === 404) {
        throw new Error('Ressource introuvable');
      } else if (status === 500) {
        throw new Error(data.message || 'Erreur serveur');
      }
    } else if (error.request) {
      // Pas de réponse du serveur
      throw new Error('Impossible de contacter le serveur. Vérifiez votre connexion.');
    }

    throw error;
  }
);

// ============================================
// API CHAT / RECOMMENDATIONS
// ============================================

/**
 * Crée une nouvelle session de conversation
 * @returns {Promise<{session_id: string}>}
 */
export const createConversation = async () => {
  try {
    const response = await apiClient.post('/conversation/start');
    return response.data;
  } catch (error) {
    console.error('❌ Erreur création conversation:', error);
    throw error;
  }
};

/**
 * Envoie un message au chatbot et récupère la recommandation
 * @param {Object} payload - { message: string, code_postal?: string, session_id?: string }
 * @returns {Promise<{status: string, message: string, session_id: string, data?: Object}>}
 */
export const sendChatMessage = async (payload) => {
  try {
    const response = await apiClient.post('/recommendation', payload);
    return response.data;
  } catch (error) {
    console.error('❌ Erreur envoi message:', error);
    throw error;
  }
};

// ============================================
// API CINEMAS
// ============================================

/**
 * Récupère les cinémas par code postal
 * @param {string} codePostal - Code postal sur 5 chiffres
 * @returns {Promise<Array>}
 */
export const getCinemasByPostalCode = async (codePostal) => {
  try {
    const response = await apiClient.get(`/cinemas/${codePostal}`);
    return response.data.data || [];
  } catch (error) {
    console.error('❌ Erreur récupération cinémas:', error);
    throw error;
  }
};

/**
 * Récupère tous les cinémas
 * @returns {Promise<Array>}
 */
export const getAllCinemas = async () => {
  try {
    const response = await apiClient.get('/cinemas');
    return response.data.data || [];
  } catch (error) {
    console.error('❌ Erreur récupération tous les cinémas:', error);
    throw error;
  }
};

// Export par défaut
export default {
  createConversation,
  sendChatMessage,
  getCinemasByPostalCode,
  getAllCinemas
};
