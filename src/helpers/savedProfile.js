import { ref } from 'vue';

const storageKey = 'aimlab-tracker-saved-profile';
export const savedProfile = ref('');
try { savedProfile.value = localStorage.getItem(storageKey) || ''; } catch {}

export function saveProfile(username) {
  try {
    if (username) localStorage.setItem(storageKey, username);
    else localStorage.removeItem(storageKey);
    savedProfile.value = username;
    return true;
  } catch { return false; }
}
