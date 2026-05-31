<template>
  <div>
    <div class="page-header">
      <h2>{{ t('discord.title') }}</h2>
    </div>
    <div class="card" style="max-width: 600px;">
      <div class="form-group">
        <label class="form-label">{{ t('discord.token') }}</label>
        <input class="input" type="password" v-model="form.token" placeholder="Bot token" />
      </div>
      <div class="form-group">
        <label class="form-label">{{ t('discord.clientId') }}</label>
        <input class="input" v-model="form.clientId" />
      </div>
      <div class="form-group">
        <label class="form-label">{{ t('discord.channels') }}</label>
        <div v-for="(ch, i) in form.allowedChannels" :key="i" style="display: flex; gap: 8px; margin-bottom: 8px;">
          <input class="input" v-model="form.allowedChannels[i]" />
          <button class="btn btn-danger" @click="form.allowedChannels.splice(i, 1)">-</button>
        </div>
        <button class="btn" @click="form.allowedChannels.push('')">{{ t('discord.addChannel') }}</button>
      </div>
      <div class="form-group">
        <label class="form-label">{{ t('discord.roles') }}</label>
        <div v-for="(role, i) in form.adminRoles" :key="i" style="display: flex; gap: 8px; margin-bottom: 8px;">
          <input class="input" v-model="form.adminRoles[i]" />
          <button class="btn btn-danger" @click="form.adminRoles.splice(i, 1)">-</button>
        </div>
        <button class="btn" @click="form.adminRoles.push('')">{{ t('discord.addRole') }}</button>
      </div>
      <button class="btn btn-primary" @click="save">{{ t('discord.save') }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { api } from '../api.js';

const { t } = useI18n();

const form = ref({
  token: '',
  clientId: '',
  allowedChannels: [] as string[],
  adminRoles: [] as string[],
});

onMounted(async () => {
  const data = await api.get('/config/discord');
  form.value = {
    token: data.token || '',
    clientId: data.clientId || '',
    allowedChannels: data.allowedChannels || [],
    adminRoles: data.adminRoles || [],
  };
});

async function save() {
  await api.put('/config/discord', form.value);
  await api.post('/config/save', {});
}
</script>
