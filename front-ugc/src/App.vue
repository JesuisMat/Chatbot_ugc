<script setup>
import { ref } from 'vue'
import Navbar from './components/Navbar.vue'
import Hero from './components/Hero.vue'
import MovieGrid from './components/MovieGrid.vue'
import Chatbot from './components/Chatbot.vue'

const isChatOpen = ref(false)
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <Navbar />
    <main>
      <Hero />
      <MovieGrid />
    </main>

    <button 
      @click="isChatOpen = !isChatOpen"
      class="fixed bottom-6 right-6 w-14 h-14 bg-[#E10028] rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform z-50 text-white"
    >
      <span v-if="!isChatOpen" class="text-2xl">💬</span>
      <span v-else class="text-2xl font-bold">×</span>
    </button>

    <Chatbot v-if="isChatOpen" />
  </div>
</template>