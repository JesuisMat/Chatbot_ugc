// Backend/models/conversation.js
import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'assistant'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  metadata: {
    preferences: Object,
    cinemas: Array
  }
}, { _id: false });

const conversationSchema = new mongoose.Schema({
  session_id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  messages: [messageSchema],
  user_preferences: {
    code_postal: String,
    genre: String,
    acteurs: [String],
    realisateur: String
  },
  last_interaction: {
    type: Date,
    default: Date.now
  },
  created_at: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Index pour nettoyer les vieilles conversations (1 jour)
conversationSchema.index({ last_interaction: 1 }, { expireAfterSeconds: 86400 });

const Conversation = mongoose.model('Conversation', conversationSchema);

export default Conversation;
