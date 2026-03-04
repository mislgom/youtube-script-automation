// Gap Analyzer — finds under-explored topic areas from category data
import { queryAll, queryOne, runSQL } from '../db.js';

// Build a cross-category matrix showing video counts per combination
export function buildGapMatrix(groupX, groupY) {
  // Get categories for each group
  const catsX = queryAll('SELECT * FROM categories WHERE group_name = ? ORDER BY sort_order', [groupX]);
  const catsY = queryAll('SELECT * FROM categories WHERE group_name = ? ORDER BY sort_order', [groupY]);

  if (catsX.length === 0 || catsY.length === 0) {
    return { xLabels: [], yLabels: [], matrix: [], gaps: [] };
  }

  // Build matrix
  const matrix = [];
  const gaps = [];
  let maxCount = 0;

  for (const cy of catsY) {
    const row = [];
    for (const cx of catsX) {
      // Count videos with both categories
      const result = queryAll(`
        SELECT COUNT(DISTINCT vc1.video_id) as cnt
        FROM video_categories vc1
        JOIN video_categories vc2 ON vc1.video_id = vc2.video_id
        WHERE vc1.category_id = ? AND vc2.category_id = ?
      `, [cx.id, cy.id]);
      const count = result[0]?.cnt || 0;
      row.push(count);
      if (count > maxCount) maxCount = count;

      if (count <= 2) {
        gaps.push({
          x: cx.name,
          y: cy.name,
          count,
          opportunity: count === 0 ? 'high' : 'medium'
        });
      }
    }
    matrix.push(row);
  }

  // 고수요(인기 있는) 영역부터 분석되도록 정렬 (사용자 요청 반영: 포화 영역 우선)
  gaps.sort((a, b) => b.count - a.count);

  return {
    xLabels: catsX.map(c => c.name),
    yLabels: catsY.map(c => c.name),
    xColors: catsX.map(c => c.color),
    yColors: catsY.map(c => c.color),
    matrix,
    maxCount,
    gaps: gaps.slice(0, 30)
  };
}

// Get category distribution (for donut charts)
export function getCategoryDistribution(groupName) {
  const data = queryAll(`
    SELECT c.name, c.color, COUNT(vc.video_id) as count
    FROM categories c
    LEFT JOIN video_categories vc ON c.id = vc.category_id
    WHERE c.group_name = ?
    GROUP BY c.id
    ORDER BY count DESC
  `, [groupName]);
  return data;
}

// Get all category groups
export function getCategoryGroups() {
  const data = queryAll('SELECT DISTINCT group_name FROM categories ORDER BY group_name');
  return data.map(d => d.group_name);
}

// Get monthly trend data
export function getTrends(months = 12) {
  const data = queryAll(`
    SELECT 
      strftime('%Y-%m', published_at) as month,
      COUNT(*) as count
    FROM videos
    WHERE published_at IS NOT NULL
      AND published_at >= date('now', '-${months} months')
    GROUP BY month
    ORDER BY month
  `);
  return data;
}

// Get trend by category
export function getTrendsByCategory(groupName, months = 12) {
  const data = queryAll(`
    SELECT 
      strftime('%Y-%m', v.published_at) as month,
      c.name as category,
      c.color,
      COUNT(*) as count
    FROM videos v
    JOIN video_categories vc ON v.id = vc.video_id
    JOIN categories c ON vc.category_id = c.id
    WHERE c.group_name = ?
      AND v.published_at IS NOT NULL
      AND v.published_at >= date('now', '-${months} months')
    GROUP BY month, c.id
    ORDER BY month
  `, [groupName]);
  return data;
}
// Multi-category analysis for a filtered set of videos
export function getMultiGapAnalysis(selectedCategoryIds = []) {
  let videoIds = [];
  const allCategories = queryAll('SELECT * FROM categories ORDER BY group_name, sort_order');
  const groups = [...new Set(allCategories.map(c => c.group_name))];

  if (selectedCategoryIds.length > 0) {
    // Find videos that have ALL selected categories
    const placeholders = selectedCategoryIds.map(() => '?').join(',');
    const results = queryAll(`
            SELECT video_id FROM video_categories 
            WHERE category_id IN (${placeholders})
            GROUP BY video_id
            HAVING COUNT(DISTINCT category_id) = ?
        `, [...selectedCategoryIds, selectedCategoryIds.length]);
    videoIds = results.map(r => r.video_id);
  } else {
    // If nothing selected, analyze overall saturation
    const results = queryAll('SELECT id as video_id FROM videos');
    videoIds = results.map(r => r.video_id);
  }

  if (videoIds.length === 0) {
    return { totalVideos: 0, groupDistributions: {}, gaps: [] };
  }

  // For each group, calculate distribution within the filtered videos
  const groupDistributions = {};
  const gaps = [];

  for (const group of groups) {
    const groupCats = allCategories.filter(c => c.group_name === group);
    const distribution = [];

    for (const cat of groupCats) {
      const countResult = queryAll(`
                SELECT COUNT(DISTINCT video_id) as cnt FROM video_categories 
                WHERE category_id = ? AND video_id IN (${videoIds.join(',')})
            `, [cat.id]);
      const count = countResult[0]?.cnt || 0;
      const percentage = Math.round((count / videoIds.length) * 100);

      distribution.push({ id: cat.id, name: cat.name, count, percentage, color: cat.color });

      // Mark as gap if percentage < 30%
      if (percentage < 30) {
        gaps.push({ group, name: cat.name, percentage, count, opportunity: count === 0 ? 'high' : 'medium' });
      }
    }
    groupDistributions[group] = distribution;
  }

  return {
    totalVideos: videoIds.length,
    groupDistributions,
    gaps: gaps.sort((a, b) => a.percentage - b.percentage).slice(0, 15)
  };
}

