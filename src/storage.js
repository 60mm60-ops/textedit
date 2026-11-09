import { openDB } from 'idb';
const journalKey = 'manuscript-editor-recovery-v1';
let dbPromise, knownJournal;
let queue = Promise.resolve();
const database = () => dbPromise ||= openDB('manuscript-editor-v1', 1, {
  upgrade(db) { db.createObjectStore('state'); }
});
function validate(value) {
  if (value?.schemaVersion !== 1 || !Array.isArray(value.chapters) ||
      !value.chapters.length || !value.chapters.every(c =>
        typeof c.id === 'string' && typeof c.title === 'string' && typeof c.text === 'string') ||
      new Set(value.chapters.map(c => c.id)).size !== value.chapters.length ||
      !value.chapters.some(c => c.id === value.activeId)) {
    throw new Error('保存データの形式を確認できません。既存データは上書きしません。');
  }
  return value;
}
export async function readState() {
  knownJournal = localStorage.getItem(journalKey);
  // Recover edits even if the last IndexedDB transaction did not finish.
  if (knownJournal !== null) return validate(JSON.parse(knownJournal));
  const value = await (await database()).get('state', 'workspace');
  return value == null ? null : validate(value);
}
export function stageState(value) {
  validate(value);
  if (localStorage.getItem(journalKey) !== knownJournal) {
    throw new Error('別のタブで原稿が変更されました。バックアップしてから再読み込みしてください。');
  }
  const serialized = JSON.stringify(value);
  localStorage.setItem(journalKey, serialized);
  knownJournal = serialized;
}
export function writeState(value) {
  // Serialize writes and wait for transaction completion before reporting success.
  const next = queue.catch(() => {}).then(async () => {
    const db = await database();
    const tx = db.transaction('state', 'readwrite');
    await tx.store.put(value, 'workspace');
    await tx.done;
  });
  queue = next;
  return next;
}
