<template>
  <div :data-theme="theme">
    <template v-if="!authenticated">
      <div class="login-page">
        <div class="login-card">
          <h1 class="login-title">{{ t('auth.title') }}</h1>
          <p class="login-subtitle">{{ t('auth.subtitle') }}</p>
          <form @submit.prevent="login">
            <div class="form-group">
              <input
                class="input"
                type="password"
                v-model="password"
                :placeholder="t('auth.password')"
                autofocus
              />
            </div>
            <p v-if="loginError" class="login-error">{{ t('auth.error') }}</p>
            <button class="btn btn-primary" style="width: 100%;" type="submit">{{ t('auth.login') }}</button>
          </form>
        </div>
      </div>
    </template>
    <template v-else>
      <div class="app-layout">
        <aside class="sidebar">
          <div class="sidebar-header">
            <h1>Pharos</h1>
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
            <div class="footer-controls">
              <button class="theme-toggle" @click="toggleTheme">
                <span>{{ theme === 'dark' ? t('theme.light') : t('theme.dark') }}</span>
              </button>
              <button class="lang-toggle" @click="toggleLang">
                <span>{{ locale === 'zh-CN' ? 'EN' : '中' }}</span>
              </button>
            </div>
          </div>
        </aside>
        <main class="main-content">
          <router-view />
        </main>
      </div>
    </template>

    <div class="toast-container">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="toast"
        :class="`toast-${toast.type}`"
      >
        {{ toast.message }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, provide } from 'vue';
import { useI18n } from 'vue-i18n';
import { api } from './api.js';
import { useToast } from './composables/useToast.js';

const { t, locale } = useI18n();
const { toasts, success, error, info } = useToast();

provide('toast', { success, error, info });

const theme = ref<'light' | 'dark'>(
  (localStorage.getItem('pharos-theme') as 'light' | 'dark') || 'dark'
);
const authenticated = ref(false);
const password = ref('');
const loginError = ref(false);

document.documentElement.setAttribute('data-theme', theme.value);

onMounted(async () => {
  const token = localStorage.getItem('pharos-token');
  if (token) {
    try {
      const res = await api.post('/auth/verify', { token });
      if (res?.valid) {
        authenticated.value = true;
        api.setToken(token);
      }
    } catch {
      localStorage.removeItem('pharos-token');
    }
  }
});

async function login() {
  loginError.value = false;
  try {
    const res = await api.post('/auth/login', { password: password.value });
    if (res?.token) {
      localStorage.setItem('pharos-token', res.token);
      api.setToken(res.token);
      authenticated.value = true;
    } else {
      loginError.value = true;
    }
  } catch {
    loginError.value = true;
  }
}

function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', theme.value);
  localStorage.setItem('pharos-theme', theme.value);
}

function toggleLang() {
  locale.value = locale.value === 'zh-CN' ? 'en' : 'zh-CN';
  localStorage.setItem('pharos-lang', locale.value);
}

const navItems = [
  { path: '/dashboard', label: 'nav.dashboard' },
  { path: '/projects', label: 'nav.projects' },
  { path: '/providers', label: 'nav.providers' },
  { path: '/discord', label: 'nav.discord' },
  { path: '/history', label: 'nav.history' },
  { path: '/settings', label: 'nav.settings' },
];
</script>
