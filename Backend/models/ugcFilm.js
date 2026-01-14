// models/UgcFilm.js
import mongoose from 'mongoose';

const horaireSchema = new mongoose.Schema({
  start: { type: String, required: true },
  end: { type: String, required: true },
  version: String
}, { _id: false });

const seanceSchema = new mongoose.Schema({
  date: { type: String, required: true },
  horaires: [horaireSchema]
}, { _id: false });

const ugcFilmSchema = new mongoose.Schema({
  // Relation avec le cinéma (pivot principal)
  cinema_id: { type: Number, required: true, ref: 'Cinema' },
  cinema_name: String,
  
  // Identifiant unique : film_id + cinema_id
  film_id: { type: String, required: true },
  composite_id: { type: String, required: true, unique: true }, // "17892_57"
  
  // Métadonnées film
  title: { type: String, required: true },
  genre: String, // "Action, Drame"
  genres_array: [String], // ["Action", "Drame"]
  duration_minutes: Number,
  duration_display: String,
  director: String,
  actors: [String],
  rating: Number,
  release_date: String,
  
  // Séances (spécifiques à CE cinéma)
  seances: [seanceSchema],
  
  // Métadonnées scraping
  scraped_at: { type: Date, default: Date.now },
  week_number: Number,
  
  // Champ vectoriel (1024 dims)
  film_embedding: {
    type: [Number],
    required: true,
    validate: {
      validator: (arr) => arr.length === 1024,
      message: 'Embedding must have 1024 dimensions'
    }
  }
}, { timestamps: true });

// Index composés
ugcFilmSchema.index({ cinema_id: 1, film_id: 1 }, { unique: true });
ugcFilmSchema.index({ week_number: 1 });
ugcFilmSchema.index({ 'seances.date': 1 });
ugcFilmSchema.index({ genres_array: 1 });
ugcFilmSchema.index({ duration_minutes: 1 });

// Middleware pour générer composite_id avant sauvegarde
ugcFilmSchema.pre('save', function(next) {
  this.composite_id = `${this.film_id}_${this.cinema_id}`;
  next();
});

export default mongoose.model('UgcFilm', ugcFilmSchema);