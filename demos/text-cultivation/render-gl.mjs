// WebGL2 renderer: indigo sutra paper (磁青纸), mineral-pigment glyphs, firelight, flames, fluids.
// It only reads World state. Visual randomness uses Math.random(), never World.random().
const GLYPHS = ['我', '水', '火', '木', '金', '土', '冰', '汽', '雷', '灰', '燃', '沸', '凝', '冻', '融', '熔', '铸', '熄', '霆', '剑', '渡', '劫', '飞', '升', '生', '克', '阵', '内', '观', '斩', '环', '爆', '镇', '风', '焰', '飓', '岳', '卷', '岩', '沙', '收', '灵', '符', '妖', '魅', '傀', '魄'];
export const GLYPH_INDEX = Object.fromEntries(GLYPHS.map((ch, i) => [ch, i]));
const LABELS = { ignite: 10, boil: 11, condense: 12, freeze: 13, thaw: 14, melt: 15, solidify: 16, extinguish: 17, lightning: 18 };
const ATLAS_COLS = 8, ATLAS_ROWS = 6, ATLAS_CELL = 128, SPREAD = 16;
const PLAYER = 11;
// Pigments as linear-ish display colours on the indigo ground.
const PIGMENT = {
  1: [.56, .82, 1.0], 2: [1.0, .42, .16], 3: [.42, .78, .52], 4: [.92, .73, .34], 5: [.80, .56, .32],
  6: [.84, .95, 1.0], 7: [.80, .86, .95], 8: [.82, .74, 1.0], 9: [.62, .62, .66], 10: [1.0, .62, .22],
};
const LABEL_COLOR = { ignite: [1, .5, .18], boil: [.7, .85, 1], condense: [.55, .8, 1], freeze: [.82, .95, 1], thaw: [.6, .85, 1], melt: [1, .66, .25], solidify: [.95, .76, .38], extinguish: [.75, .82, .9], lightning: [.85, .78, 1] };

const NOISE = `
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.-2.*f);
  float a = hash12(i), b = hash12(i+vec2(1.,0.)), c = hash12(i+vec2(0.,1.)), d = hash12(i+vec2(1.,1.));
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y); }
float fbm(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 4; i++){ s += a*vnoise(p); p = p*2.03 + vec2(17.1, 9.2); a *= .5; } return s/.9375; }
vec3 fireRamp(float t){ t = clamp(t, 0., 1.);
  vec3 c = mix(vec3(.30,.02,.01), vec3(.92,.22,.05), smoothstep(0., .35, t));
  c = mix(c, vec3(1., .58, .16), smoothstep(.3, .7, t));
  return mix(c, vec3(1., .93, .70), smoothstep(.68, 1., t)); }
`;
const HEAD = '#version 300 es\nprecision highp float;\n';
const FULL_VS = `#version 300 es
out vec2 vUV;
void main(){ vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); vUV = p; gl_Position = vec4(p*2.-1., 0., 1.); }`;

const PAPER_FS = HEAD + `in vec2 vUV; out vec4 o;
uniform vec2 uRes, uGrid; uniform float uSeed, uDpr;
${NOISE}
void main(){
  vec2 px = gl_FragCoord.xy; vec2 uv = px / uRes; vec2 q0 = px / uDpr;
  vec3 c = mix(vec3(.046,.076,.158), vec3(.094,.145,.262), smoothstep(0., 1., uv.y));
  c *= .86 + .26*fbm(q0/220. + uSeed);
  c *= .95 + .10*vnoise(q0/38. + uSeed*3.);
  float fib = 0.;
  for (int k = 0; k < 3; k++) {
    float a = float(k)*2.1 + .5 + uSeed;
    vec2 q = mat2(cos(a), -sin(a), sin(a), cos(a)) * q0;
    fib += smoothstep(.7, .95, vnoise(vec2(q.x/1.4, q.y/38.) + float(k)*13.)) * vnoise(q0/90. + float(k)*7.);
  }
  c += fib*.016*vec3(.55,.68,1.);
  vec2 g = q0/30.; vec2 gi = floor(g), gf = fract(g);
  float fleck = 0.;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 off = vec2(float(x), float(y)), id = gi + off;
    float h = hash12(id*1.37 + uSeed*7.);
    if (h > .935) {
      vec2 p = off + vec2(hash12(id + 3.1), hash12(id + 5.7)) - gf;
      float r = mix(.05, .13, hash12(id + 9.3)) * (h > .985 ? 2. : 1.);
      float ang = atan(p.y, p.x);
      float rr = r*(.6 + .6*vnoise(vec2(ang*1.9 + h*30., h*50.)));
      fleck = max(fleck, (1. - smoothstep(rr*.65, rr, length(p))) * (.55 + .45*hash12(id + 1.9)));
    }
  }
  float cw = uRes.x / uGrid.x;
  float fx = fract(px.x / cw); float dl = min(fx, 1. - fx) * cw / uDpr;
  float rule = (1. - smoothstep(.25, 1.05, dl)) * (.55 + .45*vnoise(vec2(px.x*.37, q0.y/26.)));
  vec3 gold = vec3(.80, .64, .33);
  c = mix(c, gold*.55, rule*.07);
  vec2 e2 = min(px, uRes - px) / uDpr; float edge = min(e2.x, e2.y);
  float frame = (1. - smoothstep(.45, 1.25, abs(edge - 6.))) + .7*(1. - smoothstep(.3, .9, abs(edge - 9.5)));
  c = mix(c, gold*.85, clamp(frame, 0., 1.)*.5);
  c *= mix(.72, 1., smoothstep(0., 90., edge));
  o = vec4(c, fleck);
}`;

