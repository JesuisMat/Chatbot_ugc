
// backend/models/cinema.js
import mongoose from 'mongoose';

const cinemaSchema = new mongoose.Schema({
  _id: String,
  id: Number,
  nom: String,
  Nom: String,
  url_google_maps: String,
  adresse: String,
  Adresse: String,
  code_postal: {
    type: String,
    index: true
  },
  Code_postal: {
    type: String,
    index: true
  },
  ville: String,
  Ville: String
}, {
  collection: 'cinemas',
  timestamps: false,
  strict: false
});

// ⭐ Index composé pour recherches géographiques
cinemaSchema.index({ Code_postal: 1, Ville: 1 });

const Cinema = mongoose.model('cinemas', cinemaSchema);

export default Cinema;