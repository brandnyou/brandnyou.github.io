
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const GSK_KEY = env.GSK_API_KEY || '';
    const CORS = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'};
    if (req.method === 'OPTIONS') return new Response(null, {status:204, headers:CORS});

    // ── POST /analyze ── 실시간 웹서치 기반 카테고리 분류
    if (url.pathname === '/analyze' && req.method === 'POST') {
      try {
        const {brand} = await req.json();
        if (!brand) return new Response(JSON.stringify({error:'brand required'}), {status:400, headers:{...CORS,'Content-Type':'application/json'}});

        // Genspark web_search 호출
        const sr = await fetch('https://www.genspark.ai/api/tool_cli/web_search', {
          method:'POST',
          headers:{'Authorization':'Bearer '+GSK_KEY,'Content-Type':'application/json'},
          body:JSON.stringify({query: brand + ' 브랜드 제품 뷰티 스킨케어 살림 헤어 건강'})
        });
        const sd = await sr.json();
        const snippets = (sd.data?.organic_results||[]).map(r=>(r.title||'')+' '+(r.snippet||'')).join(' ');
        const result = classifyBrand(brand, snippets);
        return new Response(JSON.stringify(result), {status:200, headers:{...CORS,'Content-Type':'application/json'}});
      } catch(e) {
        return new Response(JSON.stringify({brand:'',cat:'스킨케어',kws:'스킨케어 뷰티',target:'성분덕후',tone:'리얼리뷰',confidence:'fallback',error:e.message}),
          {status:200, headers:{...CORS,'Content-Type':'application/json'}});
      }
    }

    // ── GET / ── HTML 서빙
    const hr = await fetch('https://raw.githubusercontent.com/brandnyou/brandnyou.github.io/main/v7_source.html',{headers:{'Cache-Control':'no-cache'}});
    const html = await hr.text();
    return new Response(html, {headers:{...CORS,'Content-Type':'text/html;charset=utf-8','Cache-Control':'no-cache'}});
  }
};

function classifyBrand(brand, text) {
  const b = brand.toLowerCase().replace(/\s+/g,'');
  const t = text.toLowerCase();

  // 카테고리 정의 — words는 브랜드명/스니펫 공통 매칭, snippetOnly는 스니펫에서만
  const CATS = [
    { cat:'헤어케어', kws:'탈모 두피케어 헤어케어 샴푸 손상모',
      brandWords:['탈모','두피','헤어','샴푸','모발','트리트먼트','스칼프','린스','hair','scalp','shampoo'],
      textWords:['샴푸','헤어','두피','탈모','모발','트리트먼트','헤어케어','두피케어','hair care','shampoo','scalp','髮'],
      target:'3040', tone:'리얼리뷰' },

    { cat:'살림홈케어', kws:'살림 세제 청소 홈케어 생활용품',
      brandWords:['살림','세제','청소','세탁','주방','홈케어','생활','클린','퍼실','피죤','테크'],
      textWords:['세제','살림','청소용품','세탁세제','주방세제','생활용품','홈케어','클리너','세탁','laundry','cleaning','detergent','퍼실','피죤'],
      target:'라이프스타일', tone:'공구전문' },

    { cat:'이너뷰티', kws:'이너뷰티 건강기능식품 콜라겐 영양제',
      brandWords:['콜라겐','유산균','이너뷰티','건강','비타민','영양','홍삼','면역','글루타치온','다이어트','프로바이오'],
      textWords:['콜라겐','유산균','영양제','건강기능식품','이너뷰티','비타민','홍삼','글루타치온','supplement','프로바이오틱스','다이어트식품'],
      target:'약사의사', tone:'신뢰전문' },

    { cat:'육아', kws:'육아 신생아 아기 임산부 육아맘',
      brandWords:['육아','신생아','임산부','유아','베이비','아기','맘스'],
      textWords:['육아','신생아','임산부','유아용','베이비','아기용품','baby','infant','kids','maternity'],
      target:'3040', tone:'육아맘' },

    { cat:'친환경비건', kws:'비건 친환경 자연주의 오가닉 클린뷰티',
      brandWords:['비건','친환경','오가닉','유기농','천연','클린','제로','에코','그린'],
      textWords:['비건','친환경','오가닉','유기농','천연성분','클린뷰티','제로웨이스트','vegan','organic','eco','자연주의'],
      target:'라이프스타일', tone:'친환경' },

    { cat:'의학더마', kws:'더마 피부과 민감피부 트러블케어',
      brandWords:['더마','피부과','의학','아토피','트러블','derma','clinic','doctor','rx'],
      textWords:['더마','피부과','민감성피부','아토피','트러블케어','dermatology','derma','임상','처방','약국'],
      target:'성분덕후', tone:'신뢰전문' },

    { cat:'메이크업', kws:'메이크업 색조 립 틴트 K뷰티',
      brandWords:['색조','틴트','파운데이션','아이섀도','쿠션','메이크업','컨실러','립'],
      textWords:['색조화장품','메이크업','틴트','파운데이션','아이섀도','쿠션팩트','립스틱','컨실러','makeup','eyeshadow'],
      target:'2030', tone:'감성라이프' },

    { cat:'스킨케어', kws:'스킨케어 세럼 토너 수분케어 K뷰티',
      brandWords:['스킨케어','세럼','토너','앰플','수분','보습','선크림','피부'],
      textWords:['스킨케어','세럼','토너','앰플','보습크림','수분크림','선크림','피부관리','skin care','serum','toner','moisturizer'],
      target:'성분덕후', tone:'리얼리뷰' },
  ];

  // 점수 계산 — 브랜드명 매칭 가중치 3배
  for (const c of CATS) {
    c.score = 0;
    for (const w of c.brandWords) { if (b.includes(w)) c.score += 6; }
    for (const w of c.textWords)  { if (t.includes(w)) c.score += 2; }
  }

  const sorted = CATS.sort((a,b)=>b.score-a.score);
  const best = sorted[0];
  const second = sorted[1];

  // 점수 0이면 모두 동점 → 스킨케어 기본값
  const confidence = best.score >= 12 ? 'search_high' : best.score >= 6 ? 'search_mid' : best.score >= 2 ? 'search_low' : 'fallback';

  return {brand, cat:best.cat, kws:best.kws, target:best.target, tone:best.tone, confidence, score:best.score, searchUsed:true};
}
