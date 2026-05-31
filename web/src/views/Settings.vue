<template>
  <div>
    <div class="page-header">
      <h2>{{ t('settings.title') }}</h2>
    </div>

    <div class="settings-grid">
      <div class="card">
        <h3 class="card-title">{{ t('settings.password') }}</h3>
        <div class="form-group">
          <label class="form-label">{{ t('settings.newPassword') }}</label>
          <input class="input" type="password" v-model="newPassword" />
        </div>
        <button class="btn btn-primary" @click="changePassword">{{ t('settings.changePassword') }}</button>
      </div>

      <div class="card">
        <h3 class="card-title">{{ t('settings.agent') }}</h3>
        <div class="form-group">
          <label class="form-label">{{ t('settings.timeout') }}</label>
          <input class="input" type="number" v-model.number="agentForm.timeout" />
        </div>
        <div class="form-group">
          <label class="form-label">{{ t('settings.maxConcurrency') }}</label>
          <input class="input" type="number" v-model.number="agentForm.maxConcurrency" />
        </div>
        <div class="form-group" style="display: flex; align-items: center; gap: 8px;">
          <input type="checkbox" v-model="agentForm.sandbox" id="sandbox-toggle" />
          <label for="sandbox-toggle" style="font-size: 14px;">{{ t('settings.sandbox') }}</label>
        </div>
        <button class="btn btn-primary" @click="saveAgent">{{ t('common.save') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { api } from '../api.js';

const { t } = useI18n();

const newPassword = ref('');
const agentForm = ref({ timeout: 60000, maxConcurrency: 3, sandbox: true });

onMounted(async () => {
  const status = await api.get('/status');
  if (status?.agent) {
    agentForm.value = {
      timeout: status.agent.timeout,
      maxConcurrency: status.agent.maxConcurrency,
      sandbox: status.agent.sandbox,
    };
  }
});

async function changePassword() {
  if (!newPassword.value) return;
  await api.put('/config/auth', { password: newPassword.value });
  newPassword.value = '';
  alert(t('common.success'));
}

async function saveAgent() {
  await api.put('/config/agent', {
    timeout: agentForm.value.timeout,
    maxConcurrency: agentForm.value.maxConcurrency,
    sandbox: { enabled: agentForm.value.sandbox },
  });
  alert(t('common.success'));
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
}
</style>