// Helper: Categorize an external video by its title and description
export function categorizeVideoByKeywords(video, categories) {
  const text = `${video.title} ${video.description}`.toLowerCase();
  const matchedIds = [];

  for (const cat of categories) {
    const keywords = [cat.name.toLowerCase()];

    // [고도화 사전] 야담 특화 카테고리별 유의어 및 연관어 대폭 확장
    if (cat.group_name === '시대') {
      if (cat.name.includes('조선')) {
        keywords.push('이조', '한양', '임금', '왕실', '궐내', '사대부', '과거', '한복', '사또', '주상', '대감', '마님', '아씨', '포졸', '관아', '기명', '희빈', '숙종', '영조', '정조', '연산군', '광해', '세종', '태종', '민비', '고종', '경복궁', '창덕궁', '한성', '전하', '마마', '상궁', '내시', '선비', '유생', '서당', '훈장', '주막', '보부상', '어사', '암행', '조선시대');
      }
      if (cat.name.includes('고려')) keywords.push('왕건', '무신', '공민왕', '개경', '송악', '고려시대');
      if (cat.name.includes('삼국')) keywords.push('신라', '고구려', '백제', '화랑', '계백', '관창', '김유신', '가야', '삼국시대');
      if (cat.name.includes('구한말') || cat.name.includes('일제')) keywords.push('독립', '순사', '만세', '순국', '근대', '개화기');
    }

    if (cat.group_name === '사건유형') {
      if (cat.name.includes('살인') || cat.name.includes('범죄')) keywords.push('살해', '참수', '자백', '흉기', '독살', '시신', '도둑', '도적', '강도', '폭행', '형벌', '처형', '주리', '형리');
      if (cat.name.includes('괴담') || cat.name.includes('미스터리')) keywords.push('귀신', '도깨비', '요괴', '기이', '흉가', '공포', '무서운', '미스테리', '저주', '산신', '무덤', '변괴', '암흑', '지옥', '넋', '비의', '이상한');
      if (cat.name.includes('로맨스') || cat.name.includes('연애')) keywords.push('사랑', '정인', '연모', '애정', '혼인', '금슬', '부부', '바람', '불륜', '첫사랑', '기생', '첩', '낭군', '아씨', '연정', '사모', '차마', '변심', '질투', '미인', '미녀', '가열차다', '곱다', '헤어지다', '이별', '연정');
      if (cat.name.includes('복수')) keywords.push('원한', '앙갚음', '한', '응징', '처단', '억울', '통한', '복수극', '충혈', '인야하다', '원수', '세우다');
      if (cat.name.includes('풍속') || cat.name.includes('일상')) keywords.push('생활', '민중', '서민', '이야기', '기담', '인생', '교훈', '조상', '옛날', '옛적', '충돌', '풍습', '풍구리', '먹거리', '장시', '놀이', '설시', '시장', '무덕도', '장당');
      if (cat.name.includes('전쟁') || cat.name.includes('전투')) keywords.push('군대', '전투', '위기', '앞다퉁', '주리', '수렁', '돌격', '포로', '확락', '임진왜란', '병자호란', '전쟁터', '형삼', '의병', '의척');
      if (cat.name.includes('사기') || cat.name.includes('속임')) keywords.push('사기꾼', '지팡이', '속임', '뜻', '가짜', '매리다', '흑심', '야박하다', '달콤하다', '전당하다', '고시대', '빈틈');
      if (cat.name.includes('기행') || cat.name.includes('행각')) keywords.push('여행', '나들이', '항해', '탐험', '유람', '유람기', '절경', '여정', '뚜여', '주유', '유화', '방랑');
      if (cat.name.includes('동물') || cat.name.includes('짐승')) keywords.push('호랑이', '개', '맹수', '뱀', '말', '소', '돼지', '닭', '버릇', '살쾡이', '야생', '의친한 동물', '동물 변', '동물 이야기', '익수동물', '산 동물', '가도');
    }

    if (cat.group_name === '인물유형') {
      if (cat.name.includes('왕') || cat.name.includes('왕비')) keywords.push('임금', '전하', '마마', '군주', '황제', '인군', '숙시', '세자', '대원군', '어지', '입귀');
      if (cat.name.includes('궁녀') || cat.name.includes('상궁')) keywords.push('내명부인', '얹삼', '내시', '궁중생활', '고뭄', '내인', '수라');
      if (cat.name.includes('기생')) keywords.push('기녀', '풍류', '요정재씨', '기생집', '헤어지다', '기생신분', '가무');
      if (cat.name.includes('양반')) keywords.push('영', '사대부', '국록', '유학', '유생', '선비', '대감', '나리');
      if (cat.name.includes('승려') || cat.name.includes('스님')) keywords.push('당은', '무열탕', '불교', '온소', '절', '스님', '법사', '비구니');
      if (cat.name.includes('의적')) keywords.push('의체', '홍길동', '임꺽정');
      if (cat.name.includes('평민') || cat.name.includes('백성')) keywords.push('백성', '소작농', '노비', '넋', '서녚', '달납', '힘에미', '최하위신분');
      if (cat.name.includes('귀신') || cat.name.includes('하술')) keywords.push('쓰신', '잡귀르', '막', '영혼', '검은여신', '저승사자', '로군');
      if (cat.name.includes('무관') || cat.name.includes('무사')) keywords.push('장수', '운동관', '무패', '오위');
      if (cat.name.includes('상인')) keywords.push('장사군', '돈', '물품', '긴돌이', '상거래');
    }

    if (cat.group_name === '소재출처') {
      if (cat.name.includes('야사')) keywords.push('비사', '숨겨진', '뒷이야기', '정사', '사학', '야담');
      if (cat.name.includes('실록')) keywords.push('왕조', '기록', '실제', '역사', '고증', '승정원');
      if (cat.name.includes('구전') || cat.name.includes('민담')) keywords.push('전설', '내려오는', '할머니', '옛날이야기', '전해지는');
      if (cat.name.includes('신문') || cat.name.includes('언론')) keywords.push('배경', '기사', '대증작물', '보도', '휴메인');
      if (cat.name.includes('창작')) keywords.push('모티토리', '옵윤물', '고어데이터', '실화', '가상', '픽션', '실화기반');
      if (cat.name.includes('항토') || cat.name.includes('지지')) keywords.push('지역', '식민지', '주리');
    }

    if (keywords.some(kw => text.includes(kw))) {
      matchedIds.push(cat.id);
    }
  }
  return matchedIds;
}

