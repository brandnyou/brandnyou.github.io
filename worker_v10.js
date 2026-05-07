
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const GSK_KEY = env.GSK_API_KEY || 'gsk-eyJjb2dlbl9pZCI6IjQxMGQ4NGE2LTcxZjctNDU5Mi1hMjNjLTFlYTJkZTUxMTFmMyIsImtleV9pZCI6ImI1YTYxZTdiLThlNzQtNDc1ZS1hOWE1LTY4MDMwOGMzZGNkYSIsImN0aW1lIjoxNzc3NjkxMzc4LCJjbGF1ZGVfYmlnX21vZGVsIjpudWxsLCJjbGF1ZGVfbWlkZGxlX21vZGVsIjpudWxsLCJjbGF1ZGVfc21hbGxfbW9kZWwiOm51bGx9fMLGIEnADxx_IvRoKwM45RQIsRgcDUeLN3mvy2gCPNM8';

    // CORS 헤더
    const CORS = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    // ── /analyze 엔드포인트 ──
    if (url.pathname === '/analyze' && req.method === 'POST') {
      try {
        const body = await req.json();
        const brandName = (body.brand || '').trim();
        if (!brandName) return new Response(JSON.stringify({error:'brand required'}), {status:400, headers:{...CORS,'Content-Type':'application/json'}});

        // Genspark web_search 호출
        const searchResp = await fetch('https://www.genspark.ai/api/tool_cli/web_search', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + GSK_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: brandName + ' 브랜드 제품 카테고리 뷰티 스킨케어' })
        });
        const searchData = await searchResp.json();

        // 검색 결과에서 카테고리 추론
        const snippets = (searchData.data?.organic_results || [])
          .map(r => (r.title || '') + ' ' + (r.snippet || '')).join(' ').toLowerCase();

        const analysis = classifyFromSearch(brandName, snippets);
        return new Response(JSON.stringify(analysis), {
          status: 200,
          headers: { ...CORS, 'Content-Type': 'application/json' }
        });

      } catch(e) {
        return new Response(JSON.stringify({error: e.message, cat:'스킨케어', confidence:'fallback'}), {
          status: 200,
          headers: { ...CORS, 'Content-Type': 'application/json' }
        });
      }
    }

    // ── / 메인 페이지 ──
    const htmlResp = await fetch('https://raw.githubusercontent.com/brandnyou/brandnyou.github.io/main/v7_source.html', {
      headers: { 'Cache-Control': 'no-cache' }
    });
    const html = await htmlResp.text();
    return new Response(html, { headers: { ...CORS, 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'no-cache' } });
  }
};

function classifyFromSearch(brand, text) {
  const t = text.toLowerCase();
  const b = brand.toLowerCase();

  // 카테고리별 키워드 점수
  const CATS = [
    { cat: '헤어케어',    kws: '탈모 두피케어 헤어케어 샴푸 손상모', score: 0,
      words: ['헤어','두피','탈모','샴푸','모발','트리트먼트','스칼프','hair','scalp','shampoo'] },
    { cat: '살림홈케어',  kws: '살림 세제 청소 홈케어 생활용품', score: 0,
      words: ['살림','세제','청소','세탁','주방','생활용품','clean','wash','laundry','fabric softener'] },
    { cat: '이너뷰티',    kws: '이너뷰티 건강기능식품 콜라겐 영양제', score: 0,
      words: ['콜라겐','유산균','이너뷰티','건강기능','비타민','영양제','홍삼','글루타치온','supplement','health','collagen','probiotic'] },
    { cat: '육아',        kws: '육아 신생아 아기 임산부 육아맘', score: 0,
      words: ['육아','신생아','임산부','유아','베이비','아기','baby','infant','kids','maternity'] },
    { cat: '친환경비건',  kws: '비건 친환경 자연주의 오가닉 클린뷰티', score: 0,
      words: ['비건','친환경','오가닉','유기농','천연','제로웨이스트','vegan','organic','eco','natural'] },
    { cat: '의학더마',    kws: '더마 피부과 민감피부 트러블케어', score: 0,
      words: ['더마','피부과','의학','아토피','트러블','derma','clinic','dermatology','doctor','rx'] },
    { cat: '메이크업',    kws: '메이크업 색조 립 틴트 K뷰티', score: 0,
      words: ['색조','메이크업','틴트','립스틱','파운데이션','아이섀도','makeup','cosmetics','eyeshadow','foundation'] },
    { cat: '스킨케어',    kws: '스킨케어 세럼 토너 수분케어 K뷰티', score: 0,
      words: ['스킨케어','세럼','토너','앰플','수분','보습','선크림','피부','skin','serum','toner','moisturizer','sunscreen'] },
  ];

  for (const c of CATS) {
    for (const w of c.words) {
      if (t.includes(w)) c.score += 2;
      if (b.includes(w)) c.score += 5; // 브랜드명에 직접 포함 → 가중치 높음
    }
  }

  const best = CATS.sort((a,b) => b.score - a.score)[0];
  const confidence = best.score >= 10 ? 'search_high' : best.score >= 4 ? 'search_mid' : 'search_low';

  // target/tone 매핑
  const TARGET_MAP = {
    '헤어케어':'3040', '살림홈케어':'라이프스타일', '이너뷰티':'약사의사',
    '육아':'3040', '친환경비건':'라이프스타일', '의학더마':'성분덕후',
    '메이크업':'2030', '스킨케어':'성분덕후'
  };
  const TONE_MAP = {
    '헤어케어':'리얼리뷰', '살림홈케어':'공구전문', '이너뷰티':'신뢰전문',
    '육아':'육아맘', '친환경비건':'친환경', '의학더마':'신뢰전문',
    '메이크업':'감성라이프', '스킨케어':'리얼리뷰'
  };

  return {
    brand,
    cat: best.cat,
    kws: best.kws,
    target: TARGET_MAP[best.cat] || '성분덕후',
    tone: TONE_MAP[best.cat] || '리얼리뷰',
    confidence,
    score: best.score,
    searchUsed: true
  };
}
