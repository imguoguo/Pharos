<template>
  <div>
    <div class="page-header">
      <h2><span class="mdi mdi-cog"></span> {{ t('settings.title') }}</h2>
    </div>

    <div class="settings-grid">
      <div class="card">
        <h3 class="card-title"><span class="mdi mdi-lock"></span> {{ t('settings.password') }}</h3>
        <div class="form-group">
          <label class="form-label">{{ t('settings.newPassword') }}</label>
          <input class="input" type="password" v-model="newPassword" />
        </div>
        <button class="btn btn-primary" @click="changePassword">
          <span class="mdi mdi-content-save"></span> {{ t('settings.changePassword') }}
        </button>
      </div>

      <div class="card">
        <h3 class="card-title"><span class="mdi mdi-robot"></span> {{ t('settings.agent') }}</h3>
        <div class="form-group">
          <label class="form-label">{{ t('settings.timeout') }}</label>
          <input class="input" type="number" v-model.number="agentForm.timeout" />
        </div>
        <div class="form-group">
          <label class="form-label">{{ t('settings.maxConcurrency') }}</label>
          <input class="input" type="number" v-model.number="agentForm.maxConcurrency" />
        </div>
        <div class="form-group">
          <label class="form-label">{{ t('settings.maxIterations') }}</label>
          <input class="input" type="number" v-model.number="agentForm.maxIterations" min="1" max="50" />
          <p class="form-hint">{{ t('settings.maxIterationsHint') }}</p>
        </div>
        <div class="form-group">
          <label class="form-label">{{ t('settings.progressVerbosity') }}</label>
          <select class="select" v-model="agentForm.progressVerbosity">
            <option value="silent">{{ t('settings.verbositySilent') }}</option>
            <option value="progress">{{ t('settings.verbosityProgress') }}</option>
            <option value="detailed">{{ t('settings.verbosityDetailed') }}</option>
          </select>
          <p class="form-hint">{{ t('settings.progressHint') }}</p>
        </div>
        <button class="btn btn-primary" @click="saveAgent">
          <span class="mdi mdi-content-save"></span> {{ t('common.save') }}
        </button>
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

const newPassword = ref('');
const agentForm = ref({ timeout: 120000, maxConcurrency: 3, maxIterations: 20, progressVerbosity: 'progress' });

onMounted(async () => {
  const status = await api.get('/status');
  if (status?.agent) {
    agentForm.value = {
      timeout: status.agent.timeout,
      maxConcurrency: status.agent.maxConcurrency,
      maxIterations: status.agent.maxIterations || 20,
      progressVerbosity: status.agent.progressVerbosity || 'progress',
    };
  }
});

async function changePassword() {
  if (!newPassword.value) return;
  await api.put('/config/auth', { password: newPassword.value });
  newPassword.value = '';
  toast.success(t('common.success'));
}

async function saveAgent() {
  await api.put('/config/agent', {
    timeout: agentForm.value.timeout,
    maxConcurrency: agentForm.value.maxConcurrency,
    maxIterations: agentForm.value.maxIterations,
    progressVerbosity: agentForm.value.progressVerbosity,
  });
  toast.success(t('common.success'));
}
</script>

<style scoped>
.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 16px;
}
.card-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.form-hint {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 4px;
}
</style>
