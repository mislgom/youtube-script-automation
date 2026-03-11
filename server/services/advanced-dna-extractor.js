/**
 * Advanced DNA Extractor
 * Gemini AI 기반 5종 구조화 DNA 추출 + 황금 키워드 + 그룹 DNA 합산
 */
import { callGemini } from './gemini-service.js';

// ─────────────────────────────────────────────
// 1) 단일/복수 영상 → 5종 DNA 추출
// ─────────────────────────────────────────────
export async function extractAdvancedDNA(videos, category = '야담') {
    if (!videos || videos.length === 0) return null;

    // 분석 텍스트 조합 (제목 + 설명 + 자막 요약)
    const corpus = videos.slice(0, 20).map((v, i) => {
        const text = [v.title, v.description, v.transcript_summary]
            .filter(Boolean).join(' ').substring(0, 500);
        return `[영상${i + 1}] 제목: "${v.title}" | 조회수: ${(v.view_count || 0).toLocaleString()} | 내용: ${text}`;
    }).join('\n\n');

    const prompt = `당신은 유튜브 영상 DNA 분석 전문가입니다.
아래 떡상 영상들(카테고리: ${category})을 분석하여 **공통 성공 패턴(DNA)**을 추출하세요.

[분석 대상 영상 목록]
${corpus}

반드시 아래 JSON 형식 **딱 하나**만 응답하세요 (다른 텍스트 절대 없음):
{
  "hook_dna": {
    "hook_type": "결과암시 | 질문 | 충격 | 결론부분공개 | 스토리시작 | 경고 중 하나",
    "hook_sentences": ["상위 후킹 문장 1", "상위 후킹 문장 2", "상위 후킹 문장 3"],
    "open_loop": ["미공개 요소1", "미공개 요소2"],
    "hook_strength_score": 85
  },
  "structure_dna": {
    "structure_type": "야담 | 경제 | 심리 중 하나",
    "sections": [
      { "name": "도입", "goal": "시청자 훅", "duration_pct": 10, "key_question": "왜 봐야 하는가?" },
      { "name": "전개", "goal": "갈등 상승", "duration_pct": 40, "key_question": "무슨 일이 벌어지는가?" },
      { "name": "위기", "goal": "최고조", "duration_pct": 20, "key_question": "결말은?" },
      { "name": "반전", "goal": "충격 반전", "duration_pct": 20, "key_question": "예상 밖의 결말?" },
      { "name": "정리", "goal": "교훈/마무리", "duration_pct": 10, "key_question": "시청자가 얻는 것은?" }
    ],
    "climax_position": 75,
    "payoff_type": "반전 | 교훈 | 해결 | 정의구현 | 현실자각 중 하나"
  },
  "emotion_dna": {
    "emotion_curve": [
      { "position_pct": 0,  "tension": 30, "anxiety": 20, "hope": 40, "anger": 10, "relief": 60 },
      { "position_pct": 25, "tension": 60, "anxiety": 50, "hope": 30, "anger": 40, "relief": 20 },
      { "position_pct": 50, "tension": 80, "anxiety": 70, "hope": 20, "anger": 70, "relief": 10 },
      { "position_pct": 75, "tension": 95, "anxiety": 90, "hope": 15, "anger": 90, "relief": 5  },
      { "position_pct": 100,"tension": 30, "anxiety": 10, "hope": 90, "anger": 20, "relief": 95 }
    ],
    "peak_points": ["70~80% 구간 — 반전 폭로 순간"],
    "drop_points": ["30~40% 구간 — 전개 지루함 위험"]
  },
  "pace_dna": {
    "sentence_length_avg": 18,
    "short_sentence_ratio": 0.45,
    "question_frequency": 3.2,
    "repetition_keywords": ["원한", "한", "복수", "억울", "비밀", "반전", "충격", "결말", "실화", "조선"],
    "taboo_flags": []
  },
  "title_dna": {
    "title_pattern": "손해회피 | 타이밍불안 | 반전 | 개인영향 | 비밀폭로 | 경고 중 하나",
    "thumbnail_text_pattern": "충격 + 결과 + 반전 (3~6단어)",
    "cta_words": ["충격", "실화", "반전", "비밀", "결말", "충격반전", "알고보니", "진짜", "실제", "전말"]
  }
}`;

    try {
        const raw = await callGemini(prompt, { useGoogleSearch: true });
        if (!raw || typeof raw !== 'string') return null;
        const jsonStr = raw.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(jsonStr);
        return {
            ...parsed,
            _meta: {
                videoCount: videos.length,
                category,
                analyzedAt: new Date().toISOString(),
                sampleTitles: videos.slice(0, 5).map(v => v.title).filter(Boolean)
            }
        };
    } catch (e) {
        console.error('[AdvancedDNA] 파싱 실패:', e.message);
        return null;
    }
}

