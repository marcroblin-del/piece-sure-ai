export const BACKUP_TABLES = [
  'vehicles',
  'parts',
  'compatibilities',
  'documents',
  'history',
] as const;

export type BackupTable = typeof BACKUP_TABLES[number];

export type BackupPreview = {
  valid: boolean;
  errors: string[];
  counts: Record<BackupTable, number>;
};

export function inspectBackup(value: unknown): BackupPreview {
  const errors: string[] = [];
  const counts = Object.fromEntries(
    BACKUP_TABLES.map(table => [table, 0])
  ) as Record<BackupTable, number>;

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { valid: false, errors: ['JSON invalide'], counts };
  }

  const backup = value as Record<string, unknown>;

  if (backup.format !== 'PIECE-SURE-AI-BACKUP') {
    errors.push('Format de sauvegarde incorrect');
  }

  if (backup.version !== 1) {
    errors.push('Version de sauvegarde non prise en charge');
  }

  if (!backup.data || typeof backup.data !== 'object') {
    errors.push('Données absentes');
    return { valid: false, errors, counts };
  }

  const data = backup.data as Record<string, unknown>;

  for (const table of BACKUP_TABLES) {
    if (!Array.isArray(data[table])) {
      errors.push('Table absente ou invalide : ' + table);
    } else {
      counts[table] = data[table].length;

      const ids = new Set<string>();

      for (const [index, record] of data[table].entries()) {
        if (!record || typeof record !== 'object' || Array.isArray(record)) {
          errors.push(table + ' : enregistrement invalide ' + index);
          continue;
        }

        const id = (record as Record<string, unknown>).id;

        if (typeof id !== 'string' || !id.trim()) {
          errors.push(table + ' : identifiant absent ' + index);
          continue;
        }

        if (ids.has(id)) {
          errors.push(table + ' : identifiant en double ' + id);
        }

        ids.add(id);
      }
    }
  }

  if (
    Array.isArray(data.vehicles) &&
    Array.isArray(data.parts) &&
    Array.isArray(data.compatibilities)
  ) {
    const vehicles = new Set(
      data.vehicles.map((v: { id?: string }) => v?.id)
    );

    const parts = new Set(
      data.parts.map((p: { id?: string }) => p?.id)
    );

    for (const relation of data.compatibilities) {
      if (!relation || typeof relation !== 'object') continue;

      if (!vehicles.has(relation.vehicleId)) {
        errors.push('Compatibilité : véhicule introuvable');
      }

      if (!parts.has(relation.partId)) {
        errors.push('Compatibilité : pièce introuvable');
      }

      if (relation.authorized === true) {
        errors.push('Compatibilité autorisée : examen manuel obligatoire');
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    counts,
  };
}
