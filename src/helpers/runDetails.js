import { shallowRef } from "vue";
import { captureEvent } from './analytics.js';

export const selectedRun = shallowRef(null);

export function openRunDetails(selection) {
  captureEvent('run_opened', { task_id: selection.taskId, run_id: selection.playId || selection.run?.id, source: selection.run ? 'history' : 'score' });
  selectedRun.value = selection;
}

export function closeRunDetails() {
  if (selectedRun.value) captureEvent('run_closed');
  selectedRun.value = null;
}
