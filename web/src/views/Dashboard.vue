<template>
  <div>
    <div class="page-header">
      <h2>{{ t('dashboard.title') }}</h2>
    </div>
    <div class="card-grid">
      <div class="card">
        <div class="stat-value">
          <span class="status-dot" :class="status.bot?.online ? 'online' : 'offline'"></span>
          {{ status.bot?.online ? t('dashboard.online') : t('dashboard.offline') }}
        </div>
        <div class="stat-label">{{ t('dashboard.botStatus') }}</div>
      </div>
      <div class="card">
        <div class="stat-value">{{ status.bot?.guilds ?? 0 }}</div>
        <div class="stat-label">{{ t('dashboard.guilds') }}</div>
      </div>
      <div class="card">
        <div class="stat-value">{{ status.projects?.total ?? 0 }}</div>
        <div class="stat-label">{{ t('dashboard.projects') }}</div>
      </div>
      <div class="card">
        <div class="stat-value">{{ status.providers?.total ?? 0 }}</div>
        <div class="stat-label">{{ t('dashboard.providers') }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { api } from '../api.js';

const { t } = useI18n();

const status = ref<Record<string, any>>({});

onMounted(async () => {
  status.value = await api.get('/status') || {};
});
</script>
