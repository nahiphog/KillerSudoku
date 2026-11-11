import type { SimulationRecord } from './engine/simulation';

/** Keep matching grids on disk rather than retaining up to a million DOM boards. */
export async function simulationStore() {
  const name = 'killer-simulation-' + crypto.randomUUID();
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('grids');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return {
    put(index: number, record: SimulationRecord) {
      return new Promise<void>((resolve, reject) => {
        const transaction = database.transaction('grids', 'readwrite');
        transaction.objectStore('grids').put(record, index);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error ?? new Error('Grid storage interrupted.'));
      });
    },
    get(index: number) {
      return new Promise<SimulationRecord>((resolve, reject) => {
        const request = database.transaction('grids').objectStore('grids').get(index);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    },
    dispose() { database.close(); indexedDB.deleteDatabase(name); },
  };
}