// DB에 야담 분석용 기본 카테고리가 없으면 자동 삽입
export function ensureYadamCategories() {
  const defaults = {
    '시대': ['삼국시대', '고려', '조선 전기', '조선 후기', '구한말', '일제강점기', '근현대'],
    '사건유형': ['살인/범죄', '괴담/미스터리', '로맨스', '복수극', '풍속/일상', '전쟁', '사기', '기행', '동물'],
    '인물유형': ['왕/왕비', '궁녀', '기생', '양반', '승려', '무관', '의적', '평민', '귀신', '상인'],
    '소재출처': ['야사', '실록', '구전', '신문기사', '판결문', '향토사', '번안', '창작'],
    '지역': ['한양/서울', '경기', '충청', '전라', '경상', '강원', '평안', '함경', '제주', '해외']
  };

  for (const [groupName, items] of Object.entries(defaults)) {
    items.forEach((name, i) => {
      runSQL('INSERT OR IGNORE INTO categories (group_name, name, sort_order) VALUES (?, ?, ?)', [groupName, name, i]);
    });
  }
}

/**
 * 데이터베이스 통계 추출: 전체 영상 수 및 AI 분석 완료 영상 수
 */
export function getDatabaseStats() {
  const total = queryOne("SELECT COUNT(*) as cnt FROM videos");
  const analyzed = queryOne("SELECT COUNT(*) as cnt FROM videos WHERE is_analyzed = 1");
  const categorized = queryOne("SELECT COUNT(DISTINCT video_id) as cnt FROM video_categories");

  return {
    total: total?.cnt || 0,
    analyzed: analyzed?.cnt || 0,
    categorized: categorized?.cnt || 0,
    percent: total?.cnt > 0 ? Math.round((analyzed?.cnt / total?.cnt) * 100) : 0
  };
}

/**
 * 5중 교집합 통합 분석: [시대+사건+소재+인물+지역]이 모두 겹치는 가장 인기 있는 조합 Top 10 추출
 */
