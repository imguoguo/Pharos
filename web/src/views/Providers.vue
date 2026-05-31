<template>
  <div>
    <div class="page-header" style="display: flex; justify-content: space-between; align-items: center;">
      <h2><span class="mdi mdi-brain"></span> {{ t('providers.title') }}</h2>
      <button class="btn btn-primary" @click="showAdd = true">
        <span class="mdi mdi-plus"></span> {{ t('providers.add') }}
      </button>
    </div>

    <div v-if="providers.length === 0" class="card empty-state">
      <span class="mdi mdi-cloud-off-outline empty-icon"></span>
      <p>{{ t('providers.empty') }}</p>
    </div>

    <div v-else class="card">
      <div class="provider-list">
        <div
          v-for="(provider, idx) in providers"
          :key="provider.id"
          class="provider-row"
          :class="{ disabled: !provider.enabled }"
        >
          <div class="provider-drag">
            <button class="btn-icon" @click="moveUp(idx)" :disabled="idx === 0" title="Move up">
              <span class="mdi mdi-chevron-up"></span>
            </button>
            <span class="priority-badge">{{ idx + 1 }}</span>
            <button class="btn-icon" @click="moveDown(idx)" :disabled="idx === providers.length - 1" title="Move down">
              <span class="mdi mdi-chevron-down"></span>
            </button>
          </div>
          <div class="provider-toggle">
            <label class="switch">
              <input type="checkbox" :checked="provider.enabled" @change="toggleProvider(provider.id)" />
              <span class="slider"></span>
            </label>
          </div>
          <div class="provider-info">
            <div class="provider-name">{{ provider.name }}</div>
            <div class="provider-meta">
              <span class="badge badge-blue">{{ provider.type }}</span>
              <span style="font-family: monospace; font-size: 12px; color: var(--text-secondary);">{{ provider.model }}</span>
              <span v-if="provider.baseUrl" style="font-family: monospace; font-size: 11px; color: var(--text-muted);">{{ provider.baseUrl }}</span>
            </div>
          </div>
          <div class="provider-actions">
            <button class="btn" @click="testProvider(provider.id)" :disabled="testingId === provider.id">
              <span class="mdi mdi-connection"></span>
            </button>
            <button class="btn" @click="editProvider(provider)">
              <span class="mdi mdi-pencil"></span>
            </button>
            <button class="btn btn-danger" @click="deleteProvider(provider.id)">
              <span class="mdi mdi-delete"></span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showAdd || editing" class="modal-overlay" @click.self="closeModal">
      <div class="modal" style="max-width: 520px;">
        <div class="modal-header">{{ editing ? t('providers.edit') : t('providers.add') }}</div>
        <div class="form-group">
          <label class="form-label">{{ t('providers.name') }}</label>
          <input class="input" v-model="form.name" />
        </div>
        <div class="form-group">
          <label class="form-label">{{ t('providers.type') }}</label>
          <select class="select" v-model="form.type">
            <option value="anthropic">Anthropic</option>
            <option value="openai-chat">OpenAI Chat Completions</option>
            <option value="openai-responses">OpenAI Responses API</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">{{ t('providers.apiKey') }}</label>
          <input class="input" type="password" v-model="form.apiKey" />
        </div>
        <div class="form-group">
          <label class="form-label">{{ t('providers.baseUrl') }}</label>
          <input class="input" v-model="form.baseUrl" :placeholder="form.type === 'anthropic' ? 'https://api.anthropic.com' : 'https://api.openai.com/v1'" />
        </div>
        <div class="form-group">
          <label class="form-label">{{ t('providers.model') }}</label>
          <div style="display: flex; gap: 8px;">
            <input class="input" v-model="form.model" style="flex: 1;" />
            <button class="btn" @click="fetchModels" :disabled="fetchingModels">
              <span class="mdi mdi-refresh"></span>
              {{ fetchingModels ? t('providers.loadingModels') : t('providers.fetchModels') }}
            </button>
          </div>
          <div v-if="availableModels.length > 0" class="model-list">
            <div
              v-for="model in availableModels"
              :key="model"
              class="model-item"
              :class="{ active: form.model === model }"
              @click="form.model = model"
            >
              {{ model }}
            </div>
          </div>
        </div>
        <div class="form-group" style="margin-top: 12px;">
          <button class="btn" @click="testConnection" :disabled="testingConnection">
            <span class="mdi mdi-lan-connect"></span>
            {{ testingConnection ? t('providers.testing') : t('providers.testConnection') }}
          </button>
          <span v-if="connectionResult" :style="{ color: connectionResult.success ? '#22c55e' : 'var(--accent-red)', marginLeft: '12px', fontSize: '13px' }">
            <span class="mdi" :class="connectionResult.success ? 'mdi-check-circle' : 'mdi-alert-circle'"></span>
            {{ connectionResult.success ? t('providers.testSuccess') : t('providers.testFailed') }}
          </span>
        </div>
        <div class="modal-actions">
          <button class="btn" @click="closeModal">{{ t('providers.cancel') }}</button>
          <button class="btn btn-primary" @click="saveProvider">
            <span class="mdi mdi-content-save"></span> {{ t('providers.save') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, inject } from 'vue';
import { useI18n } from 'vue-i18n';
import { api } from '../api.js';

const { t } = useI18n();
const toast = inject<any>('toast');

const providers = ref<any[]>([]);
const showAdd = ref(false);
const editing = ref<string | null>(null);
const testingId = ref<string | null>(null);
const testingConnection = ref(false);
const fetchingModels = ref(false);
const availableModels = ref<string[]>([]);
const connectionResult = ref<{ success: boolean; error?: string } | null>(null);
const form = ref({ name: '', type: 'anthropic', apiKey: '', baseUrl: '', model: '' });

onMounted(async () => {
  await loadProviders();
});

async function loadProviders() {
  const data = await api.get('/providers');
  const list = data?.providers || [];
  list.sort((a: any, b: any) => (a.priority ?? 0) - (b.priority ?? 0));
  providers.value = list;
}

function editProvider(provider: any) {
  editing.value = provider.id;
  form.value = { name: provider.name, type: provider.type, apiKey: '', baseUrl: provider.baseUrl || '', model: provider.model };
  availableModels.value = [];
  connectionResult.value = null;
}

function closeModal() {
  showAdd.value = false;
  editing.value = null;
  form.value = { name: '', type: 'anthropic', apiKey: '', baseUrl: '', model: '' };
  availableModels.value = [];
  connectionResult.value = null;
}

async function saveProvider() {
  if (editing.value) {
    const body = { ...form.value };
    if (!body.apiKey) (body as any).apiKey = '***';
    await api.put(`/providers/${editing.value}`, body);
  } else {
    await api.post('/providers', form.value);
  }
  await loadProviders();
  closeModal();
  toast.success(t('common.success'));
}

async function deleteProvider(id: string) {
  await api.delete(`/providers/${id}`);
  await loadProviders();
  toast.success(t('common.success'));
}

async function toggleProvider(id: string) {
  await api.put(`/providers/${id}/toggle`, {});
  await loadProviders();
}

async function moveUp(idx: number) {
  if (idx === 0) return;
  const order = providers.value.map((p: any) => p.id);
  [order[idx - 1], order[idx]] = [order[idx], order[idx - 1]];
  await api.put('/providers/reorder', { order });
  await loadProviders();
}

async function moveDown(idx: number) {
  if (idx >= providers.value.length - 1) return;
  const order = providers.value.map((p: any) => p.id);
  [order[idx], order[idx + 1]] = [order[idx + 1], order[idx]];
  await api.put('/providers/reorder', { order });
  await loadProviders();
}

async function testProvider(id: string) {
  testingId.value = id;
  const result = await api.post(`/providers/${id}/test`, {});
  testingId.value = null;
  if (result?.success) {
    toast.success(t('providers.testSuccess'));
  } else {
    toast.error(`${t('providers.testFailed')}: ${result?.error}`);
  }
}

async function testConnection() {
  testingConnection.value = true;
  connectionResult.value = null;
  const result = await api.post('/providers/test-connection', {
    type: form.value.type,
    apiKey: form.value.apiKey,
    baseUrl: form.value.baseUrl,
  });
  testingConnection.value = false;
  connectionResult.value = result;
}

async function fetchModels() {
  fetchingModels.value = true;
  const result = await api.post('/providers/models', {
    type: form.value.type,
    apiKey: form.value.apiKey,
    baseUrl: form.value.baseUrl,
  });
  fetchingModels.value = false;
  availableModels.value = result?.models || [];
  if (result?.error) {
    toast.error(result.error);
  }
}
</script>

<style scoped>
.provider-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.provider-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: var(--radius);
  transition: background 0.15s;
}
.provider-row:hover {
  background: var(--bg-tertiary);
}
.provider-row.disabled {
  opacity: 0.5;
}
.provider-drag {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.btn-icon {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px;
  font-size: 16px;
  line-height: 1;
  transition: color 0.15s;
}
.btn-icon:hover:not(:disabled) {
  color: var(--accent-blue);
}
.btn-icon:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
.priority-badge {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--bg-tertiary);
}
.provider-toggle {
  flex-shrink: 0;
}
.provider-info {
  flex: 1;
  min-width: 0;
}
.provider-name {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;
}
.provider-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.provider-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}
.switch {
  position: relative;
  display: inline-block;
  width: 36px;
  height: 20px;
}
.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}
.slider {
  position: absolute;
  cursor: pointer;
  inset: 0;
  background: var(--border);
  border-radius: 20px;
  transition: background 0.2s;
}
.slider::before {
  content: '';
  position: absolute;
  width: 16px;
  height: 16px;
  left: 2px;
  bottom: 2px;
  background: white;
  border-radius: 50%;
  transition: transform 0.2s;
}
.switch input:checked + .slider {
  background: var(--accent-blue);
}
.switch input:checked + .slider::before {
  transform: translateX(16px);
}
.model-list {
  margin-top: 8px;
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius);
}
.model-item {
  padding: 8px 12px;
  font-size: 13px;
  font-family: monospace;
  cursor: pointer;
  border-bottom: 1px solid var(--border);
  transition: background 0.15s;
}
.model-item:last-child {
  border-bottom: none;
}
.model-item:hover {
  background: var(--bg-tertiary);
}
.model-item.active {
  background: var(--bg-tertiary);
  color: var(--accent-blue);
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
</style>
