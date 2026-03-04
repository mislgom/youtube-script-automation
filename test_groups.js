import { initDB, queryAll } from './server/db.js';

async function run() {
    await initDB();
    const groups = queryAll('SELECT DISTINCT group_name FROM categories');
    console.log('Groups:', JSON.stringify(groups.map(g => g.group_name), null, 2));

    const all = queryAll('SELECT * FROM categories ORDER BY group_name, sort_order');
    console.log('All Categories:', JSON.stringify(all, null, 2));
}
run();
