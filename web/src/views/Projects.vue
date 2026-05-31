<template>
  <div>
    <div class="page-header" style="display: flex; justify-content: space-between; align-items: center;">
      <h2>{{ t('projects.title') }}</h2>
      <button class="btn btn-primary" @click="showAdd = true">
        <span class="mdi mdi-plus"></span> {{ t('projects.add') }}
      </button>
    </div>

    <div v-if="projects.length === 0" class="card empty-state">
      <span class="mdi mdi-folder-open-outline empty-icon"></span>
      <p>{{ t('projects.noProjects') }}</p>
    </div>

    <div v-else class="project-list">
      <div class="card project-card" v-for="project in projects" :key="project.id">
        <div class="project-header">
          <div>
            <h3 class="project-name">{{ project.name }}</h3>
            <p class="project-desc">{{ project.description }}</p>
          </div>
          <div style="display: flex; gap: 6px;">
            <button class="btn" @click="editProject(project)">
              <span class="mdi mdi-pencil"></span> {{ t('projects.edit') }}
            </button>
            <button class="btn btn-danger" @click="deleteProject(project.id)">
              <span class="mdi mdi-delete"></span> {{ t('projects.delete') }}
            </button>
          </div>
        </div>

        <div class="project-section">
          <div class="section-header">
            <span class="section-title"><span class="mdi mdi-pound"></span> {{ t('projects.channels') }}</span>
            <button class="btn" @click="openAddChannel(project)">
              <span class="mdi mdi-plus"></span> {{ t('projects.addChannel') }}
            </button>
          </div>
          <div class="tag-list">
            <span class="tag" v-for="(ch, i) in project.channels" :key="i">
              {{ ch }}
              <span class="tag-remove" @click="removeChannel(project, i)">
                <span class="mdi mdi-close"></span>
              </span>
            </span>
            <span v-if="project.channels.length === 0" style="color: var(--text-muted); font-size: 13px;">-</span>
          </div>
        </div>

        <div class="project-section">
          <div class="section-header">
            <span class="section-title"><span class="mdi mdi-database"></span> {{ t('projects.sources') }} ({{ project.sources.length }})</span>
            <div style="display: flex; gap: 6px;">
              <button class="btn" @click="openUpload(project)">
                <span class="mdi mdi-upload"></span> {{ t('projects.upload') }}
              </button>
              <button class="btn" @click="openAddSource(project)">
                <span class="mdi mdi-plus"></span> {{ t('projects.addSource') }}
              </button>
            </div>
          </div>
          <table class="table" v-if="project.sources.length > 0">
            <thead>
              <tr>
                <th>{{ t('projects.sourceName') }}</th>
                <th>{{ t('projects.sourceType') }}</th>
                <th>{{ t('projects.sourcePath') }}</th>
                <th>{{ t('projects.actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="source in project.sources" :key="source.id">
                <td>{{ source.name }}</td>
                <td><span class="badge badge-blue">{{ source.type }}</span></td>
                <td style="font-family: monospace; font-size: 13px;">{{ source.path }}</td>
                <td>
                  <button class="btn btn-danger" @click="deleteSource(project, source.id)">
                    <span class="mdi mdi-delete"></span>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div v-if="showAdd || editing" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
        <div class="modal-header">{{ editing ? t('projects.edit') : t('projects.add') }}</div>
        <div class="form-group">
          <label class="form-label">{{ t('projects.name') }}</label>
          <input class="input" v-model="form.name" />
        </div>
        <div class="form-group">
          <label class="form-label">{{ t('projects.description') }}</label>
          <input class="input" v-model="form.description" />
        </div>
        <div class="modal-actions">
          <button class="btn" @click="closeModal">{{ t('projects.cancel') }}</button>
          <button class="btn btn-primary" @click="saveProject">{{ t('projects.save') }}</button>
        </div>
      </div>
    </div>

    <div v-if="addingSource" class="modal-overlay" @click.self="addingSource = null">
      <div class="modal">
        <div class="modal-header">{{ t('projects.addSource') }}</div>
        <div class="form-group">
          <label class="form-label">{{ t('projects.sourceName') }}</label>
          <input class="input" v-model="sourceForm.name" />
        </div>
        <div class="form-group">
          <label class="form-label">{{ t('projects.sourceType') }}</label>
          <select class="select" v-model="sourceForm.type">
            <option value="directory">{{ t('projects.directory') }}</option>
            <option value="file">{{ t('projects.file') }}</option>
            <option value="git-repo">{{ t('projects.gitRepo') }}</option>
            <option value="url">{{ t('projects.url') }}</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">{{ t('projects.sourcePath') }}</label>
          <input class="input" v-model="sourceForm.path" />
        </div>
        <div class="modal-actions">
          <button class="btn" @click="addingSource = null">{{ t('common.cancel') }}</button>
          <button class="btn btn-primary" @click="saveSource">{{ t('common.save') }}</button>
        </div>
      </div>
    </div>

    <div v-if="addingChannel" class="modal-overlay" @click.self="addingChannel = null">
      <div class="modal">
        <div class="modal-header">{{ t('projects.addChannel') }}</div>
        <div class="form-group">
          <label class="form-label">Channel ID</label>
          <input class="input" v-model="channelInput" />
        </div>
        <div class="modal-actions">
          <button class="btn" @click="addingChannel = null">{{ t('common.cancel') }}</button>
          <button class="btn btn-primary" @click="saveChannel">{{ t('common.save') }}</button>
        </div>
      </div>
    </div>

    <div v-if="uploading" class="modal-overlay" @click.self="uploading = null">
      <div class="modal">
        <div class="modal-header"><span class="mdi mdi-upload"></span> {{ t('projects.upload') }}</div>
        <div class="form-group">
          <label class="form-label">{{ t('projects.sourceName') }}</label>
          <input class="input" v-model="uploadName" />
        </div>
        <div class="form-group">
          <label class="form-label">{{ t('projects.selectFile') }}</label>
          <input type="file" @change="onFileSelect" class="input" />
        </div>
        <div class="modal-actions">
          <button class="btn" @click="uploading = null">{{ t('common.cancel') }}</button>
          <button class="btn btn-primary" @click="doUpload" :disabled="!uploadFile">
            <span class="mdi mdi-upload"></span> {{ t('projects.upload') }}
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

const projects = ref<any[]>([]);
const showAdd = ref(false);
const editing = ref<string | null>(null);
const form = ref({ name: '', description: '' });
const addingSource = ref<string | null>(null);
const sourceForm = ref({ name: '', type: 'directory', path: '' });
const addingChannel = ref<string | null>(null);
const channelInput = ref('');
const uploading = ref<string | null>(null);
const uploadName = ref('');
const uploadFile = ref<File | null>(null);

onMounted(async () => {
  await loadProjects();
});

async function loadProjects() {
  projects.value = await api.get('/projects') || [];
}

function editProject(project: any) {
  editing.value = project.id;
  form.value = { name: project.name, description: project.description };
}

function closeModal() {
  showAdd.value = false;
  editing.value = null;
  form.value = { name: '', description: '' };
}

async function saveProject() {
  if (editing.value) {
    await api.put(`/projects/${editing.value}`, form.value);
  } else {
    await api.post('/projects', form.value);
  }
  await loadProjects();
  closeModal();
  toast.success(t('common.success'));
}

async function deleteProject(id: string) {
  await api.delete(`/projects/${id}`);
  await loadProjects();
  toast.success(t('common.success'));
}

function openAddChannel(project: any) {
  addingChannel.value = project.id;
  channelInput.value = '';
}

async function saveChannel() {
  if (!addingChannel.value || !channelInput.value) return;
  const project = projects.value.find((p: any) => p.id === addingChannel.value);
  if (!project) return;
  const channels = [...project.channels, channelInput.value];
  await api.put(`/projects/${addingChannel.value}`, { channels });
  addingChannel.value = null;
  await loadProjects();
  toast.success(t('common.success'));
}

async function removeChannel(project: any, index: number) {
  const channels = project.channels.filter((_: any, i: number) => i !== index);
  await api.put(`/projects/${project.id}`, { channels });
  await loadProjects();
}

function openAddSource(project: any) {
  addingSource.value = project.id;
  sourceForm.value = { name: '', type: 'directory', path: '' };
}

async function saveSource() {
  if (!addingSource.value) return;
  await api.post(`/projects/${addingSource.value}/sources`, sourceForm.value);
  addingSource.value = null;
  await loadProjects();
  toast.success(t('common.success'));
}

async function deleteSource(project: any, sourceId: string) {
  await api.delete(`/projects/${project.id}/sources/${sourceId}`);
  await loadProjects();
  toast.success(t('common.success'));
}

function openUpload(project: any) {
  uploading.value = project.id;
  uploadName.value = '';
  uploadFile.value = null;
}

function onFileSelect(e: Event) {
  const input = e.target as HTMLInputElement;
  if (input.files?.length) {
    uploadFile.value = input.files[0];
    if (!uploadName.value) {
      uploadName.value = input.files[0].name;
    }
  }
}

async function doUpload() {
  if (!uploading.value || !uploadFile.value) return;
  const formData = new FormData();
  formData.append('file', uploadFile.value);
  formData.append('name', uploadName.value || uploadFile.value.name);

  const token = localStorage.getItem('pharos-token') || '';
  const res = await fetch(`/api/projects/${uploading.value}/sources/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (res.ok) {
    toast.success(t('common.success'));
    uploading.value = null;
    await loadProjects();
  } else {
    toast.error(t('common.error'));
  }
}
</script>

<style scoped>
.project-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.project-card {
  padding: 24px;
}
.project-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
}
.project-name {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 4px;
}
.project-desc {
  font-size: 14px;
  color: var(--text-secondary);
}
.project-section {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.section-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 6px;
}
.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: var(--bg-tertiary);
  border-radius: 4px;
  font-size: 13px;
  font-family: monospace;
}
.tag-remove {
  cursor: pointer;
  color: var(--accent-red);
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
