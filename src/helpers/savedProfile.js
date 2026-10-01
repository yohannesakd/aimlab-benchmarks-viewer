import { ref } from 'vue';
import { captureEvent } from './analytics.js';

const storageKey = 'aimlab-tracker-saved-profile';
export const savedProfile = ref('');
try { savedProfile.value = localStorage.getItem(storageKey) || ''; } catch {}

export function saveProfile(username) {
  try {
    if (username) localStorage.setItem(storageKey, username);
    else localStorage.removeItem(storageKey);
    savedProfile.value = username;
    captureEvent('saved_profile_changed', { saved: Boolean(username) });
    return true;
  } catch { return false; }
}
