import UgcFilm from '../models/ugcFilm.js';
import Cinema from '../models/cinema.js';
import dataTransformService from './dataTransformService.js';
import mcpClient from './mcpClient.js';
import embeddingService from './embeddingService.js';

class WeeklyUpdateService {
  /**
   * Pipeline complet de mise à jour de la base vectorielle
   * @param {Object} options - Options de scraping
   * @returns {Promise<Object>} - Résumé de l'opération
   */
  async updateUgcDatabase(options = {}) {
    const startTime = Date.now();
    console.log('\n' + '='.repeat(60));
    console.log('🚀 DÉMARRAGE UPDATE HEBDOMADAIRE UGC');
    console.log('='.repeat(60) + '\n');

    try {
      // ÉTAPE 0 : Vérification du modèle d'embedding
      console.log("📦 Vérification du modèle d'embedding...");
      const modelAvailable = await embeddingService.checkModelAvailability();

      if (!modelAvailable) {
        throw new Error(
          `Modèle d'embedding non disponible. ` +
          `Installez-le avec: ollama pull mxbai-embed-large`
        );
      }

      // ÉTAPE 1 : Récupération de tous les cinémas UGC
      console.log('\n📍 ÉTAPE 1: Récupération des cinémas UGC...');
      const allCinemas = await Cinema.find().lean();
      console.log(`✅ ${allCinemas.length} cinémas trouvés en base`);

      // Filtre optionnel pour limiter le scope (utile pour les tests)
      let cinemasToScrape = allCinemas;
      if (options.cinemaIds && options.cinemaIds.length > 0) {
        cinemasToScrape = allCinemas.filter(c =>
          options.cinemaIds.includes(c._id) || options.cinemaIds.includes(String(c.id))
        );
        console.log(`⚠️  Mode test: seulement ${cinemasToScrape.length} cinéma(s) sélectionné(s)`);
      }

      // ÉTAPE 2 : Scraping via MCP (par batch pour éviter timeout)
      console.log('\n🕷️  ÉTAPE 2: Scraping des programmations...');
      const cinemaIds = cinemasToScrape.map(c => c._id || String(c.id));

      // Scraping par batch de 10 cinémas max (évite timeout + permet progression)
      const BATCH_SIZE = 10;
      const batches = [];
      for (let i = 0; i < cinemaIds.length; i += BATCH_SIZE) {
        batches.push(cinemaIds.slice(i, i + BATCH_SIZE));
      }

      console.log(`   📦 Découpage en ${batches.length} batch(s) de max ${BATCH_SIZE} cinémas`);

      let allScrapedData = { cinemas: [] };
      let batchNumber = 0;

      for (const batch of batches) {
        batchNumber++;
        console.log(`\n   🔄 Batch ${batchNumber}/${batches.length} (${batch.length} cinémas)...`);

        const scrapingResult = await mcpClient.scrapeMultipleCinemas(batch);

        if (!scrapingResult.success) {
          console.warn(`   ⚠️  Erreur batch ${batchNumber}: ${scrapingResult.error}`);
          continue; // Continue avec les autres batches
        }

        // Parse et merge les résultats
        try {
          const batchData = JSON.parse(scrapingResult.content);
          allScrapedData.cinemas.push(...batchData.cinemas);
          console.log(`   ✅ Batch ${batchNumber} OK: ${batchData.cinemas?.length || 0} cinémas`);
        } catch (error) {
          console.error(`   ❌ Erreur parsing batch ${batchNumber}:`, error.message);
        }
      }

      console.log(`\n✅ Scraping terminé: ${allScrapedData.cinemas.length} cinémas récupérés`);

      if (allScrapedData.cinemas.length === 0) {
        throw new Error('Aucun cinéma n\'a pu être scrapé');
      }

      // ÉTAPE 3 : Transformation + Génération embeddings
      console.log('\n🔄 ÉTAPE 3: Transformation et génération embeddings...');
      const ugcFilms = await dataTransformService.transformScrapedData(allScrapedData);

      console.log(`✅ ${ugcFilms.length} films transformés avec embeddings`);

      // ÉTAPE 4 : Upsert en base (bulkWrite pour performance)
      console.log('\n💾 ÉTAPE 4: Upsert en base de données...');
      console.log(`   - ${ugcFilms.length} films à upserter`);

      // Debug: afficher un exemple de film
      if (ugcFilms.length > 0) {
        console.log(`   📋 Exemple de document (${ugcFilms[0].composite_id}):`);
        console.log(`      - Titre: ${ugcFilms[0].title}`);
        console.log(`      - Embedding dims: ${ugcFilms[0].film_embedding?.length}`);
        console.log(`      - Cinema ID: ${ugcFilms[0].cinema_id}`);
      }

      const bulkOps = ugcFilms.map(film => ({
        updateOne: {
          filter: { composite_id: film.composite_id },
          update: { $set: film },
          upsert: true
        }
      }));

      console.log(`   🔄 Exécution bulkWrite...`);
      const result = await UgcFilm.bulkWrite(bulkOps, { ordered: false });

      console.log(`✅ Upsert terminé:`);
      console.log(`   - ${result.upsertedCount} films créés`);
      console.log(`   - ${result.modifiedCount} films mis à jour`);
      console.log(`   - ${result.matchedCount} films matchés`);

      // Vérification: compter les docs en base
      const totalInDb = await UgcFilm.countDocuments();
      console.log(`   📊 Total films en base: ${totalInDb}`);

      // ÉTAPE 5 : Nettoyage des films obsolètes (> 2 semaines)
      console.log('\n🗑️  ÉTAPE 5: Nettoyage des films obsolètes...');
      const currentWeek = ugcFilms[0]?.week_number;

      if (currentWeek) {
        const deleteResult = await UgcFilm.deleteMany({
          week_number: { $lt: currentWeek - 2 }
        });
        console.log(`✅ ${deleteResult.deletedCount} films obsolètes supprimés`);
      }

      // Résumé final
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log('\n' + '='.repeat(60));
      console.log('✅ UPDATE TERMINÉ AVEC SUCCÈS');
      console.log('='.repeat(60));
      console.log(`⏱️  Durée totale: ${duration}s`);
      console.log(`📊 Résumé:`);
      console.log(`   - Cinémas scrapés: ${cinemasToScrape.length}`);
      console.log(`   - Films traités: ${ugcFilms.length}`);
      console.log(`   - Films créés: ${result.upsertedCount}`);
      console.log(`   - Films mis à jour: ${result.modifiedCount}`);
      console.log('='.repeat(60) + '\n');

      return {
        success: true,
        cinemas_scraped: cinemasToScrape.length,
        films_processed: ugcFilms.length,
        films_created: result.upsertedCount,
        films_updated: result.modifiedCount,
        duration_seconds: parseFloat(duration),
        week_number: currentWeek
      };

    } catch (error) {
      console.error('\n' + '='.repeat(60));
      console.error('❌ ERREUR DANS UPDATE HEBDOMADAIRE');
      console.error('='.repeat(60));
      console.error(error);
      console.error('='.repeat(60) + '\n');

      throw error;
    }
  }

  /**
   * Mise à jour rapide (seulement 1-2 cinémas pour tests)
   * @param {string[]} cinemaIds - IDs des cinémas à scraper
   * @returns {Promise<Object>}
   */
  async quickUpdate(cinemaIds) {
    console.log(`🚀 Mode test rapide avec ${cinemaIds.length} cinéma(s)`);
    return this.updateUgcDatabase({ cinemaIds });
  }
}

export default new WeeklyUpdateService();