const BACKDROP_FS = HEAD + `in vec2 vUV; out vec4 o;
uniform vec2 uParallax; uniform float uTime, uRise, uAspect, uMotion, uDetail;
${NOISE}
const vec3 GOLD = vec3(1., .78, .42);
vec4 over(vec4 top, vec4 under){ return vec4(top.rgb + under.rgb*(1. - top.a), top.a + under.a*(1. - top.a)); }
float ridged(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 4; i++){ float n = 1. - abs(vnoise(p)*2. - 1.); s += a*n*n; p = p*2.07 + vec2(13.1, 7.7); a *= .5; } return s/.9375; }
float sdSeg(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba)/dot(ba, ba), 0., 1.); return length(pa - ba*h); }
// Every layer sits at a depth: the nearer it is, the further it slides against the pointer and
// the faster it sinks while the opening rises. x is in aspect units, y runs up from the bottom.
vec2 layer(vec2 uv, float depth){ return vec2((uv.x + uParallax.x*depth)*uAspect, uv.y + uParallax.y*depth*.5 + uRise*depth*9.); }
float ridge(float x, float base, float amp, float freq, float seed){ return base + amp*(ridged(vec2(x*freq + seed, seed*1.7)) - .45); }
// One ink-wash range below height h: brush streaks in the body, a gold contour (泥金勾勒) that is
// brightest on slopes facing the moon, and a body that dissolves into mist further down.
vec4 inkRange(vec2 p, float h, float lit, vec3 tint, float alpha, float gold, float line, vec3 mist){
  float below = h - p.y;
  float edge = smoothstep(-.0022, .0022, below);
  if (edge <= 0.) return vec4(0.);
  float streak = vnoise(vec2(p.x*130. + tint.b*70., p.y*5.));
  vec3 col = tint*(.86 + .28*streak);
  float rim = 1. - smoothstep(line*.35, line, below);
  col = mix(col, mist, smoothstep(.04, .24, below)*.75);
  float a = edge*alpha*(1. - smoothstep(.16, .32, below)*.7);
  col += GOLD*rim*gold*(.25 + .75*lit)/max(a, .05);
  return vec4(col*a, a);
}
// Billowing cloud sea whose upper edge rolls past at its own speed; tops catch the moon.
vec4 cloudSea(vec2 p, float top, float speed, float seed, float amount){
  if (p.y > top + .05 || p.y < top - .2) return vec4(0.);
  float t = uTime*uMotion;
  float n = fbm(vec2(p.x*2.1 + t*speed + seed, p.y*8. + seed));
  float surface = top + (n - .5)*.07;
  float inside = smoothstep(surface + .012, surface - .03, p.y)*smoothstep(top - .2, top - .07, p.y);
  float tops = smoothstep(surface - .06, surface - .005, p.y);
  vec3 col = mix(vec3(.27,.33,.51), vec3(.60,.68,.86), tops);
  float a = inside*amount*(.75 + .5*n);
  return vec4(col*a, a);
}
// A pagoda on the far peak with lit windows.
vec4 pagoda(vec2 p, vec2 base, float s, vec3 tint, float t){
  vec2 q = (p - base)/s;
  if (abs(q.x) > .55 || q.y < -.05 || q.y > 1.25) return vec4(0.);
  float ink = 0., win = 0.;
  for (int i = 0; i < 5; i++) {
    float y0 = float(i)*.2, w = .17 - float(i)*.022, ax = abs(q.x);
    if (q.y > y0 && q.y < y0 + .14 && ax < w) { ink = 1.; if (ax < w*.32 && q.y > y0 + .035 && q.y < y0 + .105) win = 1.; }
    float rw = w + .13, eave = y0 + .14 + .07*pow(ax/rw, 3.);
    if (ax < rw && q.y > eave - .012 && q.y < y0 + .17 + (rw - ax)*.35) ink = 1.;
  }
  if (abs(q.x) < .018 && q.y > .99 && q.y < 1.22) ink = 1.;
  float flick = .75 + .25*sin(t*3.1 + floor(q.y*5.)*1.7);
  vec3 col = mix(tint*.5, vec3(1., .82, .45)*1.5*flick, win);
  float a = max(ink*.9, win);
  float halo = exp(-length(q - vec2(0., .5))*2.6)*.07;
  return vec4(col*a + vec3(1., .72, .36)*halo*(1. - a), max(a, halo));
}
// A waterfall pouring from a cleft into the mist.
vec4 waterfall(vec2 p, float x0, float top, float t){
  float below = top - p.y, dx = p.x - x0;
  if (below < 0. || below > .2 || abs(dx) > .03) return vec4(0.);
  float w = .003 + below*.035;
  float core = 1. - smoothstep(w*.35, w, abs(dx));
  float flow = vnoise(vec2(dx*700., (p.y + t*.3)*46.));
  float a = core*(.3 + .7*flow)*(1. - smoothstep(.1, .2, below))*.6;
  return vec4(vec3(.72,.82,.96)*a, a);
}
// A crane (仙鹤) in flight, seen from the side: white body, red crown, trailing legs, beating wing.
vec4 crane(vec2 p, vec2 c, float s, float flap){
  vec2 q = (p - c)/s;
  if (dot(q, q) > 2.2) return vec4(0.);
  float d = sdSeg(q, vec2(-.3, 0.), vec2(.22, .03)) - .075;
  d = min(d, sdSeg(q, vec2(.22, .03), vec2(.7, .12)) - .024);
  d = min(d, sdSeg(q, vec2(-.3, 0.), vec2(-.95, -.08)) - .018);
  vec2 elbow = vec2(-.12, .42*flap), tip = vec2(-.5, .82*flap + .05);
  d = min(d, min(sdSeg(q, vec2(-.02, .03), elbow) - .055, sdSeg(q, elbow, tip) - .03));
  float far = min(sdSeg(q, vec2(.02, .04), elbow + vec2(.12, -.05)) - .045, sdSeg(q, elbow + vec2(.12, -.05), tip + vec2(.2, -.08)) - .025);
  float body = 1. - smoothstep(0., .06, d), shade = (1. - smoothstep(0., .06, far))*.55;
  float crown = 1. - smoothstep(.025, .06, length(q - vec2(.72, .14)));
  float a = max(max(body, shade)*.8, crown*.95);
  vec3 col = mix(mix(vec3(.62,.68,.82), vec3(.9,.92,.98), body), vec3(.95,.25,.16), crown);
  return vec4(col*a, a);
}
// 灵气 motes drifting up out of the valley.
float motes(vec2 p, float scale, float speed, float seed, float t){
  vec2 g = vec2(p.x*scale, (p.y - t*speed)*scale), id = floor(g), f = fract(g) - .5;
  float h = hash12(id + seed);
  if (h < .86) return 0.;
  vec2 off = (vec2(hash12(id + 3.1 + seed), hash12(id + 5.7 + seed)) - .5)*.6 + vec2(sin(t*.7 + h*30.)*.12, 0.);
  return (1. - smoothstep(0., .1, length(f - off)))*(.45 + .55*sin(t*2. + h*60.));
}
// A pine bough across the moon (松间明月): ink needle fans along the branch, their edges lit by the
// moon behind them.
vec4 bough(vec2 p, vec2 moon, float t){
  float px = fwidth(p.x) + 1e-5, A = uAspect;
  if (p.x < A - .8 || p.y < .68) return vec4(0.);
  vec2 sw = vec2(sin(t*.5)*.004, sin(t*.37)*.002);
  vec2 b0 = vec2(A + .05, 1.02), b1 = vec2(A - .12, .92) + sw*.5, b2 = vec2(A - .37, .855) + sw, b3 = vec2(A - .63, .8) + sw*1.4;
  vec2 t1 = b1 + (b2 - b1)*.4, t1e = t1 + vec2(-.055, -.07) + sw, t2 = b2 + (b3 - b2)*.35, t2e = t2 + vec2(-.045, .055) + sw;
  float d = min(min(sdSeg(p, b0, b1) - .008, sdSeg(p, b1, b2) - .0055), sdSeg(p, b2, b3) - .003);
  d = min(d, min(sdSeg(p, t1, t1e) - .003, sdSeg(p, t2, t2e) - .0022));
  float ink = 1. - smoothstep(-px, px, d), rim = 0.;
  for (int i = 0; i < 10; i++) {
    float k = float(i), sz;
    vec2 c;
    if (i < 4) { c = mix(b1, b2, .05 + k*.3); sz = .046 - k*.003; }
    else if (i < 7) { c = mix(b2, b3, .12 + (k - 4.)*.38); sz = .04 - (k - 4.)*.005; }
    else if (i == 7) { c = t1e; sz = .034; }
    else if (i == 8) { c = t2e; sz = .03; }
    else { c = mix(b0, b1, .55); sz = .044; }
    c += sw*(1. + k*.1) + vec2(0., sz*.18);
    // a wide, low fan of needles radiating from a point under the branch
    vec2 q = (p - c)/vec2(sz, sz*.55), f = q - vec2(0., -.75);
    if (q.y < -1. || dot(q, q) > 5.) continue;
    float th = atan(f.x, f.y), rho = length(f);
    float len = 1.65*(1. - .32*th*th) + .2*(vnoise(vec2(th*24. + k*7., k)) - .5);
    float e = max(rho - len, (abs(th) - 1.25)*rho);
    float aa = px/(sz*.55)*1.3;
    float inside = 1. - smoothstep(-aa, aa, e);
    float needles = .74 + .26*smoothstep(.3, .7, vnoise(vec2(th*40. + k*3., rho*1.6)));
    ink = max(ink, inside*needles);
    float edge = smoothstep(-.3, -.03, e)*(1. - smoothstep(-.03, aa, e));
    rim = max(rim, edge*clamp(dot(normalize(p - c + 1e-5), normalize(moon - c + 1e-5)), 0., 1.)*exp(-length(moon - c)*4.));
  }
  float a = ink*.95;
  return vec4(vec3(.012,.02,.05)*a + GOLD*rim*1.4, min(1., a + rim*.4));
}
void main(){
  vec2 uv = vUV; float t = uTime*uMotion;
  vec4 acc = vec4(0.);
  // stars and the river of heaven, far behind everything
  vec2 sq = layer(uv, .002);
  vec2 sp = sq*70.; vec2 si = floor(sp); float h = hash12(si);
  float star = step(.988, h)*(1. - smoothstep(.0, .22, length(fract(sp) - .5 - (vec2(hash12(si + 1.3), hash12(si + 2.1)) - .5)*.5)));
  star *= (.55 + .45*sin(t*1.7 + h*80.))*smoothstep(.4, .85, uv.y);
  acc.rgb += vec3(.78,.84,1.)*star*.75;
  if (uDetail > .5 && uv.y > .45) {
    float band = exp(-pow((sq.y - .78 + (sq.x - .9*uAspect)*.32)*6., 2.));
    float dust = fbm(sq*vec2(4., 7.) + vec2(3., t*.01));
    acc.rgb += vec3(.42,.48,.78)*band*smoothstep(.42, .8, dust)*.09*smoothstep(.45, .85, uv.y);
  }
  // the moon, its halo and faint shafts of light
  vec2 mq = layer(uv, .004), moon = vec2(.8*uAspect, .8 - uRise*.08);
  vec2 dv = mq - moon;
  float r = length(dv), mr = .055;
  float disc = smoothstep(mr, mr - .003, r), rim = max(r - mr, 0.);
  float shafts = pow(vnoise(vec2(atan(dv.y, dv.x)*7., t*.04)), 3.)*exp(-rim*4.)*.055;
  acc.rgb += vec3(.62,.52,.34)*(exp(-rim*20.)*.34 + exp(-rim*5.)*.1 + shafts)*(1. - disc);
  vec3 mcol = vec3(1.,.93,.76)*(.72 + .28*fbm(dv*38. + 3.))*(.8 + .2*smoothstep(mr, 0., length(dv - vec2(-.012, .012))));
  acc = over(vec4(mcol*.66*disc, disc), acc);
  // high clouds drifting past the moon
  if (uv.y > .5) {
    vec2 cq = layer(uv, .007);
    float cl = fbm(vec2(cq.x*1.3 - t*.006, cq.y*3.2 + 1.));
    float cloud = smoothstep(.56, .86, cl)*smoothstep(.5, .95, uv.y)*.24;
    acc = over(vec4(vec3(.3,.35,.5)*cloud, cloud), acc);
  }
  // Five ranges from far to near, cloud seas and mist between them. Far ones are pale and hazy
  // and barely move; near ones are dark, crisp, gold-edged and slide much further.
  vec2 p1 = layer(uv, .008); float h1 = ridge(p1.x, .57, .3, 1.15, 11.);
  vec2 p2 = layer(uv, .016); float h2 = ridge(p2.x, .47, .22, 1.7, 29.) + .07*exp(-pow((p2.x - .36*uAspect)/.1, 2.));
  vec2 p3 = layer(uv, .03); float h3 = ridge(p3.x, .38, .19, 2.3, 47.);
  vec2 p4 = layer(uv, .05); float h4 = ridge(p4.x, .29, .14, 3.1, 61.);
  vec2 p5 = layer(uv, .078); float h5 = ridge(p5.x, .2, .1, 4.2, 83.);
  float l1 = clamp(.5 - dFdx(h1)/dFdx(p1.x)*.8, 0., 1.), l2 = clamp(.5 - dFdx(h2)/dFdx(p2.x)*.8, 0., 1.), l3 = clamp(.5 - dFdx(h3)/dFdx(p3.x)*.8, 0., 1.);
  float l4 = clamp(.5 - dFdx(h4)/dFdx(p4.x)*.8, 0., 1.), l5 = clamp(.5 - dFdx(h5)/dFdx(p5.x)*.8, 0., 1.);
  acc = over(inkRange(p1, h1, l1, vec3(.22,.29,.48), .42, .09, .002, vec3(.33,.4,.58)), acc);
  if (uDetail > .5) {
    // cranes cross the sky between the far ranges
    vec2 kq = layer(uv, .013);
    for (int i = 0; i < 3; i++) {
      float k = float(i), span = uAspect + .5;
      vec2 c = vec2(mod(t*(.016 + k*.003) + k*.61, span) - .25, .66 + k*.035 + .012*sin(t*.4 + k*2.));
      acc = over(crane(kq, c, .03 - k*.004, sin(t*4.2 + k*2.3)), acc);
    }
  }
  acc = over(cloudSea(layer(uv, .012), .5, .008, 3., .34), acc);
  acc = over(inkRange(p2, h2, l2, vec3(.16,.22,.4), .52, .14, .0024, vec3(.31,.38,.56)), acc);
  if (abs(p2.x - .36*uAspect) < .045) {
    vec2 pb = vec2(.36*uAspect, ridge(.36*uAspect, .47, .22, 1.7, 29.) + .07 - .004);
    acc = over(pagoda(p2, pb, .07, vec3(.13,.18,.33), t), acc);
  }
  acc = over(cloudSea(layer(uv, .022), .41, .014, 17., .38), acc);
  acc = over(inkRange(p3, h3, l3, vec3(.1,.18,.3), .62, .22, .003, vec3(.3,.38,.55)), acc);
  float wx = .64*uAspect;
  if (abs(p3.x - wx) < .03) acc = over(waterfall(p3, wx, ridge(wx, .38, .19, 2.3, 47.) - .012, t), acc);
  if (uv.y > .07 && uv.y < .3) {
    vec2 m3q = layer(uv, .04);
    float mist3 = fbm(vec2(m3q.x*1.8 + t*.02, m3q.y*7. - t*.02));
    float m3 = smoothstep(.3, .19, uv.y)*smoothstep(.07, .19, uv.y)*mist3*.18;
    acc = over(vec4(vec3(.38,.46,.64)*m3, m3), acc);
  }
  acc = over(inkRange(p4, h4, l4, vec3(.07,.11,.23), .72, .3, .0036, vec3(.27,.34,.52)), acc);
  if (uv.y < .22) {
    vec2 m4q = layer(uv, .062);
    float mist4 = fbm(vec2(m4q.x*2.2 - t*.03, m4q.y*8. + t*.02));
    float m4 = smoothstep(.22, .12, uv.y)*smoothstep(.0, .12, uv.y)*mist4*.16;
    acc = over(vec4(vec3(.34,.42,.6)*m4, m4), acc);
  }
  // the nearest hills, with ink pines along the ridge
  vec4 near = inkRange(p5, h5, l5, vec3(.03,.05,.12), .9, .42, .005, vec3(.2,.26,.42));
  float cell = floor(p5.x*9.), seed = hash12(vec2(cell, 7.));
  if (seed > .35 && p5.y < h5 + .08 && p5.y > h5 - .05) {
    float xc = (cell + .35 + .3*hash12(vec2(cell, 3.)))/9., th = .045 + .025*hash12(vec2(cell, 9.));
    float base = ridge(xc, .2, .1, 4.2, 83.) - .004;
    vec2 q = vec2(p5.x - xc, p5.y - base);
    float pine = (abs(q.x) < .0022 && q.y > 0. && q.y < th) ? 1. : 0.;
    for (int k = 0; k < 4; k++) {
      float fk = float(k), cy = th*(.38 + fk*.2), w = th*(.5 - fk*.1), hgt = th*.1;
      vec2 e = vec2(q.x/w, (q.y - cy)/hgt);
      float fr = vnoise(vec2(q.x*260. + cell*7., fk*3.))*.35;
      if (length(e) < 1. - fr && e.y > -.9) pine = 1.;
    }
    if (pine > 0.) { vec3 pc = vec3(.025,.04,.1); near = over(vec4(pc*.92, .92), near); }
  }
  acc = over(near, acc);
  // 灵气 rising from the valley at two depths
  if (uDetail > .5) { vec2 fq = layer(uv, .035); acc.rgb += GOLD*motes(fq, 38., .012, 1.7, t)*.5*smoothstep(.62, .12, uv.y); }
  vec2 nq = layer(uv, .09); acc.rgb += GOLD*motes(nq, 19., .022, 5.3, t)*.75*smoothstep(.7, .1, uv.y);
  // a pine bough in front of the moon, nearest of all
  // (the moon's place on screen, carried into the bough's layer so its rim light follows the moon)
  vec2 ms = vec2(.8 - uParallax.x*.004, .8 - uRise*.08 - uParallax.y*.002 - uRise*.036);
  if (uDetail > .5) acc = over(bough(layer(uv, .11), layer(ms, .11), t), acc);
  o = acc;
}`;

const COPY_FLIP_FS = HEAD + `in vec2 vUV; out vec4 o; uniform sampler2D uTex;
void main(){ o = texture(uTex, vec2(vUV.x, 1. - vUV.y)); }`;
const BLUR_FS = HEAD + `in vec2 vUV; out vec4 o; uniform sampler2D uTex; uniform vec2 uDir;
void main(){
  vec4 s = texture(uTex, vUV) * .2270270270;
  s += (texture(uTex, vUV + uDir*1.3846153846) + texture(uTex, vUV - uDir*1.3846153846)) * .3162162162;
  s += (texture(uTex, vUV + uDir*3.2307692308) + texture(uTex, vUV - uDir*3.2307692308)) * .0702702703;
  o = s;
}`;

const FLUID_VS = HEAD + `layout(location=0) in vec4 iA; layout(location=1) in float iR;
uniform vec2 uRes, uCell; out vec2 vP; flat out vec2 vCh;
void main(){
  vec2 corner = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1));
  vec2 px = (iA.xy + .5 + (corner*2. - 1.)*iR) * uCell;
  vP = corner*2. - 1.; vCh = iA.zw;
  gl_Position = vec4(px.x/uRes.x*2. - 1., 1. - px.y/uRes.y*2., 0., 1.);
}`;
const FLUID_FS = HEAD + `in vec2 vP; flat in vec2 vCh; out vec4 o;
void main(){
  float k = max(0., 1. - dot(vP, vP)); k *= k*vCh.y;
  float ch = vCh.x;
  o = vec4(ch < .5 ? k : 0., (ch > .5 && ch < 1.5) ? k : 0., (ch > 1.5 && ch < 2.5) ? k : 0., ch > 2.5 ? k : 0.);
}`;

const SCENE_BG_FS = HEAD + `in vec2 vUV; out vec4 o;
uniform sampler2D uPaper, uFluid, uLight, uBack; uniform vec2 uCellUV, uRes; uniform float uTime, uFlash, uMotion, uStorm, uDark, uBackdrop;
${NOISE}
void main(){
  vec4 paper = texture(uPaper, vUV);
  vec4 back = texture(uBack, vUV)*uBackdrop;
  paper.rgb = paper.rgb*(1. - back.a) + back.rgb;
  vec3 L = texture(uLight, vUV).rgb;
  vec3 c = paper.rgb * (1. - uDark*.5) * (1. + uFlash*1.7) + paper.rgb * L * 6.5 + L * L * .7 + L * .3;
  float tw = .7 + .3*sin(uTime*2.3*uMotion + hash12(floor(vUV*uRes/3.))*40.);
  c = mix(c, vec3(1.,.83,.45) * (.78 + 2.2*dot(L, vec3(.333)) + uFlash*1.6) * tw, paper.a*.92);
  vec4 f = texture(uFluid, vUV);
  vec2 cu = vUV / uCellUV; float t = uTime;
  float cloud = fbm(cu*vec2(.42, .34) + vec2(t*.1, -t*.28));
  float fog = smoothstep(.05, .5, f.b*(.55 + .9*cloud));
  float lip = fog*(1. - smoothstep(.0, .5, texture(uFluid, vUV + vec2(0., uCellUV.y*.6)).b));
  vec3 fogCol = mix(vec3(.66,.74,.88) + lip*.12, vec3(.15,.13,.23) + lip*.05, uStorm) + L*mix(.35, 1.1, uStorm);
  c = mix(c, fogCol, fog*mix(.42, .8, uStorm));
  float ice = smoothstep(.46, .54, f.a);
  c = mix(c, vec3(.50,.70,.86) + L*.25, ice*.26);
  float wm = smoothstep(.44, .52, f.r);
  if (wm > .001) {
    float d1 = step(.5, texture(uFluid, vUV + vec2(0., uCellUV.y)).r);
    float d2 = step(.5, texture(uFluid, vUV + vec2(0., uCellUV.y*2.5)).r);
    float d3 = step(.5, texture(uFluid, vUV + vec2(0., uCellUV.y*4.5)).r);
    float depth = (d1 + d2 + d3) / 3.;
    vec3 wc = mix(vec3(.16,.46,.76), vec3(.04,.15,.38), depth);
    float ca = vnoise(cu*1.25 + vec2(t*.55, t*.35)) * vnoise(cu*1.7 - vec2(t*.45, -t*.3));
    wc += pow(ca, 2.)*.42*(1. - depth*.6)*vec3(.6,.85,1.);
    float above = texture(uFluid, vUV + vec2(0., uCellUV.y*.16)).r;
    float rim = 1. - smoothstep(.5, .6, f.r);
    float surf = wm * rim * (1. - smoothstep(.42, .5, above));
    wc = mix(wc, vec3(.78,.95,1.), surf*.85);
    wc += vec3(.10,.22,.34)*(1. - depth)*(1. - smoothstep(.0, 1., depth*3.));
    wc += L*.9 + uFlash*.35;
    c = mix(c, wc, wm*.86);
  }
  float mm = smoothstep(.44, .52, f.g);
  if (mm > .001) {
    float fl = vnoise(cu*.9 + vec2(t*.5, 0.));
    c = mix(c, fireRamp(.6 + .3*fl), mm*.94);
  }
  o = vec4(c, 1.);
}`;

