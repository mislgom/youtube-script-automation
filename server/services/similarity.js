// TF-IDF + Cosine Similarity engine — local, no external API needed
// This is the fast "1st pass" filter before Gemini AI "2nd pass"

const STOPWORDS = new Set([
    '의', '를', '을', '에', '에서', '은', '는', '이', '가', '와', '과', '도', '로', '으로',
    '한', '하는', '된', '되는', '있는', '없는', '그', '저', '것', '수', '등', '더',
    '및', '또는', '그리고', '하지만', '때문에', '위해', '통해', '대한', '중', '후',
    '구독', '좋아요', '알림', '영상', '채널', '시청', '감사', '링크', '댓글', '오늘',
    '여러분', '정말', '너무', '우리', '같은', '많은', '다른', '대해', '대해서',
    'the', 'a', 'an', 'is', 'are', 'was', 'in', 'on', 'at', 'to', 'for', 'of', 'and'
]);

// Basic Korean tokenizer: split by spaces, remove particles
function tokenize(text) {
    if (!text) return [];
    return text
        .replace(/[^\w\s가-힣]/g, ' ')
        .split(/\s+/)
        .map(w => w.trim())
        .filter(w => w.length >= 2 && !STOPWORDS.has(w));
}

// Build TF (Term Frequency) for a document
function buildTF(tokens) {
    const tf = {};
    for (const token of tokens) {
        tf[token] = (tf[token] || 0) + 1;
    }
    const max = Math.max(...Object.values(tf), 1);
    for (const key in tf) {
        tf[key] = tf[key] / max; // Normalize
    }
    return tf;
}

// Build IDF (Inverse Document Frequency) from all documents
function buildIDF(documents) {
    const df = {}; // document frequency
    const N = documents.length;

    for (const doc of documents) {
        const uniqueTokens = new Set(doc.tokens);
        for (const token of uniqueTokens) {
            df[token] = (df[token] || 0) + 1;
        }
    }

    const idf = {};
    for (const token in df) {
        idf[token] = Math.log(N / (1 + df[token]));
    }
    return idf;
}

// Build TF-IDF vector for a document
function buildTFIDF(tf, idf) {
    const tfidf = {};
    for (const token in tf) {
        tfidf[token] = tf[token] * (idf[token] || 0);
    }
    return tfidf;
}

// Cosine similarity between two sparse vectors
function cosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    const allKeys = new Set([...Object.keys(vecA), ...Object.keys(vecB)]);
    for (const key of allKeys) {
        const a = vecA[key] || 0;
        const b = vecB[key] || 0;
        dotProduct += a * b;
        normA += a * a;
        normB += b * b;
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Main: compare a new text against all video documents
export function compareTexts(newText, videoDocuments) {
    // Prepare all docs including the new text
    const newTokens = tokenize(newText);
    const docs = videoDocuments.map(v => ({
        id: v.id,
        title: v.title,
        tokens: tokenize(`${v.title} ${v.title} ${(v.description || '').substring(0, 200)} ${v.transcript_keywords || ''}`)
    }));

    // Build IDF from existing docs + new text
    const allDocs = [...docs, { tokens: newTokens }];
    const idf = buildIDF(allDocs);

    // Build TF-IDF vector for new text
    const newTF = buildTF(newTokens);
    const newVec = buildTFIDF(newTF, idf);

    // Calculate similarity with each video
    const results = docs.map(doc => {
        const docTF = buildTF(doc.tokens);
        const docVec = buildTFIDF(docTF, idf);
        const score = cosineSimilarity(newVec, docVec);
        return {
            id: doc.id,
            title: doc.title,
            similarity: Math.round(score * 100)
        };
    });

    // Sort by similarity descending
    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, 20);
}

// Extract top keywords  from all videos (frequency-based)
export function getTopKeywords(videoDocuments, topN = 30) {
    const freq = {};
    for (const v of videoDocuments) {
        const tokens = tokenize(`${v.title} ${(v.description || '').substring(0, 200)} ${v.transcript_keywords || ''}`);
        const unique = new Set(tokens);
        for (const token of unique) {
            freq[token] = (freq[token] || 0) + 1;
        }
    }

    return Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, topN)
        .map(([word, count]) => ({ word, count }));
}
