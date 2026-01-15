// Backend/services/conversationService.js
import Conversation from '../models/conversation.js';
import { v4 as uuidv4 } from 'uuid';

class ConversationService {
  /**
   * Crée une nouvelle session de conversation
   */
  async createSession() {
    const session_id = uuidv4();
    const conversation = new Conversation({
      session_id,
      messages: [],
      user_preferences: {}
    });
    await conversation.save();
    console.log(`✅ Nouvelle session créée: ${session_id}`);
    return session_id;
  }

  /**
   * Récupère une conversation existante
   */
  async getConversation(session_id) {
    try {
      const conversation = await Conversation.findOne({ session_id }).lean();
      if (!conversation) {
        console.log(`⚠️ Session ${session_id} introuvable`);
        return null;
      }
      return conversation;
    } catch (error) {
      console.error('❌ Erreur récupération conversation:', error);
      return null;
    }
  }

  /**
   * Ajoute un message à la conversation
   */
  async addMessage(session_id, role, content, metadata = {}) {
    try {
      const conversation = await Conversation.findOne({ session_id });

      if (!conversation) {
        throw new Error(`Session ${session_id} introuvable`);
      }

      conversation.messages.push({
        role,
        content,
        timestamp: new Date(),
        metadata
      });

      conversation.last_interaction = new Date();
      await conversation.save();

      console.log(`📝 Message ajouté à ${session_id} (${role})`);
      return conversation;
    } catch (error) {
      console.error('❌ Erreur ajout message:', error);
      throw error;
    }
  }

  /**
   * Met à jour les préférences utilisateur
   */
  async updatePreferences(session_id, preferences) {
    try {
      const conversation = await Conversation.findOne({ session_id });

      if (!conversation) {
        throw new Error(`Session ${session_id} introuvable`);
      }

      // Merge des préférences existantes avec les nouvelles
      conversation.user_preferences = {
        ...conversation.user_preferences,
        ...preferences
      };

      conversation.last_interaction = new Date();
      await conversation.save();

      console.log(`✏️ Préférences mises à jour pour ${session_id}`);
      return conversation;
    } catch (error) {
      console.error('❌ Erreur mise à jour préférences:', error);
      throw error;
    }
  }

  /**
   * Récupère l'historique des messages formaté pour le LLM
   */
  getMessageHistory(conversation, limit = 10) {
    if (!conversation || !conversation.messages) {
      return [];
    }

    // Retourne les N derniers messages
    return conversation.messages
      .slice(-limit)
      .map(msg => ({
        role: msg.role,
        content: msg.content
      }));
  }

  /**
   * Nettoie les conversations inactives (appelé périodiquement)
   */
  async cleanupOldConversations(daysOld = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await Conversation.deleteMany({
        last_interaction: { $lt: cutoffDate }
      });

      console.log(`🧹 ${result.deletedCount} conversations supprimées (>${daysOld} jours)`);
      return result.deletedCount;
    } catch (error) {
      console.error('❌ Erreur nettoyage conversations:', error);
      return 0;
    }
  }

  /**
   * Supprime une conversation spécifique
   */
  async deleteConversation(session_id) {
    try {
      await Conversation.deleteOne({ session_id });
      console.log(`🗑️ Session ${session_id} supprimée`);
    } catch (error) {
      console.error('❌ Erreur suppression conversation:', error);
      throw error;
    }
  }
}

export default new ConversationService();
