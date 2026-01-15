<template>
  <div class="flex items-center justify-center" :class="containerClass">
    <div class="relative">
      <!-- Spinner animé -->
      <div
        class="animate-spin rounded-full border-t-2 border-b-2"
        :class="[
          sizeClass,
          colorClass
        ]"
      ></div>

      <!-- Point central -->
      <div
        class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
        :class="dotSizeClass"
      >
        <div class="rounded-full" :class="[dotClass, colorClass.replace('border-', 'bg-')]"></div>
      </div>
    </div>

    <!-- Texte optionnel -->
    <p v-if="text" class="ml-3 text-sm" :class="textColorClass">
      {{ text }}
    </p>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  size: {
    type: String,
    default: 'md', // 'sm', 'md', 'lg', 'xl'
    validator: (val) => ['sm', 'md', 'lg', 'xl'].includes(val)
  },
  color: {
    type: String,
    default: 'primary' // 'primary', 'red', 'white', 'gray'
  },
  text: {
    type: String,
    default: ''
  },
  centered: {
    type: Boolean,
    default: false
  }
});

// Classes dynamiques basées sur les props
const sizeClass = computed(() => {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  };
  return sizes[props.size];
});

const dotSizeClass = computed(() => {
  const dotSizes = {
    sm: 'w-1 h-1',
    md: 'w-2 h-2',
    lg: 'w-3 h-3',
    xl: 'w-4 h-4'
  };
  return dotSizes[props.size];
});

const dotClass = computed(() => {
  return dotSizeClass.value;
});

const colorClass = computed(() => {
  const colors = {
    primary: 'border-[#001C4F]',
    red: 'border-[#E10028]',
    white: 'border-white',
    gray: 'border-gray-400'
  };
  return colors[props.color] || colors.primary;
});

const textColorClass = computed(() => {
  const textColors = {
    primary: 'text-[#001C4F]',
    red: 'text-[#E10028]',
    white: 'text-white',
    gray: 'text-gray-600'
  };
  return textColors[props.color] || textColors.primary;
});

const containerClass = computed(() => {
  return props.centered ? 'min-h-[200px]' : '';
});
</script>

<style scoped>
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.animate-spin {
  animation: spin 1s linear infinite;
}
</style>
