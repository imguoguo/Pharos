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
            <td style="display: flex; gap: 6px;">
              <button class="btn" @click="testProvider(provider.id)">
                {{ testingId === provider.id ? t('providers.testing') : t('providers.test') }}
              </button>
              <button class="btn" @click="editProvider(provider)">{{ t('providers.edit') }}</button>
              <button class="btn" @click="setDefault(provider.id)" v-if="provider.id !== defaultProvider">{{ t('providers.setDefault') }}</button>
              <button class="btn btn-danger" @click="deleteProvider(provider.id)">{{ t('providers.delete') }}</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="showAdd || editing" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
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
          <label class="form-label">API Key</label>
          <input class="input" type="password" v-model="form.apiKey" />
        </div>
        <div class="form-group" v-if="form.type !== 'anthropic'">
          <label class="form-label">Base URL</label>
          <input class="input" v-model="form.baseUrl" placeholder="https://api.openai.com/v1" />
        </div>
        <div class="form-group">
          <label class="form-label">{{ t('providers.model') }}</label>
          <input class="input" v-model="form.model" />
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
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { api } from '../api.js';

const { t } = useI18n();

const providers = ref<any[]>([]);
const defaultProvider = ref('');
const showAdd = ref(false);
const editing = ref<string | null>(null);
const testingId = ref<string | null>(null);
const form = ref({ name: '', type: 'anthropic', apiKey: '', baseUrl: '', model: '' });

onMounted(async () => {
  await loadProviders();
});

async function loadProviders() {
  const data = await api.get('/providers');
  providers.value = data.providers;
  defaultProvider.value = data.defaultProvider;
}

function editProvider(provider: any) {
  editing.value = provider.id;
  form.value = { name: provider.name, type: provider.type, apiKey: '', baseUrl: provider.baseUrl || '', model: provider.model };
}

function closeModal() {
  showAdd.value = false;
  editing.value = null;
  form.value = { name: '', type: 'anthropic', apiKey: '', baseUrl: '', model: '' };
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
}

async function deleteProvider(id: string) {
  await api.delete(`/providers/${id}`);
  await loadProviders();
}

async function setDefault(id: string) {
  await api.put('/providers/default', { providerId: id });
  await loadProviders();
}

async function testProvider(id: string) {
  testingId.value = id;
  const result = await api.post(`/providers/${id}/test`, {});
  testingId.value = null;
  if (result.success) {
    alert(t('providers.testSuccess'));
  } else {
    alert(`${t('providers.testFailed')}: ${result.error}`);
  }
}
</script>
