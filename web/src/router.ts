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
    path: '/projects',
    component: () => import('./views/Projects.vue'),
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
  {
    path: '/settings',
    component: () => import('./views/Settings.vue'),
  },
];
