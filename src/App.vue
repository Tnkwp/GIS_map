<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <header>
    <nav><RouterLink to="/map">Map</RouterLink> |</nav>
  </header>

  <RouterView />
</template>

<style scoped>
header {
  padding: 1rem;
  background: #f8f9fa;
}

nav {
  width: 100%;
  text-align: center;
}

nav a {
  margin: 0 0.5rem;
  color: #2c3e50;
  text-decoration: none;
}

nav a.router-link-active {
  color: #42b983;
  font-weight: bold;
}
</style>
