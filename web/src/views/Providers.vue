<template>
  <div>
    <div class="page-header" style="display: flex; justify-content: space-between; align-items: center;">
      <h2>{{ t('providers.title') }}</h2>
      <button class="btn btn-primary" @click="showAdd = true">{{ t('providers.add') }}</button>
    </div>
    <div class="card">
      <table class="table">
        <thead>
          <tr>
            <th>{{ t('providers.name') }}</th>
            <th>{{ t('providers.type') }}</th>
            <th>{{ t('providers.model') }}</th>
            <th>{{ t('providers.baseUrl') }}</th>
            <th>{{ t('providers.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="provider in providers" :key="provider.id">
            <td>
              {{ provider.name }}
              <span v-if="provider.id === defaultProvider" class="badge badge-yellow" style="margin-left: 8px;">Default</span>
            </td>
            <td><span class="badge badge-blue">{{ provider.type }}</span></td>
            <td style="font-family: monospace; font-size: 13px;">{{ provider.model }}</td>
            <td style="font-family: monospace; font-size: 12px; color: var(--text-secondary);">{{ provider.baseUrl || '-' }}</td>
            <td>
              <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                <button class="btn" @click="testProvider(provider.id)" :disabled="testingId === provider.id">
                  {{ testingId === provider.id ? t('providers.testing') : t('providers.test') }}
                </button>
                <button class="btn" @click="editProvider(provider)">{{ t('providers.edit') }}</button>
                <button class="btn" @click="setDefault(provider.id)" v-if="provider.id !== defaultProvider">{{ t('providers.setDefault') }}</button>
                <button class="btn btn-danger" @click="deleteProvider(provider.id)">{{ t('providers.delete') }}</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
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
            {{ testingConnection ? t('providers.testing') : t('providers.testConnection') }}
          </button>
          <span v-if="connectionResult" :style="{ color: connectionResult.success ? '#22c55e' : 'var(--accent-red)', marginLeft: '12px', fontSize: '13px' }">
            {{ connectionResult.success ? t('providers.testSuccess') : t('providers.testFailed') + ': ' + connectionResult.error }}
          </span>
        </div>
        <div class="modal-actions">
          <button class="btn" @click="closeModal">{{ t('providers.cancel') }}</button>
          <button class="btn btn-primary" @click="saveProvider">{{ t('providers.save') }}</button>
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
const defaultProvider = ref('');
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
  providers.value = data?.providers || [];
  defaultProvider.value = data?.defaultProvider || '';
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

async function setDefault(id: string) {
  await api.put('/providers/default', { providerId: id });
  await loadProviders();
  toast.success(t('common.success'));
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
</style>