const GLYPH_VS = HEAD + `layout(location=0) in vec4 iA; layout(location=1) in vec4 iB; layout(location=2) in vec4 iC; layout(location=3) in vec4 iD;
uniform vec2 uRes, uCell; uniform float uTime, uMotion, uEmissive;
out vec2 vUV; flat out vec4 vA; flat out vec4 vB; flat out vec4 vC; flat out vec4 vD;
bool glows(){
  float k = iA.z, p = iA.w;
  if (iC.w >= 8. || mod(floor(iC.w/4.), 2.) >= 1.) return true;
  if (mod(iC.w, 2.) >= 1.) return false;
  if ((k > 1.5 && k < 2.5) || (k > 7.5 && k < 8.5) || (k > 9.5 && k < 10.5)) return true;
  if (abs(iB.w) > .25) return true;
  if (k > 2.5 && k < 3.5 && iB.z > 420.) return true;
  if (k > 3.5 && k < 4.5 && iB.z > 800.) return true;
  if (iB.x < 1. && p > 1.5 && p < 3.5) return true;
  return false;
}
void main(){
  vec2 corner = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1));
  float k = iA.z, seed = iC.x, death = iC.y, m = uMotion;
  bool player = mod(floor(iC.w/4.), 2.) >= 1.;
  float unit = min(uCell.x, uCell.y);
  float scale = (player ? 2.8 : 1.26)*iD.x;
  vec2 c = iA.xy + .5;
  if (!player && iC.w < 8.) {
    if (k > 1.5 && k < 2.5) { c.y -= (.04 + .04*sin(uTime*7.3 + seed*40.))*m; scale *= 1. + .05*sin(uTime*9.1 + seed*21.)*m; }
    else if (k > 6.5 && k < 7.5) { c.x += .14*sin(uTime*1.3 + seed*30.)*m; c.y += .09*cos(uTime*1.1 + seed*17.)*m; scale *= 1.12; }
    else if (k > .5 && k < 1.5) { c.y += .035*sin(uTime*2.4 + iA.x*.7 + seed*6.)*m; }
    else if (k > 2.5 && k < 3.5) { c.x += .035*sin(uTime*1.3 + iA.x*.35 - iA.y*.45 + seed)*m; }
    float b = 1. - iB.y; scale *= 1. + .32*b*b*m;
    if (death > 0. && ((k > 1.5 && k < 2.5) || (k > 6.5 && k < 8.5))) { c.y -= death*.7*m; scale *= 1. + death*.35; }
  }
  float r = iD.y; mat2 R = mat2(cos(r), sin(r), -sin(r), cos(r));
  vec2 px = c*uCell + R*((corner - .5)*unit*scale);
  vUV = corner; vA = iA; vB = iB; vC = iC; vD = iD;
  vec4 pos = vec4(px.x/uRes.x*2. - 1., 1. - px.y/uRes.y*2., 0., 1.);
  if (uEmissive > .5 && !glows()) pos = vec4(2., 2., 2., 1.);
  gl_Position = pos;
}`;

const GLYPH_FS = HEAD + `in vec2 vUV; flat in vec4 vA; flat in vec4 vB; flat in vec4 vC; flat in vec4 vD; out vec4 o;
uniform sampler2D uAtlas, uLight; uniform vec2 uAtlasGrid, uViewport;
uniform float uTime, uEmissive, uMotion, uFlash;
${NOISE}
float sdf(float idx, vec2 uv){
  vec2 cell = vec2(mod(idx, uAtlasGrid.x), floor(idx / uAtlasGrid.x));
  return texture(uAtlas, (cell + clamp(uv, .004, .996)) / uAtlasGrid).r;
}
float gOver = 0.;
float gidx(float k){ if (gOver > .5) return gOver - 1.; return k > 10.5 ? 0. : (k > 9.5 ? 4. : k); }
float ink(float d, float bias, float aa){ return smoothstep(.5 - aa, .5 + aa, d + bias); }
vec3 E;  // emission accumulated by shade()
vec4 shade(float k, vec2 uv, float bias, float seed, float temp, float charge, float fuel){
  float m = uMotion, t = uTime;
  E = vec3(0.);
  if (k > .5 && k < 1.5) uv.x += sin(uv.y*9. + t*3. + seed*20.)*.014*m;
  if (k > 9.5 && k < 10.5) uv.y -= .08*sin(uv.x*3.1416)*(.6 + .4*sin(t*1.7 + seed*9.))*m;
  float d = sdf(gidx(k), uv);
  float aa = max(fwidth(d)*.8, .004);
  float edgeN = (vnoise(uv*7. + seed*13.) - .5)*.05;
  float a = ink(d, bias + edgeN, aa);
  vec3 col = vec3(1.);
  if (k < 1.5) {
    col = mix(vec3(.50,.78,1.), vec3(.86,.96,1.), smoothstep(.56, .78, d)); a *= .8;
  } else if (k < 2.5) {
    float heat = clamp(.5 + fuel*.14, .5, 1.) * (.88 + .12*sin(t*13.*m + seed*50.));
    float core = smoothstep(.52, .74, d);
    a = ink(d, bias + .025 + edgeN, aa);
    col = mix(vec3(.96,.30,.09), vec3(1.,.88,.55), core*heat);
    E = mix(vec3(.85,.20,.05), vec3(1.,.72,.32), core)*a*.8*heat + vec3(.75,.18,.04)*smoothstep(.16, .5, d)*.3*heat;
  } else if (k < 3.5) {
    float charr = smoothstep(420., 600., temp);
    float dry = smoothstep(.62, .92, vnoise(vec2(uv.x*26., uv.y*4.) + seed*5.));
    a *= 1. - dry*.28;
    col = mix(vec3(.38,.72,.47), vec3(.62,.86,.58), smoothstep(.6, .8, d)*.5);
    col = mix(col, vec3(.17,.10,.07), charr);
    float rim = ink(d, bias + .05, aa) - ink(d, bias - .035, aa);
    E = vec3(1.,.34,.07)*rim*charr*(.45 + .55*vnoise(uv*12. + t*2.*m))*1.4;
  } else if (k < 4.5 || (k > 9.5 && k < 10.5)) {
    if (k < 4.5) {
      vec2 tx = vec2(1.5/${ATLAS_CELL}.0, 0.);
      float gxv = sdf(gidx(k), uv + tx.xy) - sdf(gidx(k), uv - tx.xy);
      float gyv = sdf(gidx(k), uv + tx.yx) - sdf(gidx(k), uv - tx.yx);
      float hgt = smoothstep(.5, .66, d);
      vec3 n = normalize(vec3(-gxv*(1. - hgt)*9., gyv*(1. - hgt)*9., 1.));
      vec3 Ld = normalize(vec3(cos(t*.35 + seed*2.)*.7, .55, .75));
      float diff = max(dot(n, Ld), 0.);
      float spec = pow(max(dot(reflect(-Ld, n), vec3(0., 0., 1.)), 0.), 22.);
      col = (vec3(.80,.60,.25)*(.55 + .6*diff) + vec3(1.,.93,.74)*spec*.85)*mix(1., .78, clamp(fuel/6., 0., 1.));
      col *= .9 + .2*vnoise(uv*24. + seed*9.);
      float phase = fract(t*.11*m + seed);
      float band = 1. - smoothstep(0., .09, abs(uv.x + uv.y - (phase*6. - 2.)));
      col += band*vec3(1.,.9,.6)*.45;
      float hot = smoothstep(800., 1370., temp);
      col = mix(col, vec3(1.,.42,.14), hot*.65);
      E = vec3(1.,.34,.1)*hot*a*.55;
    } else {
      float hot = clamp((temp - 1100.)/1400., .25, 1.);
      a = ink(d, bias + .05 + edgeN, aa);
      col = fireRamp(.55 + .45*hot*(.8 + .2*vnoise(uv*6. + t*1.5*m)));
      E = col*a*.7 + fireRamp(.5)*smoothstep(.15, .5, d)*.3;
    }
  } else if (k < 5.5) {
    float depth = clamp(fuel/6., 0., 1.);
    col = vec3(.80,.56,.32)*(.82 + .3*fbm(uv*6. + seed))*mix(1.16, .5, sqrt(depth));
    col = mix(col, vec3(.95,.78,.52), (1. - smoothstep(0., .2, depth))*smoothstep(.55, .8, d)*.35);
    a = ink(d, bias + (vnoise(uv*14. + seed*7.) - .5)*.08, aa);
    a *= 1. - .3*smoothstep(.62, .92, vnoise(vec2(uv.x*30., uv.y*5.) + seed*3.));
  } else if (k < 6.5) {
    vec2 g = uv*3.4 + seed*7.; vec2 gi = floor(g), gf = fract(g); float f1 = 9., f2 = 9.;
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
      vec2 off = vec2(float(x), float(y)); vec2 p = off + vec2(hash12(gi + off), hash12(gi + off + 4.2)) - gf;
      float dd = dot(p, p); if (dd < f1) { f2 = f1; f1 = dd; } else if (dd < f2) f2 = dd; }
    float facet = 1. - smoothstep(0., .08, sqrt(f2) - sqrt(f1));
    col = mix(vec3(.66,.86,1.), vec3(.95,1.,1.), smoothstep(.55, .8, d)) + facet*.18;
    a *= .92;
  } else if (k < 7.5) {
    float soft = aa + .085;
    a = smoothstep(.5 - soft, .5 + soft, d + bias) * .17;
    col = vec3(.84,.90,.98);
  } else if (k < 8.5) {
    float fl = .75 + .25*vnoise(vec2(t*31.*m, seed*90.));
    a = ink(d, bias + .03, aa);
    col = vec3(.95,.92,1.);
    E = (vec3(.78,.68,1.)*a*1.25 + vec3(.5,.36,1.)*smoothstep(.12, .5, d)*.55)*fl;
  } else if (k < 9.5) {
    float er = fbm(uv*6. + seed*11.);
    a = ink(d, bias - .02, aa) * smoothstep(.22, .44, er + .22) * .82;
    col = vec3(.56,.56,.60)*(.82 + .25*er)*mix(1.1, .62, clamp(fuel/6., 0., 1.));
  }
  bool conductor = (k > .5 && k < 1.5) || (k > 3.5 && k < 4.5) || (k > 5.5 && k < 6.5) || (k > 9.5 && k < 10.5);
  if (conductor && abs(charge) > .25) {
    float q = min(1., abs(charge)/4.);
    float rim = ink(d, bias + .06, aa) - ink(d, bias - .04, aa);
    float fl = .55 + .45*vnoise(vec2(t*30.*m + uv.x*8., seed*90. + uv.y*8.));
    col = mix(col, vec3(.88,.82,1.), rim*q*.85);
    E += vec3(.62,.46,1.)*(rim*1.5 + a*.25)*q*fl;
  }
  return vec4(col, a);
}
void main(){
  float k = vA.z, prev = vA.w, tt = vB.x, bt = vB.y;
  float temp = vB.z, charge = vB.w, seed = vC.x, death = vC.y, fuel = vC.z, flags = vC.w;
  vec2 uv = vUV;
  vec3 L = texture(uLight, gl_FragCoord.xy / uViewport).rgb;
  gOver = vD.w;
  if (flags >= 8.) {
    // Calligraphic caption: cream ink with a soft halo; kind picks the tint.
    float d = sdf(gidx(k), uv);
    float aa = max(fwidth(d)*.8, .004);
    float birth = 1. - bt;
    float a = ink(d, -.24*birth*birth + (vnoise(uv*7. + seed*13.) - .5)*.04, aa)*smoothstep(0., .3, bt);
    vec3 col = k > 7.5 && k < 8.5 ? vec3(.90,.84,1.) : (k > 3.5 && k < 4.5 ? vec3(1.,.86,.52) : vec3(.98,.90,.72));
    vec3 halo = k > 7.5 && k < 8.5 ? vec3(.55,.4,1.) : vec3(1.,.72,.35);
    if (uEmissive > .5) o = vec4(halo*(a*.45 + smoothstep(.12, .5, d)*.3)*vD.z*smoothstep(0., .5, bt), 1.);
    else o = vec4(col + L*.3, a*vD.z);
    return;
  }
  if (mod(floor(flags/4.), 2.) >= 1.) {
    vec2 sp = (uv - .5)*2.8/1.3 + .5;
    vec2 q = abs(sp - .5)*2.;
    float sq = max(q.x, q.y);
    float en = (vnoise(sp*11. + 3.) - .5)*.07;
    float seal = 1. - smoothstep(.90 + en, .95 + en, sq);
    float gd = sdf(0., (sp - .5)*1.12 + .5);
    float aa = max(fwidth(gd)*.8, .004);
    float carve = ink(gd, .035, aa) * step(sq, .86);
    float tex = .85 + .15*vnoise(sp*30.);
    float a = seal;
    vec3 col = vec3(.80,.18,.13)*tex + L*.4;
    vec3 carved = vec3(.98,.90,.76);
    float r = length(uv - .5)*2.;
    if (uEmissive > .5) {
      float pulse = .7 + .3*sin(uTime*2.2);
      o = vec4(vec3(1.,.36,.2)*(1. - smoothstep(.3, 1., r))*.16*pulse, 1.);
    } else {
      float shadow = (1. - smoothstep(.3, .62, length((uv - vec2(.5, .53))*vec2(1., 1.15))))*.35*(1. - seal);
      o = vec4(mix(vec3(0.), mix(col, carved, carve*.92), seal), max(a, shadow));
    }
    return;
  }
  float birth = 1. - bt;
  float bias = -.24*birth*birth;
  vec4 cur = shade(k, uv, bias, seed, temp, charge, fuel); vec3 ec = E;
  cur.a *= smoothstep(0., .22, bt);
  cur.rgb += birth*.22;
  vec3 emis = ec;
  if (tt < 1. && prev > .5) {
    vec4 pre = shade(prev, uv, 0., seed, temp, charge, fuel); vec3 ep = E;
    float n = fbm(uv*4.2 + seed*7.);
    if (prev > 2.5 && prev < 3.5 && k > 1.5 && k < 2.5) {
      float b = tt*1.35;
      float keep = smoothstep(b - .12, b, n);
      float band = (1. - keep)*smoothstep(b - .34, b - .12, n)*pre.a;
      pre.a *= keep;
      emis = ec*smoothstep(.3, 1., tt) + vec3(1.,.52,.14)*band*2.2;
      cur.a *= smoothstep(.3, 1., tt);
    } else if (prev > .5 && prev < 1.5 && k > 6.5 && k < 7.5) {
      pre.a *= 1. - smoothstep(0., 1., tt*1.35 + (n - .5)*.7 + (.5 - uv.y)*.35);
      cur.a *= tt;
    } else if (prev > .5 && prev < 1.5 && k > 5.5 && k < 6.5) {
      float front = smoothstep(tt*1.5 - .18, tt*1.5, 1. - n + .1);
      cur.a *= 1. - front;
      cur.rgb += (1. - front)*smoothstep(tt*1.5 - .35, tt*1.5 - .18, 1. - n + .1)*.45;
      pre.a *= front;
    } else if (prev > 1.5 && prev < 2.5) {
      float cool = smoothstep(0., 1., tt);
      emis = ep*(1. - cool) + ec;
      pre.a *= 1. - cool; cur.a *= cool;
    } else if ((prev > 3.5 && prev < 4.5) || (prev > 9.5 && prev < 10.5)) {
      pre.a *= 1. - tt; cur.a *= tt; emis = mix(ep, ec, tt);
    } else {
      pre.a *= 1. - tt; cur.a *= tt; emis = mix(ep, ec, tt);
    }
    float aOut = cur.a + pre.a*(1. - cur.a);
    cur.rgb = aOut > 0. ? (cur.rgb*cur.a + pre.rgb*pre.a*(1. - cur.a))/aOut : cur.rgb;
    cur.a = aOut;
  }
  if (death > 0.) {
    float n = fbm(uv*5. + seed*3.);
    bool erased = mod(floor(flags/2.), 2.) >= 1.;
    float speed = erased ? 1.45 : 1.15;
    float keep = smoothstep(death*speed - .12, death*speed, n);
    cur.a *= keep*(1. - death*.4);
    emis *= keep*(1. - death);
    if (erased) cur.rgb = mix(cur.rgb, vec3(.55,.62,.75), .4);
  }
  if (mod(flags, 2.) >= 1.) { cur.a *= .34; emis = vec3(0.); }
  cur.a *= vD.z; emis *= vD.z;
  if (uEmissive > .5) { o = vec4(emis, 1.); return; }
  vec3 lit = cur.rgb + cur.rgb*L*1.35 + L*.08 + cur.rgb*uFlash*.8;
  o = vec4(lit, cur.a);
}`;

