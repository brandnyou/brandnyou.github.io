export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const GSK_KEY = env.GSK_API_KEY || '';
    const CORS = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'};
    if (req.method === 'OPTIONS') return new Response(null,{status:204,headers:CORS});

    if (url.pathname === '/analyze' && req.method === 'POST') {
      try {
        const {brand} = await req.json();
        if (!brand) return new Response(JSON.stringify({error:'brand required'}),{status:400,headers:{...CORS,'Content-Type':'application/json'}});

        const sr = await fetch('https://www.genspark.ai/api/tool_cli/web_search', {
          method:'POST',
          headers:{'Authorization':'Bearer '+GSK_KEY,'Content-Type':'application/json'},
          body: JSON.stringify({q: brand + ' 브랜드 제품 종류'})
        });
        const sd = await sr.json();
        const snippets = (sd.data?.organic_results||[]).map(r=>(r.title||'')+' '+(r.snippet||'')).join(' ');
        const result = classifyBrand(brand, snippets);
        return new Response(JSON.stringify(result),{status:200,headers:{...CORS,'Content-Type':'application/json'}});
      } catch(e) {
        return new Response(JSON.stringify({brand:'',cat:'기타',kws:'',target:'',tone:'',confidence:'fallback',score:0,error:e.message}),
          {status:200,headers:{...CORS,'Content-Type':'application/json'}});
      }
    }

    const hr = await fetch('https://raw.githubusercontent.com/brandnyou/brandnyou.github.io/main/v7_source.html',{headers:{'Cache-Control':'no-cache'}});
    const html = await hr.text();
    return new Response(html,{headers:{...CORS,'Content-Type':'text/html;charset=utf-8','Cache-Control':'no-cache'}});
  }
};

