<template>
  <div>
    <div class="page-header">
      <h2><span class="mdi mdi-chat"></span> {{ t('discord.title') }}</h2>
    </div>
    <div class="card" style="max-width: 600px;">
      <div class="form-group">
        <label class="form-label"><span class="mdi mdi-key"></span> {{ t('discord.token') }}</label>
        <input class="input" type="password" v-model="form.token" placeholder="Bot Token (Reset Token)" />
        <p class="form-hint">{{ t('discord.tokenHint') }}</p>
      </div>
      <div class="form-group">
        <label class="form-label"><span class="mdi mdi-identifier"></span> {{ t('discord.appId') }}</label>
        <input class="input" v-model="form.appId" placeholder="Application ID" />
        <p class="form-hint">{{ t('discord.appIdHint') }}</p>
      </div>
      <div class="form-group">
        <label class="form-label"><span class="mdi mdi-key-variant"></span> {{ t('discord.publicKey') }}</label>
        <input class="input" v-model="form.publicKey" placeholder="Public Key" />
        <p class="form-hint">{{ t('discord.publicKeyHint') }}</p>
      </div>
      <div class="form-group">
        <label class="form-label"><span class="mdi mdi-shield-account"></span> {{ t('discord.roles') }}</label>
        <p class="form-hint">{{ t('discord.rolesHint') }}</p>
        <div v-for="(role, i) in form.adminRoles" :key="i" style="display: flex; gap: 8px; margin-bottom: 8px;">
          <input class="input" v-model="form.adminRoles[i]" placeholder="Role ID (e.g. 123456789012345678)" />
          <button class="btn btn-danger" @click="form.adminRoles.splice(i, 1)">
            <span class="mdi mdi-minus"></span>
          </button>
        </div>
        <button class="btn" @click="form.adminRoles.push('')">
          <span class="mdi mdi-plus"></span> {{ t('discord.addRole') }}
        </button>
      </div>
      <button class="btn btn-primary" @click="save">
        <span class="mdi mdi-content-save"></span> {{ t('discord.save') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, inject } from 'vue';
import { useI18n } from 'vue-i18n';
import { api } from '../api.js';

const { t } = useI18n();
const toast = inject<any>('toast');

const form = ref({
  token: '',
  appId: '',
  publicKey: '',
  adminRoles: [] as string[],
});

onMounted(async () => {
  const data = await api.get('/config/discord');
  if (data) {
    form.value = {
      token: data.token || '',
      appId: data.appId || '',
      publicKey: data.publicKey || '',
      adminRoles: data.adminRoles || [],
    };
  }
});

async function save() {
  await api.put('/config/discord', form.value);
  toast.success(t('common.success'));
}
</script>

<style scoped>
.form-hint {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 4px;
}
</style>