export function buildCombinedNicheRanking() {
  // 5가지 그룹의 카테고리 ID들을 가져옴
  const groups = ['시대', '사건유형', '소재출처', '인물유형', '지역'];
  const catMap = {};
  for (const g of groups) {
    catMap[g] = queryAll("SELECT id, name FROM categories WHERE group_name = ?", [g]);
  }

  // [테마 완화] 5중 교집합 대신 3중 교집합(시대+사건+소재)을 기본으로 하여 데이터 볼륨 확보 (300~500개 수준)
  const topCombinations = queryAll(`
    SELECT 
      c1.name as era, c2.name as event, c3.name as source,
      c1.id as eraId, c2.id as eventId, c3.id as sourceId,
      COUNT(DISTINCT v.id) as count
    FROM videos v
    JOIN video_categories vc1 ON v.id = vc1.video_id JOIN categories c1 ON vc1.category_id = c1.id AND c1.group_name = '시대'
    JOIN video_categories vc2 ON v.id = vc2.video_id JOIN categories c2 ON vc2.category_id = c2.id AND c2.group_name = '사건유형'
    JOIN video_categories vc3 ON v.id = vc3.video_id JOIN categories c3 ON vc3.category_id = c3.id AND c3.group_name = '소재출처'
    GROUP BY c1.id, c2.id, c3.id
    ORDER BY count DESC
    LIMIT 15
  `);

  return topCombinations.map(combo => ({
    label: `${combo.era} • ${combo.event} • ${combo.source}`,
    count: combo.count,
    era: combo.era,
    event: combo.event,
    eraId: combo.eraId,
    eventId: combo.eventId,
    sourceId: combo.sourceId,
    personId: 0,
    regionId: 0,
    details: { source: combo.source, person: '전체', region: '전체' }
  }));
}