// ─────────────────────────────────────────────
// 2) DNA → 황금 키워드 추출
// ─────────────────────────────────────────────
export async function extractGoldenKeywords(dna) {
    if (!dna) return [];

    // 기존 pace_dna.repetition_keywords + title_dna.cta_words를 기반으로 AI가 정제
    const rawKeywords = [
        ...(dna.pace_dna?.repetition_keywords || []),
        ...(dna.title_dna?.cta_words || []),
        ...(dna.hook_dna?.open_loop || []),
    ].join(', ');

    const prompt = `당신은 유튜브 콘텐츠 마케팅 전문가입니다.
아래는 떡상 영상들의 DNA에서 추출된 키워드 목록입니다:
[원시 키워드]: ${rawKeywords}

[Hook 유형]: ${dna.hook_dna?.hook_type || ''}
[감정 절정]: ${dna.emotion_dna?.peak_points?.join(', ') || ''}
[구조 유형]: ${dna.structure_dna?.structure_type || ''}
[제목 패턴]: ${dna.title_dna?.title_pattern || ''}

위 데이터를 종합하여, 썸네일 제목에 바로 쓸 수 있는 **황금 키워드 15개**를 선별/정제하세요.
형용사·명사·동사 조합으로 제목 후킹에 최적화된 단어들이어야 합니다.

반드시 아래 JSON만 응답하세요:
{
  "golden_keywords": ["키워드1", "키워드2", "키워드3", "키워드4", "키워드5",
                       "키워드6", "키워드7", "키워드8", "키워드9", "키워드10",
                       "키워드11", "키워드12", "키워드13", "키워드14", "키워드15"],
  "keyword_reason": "이 키워드들이 황금인 이유를 한 문장으로"
}`;

    try {
        const raw = await callGemini(prompt, { useGoogleSearch: true });
        if (!raw || typeof raw !== 'string') return [];
        const jsonStr = raw.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(jsonStr);
        return parsed;
    } catch (e) {
        console.error('[GoldenKeywords] 파싱 실패:', e.message);
        return { golden_keywords: [], keyword_reason: '' };
    }
}

// ─────────────────────────────────────────────
// 3) 황금 키워드 + DNA + 주제(Topic) → 썸네일 후킹 제목 10개 추천
// ─────────────────────────────────────────────
export async function recommendTitles(dna, goldenKeywords, category = '야담', topic = '') {
    const keywords = goldenKeywords?.golden_keywords || goldenKeywords || [];
    const keywordStr = keywords.join(', ');

    const prompt = `당신은 유튜브 구독자 100만 채널의 썸네일·제목 전문 카피라이터입니다.

[사용자 요청 주제]: "${topic}"

[DNA 분석 결과 요약]
- 후킹 유형: ${dna.hook_dna?.hook_type}
- 구조 유형: ${dna.structure_dna?.structure_type}
- 제목 패턴: ${dna.title_dna?.title_pattern}
- 페이오프: ${dna.structure_dna?.payoff_type}
- 황금 키워드: ${keywordStr}
- 카테고리: ${category}

위 [사용자 요청 주제]의 핵심 소재(예: 맹인, 점쟁이, 왕의 비밀 등)를 반드시 유지하면서, 클릭률(CTR)을 극대화할 수 있는 **썸네일·후킹 제목 10개**를 생성하세요.

규칙:
1. **[사용자 요청 주제]의 주인공이나 핵심 소재를 절대 바꾸지 마십시오.** (예: 맹인 이야기면 제목에도 맹인이나 관련 표현이 들어가야 함)
2. 제목은 15~30자 이내 (너무 길면 썸네일에서 잘림)
3. 황금 키워드를 최소 2개 이상 포함
4. 기존에 없는 신선한 각도로 (기존 인기 영상과 완전히 다른 주제)
5. 10개 중 1~2개는 ${category === '야담' ? '가난뱅이/절름발이/맹인/거지 등 파격적 조선 민중 언어' : '파격적 표현'}을 제목에 포함하여 원본 주제를 더 자극적으로 만드세요.
6. 각 제목 뒤에 예상 CTR 점수(0~100)와 한 줄 이유를 붙이세요

반드시 아래 JSON만 응답하세요:
[
  {
    "title": "후킹 제목 1",
    "ctr_score": 92,
    "reason": "이 제목이 클릭될 이유"
  }
]`;

    try {
        // jsonMode: true — google_search 그라운딩 텍스트가 섞이면 JSON.parse 실패 → useGoogleSearch 금지
        const raw = await callGemini(prompt, { jsonMode: true });
        if (!raw || typeof raw !== 'string') return [];
        const jsonStr = raw.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(jsonStr);
        return Array.isArray(parsed) ? parsed.slice(0, 10) : [];
    } catch (e) {
        console.error('[RecommendTitles] 파싱 실패:', e.message);
        return [];
    }
}

