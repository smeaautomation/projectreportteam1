export const MAX_SNAPSHOT_BYTES = 1024 * 1024;

export class SnapshotValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "SnapshotValidationError";
  }
}

function fail(message) {
  throw new SnapshotValidationError(message);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateString(value, label, { required = true, max = 300 } = {}) {
  if (typeof value !== "string") fail(`${label} must be a string`);
  if (required && !value.trim()) fail(`${label} is required`);
  if (value.length > max) fail(`${label} exceeds ${max} characters`);
}

function validateDate(value, label, { required = true } = {}) {
  validateString(value, label, { required, max: 10 });
  if (!value && !required) return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) fail(`${label} must use YYYY-MM-DD`);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    fail(`${label} is not a valid date`);
  }
}

function validateTask(task, projectId, taskKeys, index) {
  const prefix = `Project ${projectId} task ${index + 1}`;
  if (!isObject(task)) fail(`${prefix} must be an object`);
  validateString(task.key, `${prefix} key`, { max: 200 });
  if (taskKeys.has(task.key)) fail(`Duplicate task key ${task.key} in project ${projectId}`);
  taskKeys.add(task.key);
  validateString(task.name, `${prefix} name`, { max: 300 });
  validateString(task.short ?? "", `${prefix} short`, { required: false, max: 120 });
  validateString(task.context ?? "", `${prefix} context`, { required: false, max: 2000 });
  if (!new Set(["todo", "active", "done"]).has(task.status)) fail(`${prefix} task status is invalid`);
  validateDate(task.startedAt, `${prefix} task startedAt`);
  validateDate(task.dueAt, `${prefix} task dueAt`);
  validateDate(task.completedAt ?? "", `${prefix} task completedAt`, { required: false });
}

function validateProject(project, projectIds, index) {
  const prefix = `Project ${index + 1}`;
  if (!isObject(project)) fail(`${prefix} must be an object`);
  validateString(project.id, `${prefix} project id`, { max: 200 });
  if (projectIds.has(project.id)) fail(`Duplicate project id ${project.id}`);
  projectIds.add(project.id);
  validateString(project.name, `${prefix} project name`, { max: 300 });
  validateString(project.owner, `${prefix} project owner`, { max: 100 });
  validateString(project.category, `${prefix} project category`, { max: 100 });
  validateString(project.source ?? "", `${prefix} project source`, { required: false, max: 300 });
  validateDate(project.start, `${prefix} project start`);
  validateDate(project.end, `${prefix} project end`);
  if (project.urgency !== undefined) validateString(project.urgency, `${prefix} project urgency`, { max: 50 });
  if (project.priority !== undefined) validateString(project.priority, `${prefix} project priority`, { max: 50 });
  if (!Array.isArray(project.tasks)) fail(`${prefix} tasks must be an array`);
  const taskKeys = new Set();
  project.tasks.forEach((task, taskIndex) => validateTask(task, project.id, taskKeys, taskIndex));
}

export function validateSnapshot(projects) {
  if (!Array.isArray(projects)) fail("Projects snapshot must be an array");

  let serialized;
  try {
    serialized = JSON.stringify(projects);
  } catch {
    fail("Projects snapshot must be serializable JSON");
  }
  if (Buffer.byteLength(serialized) > MAX_SNAPSHOT_BYTES) {
    fail(`Snapshot exceeds ${MAX_SNAPSHOT_BYTES} bytes`);
  }

  const projectIds = new Set();
  projects.forEach((project, index) => validateProject(project, projectIds, index));
  return JSON.parse(serialized);
}
