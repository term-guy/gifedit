<script setup lang="ts">
import { ref, onMounted } from "vue";
import FeatureCard from "@/components/FeatureCard.vue";
import { useCounterStore } from "@/stores/counter";
import apiService, {
  API_URL,
  type Person,
  type Planet,
} from "@/services/api.service";

interface PersonWithHomeworldName extends Person {
  homeworldName: string;
}

const counter = useCounterStore();
const people = ref<PersonWithHomeworldName[]>([]);
const planets = ref<Planet[]>([]);
const isLoading = ref(false);
const error = ref<string | null>(null);

onMounted(async () => {
  try {
    isLoading.value = true;
    const [peopleData, planetsData] = await Promise.all([
      apiService.getPeople(),
      apiService.getPlanets(),
    ]);

    const planetMap: Record<string, string> = {};
    for (const planet of planetsData) {
      planetMap[`${API_URL}/planets/${planet.id}`] = planet.name;
    }

    for (const person of peopleData) {
      if (!planetMap[person.homeworld]) {
        const planetId = person.homeworld.split("/").filter(Boolean).pop();
        if (!planetId) {
          continue;
        }

        const planet = await apiService.getPlanet(planetId);
        planetMap[person.homeworld] = planet.name;
      }
    }

    people.value = peopleData.map((person) => ({
      ...person,
      homeworldName: planetMap[person.homeworld] || "Unknown",
    }));
    planets.value = planetsData;
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Unknown error";
  } finally {
    isLoading.value = false;
  }
});
</script>

<template>
  <h1 class="text-4xl font-bold mb-6">Welcome to the Home</h1>
  <p class="text-lg mb-6">
    This is a responsive template app with dark/light theme support built with
    Tailwind CSS, Pinia store and Vue router.
  </p>

  <div class="mb-6">
    <button
      class="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 cursor-pointer"
      @click="counter.increment()"
    >
      Increment
    </button>
    <p class="mt-2">Count: {{ counter.count }}</p>
  </div>

  <div v-if="isLoading" class="text-center py-8">
    <p>Loading data...</p>
  </div>

  <div
    v-else-if="error"
    class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6"
  >
    Error loading data: {{ error }}
  </div>

  <div v-else>
    <h2 class="text-2xl font-bold mb-4">People</h2>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
      <FeatureCard
        v-for="person in people"
        :key="person.id"
        :title="person.name"
        :content="`From ${person.homeworldName}`"
      />
    </div>

    <h2 class="text-2xl font-bold mb-4">Planets</h2>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <FeatureCard
        v-for="planet in planets"
        :key="planet.id"
        :title="planet.name"
        :content="`Population: ${planet.population}`"
      />
    </div>
  </div>
</template>
