import { initDB, queryOne, queryAll } from './server/db.js';

async function run() {
    await initDB();

    const totalVideos = queryOne("SELECT COUNT(*) as cnt FROM videos");
    const totalCategories = queryOne("SELECT COUNT(*) as cnt FROM video_categories");
    const categoriesByGroup = queryAll("SELECT group_name, COUNT(*) as cnt FROM categories GROUP BY group_name");

    console.log('--- Database Statistics ---');
    console.log(`Total Videos: ${totalVideos.cnt}`);
    console.log(`Total Video-Category Mappings: ${totalCategories.cnt}`);
    console.log('--- Categories by Group ---');
    categoriesByGroup.forEach(g => console.log(`${g.group_name}: ${g.cnt}`));

    // Check specific Yadam categories
    const eraCats = queryAll("SELECT name, id FROM categories WHERE group_name = '시대'");
    const eventCats = queryAll("SELECT name, id FROM categories WHERE group_name = '사건유형'");

    console.log('\n--- Specific Counts ---');
    console.log(`Era Categories: ${eraCats.length}`);
    console.log(`Event Categories: ${eventCats.length}`);

    // Test a specific intersection (Joseon Era + Animal)
    const joseon = eraCats.find(c => c.name.includes('조선'));
    const animal = queryOne("SELECT id FROM categories WHERE name = '동물'");

    if (joseon && animal) {
        const intersection = queryOne(`
            SELECT COUNT(DISTINCT vc1.video_id) as cnt
            FROM video_categories vc1
            JOIN video_categories vc2 ON vc1.video_id = vc2.video_id
            WHERE vc1.category_id = ? AND vc2.category_id = ?
        `, [joseon.id, animal.id]);
        console.log(`\nIntersection [${joseon.name}] + [동물]: ${intersection.cnt}`);
    }
}

run().catch(console.error);
