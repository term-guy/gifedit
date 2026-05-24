<script setup lang="ts">
import { RouterLink } from "vue-router";
</script>

<template>
  <div
    class="flex flex-col items-center justify-center min-h-[50vh] text-center"
  >
    <h1 class="text-8xl font-bold text-primary-600 dark:text-primary-400">
      404
    </h1>
    <p class="mt-4 text-2xl font-semibold text-gray-700 dark:text-gray-300">
      Page not found
    </p>
    <p class="mt-2 text-gray-500 dark:text-gray-400">
      The page you're looking for doesn't exist.
    </p>
    <RouterLink
      to="/"
      class="mt-8 px-6 py-3 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 transition-colors"
    >
      Go home
    </RouterLink>
  </div>
</template>
