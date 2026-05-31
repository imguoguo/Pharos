<template>
  <div>
    <div class="page-header" style="display: flex; justify-content: space-between; align-items: center;">
      <h2>{{ t('history.title') }}</h2>
      <button class="btn btn-danger" @click="clearHistory">{{ t('history.clear') }}</button>
    </div>
    <div class="card">
      <table class="table" v-if="entries.length > 0">
        <thead>
          <tr>
            <th>{{ t('history.user') }}</th>
            <th>{{ t('history.query') }}</th>
            <th>{{ t('history.provider') }}</th>
            <th>{{ t('history.tokens') }}</th>
            <th>{{ t('history.duration') }}</th>
            <th>{{ t('history.time') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="entry in entries" :key="entry.id" @click="selected = entry" style="cursor: pointer;">
            <td>{{ entry.username }}</td>
            <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ entry.query }}</td>
            <td><span class="badge badge-blue">{{ entry.providerId }}</span></td>
            <td>{{ entry.tokensUsed }}</td>
            <td>{{ (entry.duration / 1000).toFixed(1) }}s</td>
            <td>{{ new Date(entry.timestamp).toLocaleString() }}</td>
          </tr>
        </tbody>
      </table>
      <div v-else style="padding: 40px; text-align: center; color: var(--text-muted);">
        {{ t('history.empty') }}
      </div>
    </div>

    <div v-if="selected" class="modal-overlay" @click.self="selected = null">
      <div class="modal" style="max-width: 640px;">
        <div class="modal-header">{{ selected.username }} - {{ new Date(selected.timestamp).toLocaleString() }}</div>
        <div class="form-group">
          <label class="form-label">{{ t('history.query') }}</label>
          <div style="padding: 12px; background: var(--bg-secondary); border-radius: var(--radius); font-size: 14px;">{{ selected.query }}</div>
        </div>
        <div class="form-group">
          <label class="form-label">{{ t('history.response') }}</label>
          <div style="padding: 12px; background: var(--bg-secondary); border-radius: var(--radius); font-size: 14px; max-height: 400px; overflow-y: auto; white-space: pre-wrap;">{{ selected.response }}</div>
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

const entries = ref<any[]>([]);
const selected = ref<any>(null);

onMounted(async () => {
  await loadHistory();
});

async function loadHistory() {
  const data = await api.get('/history');
  entries.value = data.entries;
}

async function clearHistory() {
  await api.delete('/history');
  entries.value = [];
}
</script>
