<template>
  <div>
    <div class="page-header">
      <h2>{{ t('history.title') }}</h2>
    </div>

    <div class="history-layout">
      <div class="channel-list card">
        <div
          v-for="ch in channels"
          :key="ch"
          class="channel-item"
          :class="{ active: selectedChannel === ch }"
          @click="selectChannel(ch)"
        >
          # {{ ch }}
        </div>
        <div v-if="channels.length === 0" style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 13px;">
          {{ t('history.noChannels') }}
        </div>
      </div>

      <div class="channel-history card" v-if="selectedChannel">
        <table class="table" v-if="entries.length > 0">
          <thead>
            <tr>
              <th>{{ t('history.user') }}</th>
              <th>{{ t('history.query') }}</th>
              <th>{{ t('history.duration') }}</th>
              <th>{{ t('history.time') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="entry in entries" :key="entry.id" @click="selected = entry" style="cursor: pointer;">
              <td>{{ entry.username }}</td>
              <td style="max-width: 400px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ entry.query }}</td>
              <td>{{ (entry.duration / 1000).toFixed(1) }}s</td>
              <td>{{ new Date(entry.timestamp).toLocaleString() }}</td>
            </tr>
          </tbody>
        </table>
        <div v-else style="padding: 40px; text-align: center; color: var(--text-muted);">
          {{ t('history.empty') }}
        </div>
      </div>
    </div>

    <div v-if="selected" class="modal-overlay" @click.self="selected = null">
      <div class="modal" style="max-width: 700px;">
        <div class="modal-header">{{ selected.username }} - {{ new Date(selected.timestamp).toLocaleString() }}</div>
        <div class="form-group">
          <label class="form-label">{{ t('history.query') }}</label>
          <div class="detail-block">{{ selected.query }}</div>
        </div>
        <div class="form-group">
          <label class="form-label">{{ t('history.response') }}</label>
          <div class="detail-block" style="max-height: 400px; overflow-y: auto; white-space: pre-wrap;">{{ selected.response }}</div>
        </div>
        <div class="modal-actions">
          <button class="btn" @click="selected = null">{{ t('common.cancel') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { api } from '../api.js';

const { t } = useI18n();

const channels = ref<string[]>([]);
const selectedChannel = ref<string | null>(null);
const entries = ref<any[]>([]);
const selected = ref<any>(null);

onMounted(async () => {
  const data = await api.get('/history/channels');
  channels.value = data || [];
  if (channels.value.length > 0) {
    await selectChannel(channels.value[0]);
  }
});

async function selectChannel(channelId: string) {
  selectedChannel.value = channelId;
  const data = await api.get(`/history/channels/${channelId}`);
  entries.value = data?.entries || [];
}
</script>

<style scoped>
.history-layout {
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: 16px;
}
.channel-list {
  padding: 8px;
}
.channel-item {
  padding: 10px 12px;
  border-radius: var(--radius);
  cursor: pointer;
  font-size: 14px;
  font-family: monospace;
  color: var(--text-secondary);
  transition: all 0.15s;
}
.channel-item:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}
.channel-item.active {
  background: var(--bg-tertiary);
  color: var(--accent-blue);
}
.channel-history {
  min-height: 300px;
}
.detail-block {
  padding: 12px;
  background: var(--bg-secondary);
  border-radius: var(--radius);
  font-size: 14px;
}
</style>
