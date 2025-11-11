import initSqlJs from 'sql.js';
import type { SqlJsDatabase } from 'sql.js';
import { DraftState, Card } from '../types';

type NavigatorStorageLike = {
  getDirectory?: () => Promise<FileSystemDirectoryHandleLike>;
  persist?: () => Promise<boolean>;
};

type FileSystemDirectoryHandleLike = {
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandleLike>;
};

type FileSystemFileHandleLike = {
  getFile(): Promise<File>;
  createWritable(): Promise<FileSystemWritableFileStreamLike>;
};

type FileSystemWritableFileStreamLike = {
  write(data: Uint8Array): Promise<void>;
  close(): Promise<void>;
};

type NavigatorWithStorage = Navigator & { storage?: NavigatorStorageLike };

const DB_FILE_NAME = 'lorcana.sqlite';

let db: SqlJsDatabase | null = null;
let dbFileHandlePromise: Promise<FileSystemFileHandleLike | null> | null = null;

export interface SavedDeck {
  id: number;
  name: string;
  created_at: string;
  total_cards: number;
  cards_json: string;
  draft_id: number | null;
}

export interface SavedDraft {
  id: number;
  name: string;
  created_at: string;
  draft_state_json: string;
}

function getNavigatorStorage(): NavigatorStorageLike | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const nav = window.navigator as NavigatorWithStorage;
  return nav.storage ?? null;
}

async function getDatabaseFileHandle(): Promise<FileSystemFileHandleLike | null> {
  if (dbFileHandlePromise) {
    return dbFileHandlePromise;
  }

  const storage = getNavigatorStorage();
  if (!storage || typeof storage.getDirectory !== 'function') {
    console.warn('[database] Origin Private File System unavailable; falling back to browser storage.');
    dbFileHandlePromise = Promise.resolve(null);
    return dbFileHandlePromise;
  }

  dbFileHandlePromise = (async () => {
    if (!storage || typeof storage.getDirectory !== 'function') {
      return null;
    }
    try {
      await storage.persist?.();
      const directoryHandle = await storage.getDirectory();
      return await directoryHandle.getFileHandle(DB_FILE_NAME, { create: true });
    } catch (err) {
      console.error('[database] Failed to access OPFS, falling back to browser storage:', err);
      return null;
    }
  })();

  return dbFileHandlePromise;
}

async function readDatabaseFromFile(): Promise<Uint8Array | null> {
  try {
    const fileHandle = await getDatabaseFileHandle();
    if (!fileHandle) return null;

    const file = await fileHandle.getFile();
    if (!file || file.size === 0) {
      return null;
    }

    const buffer = await file.arrayBuffer();
    return new Uint8Array(buffer);
  } catch (err) {
    console.error('[database] Failed to read database file, falling back to browser storage:', err);
    return null;
  }
}

function readDatabaseFromLocalStorage(): Uint8Array | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const savedDb = window.localStorage.getItem('lorcana-db');
    if (!savedDb) {
      return null;
    }

    const binaryString = atob(savedDb);
    const buffer = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i += 1) {
      buffer[i] = binaryString.charCodeAt(i);
    }
    return buffer;
  } catch (err) {
    console.error('[database] Failed to read database from localStorage:', err);
    return null;
  }
}

async function writeDatabaseToFile(data: Uint8Array): Promise<boolean> {
  try {
    const fileHandle = await getDatabaseFileHandle();
    if (!fileHandle) return false;

    const writable = await fileHandle.createWritable();
    await writable.write(data);
    await writable.close();
    return true;
  } catch (err) {
    console.error('[database] Failed to write database to file:', err);
    return false;
  }
}

function writeDatabaseToLocalStorage(data: Uint8Array): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const chunkSize = 8192;
    let binaryString = '';
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.subarray(i, Math.min(i + chunkSize, data.length));
      for (let j = 0; j < chunk.length; j += 1) {
        binaryString += String.fromCharCode(chunk[j]);
      }
    }

    const base64 = btoa(binaryString);
    window.localStorage.setItem('lorcana-db', base64);
  } catch (err) {
    console.error('[database] Failed to write database to localStorage:', err);
  }
}

