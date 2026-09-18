import localforage from "localforage";

// Configure localforage to use IndexedDB as priority
localforage.config({
  name: "DarAlHikayat",
  storeName: "notes_store",
  description: "Storage for stories and notes in Dar Al Hikayat",
});

const NOTES_KEY = "dar_notes_v2"; // Versioning the key to avoid conflicts with old localStorage data

export const StorageService = {
  /**
   * Loads notes from IndexedDB. If empty, tries to migrate from localStorage.
   */
  async loadNotes(): Promise<any[]> {
    try {
      const notes = await localforage.getItem<any[]>(NOTES_KEY);
      if (notes && Array.isArray(notes)) {
        return notes;
      }
      
      // Migration logic from localStorage
      const legacyNotes = localStorage.getItem("dar_notes");
      if (legacyNotes) {
        try {
          const parsed = JSON.parse(legacyNotes);
          if (Array.isArray(parsed) && parsed.length > 0) {
            console.log(`Migrating ${parsed.length} notes from legacy storage...`);
            await this.saveNotes(parsed);
            // Optionally clear legacy storage after successful migration
            // localStorage.removeItem("dar_notes");
            return parsed;
          }
        } catch (e) {
          console.error("Failed to parse legacy notes during migration:", e);
        }
      }
      
      return [];
    } catch (error) {
      console.error("StorageService.loadNotes error:", error);
      return [];
    }
  },

  /**
   * Saves notes to IndexedDB asynchronously.
   */
  async saveNotes(notes: any[]): Promise<void> {
    try {
      await localforage.setItem(NOTES_KEY, notes);
    } catch (error) {
      console.error("StorageService.saveNotes error:", error);
      throw error;
    }
  },

  /**
   * Clears all notes.
   */
  async clearNotes(): Promise<void> {
    await localforage.removeItem(NOTES_KEY);
  }
};
