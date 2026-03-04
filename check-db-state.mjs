import { initDB, queryAll } from './server/db.js';

async function check() {
    try {
        await initDB();
        const settings = queryAll("SELECT * FROM settings WHERE key IN ('gemini_api_key', 'google_project_id', 'google_location')");
        console.log("Current Settings in DB:");
        settings.forEach(s => {
            let val = s.value;
            if (s.key === 'gemini_api_key' && val) {
                val = val.substring(0, 5) + '...' + val.substring(val.length - 4);
            }
            console.log(`- ${s.key}: [${val}]`);
        });
        process.exit(0);
    } catch (e) {
        console.error("Error checking DB:", e);
        process.exit(1);
    }
}

check();
