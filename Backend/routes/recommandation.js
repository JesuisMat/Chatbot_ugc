import express from 'express';
import llmService from '../services/llmService.js';
import cinemaService from '../services/cinemaService.js';
import conversationService from '../services/conversationService.js';
import { z } from 'zod';

const router = express.Router();

// Validation du body
const recommendationSchema = z.object({
  message: z.string().min(3, 'Le message doit contenir au moins 3 caractères'),
  code_postal: z.string().regex(/^\d{5}$/, 'Code postal invalide (5 chiffres requis)').optional(),
  session_id: z.string().uuid().optional() // Support de la session de conversation
});

/**
 * POST /api/conversation/start
 * Crée une nouvelle session de conversation
 */
router.post('/conversation/start', async (req, res) => {
  try {
    const session_id = await conversationService.createSession();

    res.json({
      status: 'success',
      session_id,
      message: 'Session créée avec succès'
    });
  } catch (error) {
    console.error('❌ Erreur création session:', error);
    res.status(500).json({
      status: 'error',
      message: 'Erreur lors de la création de la session'
    });
  }
});

/**
 * POST /api/recommendation
 * Body: { message: string, code_postal?: string, session_id?: string }
 */
router.post('/recommendation', async (req, res) => {
  try {
    // Validation
    const validated = recommendationSchema.parse(req.body);

    console.log('\n🎬 === REQUÊTE API ===');
    console.log('Body:', validated);

    // Gestion de la session
    let session_id = validated.session_id;
    let conversation = null;

    if (session_id) {
      // Récupérer la conversation existante
      conversation = await conversationService.getConversation(session_id);

      if (!conversation) {
        console.log('⚠️ Session introuvable, création d\'une nouvelle');
        session_id = await conversationService.createSession();
        conversation = await conversationService.getConversation(session_id);
      }
    } else {
      // Créer une nouvelle session
      session_id = await conversationService.createSession();
      conversation = await conversationService.getConversation(session_id);
    }

    // Ajouter le message utilisateur à l'historique
    await conversationService.addMessage(session_id, 'user', validated.message);

    // Traitement via le LLM Service
    const result = await llmService.processUserRequest(
      validated.message,
      validated.code_postal,
      conversation // Passer l'historique au LLM
    );

    // Réponse selon le résultat
    if (result.needsMoreInfo) {
      // Sauvegarder la réponse du bot
      await conversationService.addMessage(session_id, 'assistant', result.message);

      return res.status(200).json({
        status: 'needs_info',
        message: result.message,
        session_id,
        extractedInfo: result.extractedInfo
      });
    }

    if (!result.success) {
      // Sauvegarder la réponse du bot
      await conversationService.addMessage(session_id, 'assistant', result.message);

      return res.status(200).json({
        status: 'error',
        message: result.message,
        session_id,
        extractedInfo: result.extractedInfo
      });
    }

    // Sauvegarder la recommandation dans l'historique
    await conversationService.addMessage(
      session_id,
      'assistant',
      result.recommendation,
      {
        preferences: result.extractedInfo,
        cinemas: result.cinemas
      }
    );

    // Mettre à jour les préférences de la session
    if (result.extractedInfo && result.extractedInfo.code_postal) {
      await conversationService.updatePreferences(session_id, {
        code_postal: result.extractedInfo.code_postal,
        genre: result.extractedInfo.genre,
        acteurs: result.extractedInfo.acteurs,
        realisateur: result.extractedInfo.realisateur
      });
    }

    // Succès
    res.json({
      status: 'success',
      message: result.recommendation,
      session_id,
      data: {
        preferences: result.extractedInfo,
        cinemas: result.cinemas
      }
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        status: 'validation_error',
        errors: error.errors
      });
    }

    console.error('❌ Erreur route:', error);
    res.status(500).json({
      status: 'error',
      message: 'Une erreur est survenue lors du traitement de votre demande.'
    });
  }
});

/**
 * GET /api/cinemas/:codePostal
 * Récupère les cinémas d'un code postal
 */
router.get('/cinemas/:codePostal', async (req, res) => {
  try {
    const { codePostal } = req.params;
    
    // Validation
    if (!/^\d{5}$/.test(codePostal)) {
      return res.status(400).json({
        status: 'error',
        message: 'Code postal invalide (5 chiffres requis)'
      });
    }
    
    const cinemas = await cinemaService.findByPostalCode(codePostal);
    
    res.json({
      status: 'success',
      count: cinemas.length,
      data: cinemas
    });
    
  } catch (error) {
    console.error('❌ Erreur récupération cinémas:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * GET /api/cinemas
 * Liste tous les cinémas (pour debug)
 */
router.get('/cinemas', async (req, res) => {
  try {
    const cinemas = await cinemaService.getAllCinemas();
    
    res.json({
      status: 'success',
      count: cinemas.length,
      data: cinemas
    });
    
  } catch (error) {
    console.error('❌ Erreur récupération cinémas:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

export default router;