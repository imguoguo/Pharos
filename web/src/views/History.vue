<template>
  <div>
    <div class="page-header">
      <h2><span class="mdi mdi-history"></span> {{ t('history.title') }}</h2>
    </div>

    <div v-if="channels.length === 0" class="card empty-state">
      <span class="mdi mdi-chat-sleep-outline empty-icon"></span>
      <p>{{ t('history.noChannels') }}</p>
    </div>

    <div v-else class="history-layout">
      <div class="channel-list card">
        <div
          v-for="ch in channels"
          :key="ch"
          class="channel-item"
          :class="{ active: selectedChannel === ch }"
          @click="selectChannel(ch)"
        >
          <span class="mdi mdi-pound"></span> {{ ch }}
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
        <div class="pagination" v-if="totalPages > 1">
          <button class="btn btn-sm" :disabled="page <= 1" @click="goPage(page - 1)">
            <span class="mdi mdi-chevron-left"></span>
          </button>
          <span class="page-info">{{ page }} / {{ totalPages }}</span>
          <button class="btn btn-sm" :disabled="page >= totalPages" @click="goPage(page + 1)">
            <span class="mdi mdi-chevron-right"></span>
          </button>
        </div>
        <div v-if="entries.length === 0" class="empty-state" style="padding: 40px;">
          <span class="mdi mdi-message-text-outline" style="font-size: 32px; opacity: 0.5;"></span>
          <p>{{ t('history.empty') }}</p>
        </div>
      </div>
    </div>

    <div v-if="selected" class="modal-overlay" @click.self="selected = null">
      <div class="modal" style="max-width: 800px;">
        <div class="modal-header">{{ selected.username }} - {{ new Date(selected.timestamp).toLocaleString() }}</div>
        <div class="form-group">
          <label class="form-label"><span class="mdi mdi-comment-question"></span> {{ t('history.query') }}</label>
          <div class="detail-block">{{ selected.query }}</div>
        </div>

        <div class="form-group" v-if="selected.steps?.length">
          <label class="form-label"><span class="mdi mdi-transit-connection-variant"></span> {{ t('history.agentSteps') }} ({{ selected.steps.length }})</label>
          <div class="steps-container">
            <div v-for="(step, i) in selected.steps" :key="i" class="step-item" :class="`step-${step.type}`">
              <div class="step-header">
                <span class="step-icon mdi" :class="stepIcon(step.type)"></span>
                <span class="step-type">{{ stepLabel(step.type) }}</span>
                <span v-if="step.toolName" class="step-tool">{{ step.toolName }}</span>
                <span v-if="step.providerId" class="step-provider">{{ step.providerId }}</span>
                <span class="step-time">{{ formatTime(step.timestamp) }}</span>
              </div>
              <div class="step-content" v-if="step.content">{{ truncate(step.content, step.type === 'tool_result' ? 500 : 1000) }}</div>
            </div>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label"><span class="mdi mdi-comment-check"></span> {{ t('history.response') }}</label>
          <div class="detail-block" style="max-height: 300px; overflow-y: auto; white-space: pre-wrap;">{{ selected.response }}</div>
        </div>
        <div class="modal-actions">
          <button class="btn" @click="selected = null">{{ t('common.cancel') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { api } from '../api.js';

const { t } = useI18n();

const channels = ref<string[]>([]);
const selectedChannel = ref<string | null>(null);
const entries = ref<any[]>([]);
const selected = ref<any>(null);
const page = ref(1);
const total = ref(0);
const pageSize = 20;
const totalPages = computed(() => Math.ceil(total.value / pageSize));

onMounted(async () => {
  const data = await api.get('/history/channels');
  channels.value = data || [];
  if (channels.value.length > 0) {
    await selectChannel(channels.value[0]);
  }
});

async function selectChannel(channelId: string) {
  selectedChannel.value = channelId;
  page.value = 1;
  await fetchPage();
}

async function fetchPage() {
  const data = await api.get(`/history/channels/${selectedChannel.value}?page=${page.value}&limit=${pageSize}`);
  entries.value = data?.entries || [];
  total.value = data?.total || 0;
}

async function goPage(p: number) {
  page.value = p;
  await fetchPage();
}

function stepIcon(type: string): string {
  switch (type) {
    case 'llm_call': return 'mdi-brain';
    case 'tool_call': return 'mdi-wrench';
    case 'tool_result': return 'mdi-clipboard-text';
    default: return 'mdi-circle-small';
  }
}

function stepLabel(type: string): string {
  switch (type) {
    case 'llm_call': return 'LLM';
    case 'tool_call': return 'Tool Call';
    case 'tool_result': return 'Result';
    default: return type;
  }
}

function formatTime(ts: string): string {
  return new Date(ts).toLocaleTimeString();
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + '...';
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
  display: flex;
  align-items: center;
  gap: 6px;
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
.steps-container {
  max-height: 400px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius);
}
.step-item {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
}
.step-item:last-child {
  border-bottom: none;
}
.step-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.step-icon {
  font-size: 14px;
}
.step-type {
  font-weight: 500;
  font-size: 12px;
  text-transform: uppercase;
}
.step-tool {
  font-family: monospace;
  font-size: 12px;
  color: var(--accent-blue);
}
.step-provider {
  font-size: 11px;
  color: var(--text-muted);
}
.step-time {
  margin-left: auto;
  font-size: 11px;
  color: var(--text-muted);
}
.step-content {
  font-family: monospace;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--text-secondary);
  padding: 6px 8px;
  background: var(--bg-tertiary);
  border-radius: 4px;
  max-height: 120px;
  overflow-y: auto;
}
.step-llm_call .step-icon { color: var(--accent-blue); }
.step-tool_call .step-icon { color: var(--accent-yellow); }
.step-tool_result .step-icon { color: #22c55e; }
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 16px 0 4px;
}
.btn-sm {
  padding: 4px 10px;
  font-size: 13px;
}
.page-info {
  font-size: 13px;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
  min-width: 60px;
  text-align: center;
}
</style>
