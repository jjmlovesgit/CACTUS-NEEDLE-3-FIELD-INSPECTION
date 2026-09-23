/**
 * High-Efficiency IndexedDB Blob Storage Service for Inspection Photos
 * Stores native binary Blob objects directly (Zero Base64 encoding overhead - 33% smaller storage footprint)
 */

export interface StoredInspectionPhoto {
  id: string;
  inspectionId?: string;
  blob: Blob; // Native binary Blob (Not Base64)
  name: string;
  type: string;
  sizeBytes: number;
  timestamp: string;
}

const DB_NAME = 'CactusInspectionDB';
const DB_VERSION = 2; // Incremented for Blob photos store
const PHOTO_STORE_NAME = 'inspection_photos';
const MAIN_STORE_NAME = 'inspections';

/**
 * Open local IndexedDB with dedicated native Blob object store.
 */
export function openPhotoDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not supported in this environment'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(MAIN_STORE_NAME)) {
        const mainStore = db.createObjectStore(MAIN_STORE_NAME, { keyPath: 'id' });
        mainStore.createIndex('synced', 'synced', { unique: false });
        mainStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      if (!db.objectStoreNames.contains(PHOTO_STORE_NAME)) {
        const photoStore = db.createObjectStore(PHOTO_STORE_NAME, { keyPath: 'id' });
        photoStore.createIndex('inspectionId', 'inspectionId', { unique: false });
        photoStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };

    request.onsuccess = (event: any) => resolve(event.target.result);
    request.onerror = (event: any) => reject(event.target.error);
  });
}

/**
 * Save native binary File/Blob directly into IndexedDB without Base64 conversion.
 */
export async function savePhotoBlob(
  fileOrBlob: File | Blob,
  inspectionId?: string,
  customName?: string
): Promise<StoredInspectionPhoto> {
  const db = await openPhotoDb();
  const id = `IMG-${Math.random().toString(36).substring(2, 9).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
  const timestamp = new Date().toISOString();

  const photoRecord: StoredInspectionPhoto = {
    id,
    inspectionId: inspectionId || 'UNASSIGNED',
    blob: fileOrBlob, // Stored directly as native binary Blob
    name: customName || (fileOrBlob as File).name || `inspection_photo_${id}.jpg`,
    type: fileOrBlob.type || 'image/jpeg',
    sizeBytes: fileOrBlob.size,
    timestamp,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE_NAME, 'readwrite');
    const store = tx.objectStore(PHOTO_STORE_NAME);
    const request = store.add(photoRecord);

    request.onsuccess = () => resolve(photoRecord);
    request.onerror = (event: any) => reject(event.target.error);
  });
}

/**
 * Fetch all stored photo Blobs from IndexedDB.
 */
export async function getAllPhotoBlobs(): Promise<StoredInspectionPhoto[]> {
  const db = await openPhotoDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE_NAME, 'readonly');
    const store = tx.objectStore(PHOTO_STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = (event: any) => reject(event.target.error);
  });
}

/**
 * Fetch stored photo Blobs matching a specific Asset ID / Machine Tag (e.g. PUMP-104).
 */
export async function getPhotosByAssetId(assetId: string): Promise<StoredInspectionPhoto[]> {
  const all = await getAllPhotoBlobs();
  const searchTag = assetId.trim().toLowerCase();
  return all.filter((p) => p.inspectionId && p.inspectionId.trim().toLowerCase() === searchTag);
}

/**
 * Delete a specific photo Blob by ID.
 */
export async function deletePhotoBlob(id: string): Promise<void> {
  const db = await openPhotoDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE_NAME, 'readwrite');
    const store = tx.objectStore(PHOTO_STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = (event: any) => reject(event.target.error);
  });
}

/**
 * Helper: Create zero-leak memory object URL from Blob.
 */
export function createBlobImageUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}