// Special Yadam Analysis: [시대 x 사건유형]을 하나의 행(Y)으로 묶고, 나머지(인물/소재 등)를 박스(X)로 배치하여 3중 교집합 분석
export function buildYadamGapMatrix(externalVideos = []) {
  // 1. 시대 카테고리 (Y축 1단계) - '조선' 우선, 없으면 전체
  let catsEra = queryAll("SELECT * FROM categories WHERE group_name = '시대' AND name LIKE '%조선%' ORDER BY sort_order");
  if (catsEra.length === 0) {
    catsEra = queryAll("SELECT * FROM categories WHERE group_name = '시대' ORDER BY sort_order");
  }
  const hasEraCats = catsEra.length > 0;
  if (catsEra.length === 0) catsEra = [{ id: 0, name: '전체' }];

  // 2. 사건유형 카테고리 (Y축 2단계)
  const catsEvent = queryAll("SELECT * FROM categories WHERE group_name = '사건유형' ORDER BY sort_order");
  const hasEventCats = catsEvent.length > 0;

  const gaps = [];
  let globalMaxCount = 0;

  // 행(Y) 구성을 위한 하이브리드 레이블 생성
  const yLabels = [];
  const yMetaData = [];

  for (const era of catsEra) {
    if (hasEventCats) {
      for (const event of catsEvent) {
        yLabels.push(`[${era.name}] ${event.name}`);
        yMetaData.push({ eraId: era.id, eventId: event.id, eraName: era.name, eventName: event.name });
      }
    } else {
      yLabels.push(`[${era.name}] 전체 사건`);
      yMetaData.push({ eraId: era.id, eventId: 0, eraName: era.name, eventName: '전체 사건' });
    }
  }

  // 데이터가 아예 없는 경우를 대비한 가상 레이블
  if (yLabels.length === 0) {
    yLabels.push('[전체] 기본 분석');
    yMetaData.push({ eraId: 0, eventId: 0, eraName: '전체', eventName: '기본 분석' });
  }

  const allRowCells = [];
  for (let yi = 0; yi < yMetaData.length; yi++) {
    const meta = yMetaData[yi];

    // SQL 조건 설정 (0이면 무시)
    const eraSql = meta.eraId === 0 ? '1=1' : `vc1.category_id = ${meta.eraId}`;
    const eventSql = meta.eventId === 0 ? '1=1' : `vc2.category_id = ${meta.eventId}`;

    // [Tier 1] 5중 교집합 (Era + Event + Source + Person + Region)
    let topCompos = queryAll(`
      SELECT 
        c3.name as source, c4.name as person, c5.name as region,
        c3.id as sourceId, c4.id as personId, c5.id as regionId,
        COUNT(DISTINCT v.id) as cnt
      FROM videos v
      JOIN video_categories vc1 ON v.id = vc1.video_id AND ${eraSql}
      JOIN video_categories vc2 ON v.id = vc2.video_id AND ${eventSql}
      JOIN video_categories vc3 ON v.id = vc3.video_id JOIN categories c3 ON vc3.category_id = c3.id AND c3.group_name = '소재출처'
      JOIN video_categories vc4 ON v.id = vc4.video_id JOIN categories c4 ON vc4.category_id = c4.id AND c4.group_name = '인물유형'
      JOIN video_categories vc5 ON v.id = vc5.video_id JOIN categories c5 ON vc5.category_id = c5.id AND c5.group_name = '지역'
      GROUP BY c3.id, c4.id, c5.id
      ORDER BY cnt DESC
      LIMIT 8
    `);

    // [Tier 2] 3중 교집합 (Era + Event + Source) - 5중 결과가 0개일 때
    if (topCompos.length === 0) {
      topCompos = queryAll(`
        SELECT 
          c3.name as source, '전체' as person, '전체' as region,
          c3.id as sourceId, 0 as personId, 0 as regionId,
          COUNT(DISTINCT v.id) as cnt
        FROM videos v
        JOIN video_categories vc1 ON v.id = vc1.video_id AND ${eraSql}
        JOIN video_categories vc2 ON v.id = vc2.video_id AND ${eventSql}
        JOIN video_categories vc3 ON v.id = vc3.video_id JOIN categories c3 ON vc3.category_id = c3.id AND c3.group_name = '소재출처'
        GROUP BY c3.id
        ORDER BY cnt DESC
        LIMIT 8
      `);
    }

    // [Tier 3] 1중 필터 (Only Source) - 여전히 0개일 때 (전체 대비 비율 확보용)
    if (topCompos.length === 0) {
      topCompos = queryAll(`
        SELECT 
          c3.name as source, '전체' as person, '전체' as region,
          c3.id as sourceId, 0 as personId, 0 as regionId,
          COUNT(DISTINCT v.id) as cnt
        FROM videos v
        JOIN video_categories vc3 ON v.id = vc3.video_id 
        JOIN categories c3 ON vc3.category_id = c3.id AND c3.group_name = '소재출처'
        GROUP BY c3.id
        ORDER BY cnt DESC
        LIMIT 8
      `);
    }

    const rowCells = topCompos.map(combo => {
      if (combo.cnt > globalMaxCount) globalMaxCount = combo.cnt;

      const cell = {
        label: combo.source,
        fullLabel: `${combo.source}${combo.person !== '전체' ? ' + ' + combo.person : ''}${combo.region !== '전체' ? ' + ' + combo.region : ''}`,
        count: combo.cnt,
        meta: {
          eraId: meta.eraId,
          eventId: meta.eventId,
          sourceId: combo.sourceId,
          personId: combo.personId,
          regionId: combo.regionId
        }
      };

      if (combo.cnt >= 0) { // 0개라도 우선 박스는 생성 (Gaps 분석용)
        gaps.push({
          x: cell.fullLabel,
          y: yLabels[yi],
          count: combo.cnt,
          level: 0,
          rawY: yLabels[yi],
          grX: '통합 소재/인물/지역',
          grY: '시대/사건',
          meta: cell.meta
        });
      }
      return cell;
    });

    allRowCells.push(rowCells);
  }

  // 레벨 계산
  gaps.forEach(g => {
    if (globalMaxCount > 0) {
      const ratio = g.count / globalMaxCount;
      if (ratio < 0.1) g.level = 1;
      else if (ratio < 0.25) g.level = 2;
      else if (ratio < 0.5) g.level = 3;
      else if (ratio < 0.75) g.level = 4;
      else g.level = 5;
    } else {
      g.level = 1; // 기준점 없을 시 최하위 레벨
    }
  });

  gaps.sort((a, b) => b.count - a.count);

  const stats = getDatabaseStats();
  const topCombined = buildCombinedNicheRanking();

  return {
    yLabels,
    allRowCells,
    maxCount: globalMaxCount,
    gaps: gaps.slice(0, 30),
    stats,
    topCombined,
    groups: { x: '통합 중복 조합', y: '시대 × 사건유형' },
    debugCounts: { dropReason: 'SUCCESS' }
  };
}
// Economy Trend Analysis — Scoring based on Freshness, Trend, and Impact
export function getEconomyTrendAnalysis(periodDays = 30) {
  const mainCats = queryAll("SELECT * FROM categories WHERE group_name = '경제(메인)' ORDER BY sort_order");
  const subCats = queryAll("SELECT * FROM categories WHERE group_name = '경제(최신분류)' ORDER BY sort_order");

  // Sub-issue keyword map (fallback when no DB sub-categories exist)
  const ISSUE_MAP = {
    '금리 / 금융 환경': [
      { name: '기준금리', keywords: ['기준금리', '금리인하', '금리인상', '한국은행'] },
      { name: '대출금리', keywords: ['대출금리', '주담대', '담보대출', '주택담보'] },
      { name: '예금금리', keywords: ['예금금리', '예금', '적금', '저축'] },
      { name: '통화정책', keywords: ['통화정책', '양적완화', '긴축', '통화량'] },
      { name: '환율', keywords: ['환율', '달러', '원달러', '외환'] },
    ],
    '부동산 / 주거': [
      { name: '담보대출', keywords: ['주담대', '담보대출', '주택담보', 'LTV', 'DSR'] },
      { name: '아파트 시세', keywords: ['아파트', '시세', '집값', '매매가'] },
      { name: '전세', keywords: ['전세', '전세금', '전세사기', '역전세'] },
      { name: '청약', keywords: ['청약', '분양', '청약통장', '당첨'] },
      { name: '재건축', keywords: ['재건축', '재개발', '정비사업', '용적률'] },
    ],
    '경제 종합': [
      { name: 'GDP / 성장률', keywords: ['GDP', '성장률', '경제성장', '잠재성장'] },
      { name: '물가 / 인플레이션', keywords: ['물가', '인플레', 'CPI', '소비자물가'] },
      { name: '소비 / 내수', keywords: ['소비', '내수', '소비심리', '가계지출'] },
      { name: '수출입', keywords: ['수출', '수입', '무역수지', '경상수지'] },
      { name: '실업 / 취업', keywords: ['실업', '취업', '고용', '일자리'] },
    ],
    '글로벌 경제 / 국제 이슈': [
      { name: '미국 경제', keywords: ['미국경제', 'FED', '연준', '미금리'] },
      { name: '중국 경제', keywords: ['중국경제', '중국', '차이나', '디커플링'] },
      { name: '관세 / 무역전쟁', keywords: ['관세', '무역전쟁', '트럼프', '보호무역'] },
      { name: '원자재', keywords: ['원자재', '유가', '원유', '금값'] },
      { name: '이머징마켓', keywords: ['이머징', '신흥국', '동남아', '인도'] },
    ],
    '주식 / 투자 시장': [
      { name: '코스피 / 코스닥', keywords: ['코스피', '코스닥', '주가', '주식'] },
      { name: '나스닥 / S&P', keywords: ['나스닥', 's&p', 'S&P', '미국증시', '미장'] },
      { name: 'ETF / 펀드', keywords: ['ETF', '펀드', '인덱스', '리츠'] },
      { name: '채권', keywords: ['채권', '국채', '회사채', '금리채'] },
      { name: 'IPO / 공모주', keywords: ['IPO', '공모주', '상장', '청약'] },
    ],
    '코인 / 디지털 자산': [
      { name: '비트코인', keywords: ['비트코인', 'BTC', '비트', '암호화폐'] },
      { name: '이더리움', keywords: ['이더리움', 'ETH', '이더'] },
      { name: '알트코인', keywords: ['알트코인', '리플', '솔라나', '도지'] },
      { name: '규제 / SEC', keywords: ['SEC', '규제', '가상자산법', '코인규제'] },
      { name: '스테이블코인', keywords: ['스테이블코인', 'USDT', 'USDC'] },
    ],
    '경제 인물 / 시장 발언': [
      { name: '중앙은행 총재', keywords: ['파월', '한국은행총재', '이창용', '연준의장'] },
      { name: '정부 / 기획재정부', keywords: ['기재부', '기획재정부', '재정부', '예산'] },
      { name: '기업인 발언', keywords: ['CEO', '대표이사', '삼성', '현대'] },
      { name: '경제학자', keywords: ['경제학자', '교수', '전문가', '분석'] },
    ],
    '생활경제 / 물가': [
      { name: '식품 물가', keywords: ['식품', '먹거리', '밥값', '음식값'] },
      { name: '에너지 / 공과금', keywords: ['전기요금', '가스요금', '에너지', '공과금'] },
      { name: '교통 / 유류비', keywords: ['휘발유', '기름값', '유류비', '교통비'] },
      { name: '의료비', keywords: ['의료비', '병원비', '건강보험', '의료'] },
    ],
    '정부 정책 / 세금': [
      { name: '세금 / 세제', keywords: ['세금', '세제', '종부세', '부동산세'] },
      { name: '복지 정책', keywords: ['복지', '지원금', '보조금', '수당'] },
      { name: '규제 / 완화', keywords: ['규제완화', '규제개혁', '완화', '행정'] },
      { name: '재정 / 예산', keywords: ['재정', '예산', '적자', '국가부채'] },
    ],
    '노후 / 연금 / 자산관리': [
      { name: '국민연금', keywords: ['국민연금', '연금개혁', '연금', '노령연금'] },
      { name: '퇴직연금', keywords: ['퇴직연금', 'IRP', '퇴직금', '연금저축'] },
      { name: '노후 자산', keywords: ['노후', '은퇴', '자산관리', '재산'] },
      { name: '상속 / 증여', keywords: ['상속', '증여', '상속세', '증여세'] },
    ],
    '개인 재테크 / 돈 관리': [
      { name: '저축 / 투자', keywords: ['저축', '재테크', '투자', '절약'] },
      { name: '부채 관리', keywords: ['빚', '부채', '대출상환', '신용'] },
      { name: '신용 / 대출', keywords: ['신용점수', '신용등급', '소액대출', '신용대출'] },
      { name: '보험', keywords: ['보험', '생명보험', '실손보험', '암보험'] },
    ],
  };

  if (mainCats.length === 0) return { categories: [], mainCategories: [], topics: [] };

  const now = new Date();
  const results = [];

  // Score calculator for a list of videos
  const scoreVideos = (videos, cat) => {
    if (videos.length === 0) {
      const baseline = (cat.group_name === '경제(메인)') ? 25 : 15;
      return { count: 0, freshScore: baseline, trendScore: baseline + 5, impactScore: baseline + 10, finalScore: baseline + 5 };
    }
    let totalFresh = 0, totalImpact = 0, totalInterest = 0;
    videos.forEach(v => {
      const pubDate = new Date(v.published_at);
      const daysDiff = Math.floor((now - pubDate) / (1000 * 60 * 60 * 24));
      const fresh = Math.max(10, 100 - (daysDiff * 1.5));
      totalFresh += fresh;
      try {
        const meta = JSON.parse(v.economy_metadata || '{}');
        totalImpact += meta.impact ? (Object.values(meta.impact).reduce((a, b) => a + b, 0) / Object.values(meta.impact).length) : 3.5;
        totalInterest += meta.interest ? (meta.interest['전체'] || 3.5) : 3.5;
      } catch (e) { totalImpact += 3.5; totalInterest += 3.5; }
    });
    const avgFresh = totalFresh / videos.length;
    const avgImpact = (totalImpact / videos.length) * 20;
    const avgInterest = (totalInterest / videos.length) * 20;
    const volumeDensity = Math.min(100, (videos.length / Math.max(1, periodDays / 7)) * 20);
    const trendScore = (volumeDensity * 0.5) + (avgInterest * 0.5);
    const finalScore = Math.round((avgFresh * 0.35) + (avgInterest * 0.35) + (volumeDensity * 0.30));
    return { count: videos.length, freshScore: Math.round(avgFresh), trendScore: Math.round(trendScore), impactScore: Math.round(avgImpact), finalScore };
  };

  // Helper: get videos for keywords via title/description match
  const getVideosForKeywords = (keywords) => {
    if (!keywords || keywords.length === 0) return [];
    const likeClauses = keywords.map(() => '(title LIKE ? OR description LIKE ?)').join(' OR ');
    const params = keywords.flatMap(k => [`%${k}%`, `%${k}%`]);
    return queryAll(`SELECT * FROM videos WHERE (${likeClauses}) AND published_at >= date('now', '-365 days') LIMIT 30`, params);
  };

  // Build main category results with sub-issues
  const mainCategoryResults = [];

  for (const cat of mainCats) {
    // Get directly tagged videos
    let videos = queryAll(`
      SELECT v.* FROM videos v
      JOIN video_categories vc ON v.id = vc.video_id
      WHERE vc.category_id = ? AND v.published_at >= date('now', '-${periodDays} days')
    `, [cat.id]);

    if (videos.length === 0) {
      const keywords = cat.name.split(/[\/\s,]+/).filter(k => k.length >= 2);
      if (keywords.length > 0) {
        const likeClauses = keywords.map(() => '(title LIKE ? OR description LIKE ?)').join(' OR ');
        const params = keywords.flatMap(k => [`%${k}%`, `%${k}%`]);
        videos = queryAll(`SELECT * FROM videos WHERE (${likeClauses}) AND published_at >= date('now', '-365 days') LIMIT 50`, params);
      }
    }

    const scores = scoreVideos(videos, cat);

    // Build sub-issues
    const issueListRaw = ISSUE_MAP[cat.name] || [];
    const subIssues = issueListRaw.map(issue => {
      const issueVideos = getVideosForKeywords(issue.keywords);
      const s = scoreVideos(issueVideos, { group_name: '경제(최신분류)' });

      // Color based on score
      let color = '#4b5563';
      if (s.finalScore >= 75) color = '#ef4444';
      else if (s.finalScore >= 55) color = '#f97316';
      else if (s.finalScore >= 35) color = '#eab308';
      else if (s.finalScore >= 15) color = '#22c55e';

      return { name: issue.name, score: s.finalScore, color, count: s.count };
    }).sort((a, b) => b.score - a.score);

    // Also check DB sub-categories that match this main category by keyword
    const matchedSubCats = subCats.filter(sc => {
      const mainKeywords = cat.name.split(/[\/\s,]+/).filter(k => k.length >= 2);
      return mainKeywords.some(kw => sc.name.includes(kw) || cat.name.includes(kw.substring(0, Math.min(kw.length, 4))));
    });

    matchedSubCats.forEach(sc => {
      if (!subIssues.find(si => si.name === sc.name)) {
        const scVideos = queryAll(`SELECT v.* FROM videos v JOIN video_categories vc ON v.id=vc.video_id WHERE vc.category_id=? LIMIT 30`, [sc.id]);
        const s = scoreVideos(scVideos, sc);
        subIssues.push({ name: sc.name, score: s.finalScore, color: sc.color || '#4b5563', count: s.count });
      }
    });

    subIssues.sort((a, b) => b.score - a.score);

    results.push({
      id: cat.id, name: cat.name, group: cat.group_name,
      count: scores.count, freshScore: scores.freshScore, trendScore: scores.trendScore,
      impactScore: scores.impactScore, finalScore: scores.finalScore,
      subIssues: subIssues.slice(0, 6),
      videos: videos.slice(0, 5).map(v => ({ title: v.title }))
    });

    mainCategoryResults.push({ name: cat.name, score: scores.finalScore });
  }

  // Also score sub-categories separately for compatibility
  const allResults = [...results];
  for (const cat of subCats) {
    const videos = queryAll(`SELECT v.* FROM videos v JOIN video_categories vc ON v.id=vc.video_id WHERE vc.category_id=? AND v.published_at >= date('now', '-${periodDays} days')`, [cat.id]);
    const scores = scoreVideos(videos, cat);
    allResults.push({
      id: cat.id, name: cat.name, group: cat.group_name,
      ...scores, subIssues: [],
      videos: videos.slice(0, 3).map(v => ({ title: v.title }))
    });
  }

  allResults.sort((a, b) => b.finalScore - a.finalScore);

  return {
    period: periodDays,
    categories: allResults,
    mainCategories: results.sort((a, b) => b.finalScore - a.finalScore),
    topRecommendations: results.slice(0, 5)
  };
}