const FIRE_FS = HEAD + `in vec2 vUV; out vec4 o; uniform sampler2D uFire; uniform vec2 uGrid; uniform float uTime, uMotion;
${NOISE}
void main(){
  vec2 g = vec2(vUV.x*uGrid.x, (1. - vUV.y)*uGrid.y);
  float t = uTime*mix(.25, 1., uMotion), acc = 0.;
  // Look down into the burning cells; turbulence grows with height so tongues split and sway.
  for (int k = 1; k < 15; k++) {
    float dy = float(k)*.36;
    float wob = (vnoise(vec2(g.x*.36 + dy*.5, g.y*.2 + t*1.25)) - .5)*dy*1.15;
    vec2 q = g + vec2(wob, dy);
    acc += texture(uFire, q/uGrid).r * exp(-dy*.4) * smoothstep(.05, .55, dy);
  }
  float n = fbm(vec2(g.x*.72, g.y*.3 + t*2.5));
  float n2 = vnoise(vec2(g.x*1.7, g.y*.85 + t*4.3));
  float f = acc*.2*max(n*1.45 - .18, 0.)*(.65 + .7*n2);
  f = smoothstep(.1, 1., f);
  o = vec4(fireRamp(f*.98)*f*.82, 1.);
}`;

const PART_VS = HEAD + `layout(location=0) in vec4 iP; layout(location=1) in vec4 iCol; layout(location=2) in vec4 iT;
uniform vec2 uRes, uCell;
out vec2 vP; flat out vec4 vCol; flat out vec4 vT;
void main(){
  vec2 corner = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1))*2. - 1.;
  float unit = min(uCell.x, uCell.y);
  float r = iT.x; mat2 R = mat2(cos(r), sin(r), -sin(r), cos(r));
  vec2 px = iP.xy*uCell + R*(corner*iP.zw)*unit;
  vP = corner; vCol = iCol; vT = iT;
  gl_Position = vec4(px.x/uRes.x*2. - 1., 1. - px.y/uRes.y*2., 0., 1.);
}`;
const PART_FS = HEAD + `in vec2 vP; flat in vec4 vCol; flat in vec4 vT; out vec4 o;
uniform sampler2D uAtlas; uniform vec2 uAtlasGrid; uniform float uAdd;
${NOISE}
void main(){
  float type = vT.y, seed = vT.z, r = length(vP), a = 0.;
  if (type < .5) a = 1. - smoothstep(.35, 1., r);
  else if (type < 1.5) { float d = length(vec2(vP.x, max(abs(vP.y) - .55, 0.)/.45)); a = (1. - smoothstep(.15, 1., d))*(.6 + .4*smoothstep(1., -1., vP.y)); }
  else if (type < 2.5) a = (1. - smoothstep(.15, 1., r + (vnoise(vP*2.4 + seed*10.) - .5)*.55))*.8;
  else if (type < 3.5) a = 1. - smoothstep(.55, .8, max(abs(vP.x), abs(vP.y)*1.7) + (vnoise(vP*3. + seed*9.) - .5)*.4);
  else if (type < 4.5) a = (1. - smoothstep(.0, .14, abs(r - .84)))*.8;
  else if (type < 5.5) {
    vec2 cell = vec2(mod(vT.w, uAtlasGrid.x), floor(vT.w / uAtlasGrid.x));
    float d = texture(uAtlas, (cell + clamp(vP*.5 + .5, .004, .996)) / uAtlasGrid).r;
    float aa = max(fwidth(d)*.8, .004);
    a = smoothstep(.5 - aa, .5 + aa, d) + smoothstep(.2, .5, d)*.35;
  }
  else if (type < 6.5) a = 1. - smoothstep(.75, 1., abs(vP.x) + abs(vP.y)*.45);
  else if (type < 7.5) {
    float rr = r + (fbm(vP*1.6 + seed*7.) - .5)*.62;
    float inside = 1. - smoothstep(.7, 1., rr);
    a = inside*(.5 + smoothstep(.55, .9, rr)*.3)*(.75 + .25*vnoise(vP*5. + seed*3.));
  }
  else if (type < 8.5) {
    float cross = max((1. - smoothstep(0., .09, abs(vP.x)))*(1. - smoothstep(0., 1., abs(vP.y))), (1. - smoothstep(0., .09, abs(vP.y)))*(1. - smoothstep(0., 1., abs(vP.x))));
    a = cross + (1. - smoothstep(0., .4, r))*.6;
  }
  else { float sq = max(abs(vP.x), abs(vP.y)); a = (1. - smoothstep(.82, .95, sq))*(.35 + .65*step(.66, sq)); }
  a = clamp(a, 0., 1.)*vCol.a;
  o = uAdd > .5 ? vec4(vCol.rgb*a, 1.) : vec4(vCol.rgb, a);
}`;

const RIBBON_VS = HEAD + `layout(location=0) in vec2 aPos; layout(location=1) in vec2 aSA; layout(location=2) in vec4 aCol; layout(location=3) in float aMode;
uniform vec2 uRes; out vec2 vSA; out vec4 vCol; flat out float vMode;
void main(){ vSA = aSA; vCol = aCol; vMode = aMode; gl_Position = vec4(aPos.x/uRes.x*2. - 1., 1. - aPos.y/uRes.y*2., 0., 1.); }`;
const RIBBON_FS = HEAD + `in vec2 vSA; in vec4 vCol; flat in float vMode; out vec4 o;
${NOISE}
void main(){
  float s = vSA.x;
  if (vMode < .5) {
    float core = exp(-s*s*14.), glow = exp(-s*s*2.2);
    o = vec4(mix(vCol.rgb, vec3(1.), core*.85)*(core*1.25 + glow*.45)*vCol.a, 1.);
  } else if (vMode < 1.5) {
    float edge = 1. - smoothstep(.5, 1., abs(s));
    float streak = smoothstep(.28, .62, vnoise(vec2(vSA.y*2.6, s*5.5 + 3.)));
    o = vec4(vCol.rgb, vCol.a*edge*(.3 + .7*streak));
  } else {
    // Flat bars (a demon's health): solid colour, soft edge, drawn over the world.
    o = vec4(vCol.rgb, vCol.a*(1. - smoothstep(.65, 1., abs(s))));
  }
}`;

const BOX_VS = HEAD + `uniform vec4 uBox; uniform vec2 uRes; out vec2 vUV;
void main(){ vec2 corner = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1)); vUV = corner;
  vec2 px = mix(uBox.xy, uBox.zw, corner); gl_Position = vec4(px.x/uRes.x*2. - 1., 1. - px.y/uRes.y*2., 0., 1.); }`;
const BOX_FS = HEAD + `in vec2 vUV; out vec4 o; uniform vec2 uSize; uniform vec4 uColor; uniform float uErase, uDpr;
void main(){
  vec2 p = vUV*uSize; float lw = 1.15*uDpr;
  float border = 1. - smoothstep(lw*.5, lw*1.5, min(min(p.x, uSize.x - p.x), min(p.y, uSize.y - p.y)));
  vec2 q = vUV - .5; float s = min(uSize.x, uSize.y);
  float dash = step(.45, fract((vUV.x + vUV.y)*6.5));
  float g1 = 1. - smoothstep(lw*.4, lw*1.2, abs(q.x)*uSize.x);
  float g2 = 1. - smoothstep(lw*.4, lw*1.2, abs(q.y)*uSize.y);
  float g3 = 1. - smoothstep(lw*.4, lw*1.2, abs(q.x - q.y)*s*.7071);
  float g4 = 1. - smoothstep(lw*.4, lw*1.2, abs(q.x + q.y)*s*.7071);
  float guides = uErase > .5 ? g4*.8 : max(max(g1, g2), max(g3, g4))*dash*.6;
  o = vec4(uColor.rgb, max(border*.9, guides*.6)*uColor.a);
}`;

const FLUID_GLOW_FS = HEAD + `in vec2 vUV; out vec4 o; uniform sampler2D uFluid;
void main(){ float m = smoothstep(.3, .6, texture(uFluid, vUV).g); o = vec4(vec3(1.,.48,.15)*m*.42, 1.); }`;
const DOWN_FS = HEAD + `in vec2 vUV; out vec4 o; uniform sampler2D uTex; uniform vec2 uTexel;
void main(){ vec2 h = uTexel*.5;
  vec4 s = texture(uTex, vUV)*4.; s += texture(uTex, vUV - h); s += texture(uTex, vUV + h);
  s += texture(uTex, vUV + vec2(h.x, -h.y)); s += texture(uTex, vUV - vec2(h.x, -h.y)); o = s/8.; }`;
const UP_FS = HEAD + `in vec2 vUV; out vec4 o; uniform sampler2D uTex; uniform vec2 uTexel;
void main(){ vec2 h = uTexel*.5;
  vec4 s = texture(uTex, vUV + vec2(-h.x*2., 0.)) + texture(uTex, vUV + vec2(-h.x, h.y))*2. + texture(uTex, vUV + vec2(0., h.y*2.)) + texture(uTex, vUV + vec2(h.x, h.y))*2.;
  s += texture(uTex, vUV + vec2(h.x*2., 0.)) + texture(uTex, vUV + vec2(h.x, -h.y))*2. + texture(uTex, vUV + vec2(0., -h.y*2.)) + texture(uTex, vUV + vec2(-h.x, -h.y))*2.;
  o = s/12.; }`;
