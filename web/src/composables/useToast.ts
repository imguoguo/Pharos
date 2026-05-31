import { ref } from 'vue';

interface ToastOptions {
  message: string;
  type: 'success' | 'error' | 'info';
  duration?: number;
}

const toasts = ref<Array<ToastOptions & { id: number }>>([]);
let toastId = 0;

export function useToast() {
  function showToast(options: ToastOptions) {
    const id = toastId++;
    const duration = options.duration ?? 3000;
    toasts.value.push({ ...options, id });
    setTimeout(() => {
      toasts.value = toasts.value.filter((t) => t.id !== id);
    }, duration);
  }

  function success(message: string) {
    showToast({ message, type: 'success' });
  }

  function error(message: string) {
    showToast({ message, type: 'error' });
  }

  function info(message: string) {
    showToast({ message, type: 'info' });
  }

  return { toasts, success, error, info };
}
