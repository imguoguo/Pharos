import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import { createI18n } from 'vue-i18n';
import App from './App.vue';
import { routes } from './router.js';
import zhCN from './i18n/zh-CN.js';
import './styles/index.css';

const router = createRouter({
  history: createWebHistory(),
  routes,
});

const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  fallbackLocale: 'zh-CN',
  messages: {
    'zh-CN': zhCN,
  },
});

const app = createApp(App);
app.use(router);
app.use(i18n);
app.mount('#app');