const COMPOSITE_FS = HEAD + `in vec2 vUV; out vec4 o;
uniform sampler2D uScene, uEmis, uBloom, uLight; uniform float uTime, uFlash, uBloomAmt, uHaze, uPush, uZoom; uniform vec2 uShake, uRes, uZoomC;
${NOISE}
void main(){
  vec2 uv = vUV + uShake;
  vec2 asp = vec2(uRes.x/uRes.y, 1.);
  float dc = length((vUV - uZoomC)*asp);
  if (uPush > .001) {
    // Pushing into 我: magnify around it, with a trembling membrane ring.
    uv = uZoomC + (uv - uZoomC)/uZoom;
    float ring = .32 - .22*uPush;
    uv += normalize((vUV - uZoomC)*asp + 1e-5)/asp*sin(dc*70. - uTime*9.)*exp(-abs(dc - ring)*22.)*.006*uPush;
  }
  float heat = texture(uLight, uv - vec2(0., .03)).a;
  vec2 n = vec2(vnoise(uv*vec2(40., 23.) + vec2(0., uTime*2.6)), vnoise(uv*vec2(33., 20.) + vec2(5.2, uTime*2.1))) - .5;
  vec2 off = n*heat*uHaze;
  vec3 scene = texture(uScene, uv + off).rgb;
  vec3 emis = texture(uEmis, uv + off*.5).rgb;
  vec3 bloom = texture(uBloom, uv).rgb;
  if (uPush > .001) {
    vec2 dir = (uv - uZoomC)*uPush*.05;
    vec3 acc = scene; float wsum = 1.;
    for (int i = 1; i < 6; i++) { float f = float(i)/5.; acc += texture(uScene, uv - dir*f).rgb*(1. - f*.5); wsum += 1. - f*.5; }
    scene = acc/wsum;
    scene.r = mix(scene.r, texture(uScene, uv + dir*.18).r, .6*uPush);
    scene.b = mix(scene.b, texture(uScene, uv - dir*.18).b, .6*uPush);
    emis *= 1. + uPush*.8;
  }
  vec3 c = scene + emis + bloom*uBloomAmt;
  c += uFlash*vec3(.07,.06,.13);
  vec3 hi = max(c - .82, 0.);
  c = min(c, .82) + .18*(1. - exp(-hi/.18));
  float v = length((vUV - .5)*vec2(1., .9));
  c *= 1. - .22*smoothstep(.35, .85, v);
  c *= 1. - uPush*.62*smoothstep(.04, .55, dc);
  c += uPush*uPush*vec3(.5,.36,.2)*(1. - smoothstep(0., .18, dc));
  c += (hash12(gl_FragCoord.xy + fract(uTime)*97.) - .5)*.018;
  o = vec4(c, 1.);
}`;

