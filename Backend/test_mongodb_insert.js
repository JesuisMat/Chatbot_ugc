// Test direct d'insertion MongoDB
import 'dotenv/config';
import './models/connection.js';
import UgcFilm from './models/ugcFilm.js';

async function testInsert() {
  console.log('🧪 Test d\'insertion MongoDB\n');

  try {
    // Attendre que la connexion soit établie
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 1. Compter les documents existants
    const countBefore = await UgcFilm.countDocuments();
    console.log(`📊 Documents avant insertion: ${countBefore}`);

    // 2. Créer un film de test avec embedding de 1024 dims
    const testEmbedding = Array(1024).fill(0).map(() => Math.random());

    const testFilm = {
      cinema_id: 999,
      cinema_name: "Test Cinema",
      film_id: "TEST123",
      composite_id: "TEST123_999",

      title: "Film de Test",
      genre: "Action, Drame",
      genres_array: ["Action", "Drame"],
      duration_minutes: 120,
      duration_display: "2h00",
      director: "Test Director",
      actors: ["Actor 1", "Actor 2"],
      rating: 4.5,
      release_date: "2026-01-14",

      seances: [{
        date: "2026-01-15",
        horaires: [{
          start: "20:00",
          end: "22:00",
          version: "VF"
        }]
      }],

      week_number: 202603,
      scraped_at: new Date(),
      film_embedding: testEmbedding
    };

    console.log('\n📝 Film de test:');
    console.log(`   - Composite ID: ${testFilm.composite_id}`);
    console.log(`   - Titre: ${testFilm.title}`);
    console.log(`   - Embedding dims: ${testFilm.film_embedding.length}`);

    // 3. Insérer via bulkWrite
    console.log('\n🔄 Insertion via bulkWrite...');
    const result = await UgcFilm.bulkWrite([{
      updateOne: {
        filter: { composite_id: testFilm.composite_id },
        update: { $set: testFilm },
        upsert: true
      }
    }]);

    console.log('✅ BulkWrite résultat:');
    console.log(`   - upsertedCount: ${result.upsertedCount}`);
    console.log(`   - modifiedCount: ${result.modifiedCount}`);
    console.log(`   - matchedCount: ${result.matchedCount}`);

    // 4. Vérifier que le document existe
    const countAfter = await UgcFilm.countDocuments();
    console.log(`\n📊 Documents après insertion: ${countAfter}`);

    // 5. Récupérer le document
    const inserted = await UgcFilm.findOne({ composite_id: testFilm.composite_id });

    if (inserted) {
      console.log('\n✅ Document retrouvé en base:');
      console.log(`   - _id: ${inserted._id}`);
      console.log(`   - composite_id: ${inserted.composite_id}`);
      console.log(`   - title: ${inserted.title}`);
      console.log(`   - film_embedding length: ${inserted.film_embedding.length}`);
    } else {
      console.log('\n❌ Document NON retrouvé en base!');
    }

    // 6. Nettoyer (supprimer le test)
    console.log('\n🗑️  Suppression du film de test...');
    await UgcFilm.deleteOne({ composite_id: testFilm.composite_id });
    const countFinal = await UgcFilm.countDocuments();
    console.log(`✅ Documents finaux: ${countFinal}`);

    console.log('\n✅ Test terminé avec succès!');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Erreur durant le test:');
    console.error(error);
    process.exit(1);
  }
}

testInsert();
