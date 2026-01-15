<template>
  <div class="relative w-full h-[500px] overflow-hidden bg-black">
    <img 
  src="/315082.HR_.webp" 
  class="w-full h-full object-cover opacity-60"
  error="(e) => e.target.src = 'https://placehold.co/1200x500/001C4F/white?text=AVATAR+DE+FEU+ET+DE+CENDRES'"
/>
    
    <div class="absolute inset-0 flex flex-col justify-center max-w-7xl mx-auto px-4">
      <h1 class="text-white text-6xl font-black uppercase tracking-tighter mb-2 italic">AVATAR</h1>
      <p class="text-white text-3xl font-light uppercase tracking-widest mb-8">DE FEU ET DE CENDRES</p>
      <button class="bg-[#E10028] text-white font-bold px-8 py-3 rounded-sm uppercase text-sm w-max hover:bg-red-700 transition">
        Réserver
      </button>
    </div>

    <div class="absolute -bottom-1 left-0 right-0">
      <div class="max-w-4xl mx-auto bg-white p-6 shadow-xl rounded-t-lg flex items-center space-x-4 border-b-4 border-[#001C4F]">
        <div class="flex-1">
          <p class="text-sm font-bold mb-2 uppercase text-gray-700">Les séances dans mon cinéma</p>
          <select class="w-full border border-gray-300 rounded p-2 text-sm text-gray-600 outline-none">
            <option>Choisir un cinéma</option>
            <option>UGC Ciné Cité Les Halles</option>
            <option>UGC Ciné Cité Bassins à Flot</option>
          </select>
        </div>
        <button class="mt-7 flex items-center space-x-2 bg-gray-100 px-4 py-2 rounded text-[#001C4F] font-bold text-xs uppercase border border-gray-200 hover:bg-gray-200">
          <span>📍 À proximité</span>
        </button>
      </div>
    </div>
  </div>
</template>