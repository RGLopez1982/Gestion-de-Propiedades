import { rmSync } from 'node:fs';
import { resolve } from 'node:path';

const dbFile = process.env.DB_PATH || 'data.db';
const targets = [dbFile, `${dbFile}-wal`, `${dbFile}-shm`];

for (const target of targets) {
  rmSync(resolve(process.cwd(), target), { force: true });
}

console.log('Base de datos limpiada. Al iniciar el servidor se crearan tablas vacias.');