// 드릴 다운: 수퍼 니치(3중) 클릭 시 해당 테마 내 모든 세부 카테고리 그룹별 분포 반환
export function getNicheDetailGrid(eraId, eventId, sourceId) {
  const eraSql = eraId == 0 ? '1=1' : `vc_era.category_id = ${eraId}`;
  const eventSql = eventId == 0 ? '1=1' : `vc_event.category_id = ${eventId}`;
  const sourceSql = sourceId == 0 ? '1=1' : `vc_src.category_id = ${sourceId}`;

  // 해당 3중 테마에 속하는 영상 ID 목록 (최대 5000개)
  const themeVideoIds = queryAll(`
    SELECT DISTINCT v.id
    FROM videos v
    JOIN video_categories vc_era   ON v.id = vc_era.video_id   AND ${eraSql}
    JOIN video_categories vc_event ON v.id = vc_event.video_id AND ${eventSql}
    JOIN video_categories vc_src   ON v.id = vc_src.video_id   AND ${sourceSql}
    LIMIT 5000
  `).map(r => r.id);

  if (themeVideoIds.length === 0) return { groups: [], totalVideos: 0 };

  const idList = themeVideoIds.join(',');

  // 조회할 세부 카테고리 그룹 (3중 테마 외 나머지 전부)
  const detailGroups = ['사건유형', '인물유형', '지역'];

  const groups = [];
  let globalMax = 0;

  for (const groupName of detailGroups) {
    const rows = queryAll(`
      SELECT c.id, c.name, COUNT(DISTINCT vc.video_id) as cnt
      FROM video_categories vc
      JOIN categories c ON vc.category_id = c.id AND c.group_name = ?
      WHERE vc.video_id IN (${idList})
      GROUP BY c.id
      ORDER BY cnt DESC
    `, [groupName]);

    if (rows.length === 0) continue;

    const groupMax = rows[0].cnt;
    if (groupMax > globalMax) globalMax = groupMax;

    const cells = rows.map(r => {
      const ratio = groupMax > 0 ? r.cnt / groupMax : 0;
      let level = 1;
      if (ratio >= 0.75) level = 5;
      else if (ratio >= 0.5) level = 4;
      else if (ratio >= 0.25) level = 3;
      else if (ratio >= 0.1) level = 2;

      return {
        id: r.id,
        label: r.name,
        count: r.cnt,
        level,
        // 초록색(level 1~2) 제외 여부: 사용자 요청에 따라 level >= 3만 포함
        isVisible: level >= 3
      };
    }).filter(c => c.isVisible);

    if (cells.length > 0) {
      groups.push({ groupName, cells, groupMax });
    }
  }

  return { groups, totalVideos: themeVideoIds.length };
}

