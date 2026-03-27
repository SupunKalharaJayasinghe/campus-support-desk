export * from "@/models/module-offering-store";

import { type ModuleOfferingRecord } from "@/models/module-offering-store";

const globalForModuleOfferingStore = globalThis as typeof globalThis & {
  __moduleOfferingStore?: ModuleOfferingRecord[];
};

export function setModuleOfferingGradesState(id: string, hasGrades: boolean) {
  const targetId = String(id ?? "").trim();
  if (!targetId || !globalForModuleOfferingStore.__moduleOfferingStore) {
    return null;
  }

  const store = globalForModuleOfferingStore.__moduleOfferingStore;
  const index = store.findIndex(
    (offering) => offering.id === targetId && offering.isDeleted !== true
  );

  if (index < 0) {
    return null;
  }

  const updated: ModuleOfferingRecord = {
    ...store[index],
    hasGrades,
    updatedAt: new Date().toISOString(),
  };

  store[index] = updated;
  globalForModuleOfferingStore.__moduleOfferingStore = store;

  return updated;
}
