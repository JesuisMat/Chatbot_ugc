import scraperTool from './tools/scraperTool.js';

async function test() {
  console.log('🧪 Test du scraper UGC optimisé...\n');
  
  // Test avec Bercy (ID 42) ou Les Halles (ID 10)
  const cinemaId = '42';
  
  console.log(`Test scraping cinéma ID: ${cinemaId}\n`);
  
  const result = await scraperTool.scrapeUGCCinema(cinemaId);
  
  console.log('\n📊 RÉSULTAT:');
  console.log('- Success:', result.success);
  console.log('- Méthode:', result.method);
  console.log('- Titre:', result.title);
  
  if (result.filmCount !== undefined) {
    console.log('- Films trouvés:', result.filmCount);
  }
  
  console.log('- Caractères:', result.charCount);
  console.log('- Tokens estimés:', result.estimatedTokens);
  
  console.log('\n--- CONTENU EXTRAIT ---');
  console.log(result.content);
  
  console.log('\n✅ Test terminé');
}

test().catch(console.error);