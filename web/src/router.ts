import type { RouteRecordRaw } from 'vue-router';

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/dashboard',
  },
  {
    path: '/dashboard',
    component: () => import('./views/Dashboard.vue'),
  },
  {
    path: '/knowledge',
    component: () => import('./views/Knowledge.vue'),
  },
  {
    path: '/providers',
    component: () => import('./views/Providers.vue'),
  },
  {
    path: '/discord',
    component: () => import('./views/Discord.vue'),
  },
  {
    path: '/history',
    component: () => import('./views/History.vue'),
  },
];
