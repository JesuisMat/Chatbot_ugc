<script setup>
import { ref, onUpdated, onMounted, computed } from 'vue'
import { marked } from 'marked'
import { sendChatMessage } from '../services/api.js'
import LoadingSpinner from './LoadingSpinner.vue'
import ErrorAlert from './ErrorAlert.vue'

// Configuration de marked pour un rendu sûr
marked.setOptions({
  breaks: true,
  gfm: true
})

const messages = ref([
  {
    role: 'bot',
    text: 'Bonjour ! Comment puis-je vous aider aujourd\'hui ? 😊\n\nVous pouvez me demander des recommandations de films, des horaires de séances, ou me préciser vos préférences !',
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    isHtml: false
  }
])

// Suggestions pré-définies
const suggestions = [
  "Quel film puis-je aller voir ce soir ?",
  "Y'a t-il un bon film d'action ?",
  "Conseille-moi sur les dernières sorties"
]

const userMessage = ref('')
const chatContainer = ref(null)
const sessionId = ref(null) // Session de conversation
const isLoading = ref(false)
const error = ref(null)
const postalCode = ref('')
const showPostalCodeInput = ref(false)

// Auto-scroll
onUpdated(() => {
  if (chatContainer.value) {
    setTimeout(() => {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight
    }, 100)
  }
})

// Charger le session_id et code postal du localStorage
onMounted(() => {
  const storedSessionId = localStorage.getItem('ugc_session_id')
  const storedPostalCode = localStorage.getItem('ugc_postal_code')

  if (storedSessionId) {
    sessionId.value = storedSessionId
    console.log('📋 Session restaurée:', storedSessionId)
  }

  if (storedPostalCode) {
    postalCode.value = storedPostalCode
  }
})

// Parser markdown en HTML
const parseMarkdown = (text) => {
  return marked.parse(text || '')
}

// Envoyer un message à l'API
const sendMessage = async (textInput) => {
  const textToSend = textInput || userMessage.value
  if (!textToSend.trim()) return

  error.value = null

  // 1. Ajouter le message utilisateur
  const userMsg = {
    role: 'user',
    text: textToSend,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    isHtml: false
  }
  messages.value.push(userMsg)
  userMessage.value = ''

  // 2. Afficher l'indicateur de chargement
  isLoading.value = true

  try {
    // 3. Appeler l'API
    const payload = {
      message: textToSend,
      session_id: sessionId.value,
      code_postal: postalCode.value || undefined
    }

    console.log('📤 Envoi message:', payload)

    const response = await sendChatMessage(payload)

    console.log('📥 Réponse API:', response)

    // 4. Sauvegarder le session_id si nouveau
    if (response.session_id && response.session_id !== sessionId.value) {
      sessionId.value = response.session_id
      localStorage.setItem('ugc_session_id', response.session_id)
      console.log('💾 Session sauvegardée:', response.session_id)
    }

    // 5. Gérer la réponse selon le statut
    if (response.status === 'needs_info') {
      // Le bot demande plus d'infos (ex: code postal)
      addBotMessage(response.message, response)

      // Si le code postal est manquant, afficher l'input
      if (response.extractedInfo && !response.extractedInfo.code_postal) {
        showPostalCodeInput.value = true
      }
    } else if (response.status === 'success') {
      // Recommandation réussie
      addBotMessage(response.message, response)

      // Sauvegarder le code postal si fourni
      if (response.data?.preferences?.code_postal) {
        postalCode.value = response.data.preferences.code_postal
        localStorage.setItem('ugc_postal_code', response.data.preferences.code_postal)
        showPostalCodeInput.value = false
      }
    } else {
      // Erreur
      addBotMessage(response.message || 'Désolé, une erreur s\'est produite.', response)
    }

  } catch (err) {
    console.error('❌ Erreur envoi message:', err)
    error.value = err.message || 'Impossible de contacter le serveur'

    addBotMessage('Désolé, je rencontre un problème technique. Pouvez-vous réessayer ?')
  } finally {
    isLoading.value = false
  }
}

// Ajouter un message du bot
const addBotMessage = (text, response = null) => {
  const botMsg = {
    role: 'bot',
    text: text,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    isHtml: true, // Activer le rendu HTML/Markdown
    data: response?.data || null
  }
  messages.value.push(botMsg)
}

// Envoyer le code postal
const submitPostalCode = () => {
  if (postalCode.value && /^\d{5}$/.test(postalCode.value)) {
    localStorage.setItem('ugc_postal_code', postalCode.value)
    showPostalCodeInput.value = false
    sendMessage(`Mon code postal est ${postalCode.value}`)
  } else {
    error.value = 'Veuillez entrer un code postal valide (5 chiffres)'
  }
}

// Réinitialiser la conversation
const resetConversation = () => {
  localStorage.removeItem('ugc_session_id')
  localStorage.removeItem('ugc_postal_code')
  sessionId.value = null
  postalCode.value = ''
  messages.value = [
    {
      role: 'bot',
      text: 'Bonjour ! Comment puis-je vous aider aujourd\'hui ? 😊',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isHtml: false
    }
  ]
  error.value = null
}
</script>

