import axios from "axios";

export interface Planet {
  id: string | number;
  name: string;
  population: string;
}

export interface Person {
  id: string | number;
  name: string;
  homeworld: string;
}

interface ListResponse<T> {
  data: T[];
}

interface ItemResponse<T> {
  data: T;
}

export const API_URL = import.meta.env.VITE_API_URL as string;
const API_PREFIX = "/api/v1";

async function getList<T>(path: string): Promise<T[]> {
  const response = await axios.get<ListResponse<T>>(`${API_URL}${API_PREFIX}${path}`);
  return response.data.data;
}

async function getItem<T>(path: string): Promise<T> {
  const response = await axios.get<ItemResponse<T>>(`${API_URL}${API_PREFIX}${path}`);
  return response.data.data;
}

export default {
  getPeople() {
    return getList<Person>("/people");
  },

  getPerson(id: string | number) {
    return getItem<Person>(`/people/${id}`);
  },

  getPlanets() {
    return getList<Planet>("/planets");
  },

  getPlanet(id: string | number) {
    return getItem<Planet>(`/planets/${id}`);
  },
};
