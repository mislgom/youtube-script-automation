import { initDB } from './server/db.js';
import { buildYadamGapMatrix } from './server/services/gap-analyzer.js';

async function test() {
    await initDB();
    console.log('--- Testing Yadam Gap Matrix (Hybrid) ---');
    try {
        const result = buildYadamGapMatrix([]);
        console.log('Stats:', JSON.stringify(result.stats, null, 2));
        console.log('Top Combined (First 3):', JSON.stringify(result.topCombined?.slice(0, 3), null, 2));
        console.log('Gaps Count:', result.gaps?.length);
        console.log('Matrix Dimensions:', result.matrix?.length, 'x', result.matrix?.[0]?.length);
    } catch (e) {
        console.error('Test failed:', e);
    }
}

test();
