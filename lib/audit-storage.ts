import type { AdvertAuditRecord, PageDraft } from "./types";

const DATABASE = "toolhub-ad-studio";
const VERSION = 2;
const STORE = "advert-audits";

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE, VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("page-drafts")) database.createObjectStore("page-drafts", { keyPath: "id" });
      if (!database.objectStoreNames.contains(STORE)) {
        const store = database.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("source-page", ["sourceFilename", "page"], { unique: false });
        store.createIndex("approved-at", "approvedAt", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveAuditRecord(record: AdvertAuditRecord) {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).put(record);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

export async function listAuditRecords() {
  const database = await openDatabase();
  const records = await new Promise<AdvertAuditRecord[]>((resolve, reject) => {
    const request = database.transaction(STORE, "readonly").objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result as AdvertAuditRecord[]);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return records.toSorted((a, b) => b.approvedAt.localeCompare(a.approvedAt));
}

export async function savePageDrafts(drafts: PageDraft[]) {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction("page-drafts", "readwrite");
      const store = transaction.objectStore("page-drafts");
      store.clear();
      drafts.forEach((draft) => store.put(draft));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error("Draft save aborted"));
    });
  } finally { database.close(); }
}
export async function loadPageDrafts(): Promise<PageDraft[]> {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = database.transaction("page-drafts", "readonly").objectStore("page-drafts").getAll();
      request.onsuccess = () => resolve(request.result.sort((a: PageDraft, b: PageDraft) => a.page - b.page));
      request.onerror = () => reject(request.error);
    });
  } finally { database.close(); }
}
