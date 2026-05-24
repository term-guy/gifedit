<script setup lang="ts">
defineProps<{
  title: string;
  content: string;
}>();
</script>

<template>
  <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
    <h2 class="text-xl font-semibold mb-3">{{ title }}</h2>
    <p class="text-gray-600 dark:text-gray-400">{{ content }}</p>
  </div>
</template>
