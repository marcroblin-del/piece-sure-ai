const DB_NAME = 'piece-sure-local';
const DB_VERSION = 1;

const TABLES = [
  'vehicles',
  'parts',
  'compatibilities',
  'documents',
  'history',
] as const;

function readDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      request.transaction?.abort();
      reject(new Error('Base locale absente ou incompatible.'));
    };
  });
}

function readAllTables(
  db: IDBDatabase
): Promise<Record<string, unknown[]>> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([...TABLES], 'readonly');
    const result: Record<string, unknown[]> = {};

    for (const table of TABLES) {
      const request = tx.objectStore(table).getAll();

      request.onsuccess = () => {
        result[table] = request.result;
      };
    }

    tx.oncomplete = () => resolve(result);
    tx.onerror = () =>
      reject(tx.error || new Error('Erreur de lecture IndexedDB'));
    tx.onabort = () =>
      reject(tx.error || new Error('Lecture IndexedDB interrompue'));
  });
}

async function serializeRecord(
  record: unknown
): Promise<unknown> {
  if (record instanceof Blob) {
    const bytes = new Uint8Array(await record.arrayBuffer());
    let binary = '';
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    return {
      __type: 'Blob',
      mime: record.type,
      data: btoa(binary),
    };
  }

  if (Array.isArray(record)) {
    return Promise.all(record.map(serializeRecord));
  }

  if (record && typeof record === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(record)) {
      result[key] = await serializeRecord(value);
    }
    return result;
  }

  return record;
}

export async function createBackup(): Promise<Blob> {
  const db = await readDatabase();

  try {
    const data: Record<string, unknown> = {};

    const tables = await readAllTables(db);

    for (const table of TABLES) {
      data[table] = await serializeRecord(tables[table]);
    }

    const backup = {
      format: 'PIECE-SURE-AI-BACKUP',
      version: 1,
      createdAt: new Date().toISOString(),
      database: DB_NAME,
      data,
    };

    return new Blob(
      [JSON.stringify(backup, null, 2)],
      { type: 'application/json' }
    );
  } finally {
    db.close();
  }
}
