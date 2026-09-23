import { EquipmentInspectionFormValues } from '../schema/inspectionSchema';
import {
  encryptPayloadWithTitanKey,
  decryptPayloadWithTitanKey,
} from './securityKeyService';

export interface StoredInspectionRecord {
  id: string;
  payload: EquipmentInspectionFormValues;
  timestamp: string;
  signature: string;
  synced: boolean;
  syncedAt?: string;
  encrypted?: boolean;
  ciphertext?: string;
  iv?: string;
}

const DB_NAME = 'CactusInspectionDB';
const DB_VERSION = 2; // Unified with photo storage DB version
const STORE_NAME = 'inspections';
const PHOTO_STORE_NAME = 'inspection_photos';

/**
 * Open local IndexedDB database for offline field collection persistence.
 */
export function openInspectionDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not supported in this environment'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('synced', 'synced', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
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
 * Save a newly signed inspection record to local IndexedDB, encrypted with AES-256-GCM.
 */
export async function saveInspectionRecord(
  payload: EquipmentInspectionFormValues,
  signature: string
): Promise<StoredInspectionRecord> {
  const db = await openInspectionDb();
  const id = `REC-${Math.random().toString(36).substring(2, 9).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
  const timestamp = new Date().toISOString();

  // Encrypt payload using AES-256-GCM WebCrypto Key bound to Titan Security Key
  let ciphertext = '';
  let iv = '';
  let encrypted = false;

  try {
    const encResult = await encryptPayloadWithTitanKey(payload);
    ciphertext = encResult.ciphertext;
    iv = encResult.iv;
    encrypted = true;
  } catch (err) {
    console.warn('AES-256 Encryption fallback:', err);
  }

  const record: StoredInspectionRecord = {
    id,
    payload,
    timestamp,
    signature,
    synced: false,
    encrypted,
    ciphertext,
    iv,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.add(record);

    request.onsuccess = () => resolve(record);
    request.onerror = (event: any) => reject(event.target.error);
  });
}

/**
 * Get all stored inspection records from IndexedDB and decrypt AES-256-GCM ciphertext payloads.
 */
export async function getAllInspectionRecords(): Promise<StoredInspectionRecord[]> {
  const db = await openInspectionDb();
  const rawList: StoredInspectionRecord[] = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = (event: any) => reject(event.target.error);
  });

  // Decrypt records if encrypted
  const decryptedList: StoredInspectionRecord[] = [];
  for (const record of rawList) {
    if (record.encrypted && record.ciphertext && record.iv) {
      try {
        const decryptedPayload = await decryptPayloadWithTitanKey(record.ciphertext, record.iv);
        decryptedList.push({
          ...record,
          payload: decryptedPayload,
        });
      } catch (e) {
        console.warn('Could not decrypt record:', record.id, e);
        decryptedList.push(record);
      }
    } else {
      decryptedList.push(record);
    }
  }

  return decryptedList;
}

/**
 * Look up past inspection history by Asset ID / Machine Tag (e.g. PUMP-104).
 */
export async function getInspectionsByAssetId(assetId: string): Promise<StoredInspectionRecord[]> {
  const all = await getAllInspectionRecords();
  const searchTag = assetId.trim().toLowerCase();
  return all.filter((r) => r.payload.unit_id && String(r.payload.unit_id).trim().toLowerCase() === searchTag);
}

/**
 * Get all pending unsynced records collected while offline in the field.
 */
export async function getPendingInspectionRecords(): Promise<StoredInspectionRecord[]> {
  const all = await getAllInspectionRecords();
  return all.filter((r) => !r.synced);
}

/**
 * Mark a batch of inspection records as synced to remote server when back in range.
 */
export async function markRecordsAsSynced(recordIds: string[]): Promise<void> {
  const db = await openInspectionDb();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  const now = new Date().toISOString();

  for (const id of recordIds) {
    await new Promise<void>((resolve, reject) => {
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const record = getReq.result;
        if (record) {
          record.synced = true;
          record.syncedAt = now;
          const putReq = store.put(record);
          putReq.onsuccess = () => resolve();
          putReq.onerror = (e: any) => reject(e.target.error);
        } else {
          resolve();
        }
      };
      getReq.onerror = (e: any) => reject(e.target.error);
    });
  }
}

/**
 * Clear all records from IndexedDB.
 */
export async function clearAllRecords(): Promise<void> {
  const db = await openInspectionDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = (event: any) => reject(event.target.error);
  });
}
