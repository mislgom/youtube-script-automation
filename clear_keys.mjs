import { initDB, runSQL } from './server/db.js';

async function clearKeys() {
    try {
        await initDB();
        runSQL("UPDATE settings SET value = '' WHERE key = 'gemini_api_key'");
        runSQL("UPDATE settings SET value = '' WHERE key = 'youtube_api_key'");
        console.log("✅ Keys cleared successfully.");
    } catch (e) {
        console.error("Failed to clear keys:", e.message);
    }
}

clearKeys();
