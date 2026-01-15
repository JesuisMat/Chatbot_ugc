<template>
  <transition name="fade">
    <div
      v-if="show"
      class="rounded-lg p-4 mb-4 flex items-start gap-3 shadow-md"
      :class="typeClass"
      role="alert"
    >
      <!-- Icône -->
      <div class="flex-shrink-0">
        <svg
          v-if="type === 'error'"
          class="w-5 h-5"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fill-rule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            clip-rule="evenodd"
          />
        </svg>
        <svg
          v-else-if="type === 'warning'"
          class="w-5 h-5"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fill-rule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
            clip-rule="evenodd"
          />
        </svg>
        <svg
          v-else-if="type === 'info'"
          class="w-5 h-5"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fill-rule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clip-rule="evenodd"
          />
        </svg>
        <svg
          v-else
          class="w-5 h-5"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fill-rule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clip-rule="evenodd"
          />
        </svg>
      </div>

      <!-- Contenu -->
      <div class="flex-1">
        <h3 v-if="title" class="font-semibold mb-1">{{ title }}</h3>
        <p class="text-sm">{{ message }}</p>
      </div>

      <!-- Bouton fermer -->
      <button
        v-if="dismissible"
        @click="dismiss"
        class="flex-shrink-0 hover:opacity-70 transition-opacity"
        aria-label="Fermer"
      >
        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path
            fill-rule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clip-rule="evenodd"
          />
        </svg>
      </button>
    </div>
  </transition>
</template>

<script setup>
import { ref, computed, watch } from 'vue';

const props = defineProps({
  type: {
    type: String,
    default: 'error', // 'error', 'warning', 'info', 'success'
    validator: (val) => ['error', 'warning', 'info', 'success'].includes(val)
  },
  title: {
    type: String,
    default: ''
  },
  message: {
    type: String,
    required: true
  },
  dismissible: {
    type: Boolean,
    default: true
  },
  modelValue: {
    type: Boolean,
    default: true
  },
  autoDismiss: {
    type: Number,
    default: 0 // 0 = pas de fermeture auto, sinon durée en ms
  }
});

const emit = defineEmits(['update:modelValue', 'dismiss']);

const show = ref(props.modelValue);

// Classes CSS dynamiques
const typeClass = computed(() => {
  const classes = {
    error: 'bg-red-50 text-red-800 border border-red-200',
    warning: 'bg-yellow-50 text-yellow-800 border border-yellow-200',
    info: 'bg-blue-50 text-blue-800 border border-blue-200',
    success: 'bg-green-50 text-green-800 border border-green-200'
  };
  return classes[props.type];
});

// Synchroniser avec v-model
watch(() => props.modelValue, (newVal) => {
  show.value = newVal;
});

watch(show, (newVal) => {
  emit('update:modelValue', newVal);
});

// Auto-dismiss
if (props.autoDismiss > 0) {
  setTimeout(() => {
    dismiss();
  }, props.autoDismiss);
}

// Méthode de fermeture
const dismiss = () => {
  show.value = false;
  emit('dismiss');
};
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
