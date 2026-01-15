<script setup>
const movies = [
  { id: 1, title: 'FATHER MOTHER SISTER BROTHER', label: 'UGC AIMÉ', img: 'https://placehold.co/300x450/222/white?text=FMSB' },
  { id: 2, title: 'MA FRÈRE', label: null, img: 'https://placehold.co/300x450/444/white?text=MA+FRERE' },
  { id: 3, title: 'LES ÉCHOS DU PASSÉ', label: null, img: 'https://placehold.co/300x450/222/white?text=ECHOS' },
  { id: 4, title: 'LES LUMIÈRES DE NEW YORK', label: null, img: 'https://placehold.co/300x450/444/white?text=NY+LIGHTS' },
]
</script>

<template>
  <section class="mt-24 max-w-7xl mx-auto px-4 pb-20">
    <h2 class="text-3xl font-black uppercase italic mb-6">FILMS</h2>
    
    <div class="flex space-x-8 border-b border-gray-200 mb-8 text-sm font-bold uppercase">
      <button class="border-b-4 border-[#00B5E2] pb-2 text-[#00B5E2]">Nouveautés</button>
      <button class="pb-2 text-gray-500 hover:text-black">À l'affiche</button>
      <button class="pb-2 text-gray-500 hover:text-black">En famille</button>
    </div>

    <div class="grid grid-cols-2 md:grid-cols-4 gap-6">
      <div v-for="movie in movies" :key="movie.id" class="group cursor-pointer">
        <div class="relative aspect-[2/3] overflow-hidden rounded-lg mb-3 shadow-md">
          <img :src="movie.img" class="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
          <div v-if="movie.label" class="absolute top-2 left-2 bg-[#001C4F] text-white text-[10px] font-bold px-2 py-1 rounded-sm uppercase italic">
            {{ movie.label }}
          </div>
        </div>
        <h3 class="font-bold text-sm uppercase leading-tight group-hover:text-blue-600">{{ movie.title }}</h3>
      </div>
    </div>
  </section>
</template>