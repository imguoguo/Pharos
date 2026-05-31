<template>
  <div>
    <div class="page-header">
      <h2><span class="mdi mdi-chat"></span> {{ t('discord.title') }}</h2>
    </div>
    <div class="card" style="max-width: 600px;">
      <div class="form-group">
        <label class="form-label"><span class="mdi mdi-key"></span> {{ t('discord.token') }}</label>
        <input class="input" type="password" v-model="form.token" placeholder="Bot token" />
      </div>
      <div class="form-group">
        <label class="form-label"><span class="mdi mdi-identifier"></span> {{ t('discord.clientId') }}</label>
        <input class="input" v-model="form.clientId" />
      </div>
      <div class="form-group">
        <label class="form-label"><span class="mdi mdi-shield-account"></span> {{ t('discord.roles') }}</label>
        <div v-for="(role, i) in form.adminRoles" :key="i" style="display: flex; gap: 8px; margin-bottom: 8px;">
          <input class="input" v-model="form.adminRoles[i]" />
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
  clientId: '',
  adminRoles: [] as string[],
});

onMounted(async () => {
  const data = await api.get('/config/discord');
  if (data) {
    form.value = {
      token: data.token || '',
      clientId: data.clientId || '',
      adminRoles: data.adminRoles || [],
    };
  }
});

async function save() {
  await api.put('/config/discord', form.value);
  toast.success(t('common.success'));
}
</script>