export function createGLRenderer({ canvas, gl, world, materials, K, mobile = false, font = 'BrushKai' }) {
  const W = world.width, H = world.height;
  const partLimit = mobile ? 420 : 900;
  let motion = true, clock = 0, flash = 0, shake = 0, quality = mobile ? .55 : 1;
  let atlasReady = false, atlasFont = '', sizeKey = '', paperKey = '';
  let resetPending = true, introAt = -10, serial = 0, arcsAt = 0, eventBudget = 0, stage = null, overlay = null, windCredit = 0;
  const push = { p: 0, zoom: 1 };
  const recs = new Map(), ghosts = [], parts = [], bolts = [], trail = [];
  const erasedCells = new Set(), labelAt = {};
  const person = { x: 0, y: 0, ready: false };
  let personMoving = false;
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------- GL helpers ----------
  function shader(type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + '\n' + src.split('\n').map((l, i) => `${i + 1}: ${l}`).join('\n'));
    return s;
  }
  function program(vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, shader(gl.VERTEX_SHADER, vs)); gl.attachShader(p, shader(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    for (let i = 0, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, info.name); }
    return { p, u };
  }
  function texture(w, h, filter = gl.LINEAR, data = null) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  function target(w, h) {
    w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
    const tex = texture(w, h), fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { tex, fbo, w, h };
  }
  function free(t) { if (t) { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fbo); } }
  function bind(t) { gl.bindFramebuffer(gl.FRAMEBUFFER, t ? t.fbo : null); gl.viewport(0, 0, t ? t.w : canvas.width, t ? t.h : canvas.height); }
  function use(prog, textures = {}) {
    gl.useProgram(prog.p);
    let unit = 0;
    for (const [name, tex] of Object.entries(textures)) {
      gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(prog.u[name], unit); unit++;
    }
    return prog.u;
  }
  function instanced(layout, max) {
    const vao = gl.createVertexArray(), buffer = gl.createBuffer();
    const stride = layout.reduce((s, n) => s + n, 0);
    gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, max * stride * 4, gl.DYNAMIC_DRAW);
    let offset = 0;
    layout.forEach((size, loc) => { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride * 4, offset * 4); gl.vertexAttribDivisor(loc, 1); offset += size; });
    gl.bindVertexArray(null);
    return { vao, buffer, stride, data: new Float32Array(max * stride), max, n: 0 };
  }
  function upload(batch) { if (!batch.n) return false; gl.bindBuffer(gl.ARRAY_BUFFER, batch.buffer); gl.bufferSubData(gl.ARRAY_BUFFER, 0, batch.data, 0, batch.n * batch.stride); return true; }
  function drawQuads(batch) { gl.bindVertexArray(batch.vao); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, batch.n); gl.bindVertexArray(null); }
  const blend = mode => {
    if (!mode) { gl.disable(gl.BLEND); return; }
    gl.enable(gl.BLEND);
    if (mode === 'add') gl.blendFunc(gl.ONE, gl.ONE);
    else gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  };

  const prog = {
    paper: program(FULL_VS, PAPER_FS), backdrop: program(FULL_VS, BACKDROP_FS), copyFlip: program(FULL_VS, COPY_FLIP_FS), blur: program(FULL_VS, BLUR_FS),
    fluid: program(FLUID_VS, FLUID_FS), bg: program(FULL_VS, SCENE_BG_FS), glyph: program(GLYPH_VS, GLYPH_FS),
    fire: program(FULL_VS, FIRE_FS), part: program(PART_VS, PART_FS), ribbon: program(RIBBON_VS, RIBBON_FS),
    box: program(BOX_VS, BOX_FS), fluidGlow: program(FULL_VS, FLUID_GLOW_FS), down: program(FULL_VS, DOWN_FS),
    up: program(FULL_VS, UP_FS), composite: program(FULL_VS, COMPOSITE_FS),
  };
  const emptyVao = gl.createVertexArray();
  const glyphs = instanced([4, 4, 4, 4], world.size + 900);
  const fluids = instanced([4, 1], world.size);
  const partsUnder = instanced([4, 4, 4], partLimit), partsOver = instanced([4, 4, 4], partLimit), partsAdd = instanced([4, 4, 4], partLimit);
  const ribbonVao = gl.createVertexArray(), ribbonBuffer = gl.createBuffer();
  let ribbonData = new Float32Array(9 * 6 * 2048), ribbonCount = 0, ribbonCapacity = 0;
  gl.bindVertexArray(ribbonVao); gl.bindBuffer(gl.ARRAY_BUFFER, ribbonBuffer);
  [[0, 2, 0], [1, 2, 2], [2, 4, 4], [3, 1, 8]].forEach(([loc, size, offset]) => { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 36, offset * 4); });
  gl.bindVertexArray(null);
  const cellData = new Uint8Array(W * H * 4), fireData = new Uint8Array(W * H * 4);
  const cellTex = texture(W, H, gl.LINEAR), fireTex = texture(W, H, gl.LINEAR);
  let fireCount = 0;
  const light = [target(W * 4, H * 4), target(W * 4, H * 4)];
  let atlasTex = null, paperTex = null, scene = null, emis = null, fluid = null, back = null, bloom = [];
  const parallax = { x: 0, y: 0, tx: 0, ty: 0, inputAt: -99 };

  // ---------- atlas: glyphs as signed distance fields ----------
  function buildAtlas() {
    const w = ATLAS_COLS * ATLAS_CELL, h = ATLAS_ROWS * ATLAS_CELL;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff';
    g.font = `${Math.round(ATLAS_CELL * .76)}px ${font}, "Noto Serif CJK SC", serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    GLYPHS.forEach((ch, j) => g.fillText(ch, (j % ATLAS_COLS + .5) * ATLAS_CELL, (Math.floor(j / ATLAS_COLS) + .53) * ATLAS_CELL));
    const src = g.getImageData(0, 0, w, h).data, n = w * h, INF = 1e20;
    const outer = new Float64Array(n), inner = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const a = src[i * 4] / 255;
      if (a >= .999) { outer[i] = 0; inner[i] = INF; }
      else if (a <= .001) { outer[i] = INF; inner[i] = 0; }
      else { const d = .5 - a; outer[i] = d > 0 ? d * d : 0; inner[i] = d < 0 ? d * d : 0; }
    }
    edt(outer, w, h); edt(inner, w, h);
    const out = new Uint8Array(n * 4);
    for (let i = 0; i < n; i++) {
      const dist = Math.sqrt(outer[i]) - Math.sqrt(inner[i]);
      out[i * 4] = clamp(Math.round(255 * (.5 - dist / (2 * SPREAD))), 0, 255);
    }
    if (!atlasTex) atlasTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, atlasTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, out);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    atlasReady = true; atlasFont = fontLoaded();
  }
  function fontLoaded() { try { return document.fonts?.check?.(`64px ${font}`, '水火') ? 'loaded' : 'fallback'; } catch { return 'fallback'; } }
  // Felzenszwalb–Huttenlocher squared distance transform, columns then rows.
  function edt(grid, w, h) {
    const size = Math.max(w, h), f = new Float64Array(size), d = new Float64Array(size), v = new Int32Array(size), z = new Float64Array(size + 1);
    const line = (offset, step, length) => {
      for (let i = 0; i < length; i++) f[i] = grid[offset + i * step];
      let k = 0; v[0] = 0; z[0] = -1e20; z[1] = 1e20;
      for (let q = 1; q < length; q++) {
        let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
        while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
        k++; v[k] = q; z[k] = s; z[k + 1] = 1e20;
      }
      k = 0;
      for (let q = 0; q < length; q++) { while (z[k + 1] < q) k++; const r = q - v[k]; d[q] = r * r + f[v[k]]; }
      for (let i = 0; i < length; i++) grid[offset + i * step] = d[i];
    };
    for (let x = 0; x < w; x++) line(x, w, h);
    for (let y = 0; y < h; y++) line(y * w, 1, w);
  }

  function ensureTargets() {
    const cw = canvas.width, ch = canvas.height, key = `${cw}x${ch}`;
    if (key === sizeKey) return;
    sizeKey = key;
    [scene, emis, fluid, back, ...bloom].forEach(free);
    scene = target(cw, ch); emis = target(cw / 2, ch / 2); fluid = target(cw / 2, ch / 2); back = target(cw / 2, ch / 2);
    bloom = [target(cw / 4, ch / 4), target(cw / 8, ch / 8), target(cw / 16, ch / 16)];
    paperKey = '';
  }
  function ensurePaper() {
    if (paperKey === sizeKey && paperTex) return;
    if (paperTex) free(paperTex);
    paperTex = target(canvas.width, canvas.height);
    bind(paperTex); blend(false);
    const u = use(prog.paper);
    gl.uniform2f(u.uRes, canvas.width, canvas.height); gl.uniform2f(u.uGrid, W, H);
    gl.uniform1f(u.uSeed, 3.7); gl.uniform1f(u.uDpr, dpr());
    gl.bindVertexArray(emptyVao); gl.drawArrays(gl.TRIANGLES, 0, 3);
    paperKey = sizeKey;
  }
  const dpr = () => Math.min(globalThis.devicePixelRatio || 1, 2);

  // ---------- tracking cells by uid ----------
  function sync(stepped = false) {
    const now = clock, uid = world.uid;
    serial++;
    if (resetPending) { recs.clear(); ghosts.length = 0; resetPending = false; introAt = now; }
    const intro = now - introAt < .05;
    for (let i = 0; i < world.size; i++) {
      const k = world.kind[i]; if (!k) continue;
      const u = uid ? uid[i] : i + 1, x = i % W, y = (i / W) | 0;
      let r = recs.get(u);
      if (!r) {
        const delay = intro && motion ? x / W * .42 + Math.random() * .06 + (H - y) / H * .05 : 0;
        r = { kind: k, prev: 0, changeAt: -99, bornAt: now + delay, x, y, ox: x, oy: y, seed: Math.random(), i, seen: serial };
        recs.set(u, r);
      } else {
        if (stepped) { r.ox = r.x; r.oy = r.y; } else if (r.x !== x || r.y !== y) { r.ox = x; r.oy = y; }
        r.x = x; r.y = y; r.i = i;
        if (r.kind !== k) { r.prev = r.kind; r.kind = k; r.changeAt = now; }
      }
      r.seen = serial;
    }
    for (const [u, r] of recs) {
      if (r.seen === serial) continue;
      recs.delete(u);
      if (ghosts.length < 500 && now >= r.bornAt) ghosts.push({ kind: r.kind, x: r.x, y: r.y, at: now, seed: r.seed, erased: erasedCells.has(r.y * W + r.x) });
    }
    erasedCells.clear();
  }

  // ---------- particles ----------
  function add(p) {
    if (parts.length >= partLimit * 3) return null;
    p.age = 0; p.vx ??= 0; p.vy ??= 0; p.rot ??= 0; p.spin ??= 0; p.grow ??= 0; p.drag ??= 0; p.g ??= 0; p.seed ??= Math.random(); p.glyph ??= 0; p.sy ??= p.s;
    parts.push(p); return p;
  }
  const kinds = { disc: 0, streak: 1, puff: 2, flake: 3, ring: 4, glyph: 5, shard: 6, blot: 7, star: 8, seal: 9 };
  function burst(n, base) { if (!motion) return; for (let i = 0; i < n; i++) add(typeof base === 'function' ? base(i) : { ...base }); }
  function ember(x, y, power = 1) {
    return { type: kinds.streak, layer: 'add', x: x + rand(-.3, .3), y: y + rand(-.2, .2), vx: rand(-.9, .9) * power, vy: rand(-3.2, -1.2) * power, s: rand(.035, .06), sy: rand(.09, .16), life: rand(.5, 1.1), col: [1, rand(.45, .7), .16], a: 1, drag: .8, g: -.6, turb: 1 };
  }
  function smoke(x, y, s = .5) { return { type: kinds.puff, layer: 'over', x: x + rand(-.2, .2), y, vx: rand(-.25, .25), vy: rand(-.9, -.45), s: s * rand(.6, 1), life: rand(1.2, 2.2), col: [.36, .33, .34], a: .3, grow: .7, drag: .4 }; }
  function steamPuff(x, y, s = .55) { return { type: kinds.puff, layer: 'over', x: x + rand(-.25, .25), y, vx: rand(-.35, .35), vy: rand(-1.2, -.5), s: s * rand(.7, 1.1), life: rand(.8, 1.5), col: [.8, .86, .95], a: .34, grow: .9, drag: .6 }; }
  function drop(x, y, col = [.55, .82, 1]) { return { type: kinds.disc, layer: 'over', x: x + rand(-.2, .2), y: y + rand(-.2, .1), vx: rand(-1.6, 1.6), vy: rand(-3.2, -1.4), s: rand(.05, .08), life: rand(.45, .8), col, a: .9, g: 9 }; }
  function shard(x, y) { return { type: kinds.shard, layer: 'over', x, y, vx: rand(-2.2, 2.2), vy: rand(-2.8, -.6), s: rand(.04, .07), sy: rand(.09, .15), rot: rand(0, 6.3), spin: rand(-8, 8), life: rand(.5, .9), col: [.86, .96, 1], a: .95, g: 6 }; }
  function spark(x, y, col = [1, .75, .3], power = 1) { const a = rand(0, 6.283), v = rand(1.5, 5) * power; return { type: kinds.streak, layer: 'add', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1, s: .03, sy: .14, life: rand(.25, .55), col, a: 1, g: 4, drag: 1.5 }; }
  function glint(x, y, col = [1, .86, .5], s = .32) { return { type: kinds.star, layer: 'add', x, y, s, life: rand(.35, .7), col, a: .9, pulse: 1 }; }
  function label(type, x, y) {
    if (!motion || LABELS[type] === undefined) return;
    if (clock - (labelAt[type] ?? -9) < .75) return;
    labelAt[type] = clock;
    add({ type: kinds.glyph, glyph: LABELS[type], layer: 'add', x: x + .5, y: y - .2, vy: -1.1, drag: .6, s: .62, life: 1.25, col: LABEL_COLOR[type] || [1, 1, 1], a: .95, fadeIn: .12 });
  }

  const path = (a, b, depth, spread) => {
    if (depth === 0) return [a, b];
    const mx = (a.x + b.x) / 2 + rand(-spread, spread), my = (a.y + b.y) / 2 + rand(-spread * .3, spread * .3);
    const mid = { x: mx, y: my };
    return [...path(a, mid, depth - 1, spread * .55).slice(0, -1), ...path(mid, b, depth - 1, spread * .55)];
  };
  function boltList(start, end, { width = .26, life = .62, spread = 2.4, branches = .4 } = {}) {
    const main = path(start, end, 6, spread);
    const list = [{ pts: main, width, col: [.72, .62, 1], life }];
    for (let i = 3; i < main.length - 3; i += 3) {
      if (Math.random() > branches) continue;
      const p = main[i], len = rand(2, 5) * width / .26, ang = rand(.3, 1.2) * (Math.random() < .5 ? -1 : 1);
      list.push({ pts: path(p, { x: p.x + Math.sin(ang) * len, y: p.y + Math.cos(ang) * len * .8 }, 4, 1.1), width: width * .46, col: [.64, .52, 1], life: life * .68 });
    }
    return list;
  }
  // A scripted strike between any two points (cells), used by the opening.
  function strike(start, end, { width = .26, life = .62, flashAmount = .6, shakeAmount = .2, sparks = 14, spread = 2.4 } = {}) {
    for (const b of boltList(start, end, { width, life, spread })) bolts.push({ ...b, age: 0, flicker: true });
    flash = Math.max(flash, motion ? flashAmount : Math.min(.3, flashAmount));
    if (motion) shake = Math.max(shake, shakeAmount);
    burst(mobile ? Math.ceil(sparks / 2) : sparks, () => spark(end.x, end.y, [.88, .8, 1], 1.3 * Math.sqrt(width / .26)));
  }
  function bolt(x, y) {
    const start = { x: x + .5 + rand(-3, 3), y: -1.2 }, end = { x: x + .5, y: y + .5 };
    const list = boltList(start, end);
    // Discharge into adjacent conductors only, following the same rule as the simulation.
    const visited = new Set(), queue = [];
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const i = world.index(x + dx, y + dy);
      if (i >= 0 && materials[world.kind[i]].conductivity) { visited.add(i); queue.push({ i, from: end }); }
    }
    for (let n = 0; n < queue.length && n < 90; n++) {
      const { i, from } = queue[n], cx = i % W + .5, cy = ((i / W) | 0) + .5, to = { x: cx, y: cy };
      list.push({ pts: path(from, to, 2, .22), width: .09, col: [.7, .55, 1], life: .34 });
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const j = world.index(cx - .5 + dx, cy - .5 + dy);
        if (j >= 0 && !visited.has(j) && materials[world.kind[j]].conductivity) { visited.add(j); queue.push({ i: j, from: to }); }
      }
    }
    for (const b of list) bolts.push({ ...b, age: 0, flicker: true });
    flash = Math.max(flash, motion ? 1 : .35);
    if (motion) shake = Math.max(shake, .28);
    burst(mobile ? 10 : 18, () => spark(end.x, end.y, [.85, .75, 1], 1.3));
    burst(3, () => glint(end.x + rand(-1, 1), end.y + rand(-1, 1), [.9, .85, 1], .5));
  }

  // ---------- events from the app ----------
  function emit(event) {
    const { type, x = 0, y = 0, kind = K.EMPTY } = event;
    const cx = x + .5, cy = y + .5;
    if (type === 'reset') { resetPending = true; parts.length = 0; bolts.length = 0; trail.length = 0; person.ready = false; flash = 0; return; }
    if (type === 'qi') {
      // A mote of 灵气 rises from a reaction and flies home to 我.
      if (motion) add({ type: kinds.star, layer: 'add', x: cx + rand(-.3, .3), y: cy + rand(-.3, .3), vx: rand(-2, 2), vy: rand(-3, -1), s: rand(.14, .22), life: 2.2, col: [1, .86, .5], a: .9, home: true, drag: 1.4 });
      return;
    }
    if (type === 'move') { if (motion) add({ type: kinds.seal, layer: 'under', x: cx, y: cy, s: .5, life: .9, col: [.8, .2, .14], a: .35 }); return; }
    if (type === 'dry') { add({ type: kinds.ring, layer: 'over', x: cx, y: cy, s: .9, grow: 1.2, life: .55, col: [.9, .35, .25], a: .8 }); if (motion) shake = Math.max(shake, .08); return; }
    if (type === 'stroke') { trail.push({ x0: event.x + .5, y0: event.y + .5, x1: event.toX + .5, y1: event.toY + .5, kind, t: clock, w: .32 + (event.width || .14) * 2.4 }); if (trail.length > 160) trail.shift(); return; }
    if (type === 'erase') {
      erasedCells.add(y * W + x);
      if (++eventBudget < 26) add({ type: kinds.blot, layer: 'under', x: cx, y: cy, s: .45, grow: .9, life: .7, col: [.3, .4, .58], a: .35 });
      return;
    }
    if (type === 'write') {
      const col = PIGMENT[kind] || [1, 1, 1];
      if (++eventBudget > 34) return;
      if (eventBudget % 2 === 1) add({ type: kinds.blot, layer: 'under', x: cx + rand(-.15, .15), y: cy + rand(-.15, .15), s: rand(.55, .75), grow: rand(.35, .7), life: rand(1.2, 1.8), col, a: .16, rot: rand(0, 6.3) });
      if (!motion || eventBudget > 22) return;
      add({ type: kinds.star, layer: 'add', x: cx + rand(-.3, .3), y: cy + rand(-.3, .3), vy: -.8, s: .18, life: .45, col: [1, .86, .5], a: .7 });
      if (kind === K.WATER) burst(2, () => drop(cx, cy));
      else if (kind === K.FIRE) burst(4, () => ember(cx, cy, 1.1));
      else if (kind === K.ICE) burst(3, () => shard(cx, cy));
      else if (kind === K.EARTH || kind === K.WOOD) burst(2, () => ({ type: kinds.flake, layer: 'over', x: cx + rand(-.3, .3), y: cy + .3, vx: rand(-.8, .8), vy: rand(-1.4, -.4), s: .05, life: .6, col, a: .8, g: 5 }));
      else if (kind === K.GOLD) burst(3, () => spark(cx, cy, [1, .82, .4], .6));
      else if (kind === K.STEAM) burst(2, () => steamPuff(cx, cy, .45));
      else if (kind === K.LIGHTNING) burst(4, () => spark(cx, cy, [.85, .75, 1], .8));
      return;
    }
    if (type === 'lightning') { bolt(x, y); label(type, x, y); return; }
    if (++eventBudget > 40) return;
    label(type, x, y);
    if (!motion) return;
    if (type === 'ignite') { burst(mobile ? 5 : 9, () => ember(cx, cy, 1.25)); burst(1, () => smoke(cx, cy - .4, .55)); }
    else if (type === 'boil') { burst(3, () => steamPuff(cx, cy - .2)); burst(2, () => drop(cx, cy)); }
    else if (type === 'condense') { burst(3, () => drop(cx, cy)); add({ type: kinds.ring, layer: 'over', x: cx, y: cy + .3, s: .3, sy: .14, grow: 1.6, life: .55, col: [.6, .85, 1], a: .7 }); }
    else if (type === 'freeze') { burst(5, () => shard(cx, cy)); add({ type: kinds.ring, layer: 'add', x: cx, y: cy, s: .3, grow: 2.2, life: .45, col: [.75, .92, 1], a: .7 }); }
    else if (type === 'thaw') { burst(3, () => drop(cx, cy, [.7, .9, 1])); }
    else if (type === 'melt') { burst(mobile ? 5 : 9, () => spark(cx, cy, [1, .66, .25], 1.1)); burst(2, () => glint(cx + rand(-.4, .4), cy + rand(-.4, .4), [1, .7, .35], .4)); }
    else if (type === 'solidify') { burst(4, () => spark(cx, cy, [1, .8, .45], .6)); }
    else if (type === 'extinguish') { burst(mobile ? 4 : 7, () => steamPuff(cx, cy - .2, .6)); burst(2, () => smoke(cx, cy - .3, .4)); }
  }

  // ---------- per-frame update ----------
  function update(dt, { paused, player }) {
    eventBudget = 0;
    if (!person.ready) { person.x = player.x; person.y = player.y; person.ready = true; }
    else {
      const follow = motion ? 1 - Math.exp(-22 * dt) : 1;
      person.x += (player.x - person.x) * follow; person.y += (player.y - person.y) * follow;
    }
    personMoving = Math.abs(player.x - person.x) + Math.abs(player.y - person.y) > .003;
    flash *= Math.exp(-dt * 6.5); if (flash < .004) flash = 0;
    if (motion) {
      if (clock - parallax.inputAt > 4) { parallax.tx = Math.sin(clock * .07) * .5; parallax.ty = Math.cos(clock * .05) * .3; }
      const ease = 1 - Math.exp(-dt * 2.5);
      parallax.x += (parallax.tx - parallax.x) * ease; parallax.y += (parallax.ty - parallax.y) * ease;
    } else { parallax.x = parallax.y = 0; }
    shake = Math.max(0, shake - dt);
    // Presentation time keeps running while paused so births, ghosts and particles settle.
    clock += dt;
    for (let n = parts.length - 1; n >= 0; n--) {
      const p = parts[n];
      p.age += dt;
      if (p.age >= p.life) { parts.splice(n, 1); continue; }
      if (!motion) continue;
      if (p.turb) { p.vx += Math.sin(p.y * 2.3 + clock * 3 + p.seed * 20) * 2.4 * dt; }
      if (p.home) {
        const dx = person.x + .5 - p.x, dy = person.y + .5 - p.y, d = Math.hypot(dx, dy) || 1;
        if (d < .6) { p.life = p.age; continue; }
        const pull = 30 * Math.min(1, p.age * 1.6);
        p.vx += dx / d * pull * dt; p.vy += dy / d * pull * dt;
      }
      p.vy += p.g * dt;
      const drag = Math.exp(-p.drag * dt); p.vx *= drag; p.vy *= drag;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += p.spin * dt;
    }
    for (let n = bolts.length - 1; n >= 0; n--) { bolts[n].age += dt; if (bolts[n].age >= bolts[n].life) bolts.splice(n, 1); }
    for (let n = ghosts.length - 1; n >= 0; n--) if (clock - ghosts[n].at > .5) ghosts.splice(n, 1);
    while (trail.length && clock - trail[0].t > (trail[0].life ?? 1.1)) trail.shift();
    if (!motion || paused) return;
    // Ambient emitters scale with the number of live particles.
    const room = 1 - parts.length / (partLimit * 2.4);
    if (room <= 0) return;
    const rate = dt * quality * room;
    const kind = world.kind;
    for (let i = 0; i < world.size; i++) {
      const k = kind[i]; if (!k) continue;
      const x = i % W + .5, y = ((i / W) | 0) + .5;
      if (k === K.FIRE) {
        if (Math.random() < 1.5 * rate) add(ember(x, y - .3));
        if (Math.random() < .35 * rate && (i < W || !kind[i - W])) add(smoke(x, y - 1.2, .5));
      } else if (k === K.MOLTEN) { if (Math.random() < .5 * rate) add(spark(x, y - .3, [1, .7, .3], .5)); }
      else if (k === K.GOLD) { if (Math.random() < .05 * rate) add(glint(x + rand(-.3, .3), y + rand(-.3, .3), [1, .88, .55], .26)); }
      else if (k === K.ICE) { if (Math.random() < .05 * rate) add(glint(x + rand(-.3, .3), y + rand(-.3, .3), [.85, .97, 1], .22)); }
      else if (k === K.WATER) { if (Math.random() < .03 * rate && (i < W || kind[i - W] !== K.WATER)) add(glint(x + rand(-.4, .4), y - .35, [.7, .92, 1], .2)); }
    }
    // Wind is invisible in the rules; show it as streaks wherever the field is strong.
    if (world.windActive) {
      windCredit += dt * 45 * quality;
      for (let tries = 0; windCredit >= 1 && tries < 80; tries++) {
        const i = Math.floor(Math.random() * world.size), wx = world.windX[i], wy = world.windY[i], s = Math.hypot(wx, wy);
        if (s < .3) continue;
        windCredit--;
        add({ type: kinds.streak, layer: 'add', x: i % W + Math.random(), y: ((i / W) | 0) + Math.random(), vx: wx * 6, vy: wy * 6, s: .025, sy: .25 + s * .18, life: .5, col: [.76, .86, 1], a: Math.min(.5, s * .28) });
      }
      windCredit = Math.min(windCredit, 4);
    }
    if (clock - arcsAt > .07) {
      arcsAt = clock;
      for (let i = 0; i < world.size; i++) {
        if (Math.abs(world.charge[i]) < .6 || !materials[kind[i]].conductivity) continue;
        const x = i % W, y = (i / W) | 0;
        for (const [dx, dy] of [[1, 0], [0, 1]]) {
          const j = world.index(x + dx, y + dy);
          if (j < 0 || Math.abs(world.charge[j]) < .6 || !materials[kind[j]].conductivity || Math.random() > .45) continue;
          const a = { x: x + .5, y: y + .5 }, b = { x: x + dx + .5, y: y + dy + .5 };
          const m1 = { x: (a.x * 2 + b.x) / 3 + rand(-.16, .16), y: (a.y * 2 + b.y) / 3 + rand(-.16, .16) }, m2 = { x: (a.x + b.x * 2) / 3 + rand(-.16, .16), y: (a.y + b.y * 2) / 3 + rand(-.16, .16) };
          bolts.push({ pts: [a, m1, m2, b], width: .06, col: [.66, .5, 1], life: .09, age: 0, alpha: Math.min(1, Math.abs(world.charge[i]) / 4) });
        }
      }
    }
  }

  // ---------- drawing ----------
  function stageLight() {
    const d = cellData; d.fill(0);
    const addAt = (cx, cy, r, g, b, heat = 0) => {
      if (cx < 0 || cx >= W || cy < 0 || cy >= H) return;
      const o = (cy * W + cx) * 4;
      d[o] = Math.min(255, d[o] + r * 255); d[o + 1] = Math.min(255, d[o + 1] + g * 255); d[o + 2] = Math.min(255, d[o + 2] + b * 255); d[o + 3] = Math.min(255, d[o + 3] + heat * 255);
    };
    const u = stage.unit ?? 1;
    for (const a of stage.actors) {
      const al = a.a ?? 1, cx = Math.round(a.x * u - .5), cy = Math.round(a.y * u - .5);
      if (a.light) addAt(cx, cy, a.light[0] * al, a.light[1] * al, a.light[2] * al, a.heat ?? 0);
      else if (a.k === K.FIRE) addAt(cx, cy, .8 * al, .4 * al, .13 * al, .8 * al);
      else if (a.k === K.LIGHTNING && !(a.flags >= 8)) addAt(cx, cy, .6 * al, .55 * al, .9 * al);
    }
    for (const l of stage.lights || []) {
      const lx = l.x * u, ly = l.y * u, rad = Math.max(1, (l.r ?? 2) * u), x0 = Math.floor(lx - rad), x1 = Math.ceil(lx + rad), y0 = Math.floor(ly - rad), y1 = Math.ceil(ly + rad);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const f = Math.max(0, 1 - Math.hypot(x + .5 - lx, y + .5 - ly) / rad);
        if (f > 0) addAt(x, y, l.col[0] * f, l.col[1] * f, l.col[2] * f);
      }
    }
    gl.bindTexture(gl.TEXTURE_2D, cellTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, d);
  }
  function cellLight() {
    if (stage) { stageLight(); return; }
    const d = cellData, kind = world.kind, temp = world.temp, charge = world.charge, fuel = world.fuel;
    const extra = overlay?.lights || [];
    for (let i = 0; i < world.size; i++) {
      const k = kind[i]; let r = 0, g = 0, b = 0, heat = 0;
      if (k) {
        const t = temp[i];
        heat = clamp((t - 420) / 800, 0, 1);
        if (k === K.FIRE) { const f = .7 + .3 * Math.min(1, fuel[i] / 3); r = f; g = .5 * f; b = .16 * f; }
        else if (k === K.MOLTEN) { r = .95; g = .5; b = .17; }
        else if (k === K.LIGHTNING) { r = .8; g = .75; b = 1; }
        else if (k === K.WOOD && t > 450) { const f = Math.min(1, (t - 450) / 150) * .5; r = f; g = .28 * f; b = .05 * f; }
        else if (k === K.GOLD && t > 900) { const f = Math.min(1, (t - 900) / 470) * .55; r = f; g = .38 * f; b = .1 * f; }
        const q = materials[k].conductivity ? Math.min(1, Math.abs(charge[i]) / 3) * .7 : 0;
        if (q > .05) { r += .55 * q; g += .4 * q; b += q; }
      }
      d[i * 4] = Math.min(255, r * 255); d[i * 4 + 1] = Math.min(255, g * 255); d[i * 4 + 2] = Math.min(255, b * 255); d[i * 4 + 3] = heat * 255;
    }
    for (const l of extra) {
      const rad = Math.max(1, l.r ?? 2);
      for (let y = Math.floor(l.y - rad); y <= Math.ceil(l.y + rad); y++) for (let x = Math.floor(l.x - rad); x <= Math.ceil(l.x + rad); x++) {
        if (x < 0 || x >= W || y < 0 || y >= H) continue;
        const f = Math.max(0, 1 - Math.hypot(x + .5 - l.x, y + .5 - l.y) / rad), o = (y * W + x) * 4;
        if (f > 0) { d[o] = Math.min(255, d[o] + l.col[0] * f * 255); d[o + 1] = Math.min(255, d[o + 1] + l.col[1] * f * 255); d[o + 2] = Math.min(255, d[o + 2] + l.col[2] * f * 255); }
      }
    }
    gl.bindTexture(gl.TEXTURE_2D, cellTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, d);
  }
  function fullscreen() { gl.bindVertexArray(emptyVao); gl.drawArrays(gl.TRIANGLES, 0, 3); }
  function lightPass() {
    blend(false);
    bind(light[0]); use(prog.copyFlip, { uTex: cellTex }); fullscreen();
    const passes = [[1.5, 0], [0, 1.5], [3.2, 0], [0, 3.2], [5.5, 0], [0, 5.5]];
    let src = 0;
    for (const [dx, dy] of passes) {
      const dst = 1 - src;
      bind(light[dst]); const u = use(prog.blur, { uTex: light[src].tex });
      gl.uniform2f(u.uDir, dx / light[0].w, dy / light[0].h); fullscreen(); src = dst;
    }
    return light[src];
  }
  function depthOf(i) {
    let d = 0;
    for (let j = i - W; j >= 0 && d < 6; j -= W) { const k = world.kind[j]; if (!k || k === K.STEAM || k === K.FIRE) break; d++; }
    return d;
  }
  function buildInstances(alpha, state) {
    const now = clock, kind = world.kind, temp = world.temp, charge = world.charge, fuel = world.fuel;
    let g = glyphs.data, n = 0;
    const put = (x, y, k, prev, tt, bt, t, q, seed, death, f, flags, sc = 1, rot = 0, al = 1, glyph = 0) => {
      if (n >= glyphs.max) return;
      const o = n++ * 16;
      g[o] = x; g[o + 1] = y; g[o + 2] = k; g[o + 3] = prev; g[o + 4] = tt; g[o + 5] = bt; g[o + 6] = t; g[o + 7] = q; g[o + 8] = seed; g[o + 9] = death; g[o + 10] = f; g[o + 11] = flags;
      g[o + 12] = sc; g[o + 13] = rot; g[o + 14] = al; g[o + 15] = glyph;
    };
    const fd = fluids.data; let nf = 0;
    fireData.fill(0); fireCount = 0;
    if (stage) {
      // Scripted actors replace the world: free positions, sizes, rotation and alpha.
      const u = stage.unit ?? 1;
      for (const a of stage.actors) {
        const al = a.a ?? 1; if (al < .003) continue;
        const k = a.k, sc = (a.s ?? 1) * u, ax = a.x * u, ay = a.y * u;
        put(ax - .5, ay - .5, k, 0, 1, a.bt ?? 1, a.temp ?? 290, a.charge ?? 0, a.seed ?? .5, 0, a.fuel ?? 0, a.flags ?? 0, sc, a.r ?? 0, al, a.g === undefined ? 0 : a.g + 1);
        if ((k === K.WATER || k === K.MOLTEN || k === K.STEAM || k === K.ICE) && nf < fluids.max && !(a.flags >= 8)) {
          const o = nf++ * 5, ch = k === K.WATER ? 0 : k === K.MOLTEN ? 1 : k === K.STEAM ? 2 : 3;
          fd[o] = ax - .5; fd[o + 1] = ay - .5; fd[o + 2] = ch; fd[o + 3] = (k === K.STEAM ? .42 : .72) * al * (a.fog ?? 1); fd[o + 4] = (k === K.STEAM ? 1.7 : 1.1) * sc;
        }
        if (k === K.FIRE) {
          const cx = Math.round(ax - .5), cy = Math.round(ay - .5);
          if (cx >= 0 && cx < W && cy >= 0 && cy < H) { fireCount++; fireData[(cy * W + cx) * 4] = Math.max(fireData[(cy * W + cx) * 4], 255 * clamp(al, 0, 1)); }
        }
      }
    } else for (const r of recs.values()) {
      if (now < r.bornAt) continue;
      const i = r.i, k = kind[i];
      if (k !== r.kind) continue;
      const x = r.ox + (r.x - r.ox) * alpha, y = r.oy + (r.y - r.oy) * alpha;
      const dur = r.prev === K.WOOD ? .55 : r.prev === K.WATER && k === K.ICE ? .6 : .38;
      const tt = r.changeAt < -9 ? 1 : clamp((now - r.changeAt) / dur, 0, 1);
      const bt = clamp((now - r.bornAt) / .3, 0, 1);
      put(x, y, k, r.prev, tt, bt, temp[i], charge[i], r.seed, 0, k === K.FIRE ? fuel[i] : depthOf(i), 0);
      if (k === K.WATER || k === K.MOLTEN || k === K.STEAM || k === K.ICE) {
        const o = nf++ * 5, ch = k === K.WATER ? 0 : k === K.MOLTEN ? 1 : k === K.STEAM ? 2 : 3;
        fd[o] = x; fd[o + 1] = y; fd[o + 2] = ch; fd[o + 3] = (k === K.STEAM ? .42 : .72) * Math.min(1, bt * 1.6); fd[o + 4] = k === K.STEAM ? 1.7 : 1.1;
      }
      if (k === K.FIRE) { fireCount++; fireData[i * 4] = 255 * clamp(.6 + fuel[i] * .1, .6, 1) * (r.prev === K.WOOD ? clamp(tt * 1.6, 0, 1) : 1) * Math.min(1, bt * 2); }
    }
    if (!stage) {
      for (const gh of ghosts) put(gh.x, gh.y, gh.kind, 0, 1, 1, 290, 0, gh.seed, clamp((now - gh.at) / .5, .001, 1), 0, gh.erased ? 2 : 0);
      const { cursor, selected } = state;
      if (cursor && !cursor.drawing && (cursor.kind ?? selected)) put(cursor.x, cursor.y, cursor.kind ?? selected, 0, 1, 1, 290, 0, .5, 0, 0, 1);
      put(person.x, person.y, PLAYER, 0, 1, 1, 290, 0, .3, 0, 0, 4);
      if (overlay?.actors) for (const a of overlay.actors) {
        const al = a.a ?? 1; if (al < .003) continue;
        put(a.x - .5, a.y - .5, a.k, 0, 1, a.bt ?? 1, a.temp ?? 290, a.charge ?? 0, a.seed ?? .5, 0, a.fuel ?? 0, a.flags ?? 0, a.s ?? 1, a.r ?? 0, al, a.g === undefined ? 0 : a.g + 1);
      }
    }
    glyphs.n = n; fluids.n = nf;
    // particles
    const lists = { under: partsUnder, over: partsOver, add: partsAdd };
    for (const b of Object.values(lists)) b.n = 0;
    for (const p of parts) {
      const b = lists[p.layer] || partsOver; if (b.n >= b.max) continue;
      const t = p.age / p.life, o = b.n++ * 12, d = b.data;
      let a = p.a * (1 - t);
      if (p.fadeIn) a *= clamp(p.age / p.fadeIn, 0, 1);
      if (p.type === kinds.puff || p.type === kinds.blot) a = p.a * Math.sin(Math.PI * Math.min(1, t * 1.15 + .05));
      if (p.type === kinds.star) a = p.a * Math.sin(Math.PI * t);
      const grow = 1 + p.grow * t;
      let rot = p.rot, sx = p.s * grow, sy = p.sy * grow;
      if (p.type === kinds.streak) { rot = Math.atan2(p.vx, -p.vy); }
      d[o] = p.x; d[o + 1] = p.y; d[o + 2] = sx; d[o + 3] = sy;
      d[o + 4] = p.col[0]; d[o + 5] = p.col[1]; d[o + 6] = p.col[2]; d[o + 7] = a;
      d[o + 8] = rot; d[o + 9] = p.type; d[o + 10] = p.seed; d[o + 11] = p.glyph;
    }
    for (const src of [stage, stage ? null : overlay]) if (src?.marks) for (const m of src.marks) {
      const b = lists[m.layer] || partsOver; if (b.n >= b.max) continue;
      const o = b.n++ * 12, d = b.data, u = src.unit ?? 1;
      d[o] = m.x * u; d[o + 1] = m.y * u; d[o + 2] = m.s * u; d[o + 3] = (m.sy ?? m.s) * u;
      d[o + 4] = m.col[0]; d[o + 5] = m.col[1]; d[o + 6] = m.col[2]; d[o + 7] = m.a ?? 1;
      d[o + 8] = m.rot ?? 0; d[o + 9] = m.type; d[o + 10] = m.seed ?? .5; d[o + 11] = m.glyph ?? 0;
    }
    // ribbons: bolts (additive) then brush trails (alpha)
    ribbonCount = 0;
    const cw = canvas.width / W, ch = canvas.height / H, unit = Math.min(cw, ch);
    const pushRibbon = (pts, width, col, alphaOf, mode) => {
      for (let s = 0; s < pts.length - 1; s++) {
        const a = pts[s], b = pts[s + 1];
        const ax = a.x * cw, ay = a.y * ch, bx = b.x * cw, by = b.y * ch;
        const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1, nx = -dy / len * width * unit, ny = dx / len * width * unit;
        const along0 = s, along1 = s + 1, al0 = alphaOf(s / (pts.length - 1)), al1 = alphaOf((s + 1) / (pts.length - 1));
        const verts = [[ax - nx, ay - ny, -1, along0, al0], [ax + nx, ay + ny, 1, along0, al0], [bx - nx, by - ny, -1, along1, al1], [ax + nx, ay + ny, 1, along0, al0], [bx + nx, by + ny, 1, along1, al1], [bx - nx, by - ny, -1, along1, al1]];
        if ((ribbonCount + 6) * 9 > ribbonData.length) { const bigger = new Float32Array(ribbonData.length * 2); bigger.set(ribbonData); ribbonData = bigger; }
        for (const [x, y, side, along, al] of verts) {
          const o = ribbonCount++ * 9;
          ribbonData[o] = x; ribbonData[o + 1] = y; ribbonData[o + 2] = side; ribbonData[o + 3] = along;
          ribbonData[o + 4] = col[0]; ribbonData[o + 5] = col[1]; ribbonData[o + 6] = col[2]; ribbonData[o + 7] = al; ribbonData[o + 8] = mode;
        }
      }
    };
    for (const b of bolts) {
      const t = b.age / b.life;
      let I = (1 - t) * (b.alpha ?? 1);
      if (b.flicker && motion) I *= t < .08 ? 1 : t < .13 ? .25 : t < .2 ? .9 : 1 - t * .6;
      pushRibbon(b.pts, b.width, b.col, () => I, 0);
    }
    for (const src of [stage, stage ? null : overlay]) if (src?.ribbons) { const u = src.unit ?? 1; for (const rb of src.ribbons) if (!rb.flat) pushRibbon(rb.pts.map(q => ({ x: q.x * u, y: q.y * u })), rb.width * u, rb.col, () => rb.a ?? 1, 0); }
    const boltVerts = ribbonCount;
    for (const s of trail) {
      const t = clamp((now - s.t) / (s.life ?? 1.1), 0, 1);
      const col = PIGMENT[s.kind] || [.6, .68, .82];
      pushRibbon([{ x: s.x0, y: s.y0 }, { x: s.x1, y: s.y1 }], s.w, s.kind ? col : [.45, .55, .72], () => .3 * (1 - t) * (1 - t), 1);
    }
    if (!stage && overlay?.ribbons) for (const rb of overlay.ribbons) if (rb.flat) pushRibbon(rb.pts, rb.width, rb.col, () => rb.a ?? 1, 2);
    return boltVerts;
  }
  function drawRibbons(from, count) {
    if (count <= 0) return;
    gl.bindVertexArray(ribbonVao); gl.bindBuffer(gl.ARRAY_BUFFER, ribbonBuffer);
    gl.drawArrays(gl.TRIANGLES, from, count); gl.bindVertexArray(null);
  }
  function uploadRibbons() {
    if (!ribbonCount) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, ribbonBuffer);
    if (ribbonData.length > ribbonCapacity) { gl.bufferData(gl.ARRAY_BUFFER, ribbonData.byteLength, gl.DYNAMIC_DRAW); ribbonCapacity = ribbonData.length; }
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, ribbonData, 0, ribbonCount * 9);
  }

  function render(state) {
    if (gl.isContextLost()) return;
    sync(false);
    if (!atlasReady) buildAtlas();
    ensureTargets(); ensurePaper();
    const alpha = clamp(state.alpha ?? 1, 0, 1);
    const cw = canvas.width / W, ch = canvas.height / H;
    const boltVerts = buildInstances(alpha, state);
    let u;
    cellLight();
    const lightTex = lightPass().tex;
    const common = (u, vw = canvas.width, vh = canvas.height) => {
      if (u.uRes) gl.uniform2f(u.uRes, canvas.width, canvas.height);
      if (u.uCell) gl.uniform2f(u.uCell, cw, ch);
      if (u.uTime) gl.uniform1f(u.uTime, clock);
      if (u.uMotion) gl.uniform1f(u.uMotion, motion ? 1 : 0);
      if (u.uFlash) gl.uniform1f(u.uFlash, flash);
      if (u.uViewport) gl.uniform2f(u.uViewport, vw, vh);
      if (u.uAtlasGrid) gl.uniform2f(u.uAtlasGrid, ATLAS_COLS, ATLAS_ROWS);
    };
    // painted backdrop (half resolution): moon, stars, clouds, ink-wash ranges, mist
    const backdropOn = stage ? stage.backdrop ? 1 : 0 : 1;
    if (backdropOn) {
      bind(back); blend(false);
      u = use(prog.backdrop); common(u);
      gl.uniform2f(u.uParallax, parallax.x, parallax.y); gl.uniform1f(u.uRise, stage?.rise ?? 0); gl.uniform1f(u.uAspect, canvas.width / canvas.height);
      if (u.uDetail) gl.uniform1f(u.uDetail, mobile ? 0 : 1);
      fullscreen();
    }
    // fluid field
    bind(fluid); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    if (upload(fluids)) { blend('add'); common(use(prog.fluid)); drawQuads(fluids); }
    // scene
    bind(scene); blend(false);
    u = use(prog.bg, { uPaper: paperTex.tex, uFluid: fluid.tex, uLight: lightTex, uBack: back.tex }); gl.uniform1f(u.uBackdrop, backdropOn);
    common(u); gl.uniform2f(u.uCellUV, 1 / W, 1 / H); gl.uniform1f(u.uStorm, stage?.storm ?? 0); gl.uniform1f(u.uDark, stage?.dark ?? 0); fullscreen();
    blend('alpha');
    const drawParts = (batch, additive) => {
      if (!upload(batch)) return;
      const pu = use(prog.part, { uAtlas: atlasTex }); common(pu); gl.uniform1f(pu.uAdd, additive ? 1 : 0); drawQuads(batch);
    };
    drawParts(partsUnder, false);
    upload(glyphs);
    u = use(prog.glyph, { uAtlas: atlasTex, uLight: lightTex }); common(u); gl.uniform1f(u.uEmissive, 0); drawQuads(glyphs);
    drawParts(partsOver, false);
    uploadRibbons();
    if (ribbonCount > boltVerts) { u = use(prog.ribbon); common(u); drawRibbons(boltVerts, ribbonCount - boltVerts); }
    if (state.cursor && !stage) {
      const { cursor, brush = 0, selected } = state, k = cursor.kind ?? selected;
      const pad = .08, x0 = (cursor.x - brush - pad) * cw, y0 = (cursor.y - brush - pad) * ch, x1 = (cursor.x + brush + 1 + pad) * cw, y1 = (cursor.y + brush + 1 + pad) * ch;
      u = use(prog.box); common(u);
      gl.uniform4f(u.uBox, x0, y0, x1, y1); gl.uniform2f(u.uSize, x1 - x0, y1 - y0); gl.uniform1f(u.uErase, k ? 0 : 1); gl.uniform1f(u.uDpr, dpr());
      const c = k ? [.93, .38, .24, .85] : [.75, .8, .9, .8]; gl.uniform4f(u.uColor, ...c);
      gl.bindVertexArray(emptyVao); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    // emissive
    bind(emis); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    blend('add');
    use(prog.fluidGlow, { uFluid: fluid.tex }); fullscreen();
    if (fireCount) {
      gl.bindTexture(gl.TEXTURE_2D, fireTex); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, fireData);
      u = use(prog.fire, { uFire: fireTex }); common(u); gl.uniform2f(u.uGrid, W, H); fullscreen();
    }
    u = use(prog.glyph, { uAtlas: atlasTex, uLight: lightTex }); common(u, emis.w, emis.h); gl.uniform1f(u.uEmissive, 1); drawQuads(glyphs);
    drawParts(partsAdd, true);
    if (boltVerts) { u = use(prog.ribbon); common(u); drawRibbons(0, boltVerts); }
    // bloom
    blend(false);
    let src = emis;
    for (const t of bloom) { bind(t); u = use(prog.down, { uTex: src.tex }); gl.uniform2f(u.uTexel, 1 / src.w, 1 / src.h); fullscreen(); src = t; }
    blend('add');
    for (let i = bloom.length - 1; i > 0; i--) { bind(bloom[i - 1]); u = use(prog.up, { uTex: bloom[i].tex }); gl.uniform2f(u.uTexel, 1 / bloom[i].w, 1 / bloom[i].h); fullscreen(); }
    // composite
    blend(false); bind(null);
    u = use(prog.composite, { uScene: scene.tex, uEmis: emis.tex, uBloom: bloom[0].tex, uLight: lightTex });
    common(u);
    gl.uniform1f(u.uBloomAmt, 1.05); gl.uniform1f(u.uHaze, motion ? .0065 : 0);
    const pz = push.p > .001 ? push : { p: 0, zoom: 1 };
    gl.uniform1f(u.uPush, pz.p); gl.uniform1f(u.uZoom, pz.zoom ?? 1);
    gl.uniform2f(u.uZoomC, (person.x + .5) / W, 1 - (person.y + .5) / H);
    const sh = shake > 0 && motion ? Math.min(1, shake / .12) * .0035 : 0;
    gl.uniform2f(u.uShake, Math.sin(clock * 91) * sh, Math.cos(clock * 83) * sh * .8);
    fullscreen();
  }

  return {
    emit, update, render, sync,
    setMotion(value) { motion = Boolean(value); shake = 0; if (!motion) parts.length = 0; },
    invalidate() { sizeKey = ''; if (fontLoaded() !== atlasFont) atlasReady = false; },
    get active() { return Boolean(stage) || Boolean(overlay) || parts.length > 0 || bolts.length > 0 || ghosts.length > 0 || trail.length > 0 || flash > 0 || personMoving; },
    // The opening drives the renderer through a stage of actors and these effects.
    setStage(value) { stage = value || null; },
    // Shapes drawn over the world each frame (the magic circle), in grid cells.
    setOverlay(value) { overlay = value || null; },
    // Pointer position in -1..1 across the canvas; the painted ranges shift by depth.
    setParallax(x, y) { parallax.tx = Math.max(-1, Math.min(1, x)); parallax.ty = Math.max(-1, Math.min(1, y)); parallax.inputAt = clock; },
    // Push toward 我 before inner sight: p in 0..1, zoom >= 1.
    setPush(p, zoom = 1) { push.p = motion ? p : 0; push.zoom = motion ? zoom : 1; },
    get player() { return { x: person.x, y: person.y }; },
    fx: {
      strike, add, burst,
      ember, spark, glint, smoke, steamPuff, drop, shard,
      trail(x0, y0, x1, y1, kind, w = .3, life = 1.1) { trail.push({ x0, y0, x1, y1, kind, t: clock, w, life }); if (trail.length > 200) trail.shift(); },
      flash(v) { flash = Math.max(flash, motion ? v : Math.min(.3, v)); },
      // A formation line in gold that holds, then fades (no flicker).
      sigil(pts, { width = .12, col = [1, .82, .42], life = 1.2 } = {}) { bolts.push({ pts, width, col, life, age: 0, flicker: false }); },
      shake(v) { if (motion) shake = Math.max(shake, v); },
      clear() { parts.length = 0; bolts.length = 0; trail.length = 0; flash = 0; shake = 0; },
      kinds,
    },
    get count() { return parts.length; },
    get time() { return clock; },
  };
}
