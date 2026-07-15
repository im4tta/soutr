/**
 * app.js — wires together cloth.js (physics), textures.js (fabric), and
 * i18n.js (EN/Khmer strings) into a running WebGL scene, and binds every
 * on-screen control.
 */
(function(){

  const HANG_STYLES = {
    curtain:     { width:3.0, height:6.0, offsetY:3.0, pinMode:'top-row',    camY:-2.0, camZ:8.5 },
    swatch:      { width:3.6, height:4.6, offsetY:1.6, pinMode:'corners',    camY:-0.8, camZ:8.0 },
    krama:       { width:1.3, height:7.2, offsetY:3.4, pinMode:'center-pair',camY:-1.6, camZ:9.2 },
    sampot:      { width:5.2, height:3.4, offsetY:1.4, pinMode:'top-row',    camY:-0.4, camZ:9.8 },
    chongkraben: { width:2.2, height:6.4, offsetY:3.0, pinMode:'top-row',    camY:-1.4, camZ:8.8 },
    sbai:        { width:1.8, height:5.6, offsetY:2.7, pinMode:'center-pair',camY:-1.0, camZ:8.6 },
  };

  const state = {
    color: COLORS[4],
    pattern: 'check',
    hangStyle: 'curtain',
    stiffness: 0.9,   // 0.3 - 1.0
    windMul: 1.0,     // 0 - 3
    gravity: 0.007,   // 0.003 - 0.015
    scale: 1.0,       // 0.7 - 1.3
    windOn: true,
    backdrop: 'light',
    showTag: false,
  };

  // Curated "shop the look" gallery — real Khmer clothing + fabric samples.
  const GALLERY = [
    { key:'sample_krama_everyday',    hangStyle:'krama',       pattern:'krama',     colorIdx:8, price:'$6' },
    { key:'sample_sampot_hol',        hangStyle:'sampot',      pattern:'hol',       colorIdx:4, price:'$34' },
    { key:'sample_chongkraben',       hangStyle:'chongkraben', pattern:'check',     colorIdx:1, price:'$28' },
    { key:'sample_sbai_blush',        hangStyle:'sbai',        pattern:'solid',     colorIdx:7, price:'$22' },
    { key:'sample_sampot_pidan',      hangStyle:'sampot',      pattern:'pidan',     colorIdx:9, price:'$58' },
    { key:'sample_krama_gold',        hangStyle:'krama',       pattern:'krama',     colorIdx:9, price:'$9' },
    { key:'sample_curtain_sage',      hangStyle:'curtain',     pattern:'stripe',    colorIdx:2, price:'$14' },
    { key:'sample_swatch_mustard',    hangStyle:'swatch',      pattern:'dot',       colorIdx:6, price:'$4' },
    { key:'sample_sampot_terracotta', hangStyle:'sampot',      pattern:'phamuong',  colorIdx:3, price:'$30' },
    { key:'sample_krama_plum',        hangStyle:'krama',       pattern:'hol',       colorIdx:5, price:'$11' },
  ];

  // ---------------- texture canvas ----------------
  const texCanvas = document.createElement('canvas');
  texCanvas.width = 1024; texCanvas.height = 1024;
  const tctx = texCanvas.getContext('2d');

  // ---------------- WebGL ----------------
  const canvas = document.getElementById('glcanvas');
  // preserveDrawingBuffer is required so canvas.toDataURL() (Save image)
  // can read back the last rendered frame — without it the drawing buffer
  // is cleared by the browser right after compositing and export is blank.
  const gl = canvas.getContext('webgl', { antialias:true, alpha:true, preserveDrawingBuffer:true });
  let aspect = 1;

  function resize(){
    canvas.width = window.innerWidth * window.devicePixelRatio;
    canvas.height = window.innerHeight * window.devicePixelRatio;
    gl.viewport(0,0,canvas.width, canvas.height);
    aspect = canvas.width / canvas.height;
  }
  window.addEventListener('resize', resize);

  const vsSource = `
    attribute vec3 a_pos;
    attribute vec3 a_norm;
    attribute vec2 a_uv;
    uniform mat4 u_proj;
    uniform mat4 u_view;
    varying vec3 v_norm;
    varying vec2 v_uv;
    void main(){
      v_norm = a_norm;
      v_uv = a_uv;
      gl_Position = u_proj * u_view * vec4(a_pos,1.0);
    }`;
  const fsSource = `
    precision mediump float;
    varying vec3 v_norm;
    varying vec2 v_uv;
    uniform sampler2D u_tex;
    void main(){
      vec3 norm = normalize(v_norm);
      if(!gl_FrontFacing) norm = -norm;
      vec3 lightDir1 = normalize(vec3(0.35,0.85,0.55));
      vec3 lightDir2 = normalize(vec3(-0.5,-0.15,0.75));
      float diff1 = max(dot(norm,lightDir1),0.0);
      float diff2 = max(dot(norm,lightDir2),0.0);
      float ambient = 0.5;
      vec4 texColor = texture2D(u_tex, v_uv);
      vec3 finalColor = texColor.rgb * (ambient + diff1*0.42 + diff2*0.22);
      gl_FragColor = vec4(finalColor, texColor.a);
    }`;

  function createShader(type, src){
    const s = gl.createShader(type);
    gl.shaderSource(s,src); gl.compileShader(s);
    if(!gl.getShaderParameter(s, gl.COMPILE_STATUS)){ console.error(gl.getShaderInfoLog(s)); return null; }
    return s;
  }
  const program = gl.createProgram();
  gl.attachShader(program, createShader(gl.VERTEX_SHADER, vsSource));
  gl.attachShader(program, createShader(gl.FRAGMENT_SHADER, fsSource));
  gl.linkProgram(program);
  gl.useProgram(program);

  const aPos = gl.getAttribLocation(program,'a_pos');
  const aNorm = gl.getAttribLocation(program,'a_norm');
  const aUv = gl.getAttribLocation(program,'a_uv');
  const uProj = gl.getUniformLocation(program,'u_proj');
  const uView = gl.getUniformLocation(program,'u_view');

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  function updateTexture(){
    drawFabricTexture(tctx, texCanvas.width, texCanvas.height, state.color, state.pattern);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texCanvas);
  }
  updateTexture();

  // ---------------- cloth ----------------
  const cloth = new ClothSim(26, 42);
  const posBuf = gl.createBuffer();
  const normBuf = gl.createBuffer();
  const uvBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
  gl.bufferData(gl.ARRAY_BUFFER, cloth.uvData, gl.STATIC_DRAW);
  const idxBuf = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(cloth.indices), gl.STATIC_DRAW);

  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  const camPos = { x:0, y:-2.0, z:8.5 };
  const fov = 45*Math.PI/180;
  const projMatrix = new Float32Array(16);
  const viewMatrix = new Float32Array(16);

  function setPerspective(out, fovy, aspect, near, far){
    const f = 1.0/Math.tan(fovy/2), nf = 1/(near-far);
    out.fill(0);
    out[0]=f/aspect; out[5]=f; out[10]=(far+near)*nf; out[11]=-1; out[14]=(2*far*near)*nf;
  }
  function setTranslation(out,x,y,z){
    out.fill(0); out[0]=1; out[5]=1; out[10]=1; out[15]=1; out[12]=x; out[13]=y; out[14]=z;
  }

  function applyHangStyle(){
    const L = HANG_STYLES[state.hangStyle];
    cloth.reset({
      width: L.width * state.scale,
      height: L.height * state.scale,
      offsetY: L.offsetY,
      pinMode: L.pinMode
    });
    camPos.y = L.camY;
    camPos.z = L.camZ;
  }

  resize();
  applyHangStyle();

  // ---------------- interaction ----------------
  let pointerX=0, pointerY=0;
  const indicator = document.getElementById('indicator');

  function getRay(){
    const tanFov = Math.tan(fov/2);
    const dx = pointerX*aspect*tanFov, dy = pointerY*tanFov, dz = -1;
    const len = Math.sqrt(dx*dx+dy*dy+dz*dz);
    return { origin:{x:camPos.x,y:camPos.y,z:camPos.z}, dir:{x:dx/len,y:dy/len,z:dz/len} };
  }
  function updatePointer(e){
    pointerX = (e.clientX/window.innerWidth)*2 - 1;
    pointerY = -(e.clientY/window.innerHeight)*2 + 1;
  }

  canvas.addEventListener('pointerdown', e=>{
    updatePointer(e);
    const idx = cloth.pick(getRay(), 1.0);
    if(idx!==-1){
      cloth.grabbedIndex = idx;
      indicator.style.display='block';
      indicator.style.left=e.clientX+'px';
      indicator.style.top=e.clientY+'px';
    }
  });
  window.addEventListener('pointermove', e=>{
    updatePointer(e);
    if(cloth.grabbedIndex!==-1){
      cloth.dragTo(getRay());
      indicator.style.left=e.clientX+'px';
      indicator.style.top=e.clientY+'px';
    }
  });
  function release(){ cloth.release(); indicator.style.display='none'; }
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);

  // ---------------- main loop ----------------
  let time = 0;
  function render(){
    time += 0.016;
    const windMul = state.windOn ? state.windMul : 0;
    const windX = Math.sin(time*1.5)*0.0015*windMul;
    const windZ = Math.cos(time*1.1)*0.0015*windMul;

    cloth.step({
      gravity: state.gravity,
      damping: 0.985,
      windX, windZ,
      iterations: 15,
      stiffness: state.stiffness
    });

    gl.clearColor(0,0,0,0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    setPerspective(projMatrix, fov, aspect, 0.1, 100.0);
    setTranslation(viewMatrix, -camPos.x, -camPos.y, -camPos.z);
    gl.uniformMatrix4fv(uProj, false, projMatrix);
    gl.uniformMatrix4fv(uView, false, viewMatrix);

    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, cloth.posData, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos,3,gl.FLOAT,false,0,0);

    gl.bindBuffer(gl.ARRAY_BUFFER, normBuf);
    gl.bufferData(gl.ARRAY_BUFFER, cloth.normalData, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(aNorm);
    gl.vertexAttribPointer(aNorm,3,gl.FLOAT,false,0,0);

    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
    gl.enableVertexAttribArray(aUv);
    gl.vertexAttribPointer(aUv,2,gl.FLOAT,false,0,0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
    gl.drawElements(gl.TRIANGLES, cloth.indices.length, gl.UNSIGNED_SHORT, 0);

    requestAnimationFrame(render);
  }
  render();

  // =================================================================
  // UI wiring
  // =================================================================
  applyTranslations();

  // language toggle
  document.querySelectorAll('.lang-btn').forEach(btn=>{
    btn.addEventListener('click', ()=> setLang(btn.dataset.lang));
  });
  setLang(currentLang);
  document.addEventListener('lang-changed', ()=>{
    renderPatternRow();
    renderGallery();
  });

  // color swatches
  const colorRow = document.getElementById('colorRow');
  function renderColorRow(){
    colorRow.innerHTML = '';
    COLORS.forEach(c=>{
      const el = document.createElement('div');
      el.className = 'swatch' + (c===state.color ? ' active' : '');
      el.style.background = c.hex;
      el.title = c.name;
      el.addEventListener('click', ()=> selectColor(c));
      colorRow.appendChild(el);
    });
  }
  const customColorInput = document.getElementById('customColor');
  customColorInput.value = state.color.hex;

  function selectColor(c){
    state.color = c;
    document.querySelectorAll('.swatch').forEach(s=>s.classList.remove('active'));
    const idx = COLORS.indexOf(c);
    if(idx!==-1 && colorRow.children[idx]) colorRow.children[idx].classList.add('active');
    customColorInput.value = c.hex;
    updateTexture();
    syncGalleryActive();
  }
  renderColorRow();

  customColorInput.addEventListener('input', ()=>{
    const hex = customColorInput.value;
    state.color = { name:'Custom', hex, thread: shade(hex) };
    document.querySelectorAll('.swatch').forEach(s=>s.classList.remove('active'));
    updateTexture();
    syncGalleryActive();
  });
  function shade(hex){
    const {r,g,b} = hexToRgb(hex);
    const f = c => Math.max(0, Math.min(255, Math.round(c*0.7)));
    return `rgb(${f(r)},${f(g)},${f(b)})`;
  }

  // pattern buttons
  const patternRow = document.getElementById('patternRow');
  const patternKeys = { solid:'pattern_solid', stripe:'pattern_stripe', check:'pattern_check',
                         dot:'pattern_dot', krama:'pattern_krama', hol:'pattern_hol', pidan:'pattern_pidan',
                         phamuong:'pattern_phamuong' };
  function renderPatternRow(){
    patternRow.innerHTML = '';
    PATTERNS.forEach(p=>{
      const el = document.createElement('button');
      el.className = 'pill' + (p===state.pattern ? ' active' : '');
      el.dataset.i18n = patternKeys[p];
      el.textContent = t(patternKeys[p]);
      el.addEventListener('click', ()=> selectPattern(p));
      patternRow.appendChild(el);
    });
  }
  function selectPattern(p){
    state.pattern = p;
    document.querySelectorAll('#patternRow .pill').forEach(s=>s.classList.remove('active'));
    const idx = PATTERNS.indexOf(p);
    if(idx!==-1 && patternRow.children[idx]) patternRow.children[idx].classList.add('active');
    updateTexture();
    syncGalleryActive();
  }
  renderPatternRow();

  // hang style — all three segmented groups act as one radio set
  const hangButtons = document.querySelectorAll('#typeSeg button, #typeSeg2 button, #typeSeg3 button');
  function selectHangStyle(styleKey){
    state.hangStyle = styleKey;
    hangButtons.forEach(b=> b.classList.toggle('active', b.dataset.type === styleKey));
    applyHangStyle();
    syncGalleryActive();
  }
  hangButtons.forEach(btn=>{
    btn.addEventListener('click', ()=> selectHangStyle(btn.dataset.type));
  });

  // sliders
  function bindSlider(id, key, onChange){
    const el = document.getElementById(id);
    el.addEventListener('input', ()=>{
      state[key] = parseFloat(el.value);
      if(onChange) onChange();
    });
  }
  bindSlider('stiffnessSlider','stiffness');
  bindSlider('windSlider','windMul');
  bindSlider('gravitySlider','gravity');
  bindSlider('scaleSlider','scale', applyHangStyle);

  // ambient breeze toggle
  const windToggle = document.getElementById('windToggle');
  windToggle.addEventListener('click', ()=>{
    state.windOn = !state.windOn;
    windToggle.classList.toggle('on', state.windOn);
  });

  // backdrop toggle
  document.querySelectorAll('#backdropSeg button').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      document.querySelectorAll('#backdropSeg button').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      state.backdrop = btn.dataset.backdrop;
      document.body.classList.toggle('dark-backdrop', state.backdrop==='dark');
    });
  });

  // product tag
  const tagName = document.getElementById('tagName');
  const tagPrice = document.getElementById('tagPrice');
  const tagShowToggle = document.getElementById('tagShowToggle');
  const onCanvasTag = document.getElementById('onCanvasTag');
  const onCanvasTagName = document.getElementById('onCanvasTagName');
  const onCanvasTagPrice = document.getElementById('onCanvasTagPrice');

  function refreshTag(){
    onCanvasTagName.textContent = tagName.value || t('product_name_ph');
    onCanvasTagPrice.textContent = tagPrice.value || '';
    onCanvasTag.style.display = (state.showTag && (tagName.value || tagPrice.value)) ? 'block' : 'none';
  }
  tagName.addEventListener('input', refreshTag);
  tagPrice.addEventListener('input', refreshTag);
  tagShowToggle.addEventListener('click', ()=>{
    state.showTag = !state.showTag;
    tagShowToggle.classList.toggle('on', state.showTag);
    refreshTag();
  });

  // reset
  document.getElementById('resetBtn').addEventListener('click', applyHangStyle);

  // save image — render one fresh frame synchronously right before reading
  // pixels back, so the export always matches what's on screen.
  document.getElementById('saveBtn').addEventListener('click', ()=>{
    const link = document.createElement('a');
    link.download = 'soutr-preview.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  });

  // =================================================================
  // Tab navigation
  // =================================================================
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');
  tabButtons.forEach(btn=>{
    btn.addEventListener('click', ()=>{
      tabButtons.forEach(b=>b.classList.remove('active'));
      tabPanes.forEach(p=>p.classList.remove('active'));
      btn.classList.add('active');
      document.querySelector(`.tab-pane[data-pane="${btn.dataset.tab}"]`).classList.add('active');
    });
  });

  // =================================================================
  // Auto-hide panel — hover reveal on desktop, tap toggle on touch,
  // no permanently-visible scrollbar or fixed-width chrome.
  // =================================================================
  const panelWrap = document.getElementById('panelWrap');
  const panelHandle = document.getElementById('panelHandle');
  const panelScrim = document.getElementById('panelScrim');
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  let hideTimer = null;

  function openPanel(){
    clearTimeout(hideTimer);
    document.body.classList.add('panel-open');
  }
  function closePanelSoon(delay){
    clearTimeout(hideTimer);
    hideTimer = setTimeout(()=> document.body.classList.remove('panel-open'), delay===undefined?350:delay);
  }
  function closePanelNow(){
    clearTimeout(hideTimer);
    document.body.classList.remove('panel-open');
  }

  if(canHover){
    // one shared hover zone spanning handle + panel avoids flicker while
    // the mouse travels between the two during the open transition
    panelWrap.addEventListener('mouseenter', openPanel);
    panelWrap.addEventListener('mouseleave', ()=> closePanelSoon());
  }
  panelHandle.addEventListener('click', ()=>{
    if(document.body.classList.contains('panel-open')) closePanelNow();
    else openPanel();
  });
  panelScrim.addEventListener('click', closePanelNow);

  // =================================================================
  // Product gallery — "shop the look" sample cards
  // =================================================================
  const galleryGrid = document.getElementById('galleryGrid');
  const galleryThumbCanvas = document.createElement('canvas');
  galleryThumbCanvas.width = 220; galleryThumbCanvas.height = 290;
  const gtx = galleryThumbCanvas.getContext('2d');

  function thumbFor(colorIdx, pattern){
    const c = COLORS[colorIdx];
    drawFabricTexture(gtx, galleryThumbCanvas.width, galleryThumbCanvas.height, c, pattern);
    return galleryThumbCanvas.toDataURL('image/jpeg', 0.85);
  }

  function renderGallery(){
    galleryGrid.innerHTML = '';
    GALLERY.forEach(sample=>{
      const el = document.createElement('div');
      const isActive = state.hangStyle===sample.hangStyle && state.pattern===sample.pattern &&
                        state.color===COLORS[sample.colorIdx];
      el.className = 'gallery-card' + (isActive ? ' active' : '');
      el.style.backgroundImage = `url(${thumbFor(sample.colorIdx, sample.pattern)})`;
      el.dataset.hangStyle = sample.hangStyle;
      el.dataset.pattern = sample.pattern;
      el.dataset.colorIdx = sample.colorIdx;

      const price = document.createElement('div');
      price.className = 'gallery-card-price';
      price.textContent = sample.price;
      el.appendChild(price);

      const label = document.createElement('div');
      label.className = 'gallery-card-label';
      label.textContent = t(sample.key);
      el.appendChild(label);

      el.addEventListener('click', ()=> applySample(sample));
      galleryGrid.appendChild(el);
    });
  }

  function applySample(sample){
    selectColor(COLORS[sample.colorIdx]);
    selectPattern(sample.pattern);
    selectHangStyle(sample.hangStyle);
  }

  function syncGalleryActive(){
    document.querySelectorAll('.gallery-card').forEach((el, i)=>{
      const sample = GALLERY[i];
      const isActive = state.hangStyle===sample.hangStyle && state.pattern===sample.pattern &&
                        state.color===COLORS[sample.colorIdx];
      el.classList.toggle('active', isActive);
    });
  }

  renderGallery();

})();
