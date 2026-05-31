<template>
  <div class="app-layout" :data-theme="theme">
    <aside class="sidebar">
      <div class="sidebar-header">
        <h1>PHAROS</h1>
      </div>
      <nav class="sidebar-nav">
        <router-link
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          active-class="active"
        >
          <span>{{ t(item.label) }}</span>
        </router-link>
      </nav>
      <div class="sidebar-footer">
        <button class="theme-toggle" @click="toggleTheme">
          <span>{{ theme === 'dark' ? '☀' : '●' }}</span>
          <span>{{ theme === 'dark' ? 'Light' : 'Dark' }}</span>
        </button>
      </div>
    </aside>
    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const theme = ref<'light' | 'dark'>(
  (localStorage.getItem('pharos-theme') as 'light' | 'dark') || 'dark'
);

document.documentElement.setAttribute('data-theme', theme.value);

function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', theme.value);
  localStorage.setItem('pharos-theme', theme.value);
}

const navItems = [
  { path: '/dashboard', label: 'nav.dashboard' },
  { path: '/knowledge', label: 'nav.knowledge' },
  { path: '/providers', label: 'nav.providers' },
  { path: '/discord', label: 'nav.discord' },
  { path: '/history', label: 'nav.history' },
];
</script>
