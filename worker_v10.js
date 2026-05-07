export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const GSK_KEY = env.GSK_API_KEY || '';
    const CORS = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (req.method === 'OPTIONS') return new Response(null, {status:204, headers:CORS});

    // POST /analyze — 실시간 웹서치 AI 분류
    if (url.pathname === '/analyze' && req.method === 'POST') {
      try {
        const {brand} = await req.json();
        if (!brand) return new Response(JSON.stringify({error:'brand required'}),{status:400,headers:{...CORS,'Content-Type':'application/json'}});

        // ★ 올바른 파라미터: q (query 아님)
        const sr = await fetch('https://www.genspark.ai/api/tool_cli/web_search', {
          method: 'POST',
          headers: {'Authorization': 'Bearer ' + GSK_KEY, 'Content-Type': 'application/json'},
          body: JSON.stringify({q: brand + ' 브랜드 제품 카테고리'})
        });
        const sd = await sr.json();
        const snippets = (sd.data?.organic_results || [])
          .map(r => (r.title||'') + ' ' + (r.snippet||'')).join(' ');

        const result = classifyBrand(brand, snippets);
        return new Response(JSON.stringify(result), {status:200, headers:{...CORS,'Content-Type':'application/json'}});

      } catch(e) {
        return new Response(
          JSON.stringify({brand:'',cat:'스킨케어',kws:'스킨케어 뷰티',target:'성분덕후',tone:'리얼리뷰',confidence:'fallback',error:e.message}),
          {status:200, headers:{...CORS,'Content-Type':'application/json'}}
        );
      }
    }

    // GET / — HTML 서빙
    const hr = await fetch('https://raw.githubusercontent.com/brandnyou/brandnyou.github.io/main/v7_source.html', {
      headers:{'Cache-Control':'no-cache'}
    });
    const html = await hr.text();
    return new Response(html, {headers:{...CORS,'Content-Type':'text/html;charset=utf-8','Cache-Control':'no-cache'}});
  }
};

function classifyBrand(brand, text) {
  const b = brand.toLowerCase().replace(/\s+/g,'');
  const t = text.toLowerCase();

  const CATS = [
    { cat:'헤어케어',   kws:'탈모 두피케어 헤어케어 샴푸 손상모',  target:'3040', tone:'리얼리뷰',
      bw:['탈모','두피','헤어','샴푸','모발','트리트먼트','스칼프','린스','hair','scalp','shampoo'],
      tw:['샴푸','헤어','두피','탈모','모발','트리트먼트','헤어케어','two피케어','hair care','shampoo','scalp'] },
    { cat:'살림홈케어', kws:'살림 세제 청소 홈케어 생활용품',       target:'라이프스타일', tone:'공구전문',
      bw:['살림','세제','청소','세탁','주방','홈케어','생활','퍼실','피죤','테크'],
      tw:['세제','살림','청소','세탁','주방세제','생활용품','홈케어','세탁세제','laundry','detergent','퍼실','피죤'] },
    { cat:'이너뷰티',   kws:'이너뷰티 건강기능식품 콜라겐 영양제',  target:'약사의사', tone:'신뢰전문',
      bw:['콜라겐','유산균','건강','비타민','영양','홍삼','면역','글루타치온','다이어트','이너','supplement'],
      tw:['콜라겐','유산균','영양제','건강기능','비타민','홍삼','글루타치온','이너뷰티','supplement','프로바이오틱스'] },
    { cat:'육아',       kws:'육아 신생아 아기 임산부 육아맘',        target:'3040', tone:'육아맘',
      bw:['육아','신생아','임산부','유아','베이비','아기'],
      tw:['육아','신생아','임산부','유아용','베이비','아기용품','baby','infant','maternity'] },
    { cat:'친환경비건', kws:'비건 친환경 자연주의 오가닉 클린뷰티',  target:'라이프스타일', tone:'친환경',
      bw:['비건','친환경','오가닉','유기농','천연','클린','에코','그린'],
      tw:['비건','친환경','오가닉','유기농','천연','클린뷰티','제로웨이스트','vegan','organic','eco'] },
    { cat:'의학더마',   kws:'더마 피부과 민감피부 트러블케어',        target:'성분덕후', tone:'신뢰전문',
      bw:['더마','피부과','의학','아토피','트러블','derma','clinic','doctor'],
      tw:['더마','피부과','민감성','아토피','트러블','dermatology','derma','임상','처방'] },
    { cat:'메이크업',   kws:'메이크업 색조 립 틴트 K뷰티',           target:'2030', tone:'감성라이프',
      bw:['색조','틴트','파운데이션','아이섀도','쿠션','메이크업','컨실러','립'],
      tw:['색조','메이크업','틴트','파운데이션','아이섀도','쿠션','립스틱','컨실러','makeup','eyeshadow'] },
    { cat:'스킨케어',   kws:'스킨케어 세럼 토너 수분케어 K뷰티',     target:'성분덕후', tone:'리얼리뷰',
      bw:['스킨케어','세럼','토너','앰플','수분','보습','선크림','미백'],
      tw:['스킨케어','세럼','토너','앰플','보습','수분크림','선크림','skin care','serum','moisturizer'] },
  ];

  for (const c of CATS) {
    c.score = 0;
    for (const w of c.bw) { if (b.includes(w)) c.score += 8; }  // 브랜드명 가중치 8
    for (const w of c.tw) { if (t.includes(w)) c.score += 2; }  // 스니펫 가중치 2
  }

  const sorted = [...CATS].sort((a,b) => b.score - a.score);
  const best = sorted[0];
  const confidence = best.score >= 16 ? 'search_high' : best.score >= 8 ? 'search_mid' : best.score >= 2 ? 'search_low' : 'fallback';

  return {brand, cat:best.cat, kws:best.kws, target:best.target, tone:best.tone, confidence, score:best.score, searchUsed:true};
}