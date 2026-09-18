import { Capacitor } from "@capacitor/core";
import { SQLiteConnection, CapacitorSQLite } from "@capacitor-community/sqlite";
import localforage from "localforage";

export interface NoteMetadata {
  id: number;
  title: string;
  preview: string;
  date: string;
  category: string;
  styles: any;
  isLocked: boolean;
  password?: string;
  word_count?: number;
  char_count?: number;
  updated_at?: number;
  created_at?: number;
}

export interface NoteSavePayload {
  id?: number;
  title: string;
  content: string;
  preview?: string;
  date?: string;
  category?: string;
  styles?: any;
  isLocked?: boolean;
  password?: string;
}

// Helpers
export function computeTextStats(htmlContent: string): { wordCount: number; charCount: number; preview: string } {
  const clean = (htmlContent || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const wordCount = clean === "" ? 0 : clean.split(/\s+/).length;
  const charCount = clean.length;
  const preview = clean.substring(0, 100) + (clean.length > 100 ? "..." : "");
  return { wordCount, charCount, preview };
}

// IndexedDB fallback stores using localforage
const metaStore = localforage.createInstance({ name: "DarAlHikayat", storeName: "stories_meta" });
const bodyStore = localforage.createInstance({ name: "DarAlHikayat", storeName: "story_bodies" });
const appMetaStore = localforage.createInstance({ name: "DarAlHikayat", storeName: "app_meta" });

class StorageServiceManager {
  private sqliteConnection: SQLiteConnection | null = null;
  private db: any = null;
  private isNativeSQLite = false;
  private isInitialized = false;

  async init(): Promise<void> {
    if (this.isInitialized) return;

    if (Capacitor.isNativePlatform()) {
      try {
        this.sqliteConnection = new SQLiteConnection(CapacitorSQLite);
        const ret = await this.sqliteConnection.checkConnectionsConsistency();
        const isConn = (await this.sqliteConnection.isConnection("dar_alhikayat_db", false)).result;
        
        if (ret.result && isConn) {
          this.db = await this.sqliteConnection.retrieveConnection("dar_alhikayat_db", false);
        } else {
          this.db = await this.sqliteConnection.createConnection(
            "dar_alhikayat_db",
            false,
            "no-encryption",
            1,
            false
          );
        }

        await this.db.open();
        
        // Create tables
        const createTablesQuery = `
          CREATE TABLE IF NOT EXISTS stories (
            id INTEGER PRIMARY KEY,
            title TEXT NOT NULL,
            preview TEXT,
            date TEXT,
            category TEXT,
            styles TEXT,
            is_locked INTEGER DEFAULT 0,
            password TEXT,
            word_count INTEGER DEFAULT 0,
            char_count INTEGER DEFAULT 0,
            updated_at INTEGER,
            created_at INTEGER
          );
          CREATE TABLE IF NOT EXISTS story_bodies (
            story_id INTEGER PRIMARY KEY REFERENCES stories(id) ON DELETE CASCADE,
            html TEXT NOT NULL
          );
          CREATE TABLE IF NOT EXISTS app_meta (
            key TEXT PRIMARY KEY,
            value TEXT
          );
        `;
        await this.db.execute(createTablesQuery);

        // Try creating FTS5 table
        try {
          await this.db.execute(`
            CREATE VIRTUAL TABLE IF NOT EXISTS stories_fts USING fts5(
              title, body, content='', tokenize='unicode61 remove_diacritics 2'
            );
          `);
        } catch (e) {
          console.warn("FTS5 table creation warning (non-fatal):", e);
        }

        this.isNativeSQLite = true;
      } catch (err) {
        console.warn("Capacitor SQLite init fallback to IndexedDB:", err);
        this.isNativeSQLite = false;
      }
    } else {
      this.isNativeSQLite = false;
    }

    // Run migration if needed
    await this.migrateLegacyDataIfNeeded();
    this.isInitialized = true;
  }

  private async migrateLegacyDataIfNeeded(): Promise<void> {
    try {
      let isMigrated = false;
      if (this.isNativeSQLite) {
        const res = await this.db.query("SELECT value FROM app_meta WHERE key = 'migrated_to_sqlite_v3'");
        isMigrated = res.values && res.values.length > 0 && res.values[0].value === "true";
      } else {
        const val = await appMetaStore.getItem<string>("migrated_to_sqlite_v3");
        isMigrated = val === "true";
      }

      if (isMigrated) return;

      console.log("Migration check: Loading legacy notes for migration...");
      let legacyNotes: any[] = [];
      const v2Notes = await localforage.getItem<any[]>("dar_notes_v2");
      if (Array.isArray(v2Notes) && v2Notes.length > 0) {
        legacyNotes = v2Notes;
      } else {
        const rawLs = typeof window !== "undefined" ? localStorage.getItem("dar_notes") : null;
        if (rawLs) {
          try { legacyNotes = JSON.parse(rawLs); } catch (e) {}
        }
      }

      if (Array.isArray(legacyNotes) && legacyNotes.length > 0) {
        console.log(`Migrating ${legacyNotes.length} legacy stories to split storage...`);
        await this.importBatch(legacyNotes, () => {});
      }

      if (this.isNativeSQLite) {
        await this.db.execute("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('migrated_to_sqlite_v3', 'true');");
      } else {
        await appMetaStore.setItem("migrated_to_sqlite_v3", "true");
      }
      console.log("Migration completed successfully.");
    } catch (err) {
      console.error("Migration error:", err);
    }
  }

  async loadNotesMetadata(): Promise<NoteMetadata[]> {
    await this.init();
    if (this.isNativeSQLite) {
      const res = await this.db.query("SELECT id, title, preview, date, category, styles, is_locked, password, word_count, char_count, updated_at, created_at FROM stories ORDER BY id DESC;");
      if (!res.values) return [];
      return res.values.map((row: any) => ({
        id: row.id,
        title: row.title,
        preview: row.preview || "",
        date: row.date || "",
        category: row.category || "حكاية",
        styles: typeof row.styles === "string" ? JSON.parse(row.styles) : row.styles,
        isLocked: !!row.is_locked,
        password: row.password || "",
        word_count: row.word_count || 0,
        char_count: row.char_count || 0,
        updated_at: row.updated_at || Date.now(),
        created_at: row.created_at || Date.now(),
      }));
    } else {
      const keys = await metaStore.keys();
      const metadataList: NoteMetadata[] = [];
      for (const key of keys) {
        const item = await metaStore.getItem<NoteMetadata>(key);
        if (item) metadataList.push(item);
      }
      metadataList.sort((a, b) => b.id - a.id);
      return metadataList;
    }
  }

  async getStoryBody(storyId: number): Promise<string> {
    await this.init();
    if (this.isNativeSQLite) {
      const res = await this.db.query("SELECT html FROM story_bodies WHERE story_id = ?;", [storyId]);
      if (res.values && res.values.length > 0) {
        return res.values[0].html || "";
      }
      return "";
    } else {
      const html = await bodyStore.getItem<string>(String(storyId));
      return html || "";
    }
  }

  async saveStory(payload: NoteSavePayload): Promise<NoteMetadata> {
    await this.init();
    const now = Date.now();
    const id = payload.id || now;
    const stats = computeTextStats(payload.content);

    const formattedDate = payload.date || new Date().toLocaleDateString("ar-EG", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const metadata: NoteMetadata = {
      id,
      title: payload.title || "بدون عنوان",
      preview: payload.preview || stats.preview,
      date: formattedDate,
      category: payload.category || "حكاية",
      styles: payload.styles || {
        fontSize: 18,
        fontWeight: 400,
        textAlign: "right",
        textColor: "#121A1B",
        paperStyleIndex: 0,
      },
      isLocked: !!payload.isLocked,
      password: payload.password || "",
      word_count: stats.wordCount,
      char_count: stats.charCount,
      updated_at: now,
      created_at: payload.id ? undefined : now,
    };

    if (this.isNativeSQLite) {
      const stylesJson = JSON.stringify(metadata.styles);
      await this.db.execute(`
        INSERT OR REPLACE INTO stories (id, title, preview, date, category, styles, is_locked, password, word_count, char_count, updated_at, created_at)
        VALUES (
          ${id},
          '${metadata.title.replace(/'/g, "''")}',
          '${metadata.preview.replace(/'/g, "''")}',
          '${metadata.date.replace(/'/g, "''")}',
          '${metadata.category.replace(/'/g, "''")}',
          '${stylesJson.replace(/'/g, "''")}',
          ${metadata.isLocked ? 1 : 0},
          '${(metadata.password || "").replace(/'/g, "''")}',
          ${metadata.word_count},
          ${metadata.char_count},
          ${now},
          COALESCE((SELECT created_at FROM stories WHERE id = ${id}), ${now})
        );
      `);
      await this.db.execute(`
        INSERT OR REPLACE INTO story_bodies (story_id, html)
        VALUES (${id}, '${payload.content.replace(/'/g, "''")}');
      `);
    } else {
      await metaStore.setItem(String(id), metadata);
      await bodyStore.setItem(String(id), payload.content);
    }

    return metadata;
  }

  async deleteStories(ids: number[]): Promise<void> {
    await this.init();
    if (ids.length === 0) return;

    if (this.isNativeSQLite) {
      const idList = ids.join(",");
      await this.db.execute(`DELETE FROM stories WHERE id IN (${idList});`);
      await this.db.execute(`DELETE FROM story_bodies WHERE story_id IN (${idList});`);
    } else {
      for (const id of ids) {
        await metaStore.removeItem(String(id));
        await bodyStore.removeItem(String(id));
      }
    }
  }

  async importBatch(
    rawStories: any[],
    onProgress?: (processed: number, total: number) => void
  ): Promise<NoteMetadata[]> {
    await this.init();
    const total = rawStories.length;
    const importedMetadata: NoteMetadata[] = [];
    const chunkSize = 25;

    for (let i = 0; i < total; i += chunkSize) {
      const chunk = rawStories.slice(i, i + chunkSize);
      
      for (const item of chunk) {
        if (!item.title && !item.content) continue;
        const now = Date.now();
        const id = item.id || now + Math.floor(Math.random() * 10000);
        const stats = computeTextStats(item.content || "");

        const formattedDate = item.date || new Date().toLocaleDateString("ar-EG", {
          day: "numeric",
          month: "long",
          year: "numeric",
        });

        const meta: NoteMetadata = {
          id,
          title: item.title || "بدون عنوان",
          preview: item.preview || stats.preview,
          date: formattedDate,
          category: item.category || "حكاية مستوردة",
          styles: item.styles || {
            fontSize: 18,
            fontWeight: 400,
            textAlign: "right",
            textColor: "#121A1B",
            paperStyleIndex: 0,
          },
          isLocked: !!item.isLocked,
          password: item.password || "",
          word_count: item.word_count || stats.wordCount,
          char_count: item.char_count || stats.charCount,
          updated_at: now,
          created_at: now,
        };

        if (this.isNativeSQLite) {
          const stylesJson = JSON.stringify(meta.styles);
          const safeContent = (item.content || "").replace(/'/g, "''");
          await this.db.execute(`
            INSERT OR REPLACE INTO stories (id, title, preview, date, category, styles, is_locked, password, word_count, char_count, updated_at, created_at)
            VALUES (
              ${id},
              '${meta.title.replace(/'/g, "''")}',
              '${meta.preview.replace(/'/g, "''")}',
              '${meta.date.replace(/'/g, "''")}',
              '${meta.category.replace(/'/g, "''")}',
              '${stylesJson.replace(/'/g, "''")}',
              ${meta.isLocked ? 1 : 0},
              '${(meta.password || "").replace(/'/g, "''")}',
              ${meta.word_count},
              ${meta.char_count},
              ${now},
              ${now}
            );
            INSERT OR REPLACE INTO story_bodies (story_id, html)
            VALUES (${id}, '${safeContent}');
          `);
        } else {
          await metaStore.setItem(String(id), meta);
          await bodyStore.setItem(String(id), item.content || "");
        }

        importedMetadata.push(meta);
      }

      if (onProgress) {
        onProgress(Math.min(i + chunkSize, total), total);
      }

      // Yield frame to UI
      await new Promise((r) => setTimeout(r, 0));
    }

    return importedMetadata;
  }

  async exportFullBackupStream(): Promise<any[]> {
    await this.init();
    const metadataList = await this.loadNotesMetadata();
    const fullList: any[] = [];

    for (const meta of metadataList) {
      const html = await this.getStoryBody(meta.id);
      fullList.push({
        ...meta,
        content: html,
      });
    }

    return fullList;
  }
}

export const StorageService = new StorageServiceManager();
