<template>
  <div>
    <div class="page-header" style="display: flex; justify-content: space-between; align-items: center;">
      <h2><span class="mdi mdi-folder-multiple"></span> {{ t('projects.title') }}</h2>
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
            <button class="btn" @click="editProject(project)"><span class="mdi mdi-pencil"></span></button>
            <button class="btn btn-danger" @click="deleteProject(project.id)"><span class="mdi mdi-delete"></span></button>
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
              <span class="tag-remove" @click="removeChannel(project, i)"><span class="mdi mdi-close"></span></span>
            </span>
            <span v-if="project.channels.length === 0" style="color: var(--text-muted); font-size: 13px;">-</span>
          </div>
        </div>

        <div class="project-section">
          <div class="section-header">
            <span class="section-title"><span class="mdi mdi-database"></span> {{ t('projects.sources') }} ({{ project.sources.length }})</span>
            <div style="display: flex; gap: 6px;">
              <button class="btn" @click="openAddGit(project)">
                <span class="mdi mdi-git"></span> {{ t('projects.addGitRepo') }}
              </button>
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
                <th>Status</th>
                <th>{{ t('projects.actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="source in project.sources" :key="source.id">
                <td>{{ source.name }}</td>
                <td><span class="badge badge-blue">{{ source.type }}</span></td>
                <td style="font-family: monospace; font-size: 12px; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ source.path || source.remoteUrl }}</td>
                <td>
                  <span v-if="source.type === 'git-repo'" class="badge" :class="syncBadgeClass(source.syncStatus)">
                    {{ syncLabel(source.syncStatus) }}
                  </span>
                </td>
                <td>
                  <div style="display: flex; gap: 4px;">
                    <button v-if="source.type === 'git-repo'" class="btn" @click="syncSource(project, source)" :disabled="source.syncStatus === 'syncing'" :title="t('projects.syncNow')">
                      <span class="mdi" :class="source.syncStatus === 'syncing' ? 'mdi-loading mdi-spin' : 'mdi-refresh'"></span>
                    </button>
                    <button v-if="source.type === 'git-repo'" class="btn" @click="openProgress(project, source)" :title="t('projects.progress')">
                      <span class="mdi mdi-console"></span>
                    </button>
                    <button class="btn" @click="openIndex(project, source)" :title="t('projects.viewIndex')">
                      <span class="mdi mdi-file-document-outline"></span>
                    </button>
                    <button class="btn" @click="reindex(project, source)" :title="t('projects.reindex')">
                      <span class="mdi mdi-brain"></span>
                    </button>
                    <button class="btn btn-danger" @click="deleteSource(project, source.id)">
                      <span class="mdi mdi-delete"></span>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Project create/edit modal -->
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

    <!-- Add source modal -->
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

    <!-- Add channel modal -->
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

    <!-- Upload modal -->
    <div v-if="uploading" class="modal-overlay" @click.self="uploading = null">
      <div class="modal">
        <div class="modal-header"><span class="mdi mdi-folder-upload"></span> {{ t('projects.uploadFolder') }}</div>
        <div class="form-group">
          <label class="form-label">{{ t('projects.sourceName') }}</label>
          <input class="input" v-model="uploadName" :placeholder="t('projects.uploadNameHint')" />
        </div>
        <div class="form-group">
          <label class="form-label">{{ t('projects.selectFolder') }}</label>
          <input ref="folderInput" type="file" webkitdirectory multiple @change="onFolderSelect" class="input" />
          <p v-if="uploadFiles.length > 0" class="form-hint">{{ uploadFiles.length }} {{ t('projects.filesSelected') }}</p>
        </div>
        <div class="form-group" style="display: flex; align-items: center; gap: 8px;">
          <input type="checkbox" id="keep-structure" v-model="keepStructure" />
          <label for="keep-structure" style="font-size: 14px;">{{ t('projects.keepStructure') }}</label>
        </div>
        <div class="modal-actions">
          <button class="btn" @click="uploading = null">{{ t('common.cancel') }}</button>
          <button class="btn btn-primary" @click="doUpload" :disabled="!uploadFiles.length || uploading === 'loading'">
            <span class="mdi" :class="uploading === 'loading' ? 'mdi-loading mdi-spin' : 'mdi-upload'"></span>
            {{ uploading === 'loading' ? t('common.loading') : t('projects.upload') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Add Git repo modal -->
    <div v-if="addingGit" class="modal-overlay" @click.self="addingGit = null">
      <div class="modal">
        <div class="modal-header"><span class="mdi mdi-git"></span> {{ t('projects.addGitRepo') }}</div>
        <div class="form-group">
          <label class="form-label">{{ t('projects.sourceName') }}</label>
          <input class="input" v-model="gitForm.name" placeholder="my-repo (optional)" />
        </div>
        <div class="form-group">
          <label class="form-label">{{ t('projects.gitUrl') }}</label>
          <input class="input" v-model="gitForm.remoteUrl" placeholder="https://github.com/org/repo.git" />
        </div>
        <div class="form-group">
          <label class="form-label">{{ t('projects.gitBranch') }}</label>
          <input class="input" v-model="gitForm.branch" placeholder="main" />
        </div>
        <div class="form-group">
          <label class="form-label">{{ t('projects.syncInterval') }}</label>
          <input class="input" type="number" v-model.number="gitForm.syncIntervalMinutes" min="0" />
        </div>
        <div class="modal-actions">
          <button class="btn" @click="addingGit = null">{{ t('common.cancel') }}</button>
          <button class="btn btn-primary" @click="saveGitSource" :disabled="!gitForm.remoteUrl">
            <span class="mdi mdi-git"></span> {{ t('projects.addGitRepo') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Progress modal -->
    <div v-if="progressData" class="modal-overlay" @click.self="stopProgressPoll">
      <div class="modal" style="max-width: 640px;">
        <div class="modal-header">
          <span class="mdi mdi-console"></span> {{ progressData.source.name }}
          <span class="badge" :class="syncBadgeClass(progressData.progress.status)" style="margin-left: 8px;">{{ progressData.progress.status }}</span>
        </div>
        <div class="progress-log">
          <div v-for="(line, i) in progressData.progress.lines" :key="i" class="progress-line">{{ line }}</div>
          <div v-if="progressData.progress.lines.length === 0" style="color: var(--text-muted);">No output yet.</div>
        </div>
        <div style="font-size: 12px; color: var(--text-muted); margin-top: 8px;">
          <span v-if="progressData.source.lastSyncAt">{{ t('projects.lastSync') }}: {{ new Date(progressData.source.lastSyncAt).toLocaleString() }}</span>
          <span v-if="progressData.source.nextSyncAt" style="margin-left: 16px;">{{ t('projects.nextSync') }}: {{ new Date(progressData.source.nextSyncAt).toLocaleString() }}</span>
        </div>
        <div class="modal-actions">
          <button class="btn" @click="stopProgressPoll">{{ t('common.cancel') }}</button>
        </div>
      </div>
    </div>

    <!-- Index modal -->
    <div v-if="indexData" class="modal-overlay" @click.self="indexData = null">
      <div class="modal" style="max-width: 800px;">
        <div class="modal-header">
          <span class="mdi mdi-file-document-outline"></span> {{ t('projects.sourceIndex') }}
          <span v-if="indexData.lastIndexedAt" style="font-size: 12px; color: var(--text-muted); margin-left: 12px;">{{ t('projects.lastIndexed') }}: {{ new Date(indexData.lastIndexedAt).toLocaleString() }}</span>
        </div>
        <div class="form-group">
          <textarea class="input index-editor" v-model="indexData.content" rows="20"></textarea>
        </div>
        <div class="modal-actions">
          <button class="btn" @click="indexData = null">{{ t('common.cancel') }}</button>
          <button class="btn btn-primary" @click="saveIndex">
            <span class="mdi mdi-content-save"></span> {{ t('common.save') }}
          </button>
        </div>
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
const uploadFiles = ref<File[]>([]);
const keepStructure = ref(true);
const addingGit = ref<string | null>(null);
const gitForm = ref({ name: '', remoteUrl: '', branch: 'main', syncIntervalMinutes: 0 });
const progressData = ref<any>(null);
const indexData = ref<any>(null);
let indexProjectId = '';
let indexSourceId = '';
let progressTimer: ReturnType<typeof setInterval> | null = null;

onMounted(async () => {
  await loadProjects();
});

onUnmounted(() => {
  stopProgressPoll();
});

async function loadProjects() {
  projects.value = await api.get('/projects') || [];
}

function syncBadgeClass(status?: string) {
  return {
    'badge-blue': status === 'syncing',
    'badge-yellow': status === 'idle' || !status,
    'badge-success': status === 'success',
    'badge-red': status === 'error',
  };
}

function syncLabel(status?: string) {
  const map: Record<string, string> = {
    syncing: t('projects.syncing'),
    success: t('projects.syncSuccess'),
    error: t('projects.syncError'),
    idle: t('projects.syncIdle'),
  };
  return map[status ?? 'idle'] ?? status ?? '-';
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
  uploadFiles.value = [];
  keepStructure.value = true;
}

function onFolderSelect(e: Event) {
  const input = e.target as HTMLInputElement;
  if (input.files?.length) {
    uploadFiles.value = Array.from(input.files);
    if (!uploadName.value) {
      const firstPath = (input.files[0] as any).webkitRelativePath as string;
      uploadName.value = firstPath ? firstPath.split('/')[0] : input.files[0].name;
    }
  }
}

async function doUpload() {
  if (!uploading.value || !uploadFiles.value.length) return;
  const projectId = uploading.value;
  uploading.value = 'loading';
  const formData = new FormData();
  formData.append('name', uploadName.value);
  for (const file of uploadFiles.value) {
    const relPath = (file as any).webkitRelativePath || file.name;
    formData.append('files', file, relPath);
  }
  const token = localStorage.getItem('pharos-token') || '';
  const qs = keepStructure.value ? '' : '?keepStructure=false';
  const res = await fetch(`/api/projects/${projectId}/sources/upload${qs}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (res.ok) {
    toast.success(t('common.success'));
    uploading.value = null;
    uploadFiles.value = [];
    await loadProjects();
  } else {
    uploading.value = null;
    toast.error(t('common.error'));
  }
}

function openAddGit(project: any) {
  addingGit.value = project.id;
  gitForm.value = { name: '', remoteUrl: '', branch: 'main', syncIntervalMinutes: 0 };
}

async function saveGitSource() {
  if (!addingGit.value || !gitForm.value.remoteUrl) return;
  await api.post(`/projects/${addingGit.value}/sources/git`, gitForm.value);
  addingGit.value = null;
  await loadProjects();
  toast.success(t('common.success'));
}

async function syncSource(project: any, source: any) {
  source.syncStatus = 'syncing';
  await api.post(`/projects/${project.id}/sources/${source.id}/sync`, {});
  await pollProgress(project.id, source.id);
}

async function openProgress(project: any, source: any) {
  const data = await api.get(`/projects/${project.id}/sources/${source.id}/progress`);
  progressData.value = data;
  startProgressPoll(project.id, source.id);
}

function startProgressPoll(projectId: string, sourceId: string) {
  stopProgressPoll();
  progressTimer = setInterval(async () => {
    const data = await api.get(`/projects/${projectId}/sources/${sourceId}/progress`);
    progressData.value = data;
    if (data?.progress?.status !== 'syncing') {
      stopProgressPoll();
      await loadProjects();
    }
  }, 1500);
}

async function pollProgress(projectId: string, sourceId: string) {
  const data = await api.get(`/projects/${projectId}/sources/${sourceId}/progress`);
  if (data?.progress?.status === 'syncing') {
    startProgressPoll(projectId, sourceId);
  } else {
    await loadProjects();
  }
}

function stopProgressPoll() {
  if (progressTimer) {
    clearInterval(progressTimer);
    progressTimer = null;
  }
  progressData.value = null;
}

async function openIndex(project: any, source: any) {
  indexProjectId = project.id;
  indexSourceId = source.id;
  const data = await api.get(`/projects/${project.id}/sources/${source.id}/index`);
  indexData.value = data || { content: '', lastIndexedAt: null };
}

async function saveIndex() {
  if (!indexProjectId || !indexSourceId) return;
  await api.put(`/projects/${indexProjectId}/sources/${indexSourceId}/index`, { content: indexData.value.content });
  indexData.value = null;
  toast.success(t('common.success'));
}

async function reindex(project: any, source: any) {
  await api.post(`/projects/${project.id}/sources/${source.id}/reindex`, {});
  toast.success(t('projects.reindexStarted'));
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
.badge-success {
  background: rgba(34, 197, 94, 0.1);
  color: #22c55e;
}
.progress-log {
  background: var(--bg-tertiary);
  border-radius: var(--radius);
  padding: 12px;
  font-family: monospace;
  font-size: 12px;
  max-height: 320px;
  overflow-y: auto;
  line-height: 1.6;
}
.progress-line {
  white-space: pre-wrap;
  word-break: break-all;
}
@keyframes mdi-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.mdi-spin {
  display: inline-block;
  animation: mdi-spin 1s linear infinite;
}
.index-editor {
  width: 100%;
  min-height: 400px;
  font-family: monospace;
  font-size: 13px;
  line-height: 1.6;
  resize: vertical;
  padding: 12px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--bg-primary);
  color: var(--text-primary);
}
.index-editor:focus {
  outline: none;
  border-color: var(--accent-blue);
}
</style>