async function initDatabase(): Promise<SqlJsDatabase> {
  if (db) return db;

  try {
    const SQL = await initSqlJs({
      locateFile: (file: string) => `https://sql.js.org/dist/${file}`
    });

    const fileData = await readDatabaseFromFile();
    const localStorageData = fileData ? null : readDatabaseFromLocalStorage();

    if (fileData) {
      db = new SQL.Database(fileData);
    } else if (localStorageData) {
      db = new SQL.Database(localStorageData);
    } else {
      db = new SQL.Database();
    }

    db.run(`
      CREATE TABLE IF NOT EXISTS saved_decks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        total_cards INTEGER NOT NULL,
        cards_json TEXT NOT NULL,
        draft_id INTEGER
      );
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS saved_drafts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        draft_state_json TEXT NOT NULL
      );
    `);

    // Ensure draft_id column exists on saved_decks
    const deckTableInfo = db.exec("PRAGMA table_info(saved_decks)");
    let hasDraftIdColumn = false;
    if (deckTableInfo.length > 0) {
      const values = deckTableInfo[0].values;
      for (const row of values) {
        // PRAGMA table_info returns columns: cid, name, type, notnull, dflt_value, pk
        if (row[1] === 'draft_id') {
          hasDraftIdColumn = true;
          break;
        }
      }
    }
    if (!hasDraftIdColumn) {
      db.run('ALTER TABLE saved_decks ADD COLUMN draft_id INTEGER');
    }

    if (!fileData) {
      await saveDatabase();
    }

    return db;
  } catch (err) {
    console.error('Failed to initialize database:', err);
    throw new Error(`Database initialization failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function saveDatabase(): Promise<void> {
  if (!db) return;

  try {
    const data = db.export();
    const persistedToFile = await writeDatabaseToFile(data);
    if (!persistedToFile) {
      writeDatabaseToLocalStorage(data);
    }
  } catch (err) {
    console.error('Error saving database:', err);
  }
}

export async function saveDeck(name: string, cards: Card[], draftId?: number | null): Promise<number> {
  try {
    const database = await initDatabase();
    
    const cardsJson = JSON.stringify(cards);
    const createdAt = new Date().toISOString();
    const totalCards = cards.length;

    database.run(
      'INSERT INTO saved_decks (name, created_at, total_cards, cards_json, draft_id) VALUES (?, ?, ?, ?, ?)',
      [name, createdAt, totalCards, cardsJson, draftId ?? null]
    );

    await saveDatabase();

    // Get the last inserted ID
    const result = database.exec('SELECT last_insert_rowid() as id');
    if (result.length === 0 || result[0].values.length === 0) {
      throw new Error('Failed to get inserted deck ID');
    }
    return result[0].values[0][0] as number;
  } catch (err) {
    console.error('Error saving deck:', err);
    throw new Error(`Failed to save deck: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function getAllDecks(): Promise<SavedDeck[]> {
  const database = await initDatabase();
  
  const result = database.exec('SELECT * FROM saved_decks ORDER BY created_at DESC');
  
  if (result.length === 0) return [];

  const columns = result[0].columns;
  const values = result[0].values;

  return values.map((row: any[]) => {
    const deck: any = {};
    columns.forEach((col: string, idx: number) => {
      deck[col] = row[idx];
    });
    return deck as SavedDeck;
  });
}

export async function getDeck(id: number): Promise<SavedDeck | null> {
  try {
    const database = await initDatabase();
    
    // sql.js exec doesn't support parameters, so we need to escape manually
    const result = database.exec(`SELECT * FROM saved_decks WHERE id = ${id}`);
    
    if (result.length === 0 || result[0].values.length === 0) return null;

    const columns = result[0].columns;
    const row = result[0].values[0];
    
    const deck: any = {};
    columns.forEach((col: string, idx: number) => {
      deck[col] = row[idx];
    });
    
    return deck as SavedDeck;
  } catch (err) {
    console.error('Error getting deck:', err);
    return null;
  }
}

export async function deleteDeck(id: number): Promise<void> {
  const database = await initDatabase();
  database.run('DELETE FROM saved_decks WHERE id = ?', [id]);
  await saveDatabase();
}

export async function updateDeckName(id: number, newName: string): Promise<void> {
  try {
    const database = await initDatabase();
    database.run('UPDATE saved_decks SET name = ? WHERE id = ?', [newName, id]);
    await saveDatabase();
  } catch (err) {
    console.error('Error updating deck name:', err);
    throw new Error(`Failed to update deck name: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Update deck cards
 */
export async function updateDeckCards(id: number, cards: Card[]): Promise<void> {
  try {
    const database = await initDatabase();
    const cardsJson = JSON.stringify(cards);
    const totalCards = cards.length;
    database.run('UPDATE saved_decks SET cards_json = ?, total_cards = ? WHERE id = ?', [cardsJson, totalCards, id]);
    await saveDatabase();
  } catch (err) {
    console.error('Error updating deck cards:', err);
    throw new Error(`Failed to update deck cards: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Delete all decks that are not assigned to any draft (draft_id IS NULL)
 */
export async function deleteUnassignedDecks(): Promise<number> {
  try {
    const database = await initDatabase();
    
    // First, count how many will be deleted
    const countResult = database.exec('SELECT COUNT(*) as count FROM saved_decks WHERE draft_id IS NULL');
    let count = 0;
    if (countResult.length > 0 && countResult[0].values.length > 0) {
      count = countResult[0].values[0][0] as number;
    }
    
    // Delete all unassigned decks
    database.run('DELETE FROM saved_decks WHERE draft_id IS NULL');
    await saveDatabase();
    
    return count;
  } catch (err) {
    console.error('Error deleting unassigned decks:', err);
    throw new Error(`Failed to delete unassigned decks: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Save a draft state to the database
 */
export async function saveDraft(name: string, draftState: DraftState): Promise<number> {
  try {
    const database = await initDatabase();
    
    const draftStateJson = JSON.stringify(draftState);
    const createdAt = new Date().toISOString();

    database.run(
      'INSERT INTO saved_drafts (name, created_at, draft_state_json) VALUES (?, ?, ?)',
      [name, createdAt, draftStateJson]
    );

    await saveDatabase();

    // Get the last inserted ID
    const result = database.exec('SELECT last_insert_rowid() as id');
    if (result.length === 0 || result[0].values.length === 0) {
      throw new Error('Failed to get inserted draft ID');
    }
    return result[0].values[0][0] as number;
  } catch (err) {
    console.error('Error saving draft:', err);
    throw new Error(`Failed to save draft: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Get all saved drafts
 */
export async function getAllDrafts(): Promise<SavedDraft[]> {
  const database = await initDatabase();
  
  const result = database.exec('SELECT * FROM saved_drafts ORDER BY created_at DESC');
  
  if (result.length === 0) return [];

  const columns = result[0].columns;
  const values = result[0].values;

  return values.map((row: any[]) => {
    const draft: any = {};
    columns.forEach((col: string, idx: number) => {
      draft[col] = row[idx];
    });
    return draft as SavedDraft;
  });
}

/**
 * Get a draft by ID
 */
export async function getDraft(id: number): Promise<SavedDraft | null> {
  try {
    const database = await initDatabase();
    
    // sql.js exec doesn't support parameters, so we need to escape manually
    const result = database.exec(`SELECT * FROM saved_drafts WHERE id = ${id}`);
    
    if (result.length === 0 || result[0].values.length === 0) return null;

    const columns = result[0].columns;
    const row = result[0].values[0];
    
    const draft: any = {};
    columns.forEach((col: string, idx: number) => {
      draft[col] = row[idx];
    });
    
    return draft as SavedDraft;
  } catch (err) {
    console.error('Error getting draft:', err);
    return null;
  }
}

/**
 * Delete a draft
 */
export async function deleteDraft(id: number): Promise<void> {
  const database = await initDatabase();
  database.run('DELETE FROM saved_drafts WHERE id = ?', [id]);
  await saveDatabase();
}

/**
 * Update a draft name
 */
export async function updateDraftName(id: number, newName: string): Promise<void> {
  try {
    const database = await initDatabase();
    database.run('UPDATE saved_drafts SET name = ? WHERE id = ?', [newName, id]);
    await saveDatabase();
  } catch (err) {
    console.error('Error updating draft name:', err);
    throw new Error(`Failed to update draft name: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Get the most recent draft state (for resuming)
 */
export async function getLatestDraftState(): Promise<DraftState | null> {
  try {
    const database = await initDatabase();
    const result = database.exec('SELECT draft_state_json FROM saved_drafts ORDER BY created_at DESC LIMIT 1');
    
    if (result.length === 0 || result[0].values.length === 0) return null;
    
    const draftStateJson = result[0].values[0][0] as string;
    return JSON.parse(draftStateJson) as DraftState;
  } catch (err) {
    console.error('Error getting latest draft state:', err);
    return null;
  }
}

/**
 * Save the current draft state (for auto-save/resume)
 */
export async function saveCurrentDraftState(draftState: DraftState): Promise<void> {
  try {
    const database = await initDatabase();
    
    // Check if there's already a draft with name "Current Draft"
    const existing = database.exec(`SELECT id FROM saved_drafts WHERE name = 'Current Draft' LIMIT 1`);
    
    const draftStateJson = JSON.stringify(draftState);
    const createdAt = new Date().toISOString();
    
    if (existing.length > 0 && existing[0].values.length > 0) {
      // Update existing "Current Draft"
      const id = existing[0].values[0][0] as number;
      database.run('UPDATE saved_drafts SET draft_state_json = ?, created_at = ? WHERE id = ?', 
        [draftStateJson, createdAt, id]);
    } else {
      // Create new "Current Draft"
      database.run(
        'INSERT INTO saved_drafts (name, created_at, draft_state_json) VALUES (?, ?, ?)',
        ['Current Draft', createdAt, draftStateJson]
      );
    }
    
    await saveDatabase();
  } catch (err) {
    console.error('Error saving current draft state:', err);
    // Don't throw - allow the app to continue even if save fails
  }
}

/**
 * Clear the current draft state
 */
export async function clearCurrentDraftState(): Promise<void> {
  try {
    const database = await initDatabase();
    database.run(`DELETE FROM saved_drafts WHERE name = 'Current Draft'`);
    await saveDatabase();
  } catch (err) {
    console.error('Error clearing current draft state:', err);
  }
}

/**
 * Export the database as a downloadable file
 */
export async function exportDatabase(): Promise<void> {
  try {
    const database = await initDatabase();
    const data = database.export();
    const arrayBuffer = new ArrayBuffer(data.byteLength);
    new Uint8Array(arrayBuffer).set(data);
    
    // Create a blob from the database data
    const blob = new Blob([arrayBuffer], { type: 'application/x-sqlite3' });
    const url = URL.createObjectURL(blob);
    
    // Create a temporary anchor element to trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = `lorcana-decks-${new Date().toISOString().split('T')[0]}.db`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    // Clean up the URL object
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Error exporting database:', err);
    throw new Error(`Failed to export database: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Import a database from a file and replace the current database
 */
export async function importDatabase(file: File): Promise<void> {
  try {
    // Read the file as an ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Initialize SQL.js
    const SQL = await initSqlJs({
      locateFile: (file: string) => `https://sql.js.org/dist/${file}`
    });
    
    // Try to open the database file
    try {
      const importedDb = new SQL.Database(uint8Array);
      
      // Verify it has the correct table structure
      const deckTable = importedDb.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='saved_decks'");
      if (deckTable.length === 0 || deckTable[0].values.length === 0) {
        throw new Error('Invalid database file: missing saved_decks table');
      }
      const draftTable = importedDb.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='saved_drafts'");
      if (draftTable.length === 0 || draftTable[0].values.length === 0) {
        throw new Error('Invalid database file: missing saved_drafts table');
      }
      
      // Close the current database if it exists
      if (db) {
        db.close();
      }
      
      // Replace with the imported database
      db = importedDb;
      
      await saveDatabase();
    } catch (err) {
      throw new Error(`Invalid database file: ${err instanceof Error ? err.message : String(err)}`);
    }
  } catch (err) {
    console.error('Error importing database:', err);
    throw new Error(`Failed to import database: ${err instanceof Error ? err.message : String(err)}`);
  }
}

