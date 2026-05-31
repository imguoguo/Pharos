<template>
  <div>
    <div class="page-header" style="display: flex; justify-content: space-between; align-items: center;">
      <h2>{{ t('knowledge.title') }}</h2>
      <button class="btn btn-primary" @click="showAdd = true">{{ t('knowledge.add') }}</button>
    </div>
    <div class="card">
      <table class="table">
        <thead>
          <tr>
            <th>{{ t('knowledge.name') }}</th>
            <th>{{ t('knowledge.type') }}</th>
            <th>{{ t('knowledge.path') }}</th>
            <th>{{ t('knowledge.status') }}</th>
            <th>{{ t('knowledge.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="source in sources" :key="source.id">
            <td>{{ source.name }}</td>
            <td><span class="badge badge-blue">{{ t(`knowledge.${source.type === 'git-repo' ? 'gitRepo' : source.type}`) }}</span></td>
            <td style="font-family: monospace; font-size: 13px;">{{ source.path }}</td>
            <td>
              <span class="badge" :class="source.enabled ? 'badge-blue' : 'badge-red'">
                {{ source.enabled ? t('knowledge.enabled') : t('knowledge.disabled') }}
              </span>
            </td>
            <td>
              <button class="btn" @click="editSource(source)">{{ t('knowledge.edit') }}</button>
              <button class="btn btn-danger" @click="deleteSource(source.id)">{{ t('knowledge.delete') }}</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="showAdd || editing" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
        <div class="modal-header">{{ editing ? t('knowledge.edit') : t('knowledge.add') }}</div>
        <div class="form-group">
          <label class="form-label">{{ t('knowledge.name') }}</label>
          <input class="input" v-model="form.name" />
        </div>
        <div class="form-group">
          <label class="form-label">{{ t('knowledge.type') }}</label>
          <select class="select" v-model="form.type">
            <option value="directory">{{ t('knowledge.directory') }}</option>
            <option value="file">{{ t('knowledge.file') }}</option>
            <option value="git-repo">{{ t('knowledge.gitRepo') }}</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">{{ t('knowledge.path') }}</label>
          <input class="input" v-model="form.path" />
        </div>
        <div class="modal-actions">
          <button class="btn" @click="closeModal">{{ t('knowledge.cancel') }}</button>
          <button class="btn btn-primary" @click="saveSource">{{ t('knowledge.save') }}</button>
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

const sources = ref<any[]>([]);
const showAdd = ref(false);
const editing = ref<string | null>(null);
const form = ref({ name: '', type: 'directory', path: '' });

onMounted(async () => {
  sources.value = await api.get('/knowledge');
});

function editSource(source: any) {
  editing.value = source.id;
  form.value = { name: source.name, type: source.type, path: source.path };
}

function closeModal() {
  showAdd.value = false;
  editing.value = null;
  form.value = { name: '', type: 'directory', path: '' };
}

async function saveSource() {
  if (editing.value) {
    await api.put(`/knowledge/${editing.value}`, form.value);
  } else {
    await api.post('/knowledge', form.value);
  }
  sources.value = await api.get('/knowledge');
  closeModal();
}

async function deleteSource(id: string) {
  await api.delete(`/knowledge/${id}`);
  sources.value = await api.get('/knowledge');
}
</script>
