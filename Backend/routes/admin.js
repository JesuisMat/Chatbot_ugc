import express from 'express';
import weeklyUpdateService from '../services/weeklyUpdateService.js';
import UgcFilm from '../models/ugcFilm.js';
import Cinema from '../models/cinema.js';

const router = express.Router();

/**
 * POST /api/admin/update-ugc
 * Déclenche le scraping complet + génération embeddings + upsert DB
 *
 * Body (optionnel):
 * {
 *   "cinema_ids": ["57", "42"] // Pour tests, sinon scrape TOUS les cinémas
 * }
 */
router.post('/update-ugc', async (req, res) => {
  try {
    const { cinema_ids } = req.body;

    console.log('\n📞 Requête admin: update UGC database');
    if (cinema_ids) {
      console.log(`   Mode test: ${cinema_ids.length} cinéma(s) spécifié(s)`);
    } else {
      console.log('   Mode complet: TOUS les cinémas UGC');
    }

    const result = await weeklyUpdateService.updateUgcDatabase({
      cinemaIds: cinema_ids
    });

    res.json({
      success: true,
      message: 'Mise à jour terminée avec succès',
      ...result
    });

  } catch (error) {
    console.error('❌ Erreur update UGC:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * POST /api/admin/quick-update
 * Scraping rapide d'1-2 cinémas pour tests
 *
 * Body:
 * {
 *   "cinema_ids": ["57"]
 * }
 */
router.post('/quick-update', async (req, res) => {
  try {
    const { cinema_ids } = req.body;

    if (!cinema_ids || cinema_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'cinema_ids requis (array de 1-2 IDs)'
      });
    }

    const result = await weeklyUpdateService.quickUpdate(cinema_ids);

    res.json({
      success: true,
      message: 'Quick update terminé',
      ...result
    });

  } catch (error) {
    console.error('❌ Erreur quick update:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/admin/stats
 * Statistiques de la base vectorielle
 */
router.get('/stats', async (req, res) => {
  try {
    const totalFilms = await UgcFilm.countDocuments();
    const totalCinemas = await Cinema.countDocuments();

    // Groupby par cinéma
    const filmsByCinema = await UgcFilm.aggregate([
      {
        $group: {
          _id: '$cinema_id',
          cinema_name: { $first: '$cinema_name' },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Groupby par semaine
    const filmsByWeek = await UgcFilm.aggregate([
      {
        $group: {
          _id: '$week_number',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: -1 } }
    ]);

    // Films les mieux notés
    const topRatedFilms = await UgcFilm.find()
      .sort({ rating: -1 })
      .limit(10)
      .select('title rating director cinema_name')
      .lean();

    res.json({
      success: true,
      statistics: {
        total_films: totalFilms,
        total_cinemas: totalCinemas,
        top_cinemas: filmsByCinema,
        films_by_week: filmsByWeek,
        top_rated_films: topRatedFilms
      }
    });

  } catch (error) {
    console.error('❌ Erreur stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/admin/clear-all
 * ⚠️  Supprime TOUTES les données UgcFilm (pour reset complet)
 */
router.delete('/clear-all', async (req, res) => {
  try {
    const { confirm } = req.body;

    if (confirm !== 'YES_DELETE_ALL') {
      return res.status(400).json({
        success: false,
        error: 'Confirmation requise: { "confirm": "YES_DELETE_ALL" }'
      });
    }

    const result = await UgcFilm.deleteMany({});

    res.json({
      success: true,
      message: `${result.deletedCount} films supprimés`
    });

  } catch (error) {
    console.error('❌ Erreur clear all:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/admin/sample-film/:composite_id
 * Récupère un film avec son embedding (pour debug)
 */
router.get('/sample-film/:composite_id', async (req, res) => {
  try {
    const film = await UgcFilm.findOne({ composite_id: req.params.composite_id }).lean();

    if (!film) {
      return res.status(404).json({
        success: false,
        error: 'Film non trouvé'
      });
    }

    res.json({
      success: true,
      film: {
        ...film,
        embedding_preview: film.film_embedding?.slice(0, 5), // Seulement les 5 premiers
        embedding_length: film.film_embedding?.length
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