<template>
  <div class="fixed bottom-24 right-6 w-[400px] h-[600px] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden z-50 border border-gray-100">
    <!-- Header -->
    <div class="bg-gradient-to-r from-[#001C4F] to-[#003082] p-4 flex items-center justify-between text-white">
      <div class="flex items-center space-x-3">
        <div class="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-xl">
          🤖
        </div>
        <div>
          <h3 class="font-bold text-sm">Assistant UGC</h3>
          <p class="text-blue-300 text-[10px]" :class="{ 'animate-pulse': isLoading }">
            {{ isLoading ? 'Réflexion en cours...' : 'En ligne' }}
          </p>
        </div>
      </div>
      <button
        @click="resetConversation"
        class="text-white/70 hover:text-white transition-colors"
        title="Nouvelle conversation"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd" />
        </svg>
      </button>
    </div>

    <!-- Messages -->
    <div ref="chatContainer" class="flex-1 p-4 bg-gradient-to-b from-gray-50 to-white overflow-y-auto space-y-4">
      <!-- Erreur globale -->
      <ErrorAlert
        v-if="error"
        :message="error"
        type="error"
        @dismiss="error = null"
        class="mb-2"
      />

      <!-- Messages -->
      <div v-for="(msg, index) in messages" :key="index"
           :class="['flex w-full animate-fade-in', msg.role === 'user' ? 'justify-end' : 'justify-start']">
        <div :class="['max-w-[85%] p-3 rounded-2xl text-sm shadow-md',
                    msg.role === 'user'
                      ? 'bg-gradient-to-r from-[#E10028] to-[#C70020] text-white rounded-tr-none'
                      : 'bg-white text-gray-800 rounded-tl-none border border-gray-200']">
          <!-- Contenu HTML (markdown) -->
          <div
            v-if="msg.isHtml"
            v-html="parseMarkdown(msg.text)"
            class="prose prose-sm max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-a:text-blue-600 prose-strong:text-gray-900"
          ></div>
          <!-- Contenu texte simple -->
          <p v-else class="whitespace-pre-wrap">{{ msg.text }}</p>

          <span class="text-[9px] mt-2 block opacity-70">{{ msg.time }}</span>
        </div>
      </div>

      <!-- Indicateur de chargement -->
      <div v-if="isLoading" class="flex justify-start">
        <div class="bg-white p-4 rounded-2xl rounded-tl-none shadow-md border border-gray-200">
          <LoadingSpinner size="sm" color="primary" text="L'assistant réfléchit..." />
        </div>
      </div>
    </div>

    <!-- Input Code Postal (conditionnel) -->
    <div v-if="showPostalCodeInput" class="px-4 py-3 bg-blue-50 border-t border-blue-100">
      <label class="text-xs text-blue-900 font-medium mb-2 block">
        Votre code postal (pour trouver les cinémas près de chez vous)
      </label>
      <div class="flex gap-2">
        <input
          v-model="postalCode"
          @keyup.enter="submitPostalCode"
          type="text"
          maxlength="5"
          placeholder="Ex: 75001"
          class="flex-1 px-3 py-2 text-sm border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
        />
        <button
          @click="submitPostalCode"
          class="bg-[#001C4F] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#003082] transition-colors"
        >
          OK
        </button>
      </div>
    </div>

    <!-- Suggestions -->
    <div class="px-4 py-2 bg-gray-50 flex flex-wrap gap-2 border-t border-gray-100">
      <button
        v-for="suggestion in suggestions"
        :key="suggestion"
        @click="sendMessage(suggestion)"
        :disabled="isLoading"
        class="text-[11px] bg-white border border-blue-200 text-blue-700 px-3 py-1.5 rounded-full hover:bg-blue-50 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {{ suggestion }}
      </button>
    </div>

    <!-- Input message -->
    <div class="p-4 bg-white border-t border-gray-200 flex items-center space-x-2">
      <input
        v-model="userMessage"
        @keyup.enter="sendMessage()"
        :disabled="isLoading"
        type="text"
        placeholder="Tapez votre message..."
        class="flex-1 bg-gray-100 border-none rounded-full px-5 py-3 text-sm focus:ring-2 focus:ring-[#001C4F] outline-none disabled:opacity-50"
      />
      <button
        @click="sendMessage()"
        :disabled="isLoading || !userMessage.trim()"
        class="bg-gradient-to-r from-[#E10028] to-[#C70020] text-white p-3 rounded-full hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 rotate-90" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in {
  animation: fade-in 0.3s ease-out;
}

/* Styles pour le contenu markdown */
:deep(.prose) {
  font-size: 0.875rem;
  line-height: 1.5;
}

:deep(.prose p) {
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
}

:deep(.prose h1, .prose h2, .prose h3) {
  margin-top: 1rem;
  margin-bottom: 0.5rem;
  font-weight: 600;
}

:deep(.prose ul, .prose ol) {
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
  padding-left: 1.5rem;
}

:deep(.prose a) {
  text-decoration: underline;
}

:deep(.prose a:hover) {
  text-decoration: none;
}

:deep(.prose code) {
  background-color: #f3f4f6;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.875em;
}

:deep(.prose strong) {
  font-weight: 600;
}
</style>
