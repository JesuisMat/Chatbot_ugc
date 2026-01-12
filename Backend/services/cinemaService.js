import Cinema from '../models/cinema.js';

class CinemaService {
  /**
   * Recherche des cinémas par code postal ou département
   * Accepte 2 chiffres (département) ou 5 chiffres (code postal complet)
   * Effectue une recherche par préfixe pour correspondre au département
   */
  async findByPostalCode(codePostal) {
    try {
      // Si c'est un département (2 chiffres), on cherche tous les codes postaux qui commencent par ces 2 chiffres
      // Si c'est un code postal complet (5 chiffres), on cherche aussi par préfixe (les 2 premiers chiffres)
      const departement = codePostal.substring(0, 2);

      // Utilisation de regex pour trouver tous les codes postaux qui commencent par le département
      // On cherche dans les deux champs possibles (code_postal et Code_postal) car la base peut avoir l'un ou l'autre
      const cinemas = await Cinema.find({
        $or: [
          { code_postal: new RegExp(`^${departement}`) },
          { Code_postal: new RegExp(`^${departement}`) }
        ]
      }).lean();

      console.log(`📍 ${cinemas.length} cinéma(s) trouvé(s) pour le département ${departement} (recherche: ${codePostal})`);
      return cinemas;

    } catch (error) {
      console.error('❌ Erreur recherche cinémas:', error);
      throw error;
    }
  }

  /**
   * Récupère un cinéma par son ID
   */
  async findById(cinemaId) {
    try {
      return await Cinema.findOne({ id: cinemaId }).lean();
    } catch (error) {
      console.error('❌ Erreur récupération cinéma:', error);
      throw error;
    }
  }

  /**
   * Recherche floue par ville ou nom
   */
  async searchByNameOrCity(query) {
    try {
      const regex = new RegExp(query, 'i');
      return await Cinema.find({
        $or: [
          { Nom: regex },
          { Ville: regex }
        ]
      }).limit(10).lean();
    } catch (error) {
      console.error('❌ Erreur recherche cinémas:', error);
      throw error;
    }
  }

  /**
   * Récupère tous les cinémas (pour debug)
   */
  async getAllCinemas() {
    try {
      return await Cinema.find().lean();
    } catch (error) {
      console.error('❌ Erreur récupération cinémas:', error);
      throw error;
    }
  }
}

export default new CinemaService();