function classifyBrand(brand, text) {
  const b = brand.toLowerCase().replace(/\s+/g,'');
  const t = text.toLowerCase();

  const CATS = [
    // ── 뷰티/스킨케어 ──
    { cat:'스킨케어',    kws:'스킨케어 세럼 토너 수분케어 K뷰티',       target:'성분덕후', tone:'리얼리뷰',
      bw:['스킨케어','세럼','토너','앰플','수분','보습','선크림','미백','주름'],
      tw:['스킨케어','세럼','토너','앰플','보습','수분크림','선크림','skin care','serum','moisturizer','스킨','피부관리'] },
    { cat:'메이크업',    kws:'메이크업 색조 립 틴트 K뷰티',              target:'2030', tone:'감성라이프',
      bw:['색조','틴트','파운데이션','아이섀도','쿠션','메이크업','컨실러','립'],
      tw:['색조','메이크업','틴트','파운데이션','아이섀도','쿠션','립스틱','컨실러','makeup','화장품','색조화장'] },
    { cat:'헤어케어',    kws:'탈모 두피케어 헤어케어 샴푸 손상모',       target:'3040', tone:'리얼리뷰',
      bw:['탈모','두피','헤어','샴푸','모발','트리트먼트','스칼프','린스'],
      tw:['샴푸','헤어','두피','탈모','모발','트리트먼트','헤어케어','hair','scalp','shampoo'] },
    { cat:'의학더마',    kws:'더마 피부과 민감피부 트러블케어',           target:'성분덕후', tone:'신뢰전문',
      bw:['더마','피부과','의학','아토피','트러블','derma','clinic','doctor','rx'],
      tw:['더마','피부과','민감성','아토피','트러블','dermatology','임상','처방','약국'] },
    // ── 이너뷰티/건강 ──
    { cat:'이너뷰티',    kws:'이너뷰티 건강기능식품 콜라겐 영양제',      target:'약사의사', tone:'신뢰전문',
      bw:['콜라겐','유산균','건강','비타민','영양','홍삼','면역','글루타치온','다이어트','이너','supplement','프로바이오'],
      tw:['콜라겐','유산균','영양제','건강기능','비타민','홍삼','글루타치온','이너뷰티','supplement','프로바이오틱스','건강식품'] },
    // ── 살림/홈케어 ──
    { cat:'살림홈케어',  kws:'살림 세제 청소 홈케어 생활용품',            target:'라이프스타일', tone:'공구전문',
      bw:['살림','세제','청소','세탁','주방','홈케어','생활','퍼실','피죤','테크'],
      tw:['세제','살림','청소','세탁','주방세제','생활용품','홈케어','세탁세제','laundry','detergent','청소용품'] },
    // ── 친환경/비건 ──
    { cat:'친환경비건',  kws:'비건 친환경 자연주의 오가닉 클린뷰티',     target:'라이프스타일', tone:'친환경',
      bw:['비건','친환경','오가닉','유기농','천연','클린','에코','그린','제로'],
      tw:['비건','친환경','오가닉','유기농','천연','클린뷰티','제로웨이스트','vegan','organic','eco','자연주의'] },
    // ── 육아 ──
    { cat:'육아',        kws:'육아 신생아 아기 임산부 육아맘',            target:'3040', tone:'육아맘',
      bw:['육아','신생아','임산부','유아','베이비','아기'],
      tw:['육아','신생아','임산부','유아용','베이비','아기용품','baby','infant','maternity','육아용품'] },
    // ── 식품/음료 ──
    { cat:'식품음료',    kws:'식품 음료 먹방 요리 맛집 레시피',           target:'푸드러버', tone:'먹방',
      bw:['치킨','피자','햄버거','커피','카페','음식','식품','음료','제과','제빵','라면','과자','아이스크림','초콜릿','bbq','비비큐','bhc','교촌','맥도날드','스타벅스','버거킹'],
      tw:['치킨','피자','음식','식품','음료','카페','커피','요리','레시피','맛집','먹방','배달','식당','프랜차이즈','햄버거','제과','빵','과자'] },
    // ── 패션/의류 ──
    { cat:'패션의류',    kws:'패션 의류 코디 스타일링 OOTD',              target:'2030패션', tone:'감성라이프',
      bw:['패션','의류','옷','코디','스타일','아우터','청바지','원피스','티셔츠','나이키','아디다스','자라','에이치앤엠','유니클로','무신사'],
      tw:['패션','의류','옷','코디','스타일링','ootd','아우터','원피스','청바지','패션브랜드','의류브랜드','스트릿','트렌드'] },
    // ── 스포츠/피트니스 ──
    { cat:'스포츠피트니스', kws:'스포츠 운동 헬스 피트니스 다이어트',    target:'운동러버', tone:'활기차고긍정적',
      bw:['스포츠','운동','피트니스','헬스','요가','필라테스','골프','테니스','러닝','아웃도어','등산','나이키','아디다스','뉴발란스','언더아머','룰루레몬','데상트','휠라','푸마'],
      tw:['스포츠','운동','피트니스','헬스','요가','필라테스','골프','러닝','다이어트','홈트','헬스용품','운동복'] },
    // ── 전자/IT ──
    { cat:'전자IT',      kws:'전자 IT 가전 스마트폰 테크 디지털',         target:'테크러버', tone:'정보전달',
      bw:['전자','IT','가전','스마트폰','노트북','태블릿','삼성','LG','애플','소니','다이슨'],
      tw:['가전','스마트폰','노트북','태블릿','전자제품','IT','테크','디지털','앱','소프트웨어','하드웨어','전자기기'] },
    // ── 반려동물 ──
    { cat:'반려동물',    kws:'반려동물 강아지 고양이 펫 펫푸드',          target:'펫맘펫대디', tone:'따뜻하고사랑스러움',
      bw:['반려','펫','강아지','고양이','햄스터','pet','애완'],
      tw:['반려동물','강아지','고양이','펫','펫푸드','애완동물','pet','반려견','반려묘','펫케어','동물병원'] },
    // ── 인테리어/홈데코 ──
    { cat:'인테리어홈데코', kws:'인테리어 홈데코 가구 소품 집꾸미기',    target:'홈인테리어관심자', tone:'감성적',
      bw:['인테리어','가구','소품','홈데코','이케아','디자인'],
      tw:['인테리어','가구','소품','홈데코','집꾸미기','이케아','거실','방꾸미기','인테리어소품','홈스타일링'] },
    // ── 여행/레저 ──
    { cat:'여행레저',    kws:'여행 레저 호텔 항공 관광 캠핑',             target:'여행러버', tone:'설레고활기참',
      bw:['여행','호텔','항공','관광','캠핑','레저','리조트'],
      tw:['여행','호텔','항공','관광','캠핑','레저','리조트','배낭여행','해외여행','국내여행','숙박','투어'] },
    { cat:'미디어엔터', kws:'미디어 OTT 영상 콘텐츠 스트리밍 연예', target:'콘텐츠소비자', tone:'트렌디',
      bw:['넷플릭스','유튜브','왓챠','티빙','웨이브','쿠팡플레이','disney','넷플','영화','드라마','ott'],
      tw:['넷플릭스','유튜브','ott','스트리밍','영화','드라마','미디어','콘텐츠','애니','예능','음악','아이돌','kpop'] },
    // ── 교육 ──
    { cat:'교육',        kws:'교육 학습 강의 자격증 어학',                target:'학부모학생', tone:'신뢰전문',
      bw:['교육','학습','강의','자격증','어학','영어','코딩'],
      tw:['교육','학습','강의','자격증','어학','영어','코딩','온라인강의','스터디','학원','e러닝'] },
    // ── 금융/보험 ──
    { cat:'금융보험',    kws:'금융 보험 투자 재테크 은행',                target:'재테크관심자', tone:'신뢰전문',
      bw:['금융','보험','투자','재테크','은행','증권','카드','대출'],
      tw:['금융','보험','투자','재테크','은행','증권','주식','카드','대출','펀드','저축'] },
  ];

  for (const c of CATS) {
    c.score = 0;
    for (const w of c.bw) { if (b.includes(w)) c.score += 8; }
    for (const w of c.tw) { if (t.includes(w)) c.score += 2; }
  }

  const sorted = [...CATS].sort((a,b) => b.score - a.score);
  const best = sorted[0];

  // score 0 = 뷰티/생활 DB 외 브랜드 → 그래도 최선의 분류 제공
  const confidence = best.score >= 16 ? 'high' : best.score >= 8 ? 'mid' : best.score >= 2 ? 'low' : 'fallback';

  return {brand, cat:best.cat, kws:best.kws, target:best.target, tone:best.tone, confidence, score:best.score, searchUsed:true};
}