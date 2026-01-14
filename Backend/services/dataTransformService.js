import embeddingService from './embeddingService.js';

class DataTransformService {
  /**
   * Transforme les données scrapées (JSON structuré) en documents UgcFilm
   * @param {Object} scrapedData - Données JSON du scraper (format: {cinemas: [...]})
   * @returns {Promise<Array>} - Documents prêts pour l'insertion en DB
   */
  async transformScrapedData(scrapedData) {
    const weekNumber = this._getWeekNumber(new Date());
    const ugcFilms = [];

    console.log(`🔄 Transformation des données scrapées...`);
    console.log(`   - Semaine: ${weekNumber}`);

    // Parse le JSON si c'est une string
    const data = typeof scrapedData === 'string'
      ? JSON.parse(scrapedData)
      : scrapedData;

    // Gère les 2 formats : {cinemas: [...]} ou {cinema_id, films: [...]}
    const cinemas = data.cinemas || [data];

    for (const cinema of cinemas) {
      console.log(`\n🎬 Traitement cinéma ${cinema.cinema_id} (${cinema.cinema_name})`);
      console.log(`   - ${cinema.films?.length || 0} films à traiter`);

      for (const film of cinema.films || []) {
        try {
          // 1. Parse les genres (string → array)
          const genresArray = this._parseGenres(film.genre);

          // 2. Génère le texte pour l'embedding
          const embedText = this._prepareFilmText({
            title: film.title,
            director: film.director,
            actors: film.actors,
            genres: genresArray,
            duration_minutes: film.duration_minutes,
            rating: film.rating
          });

          // 3. Génère l'embedding
          console.log(`   📝 Génération embedding pour "${film.title}"...`);
          const embedding = await embeddingService.generateEmbedding(embedText);

          // 4. Construit le document
          const ugcFilmDoc = {
            cinema_id: cinema.cinema_id,
            cinema_name: cinema.cinema_name,
            film_id: film.film_id,
            composite_id: `${film.film_id}_${cinema.cinema_id}`,

            title: film.title,
            genre: film.genre,
            genres_array: genresArray,
            duration_minutes: film.duration_minutes,
            duration_display: film.duration_display,
            director: film.director,
            actors: film.actors || [],
            rating: film.rating,
            release_date: film.release_date,

            seances: film.seances,

            week_number: weekNumber,
            scraped_at: new Date(),
            film_embedding: embedding
          };

          ugcFilms.push(ugcFilmDoc);
          console.log(`   ✅ Film traité: ${film.title}`);

        } catch (error) {
          console.error(`   ❌ Erreur film ${film.title}:`, error.message);
          // Continue avec les autres films
        }
      }
    }

    console.log(`\n✅ ${ugcFilms.length} films transformés avec succès`);
    return ugcFilms;
  }

  /**
   * Parse les genres depuis une string
   * @param {string} genreString - "Action, Drame"
   * @returns {string[]} - ["Action", "Drame"]
   */
  _parseGenres(genreString) {
    if (!genreString) return [];
    return genreString
      .split(',')
      .map(g => g.trim())
      .filter(g => g.length > 0);
  }

  /**
   * Prépare le texte d'un film pour la vectorisation
   * @param {Object} film - Données du film
   * @returns {string} - Texte formaté pour l'embedding
   */
  _prepareFilmText(film) {
    const parts = [];

    parts.push(`Titre: ${film.title}`);

    if (film.genres && film.genres.length > 0) {
      parts.push(`Genres: ${film.genres.join(', ')}`);
    }

    if (film.director) {
      parts.push(`Réalisateur: ${film.director}`);
    }

    if (film.actors && film.actors.length > 0) {
      parts.push(`Acteurs: ${film.actors.slice(0, 5).join(', ')}`); // Max 5 acteurs
    }

    if (film.duration_minutes) {
      parts.push(`Durée: ${film.duration_minutes} minutes`);
    }

    if (film.rating) {
      parts.push(`Note: ${film.rating}/5`);
    }

    return parts.join('\n');
  }

  /**
   * Calcule le numéro de semaine (YYYYWW)
   * @param {Date} date
   * @returns {number} - Ex: 202603
   */
  _getWeekNumber(date) {
    const year = date.getFullYear();
    const firstDayOfYear = new Date(year, 0, 1);
    const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
    const week = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    return parseInt(`${year}${week.toString().padStart(2, '0')}`);
  }
}

export default new DataTransformService();
