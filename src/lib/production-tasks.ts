export type ProductionTask = {
  id: string;
  title: string;
  description?: string;
  status: "todo" | "completed";
  createdAt: string;
  completedAt?: string;
};

const TASKS_KEY = "northvale_production_tasks";

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function makeTaskId() {
  return `task-${Math.random().toString(36).slice(2, 9)}`;
}

export function getProductionTasks() {
  return readJson<ProductionTask[]>(TASKS_KEY, []);
}

export function saveProductionTasks(tasks: ProductionTask[]) {
  writeJson(TASKS_KEY, tasks);
}
