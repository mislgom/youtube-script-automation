import { queryAll } from './server/db.js';

async function diagnose() {
    try {
        console.log('--- Categories Group Count ---');
        const groups = queryAll('SELECT group_name, COUNT(*) as cnt FROM categories GROUP BY group_name');
        console.table(groups);

        console.log('--- Tagged Videos Count by Group ---');
        const tagged = queryAll(`
      SELECT c.group_name, COUNT(DISTINCT vc.video_id) as video_cnt 
      FROM video_categories vc 
      JOIN categories c ON vc.category_id = c.id 
      GROUP BY c.group_name
    `);
        console.table(tagged);

        console.log('--- Era Category Detail ---');
        const eras = queryAll("SELECT id, name FROM categories WHERE group_name = '시대'");
        console.table(eras);

        console.log('--- Event Category Detail ---');
        const events = queryAll("SELECT id, name FROM categories WHERE group_name = '사건유형'");
        console.table(events);

        console.log('--- Source Category Detail ---');
        const sources = queryAll("SELECT id, name FROM categories WHERE group_name = '소재출처'");
        console.table(sources);

    } catch (err) {
        console.error('Diagnosis Failed:', err);
    }
}

diagnose();
