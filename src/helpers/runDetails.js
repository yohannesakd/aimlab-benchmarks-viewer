import { shallowRef } from "vue";

export const selectedRun = shallowRef(null);

export function openRunDetails(selection) {
  selectedRun.value = selection;
}

export function closeRunDetails() {
  selectedRun.value = null;
}