// ─────────────────────────────────────────────
// 4) DNA + 선택 제목 → 대본 뼈대 생성
// ─────────────────────────────────────────────
export async function generateDnaSkeleton(dna, selectedTitle, category = '야담') {
    const sections = dna.structure_dna?.sections || [];
    const sectionStr = sections.map(s =>
        `  - [${s.name}] 목표: ${s.goal} / 비중: ${s.duration_pct}% / 핵심 질문: ${s.key_question}`
    ).join('\n');

    const prompt = `당신은 100만 유튜버 전용 대본 설계 전문가입니다.

[선택된 제목]: "${selectedTitle}"
[카테고리]: ${category}
[DNA 분석 기반 구조]:
${sectionStr}

[후킹 전략]:
- Hook 유형: ${dna.hook_dna?.hook_type}
- Open Loop: ${dna.hook_dna?.open_loop?.join(', ')}
- 클라이맥스 위치: 전체의 ${dna.structure_dna?.climax_position}% 지점
- 페이오프: ${dna.structure_dna?.payoff_type}

[감정 곡선]:
- 절정 구간: ${dna.emotion_dna?.peak_points?.join(', ')}
- 이탈 위험 구간: ${dna.emotion_dna?.drop_points?.join(', ')}

요구사항:
1. 위 DNA 구조를 그대로 따르되, 제목과 동일한 주제로 **기존에 없는 완전히 새로운 내용**을 설계하세요
2. 각 섹션마다: [섹션명] / 핵심 목표 / 핵심 질문 / 후킹 문장 1개 / 전환 문장 1개를 작성하세요
3. 클라이맥스 구간에는 ★ 반전/폭로 포인트를 배치하세요
4. 이탈 위험 구간에는 🔔 "다시 훅 유발" 장치를 명시하세요
5. 마무리는 교훈/행동유도/공감형 질문 중 하나로 끝내세요

반드시 아래 JSON만 응답하세요:
{
  "title": "선택된 제목",
  "category": "${category}",
  "total_duration_estimate": "약 12~15분",
  "sections": [
    {
      "name": "섹션명",
      "position": "0~10%",
      "goal": "핵심 목표",
      "key_question": "핵심 질문",
      "hook_sentence": "이 섹션의 후킹 문장",
      "transition": "다음 섹션으로 전환 문장",
      "special": "★ 반전 or 🔔 재훅 or null"
    }
  ],
  "climax_note": "클라이맥스 설계 설명",
  "ending_type": "교훈 | 행동유도 | 공감형질문",
  "ending_sentence": "마무리 제안 문장"
}`;

    try {
        const raw = await callGemini(prompt, { useGoogleSearch: true });
        if (!raw || typeof raw !== 'string') return null;
        const jsonStr = raw.replace(/```json|```/g, '').trim();
        return JSON.parse(jsonStr);
    } catch (e) {
        console.error('[DnaSkeleton] 파싱 실패:', e.message);
        return null;
    }
}

// ─────────────────────────────────────────────
// 5) 여러 영상의 DNA → 그룹 DNA 합산
// ─────────────────────────────────────────────
export function buildGroupDNA(dnaResults) {
    const valid = dnaResults.filter(Boolean);
    if (valid.length === 0) return null;

    // hook_type 빈도 집계
    const hookTypes = {};
    valid.forEach(d => {
        const t = d.hook_dna?.hook_type;
        if (t) hookTypes[t] = (hookTypes[t] || 0) + 1;
    });

    // structure_type 빈도 집계
    const structTypes = {};
    valid.forEach(d => {
        const t = d.structure_dna?.structure_type;
        if (t) structTypes[t] = (structTypes[t] || 0) + 1;
    });

    // climax_position 평균
    const climaxAvg = Math.round(
        valid.reduce((s, d) => s + (d.structure_dna?.climax_position || 75), 0) / valid.length
    );

    // 반복 키워드 합산
    const kwMap = {};
    valid.forEach(d => {
        (d.pace_dna?.repetition_keywords || []).forEach(k => {
            kwMap[k] = (kwMap[k] || 0) + 1;
        });
    });
    const topKeywords = Object.entries(kwMap)
        .sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k]) => k);

    // title_pattern 빈도
    const titlePatterns = {};
    valid.forEach(d => {
        const t = d.title_dna?.title_pattern;
        if (t) titlePatterns[t] = (titlePatterns[t] || 0) + 1;
    });

    return {
        total_analyzed: valid.length,
        top_hook_types: Object.entries(hookTypes).sort((a, b) => b[1] - a[1])
            .map(([type, count]) => ({ type, count, ratio: Math.round(count / valid.length * 100) + '%' })),
        common_structure: Object.entries(structTypes).sort((a, b) => b[1] - a[1])[0]?.[0] || '야담',
        climax_position_avg: climaxAvg,
        common_repetition_keywords: topKeywords,
        top_title_patterns: Object.entries(titlePatterns).sort((a, b) => b[1] - a[1])
            .slice(0, 5).map(([pattern, count]) => ({ pattern, count })),
        generated_at: new Date().toISOString()
    };
}
