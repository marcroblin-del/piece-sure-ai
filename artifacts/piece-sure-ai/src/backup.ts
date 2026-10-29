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
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result !== 'string') {
          reject(new Error('Lecture du document impossible'));
          return;
        }
        resolve(result.split(',')[1] || '');
      };
      reader.onerror = () =>
        reject(reader.error || new Error('Erreur de lecture du document'));
      reader.readAsDataURL(record);
    });

    return {
      __type: 'Blob',
      mime: record.type,
      data,
    };
  }

  if (Array.isArray(record)) {
    return Promise.all(record.map(async (item, index) => {
      try {
        return await serializeRecord(item);
      } catch (error) {
        const doc = item as { id?: string; filename?: string };
        throw new Error(
          'Enregistrement ' + index +
          ' — ID : ' + (doc?.id || 'inconnu') +
          ' — Fichier : ' + (doc?.filename || 'sans nom') +
          ' — ' + String(error)
        );
      }
    }));
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

    let tables;
    try {
      tables = await readAllTables(db);
    } catch (error) {
      throw new Error('LECTURE INDEXEDDB : ' + String(error));
    }

    for (const table of TABLES) {
      try {
        data[table] = await serializeRecord(tables[table]);
      } catch (error) {
        throw new Error('SERIALISATION ' + table + ' : ' + String(error));
      }
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
