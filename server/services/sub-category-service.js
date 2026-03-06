import { queryOne, runSQLNoSave, saveDB } from '../db.js';
import { callGemini } from './gemini-service.js';

export const SUB_CAT_MAP = {
    '풍속/일상': ['혼인/결혼','과거시험/출세','효도/가족','탐욕/재물','꾀/지혜','남녀관계','관아/송사','신분/계급','음식/풍습','미신/점술'],
    '복수극':    ['원귀복수','가문복수','배신복수','억울한누명','첩/처복수','노비복수','관리응징','도적복수'],
    '로맨스':    ['신분초월사랑','이별/재회','기생사랑','금지된사랑','혼인약속','환생사랑','삼각관계','첫사랑'],
    '괴담/미스터리': ['귀신출몰','저주/주술','흉가','빙의','괴물/요괴','예언/징조','사후세계','기이한현상'],
    '살인/범죄': ['독살','강도/약탈','암살','연쇄살인','위조/사칭','납치','은폐/증거인멸','관리부패'],
    '전쟁':      ['임진왜란','병자호란','전장영웅','포로/피난','첩보/밀정','의병','항복/배신','전후복구'],
    '사기':      ['사칭/신분위조','매매사기','혼인사기','과거부정','위조문서','도박사기','점술사기','관직매매'],
    '동물':      ['은혜갚는동물','동물변신','동물과교감','괴이한동물','동물징조','동물복수'],
    '기행':      ['명산유람','이국체험','기인기사','표류/漂流'],
};

export async function classifySingleVideoSubCategory(videoId, videoTitle, categoryNames) {
    if (!categoryNames || categoryNames.length === 0) return;

    for (const catName of categoryNames) {
        const subCats = SUB_CAT_MAP[catName];
        if (!subCats) continue;

        const prompt = `아래 유튜브 야담 영상들의 제목을 보고, 각 영상이 해당하는 세부 카테고리를 1개 선택하세요.

[사건유형: ${catName}]
세부 카테고리 목록: ${subCats.join(', ')}

영상 목록:
1. ${videoId} | ${videoTitle}

응답 형식 (JSON 배열만 출력):
[{"videoId":"영상ID","subCategory":"선택한세부카테고리"},...]
주의: 반드시 위 세부 카테고리 목록에서만 선택하세요.`;

        try {
            await new Promise(resolve => setTimeout(resolve, 5000));
            const raw = await callGemini(prompt, { jsonMode: true });
            if (!raw) continue;
            const jsonStr = raw.replace(/```json|```/g, '').trim();
            const results = JSON.parse(jsonStr);

            for (const item of results) {
                if (!item.videoId || !item.subCategory) continue;
                if (!subCats.includes(item.subCategory)) continue;

                runSQLNoSave(`INSERT OR IGNORE INTO sub_categories (parent_category_name, name) VALUES (?, ?)`, [catName, item.subCategory]);
                const scRow = queryOne(`SELECT id FROM sub_categories WHERE parent_category_name = ? AND name = ?`, [catName, item.subCategory]);
                if (!scRow) continue;

                runSQLNoSave(`INSERT OR IGNORE INTO video_sub_categories (video_id, sub_category_id) VALUES (?, ?)`, [item.videoId, scRow.id]);
            }
        } catch (err) {
            console.error(`[SubCat] Single classify error for ${videoId} / ${catName}:`, err.message);
        }
    }

    saveDB();
}
