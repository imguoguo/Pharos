<template>
  <div>
    <div class="page-header">
      <h2><span class="mdi mdi-view-dashboard"></span> {{ t('dashboard.title') }}</h2>
    </div>
    <div class="card-grid">
      <div class="card">
        <div class="stat-value">
          <span class="status-dot" :class="status.bot?.online ? 'online' : 'offline'"></span>
          {{ status.bot?.online ? t('dashboard.online') : t('dashboard.offline') }}
        </div>
        <div class="stat-label"><span class="mdi mdi-robot"></span> {{ t('dashboard.botStatus') }}</div>
        <div v-if="status.bot?.username" style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">{{ status.bot.username }}</div>
        <div v-if="!status.bot?.online" style="margin-top: 12px;">
          <button class="btn btn-primary" @click="restartBot" :disabled="restarting">
            <span class="mdi" :class="restarting ? 'mdi-loading mdi-spin' : 'mdi-power'"></span>
            {{ restarting ? t('dashboard.starting') : t('dashboard.startBot') }}
          </button>
        </div>
      </div>
      <div class="card">
        <div class="stat-value">{{ status.bot?.guilds ?? 0 }}</div>
        <div class="stat-label"><span class="mdi mdi-server"></span> {{ t('dashboard.guilds') }}</div>
      </div>
      <div class="card">
        <div class="stat-value">{{ status.projects?.total ?? 0 }}</div>
        <div class="stat-label"><span class="mdi mdi-folder-multiple"></span> {{ t('dashboard.projects') }}</div>
      </div>
      <div class="card">
        <div class="stat-value">{{ status.providers?.total ?? 0 }}</div>
        <div class="stat-label"><span class="mdi mdi-brain"></span> {{ t('dashboard.providers') }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, inject } from 'vue';
import { useI18n } from 'vue-i18n';
import { api } from '../api.js';

const { t } = useI18n();
const toast = inject<any>('toast');

const status = ref<Record<string, any>>();
const loading = ref(true);
const restarting = ref(false);
let pollTimer: ReturnType<typeof setInterval> | null = null;

async function fetchStatus() {
  status.value = await api.get('/status') || {};
  loading.value = false;
}

onMounted(() => {
  fetchStatus();
  pollTimer = setInterval(fetchStatus, 5000);
});

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer);
});

async function restartBot() {
  restarting.value = true;
  const res = await api.post('/bot/restart', {});
  restarting.value = false;
  if (res?.success) {
    toast.success(t('dashboard.botStarted'));
    setTimeout(async () => {
      status.value = await api.get('/status') || {};
    }, 3000);
  } else {
    toast.error(res?.error || t('common.error'));
  }
}
</script>

<style scoped>
.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-muted);
}
.empty-icon {
  font-size: 48px;
  display: block;
  margin-bottom: 12px;
  opacity: 0.5;
}
</style>
