/**
 * app.js — builds the homepage gallery (several small, independently
 * animating and draggable previews) and the full-screen interactive stage,
 * and wires up every on-screen control. Physics/rendering live in scene.js;
 * this file is UI + state only.
 */
(function(){

  // Curated pieces shown as the homepage gallery — deliberately varied so
  // the very first thing a visitor sees is more than one static swatch.
  const HOME_ITEMS = [
    { key:'sample_jewelcurtain_ruby', hangStyle:'jewelcurtain',      jewel:true, jewelIdx:1, price:'$24' },
    { key:'sample_windchime_doorway', hangStyle:'windchime',         wood:true, woodIdx:0, price:'$16' },
    { key:'sample_chongkraben_royal', hangStyle:'chongkraben_royal', pattern:'chorabap', colorIdx:9, price:'$62' },
    { key:'sample_sbai_wedding_gold', hangStyle:'sbai_wedding',      pattern:'chorabap', colorIdx:5, price:'$48' },
    { key:'sample_krama_everyday',    hangStyle:'krama',             pattern:'krama',    colorIdx:8, price:'$6'  },
    { key:'sample_sarong_everyday',   hangStyle:'sarong',            pattern:'check',    colorIdx:2, price:'$12' },
    { key:'sample_sampot_hol',        hangStyle:'sampot',            pattern:'hol',      colorIdx:4, price:'$34' },
  ];

  // Full "shop the look" gallery inside the stage's Shop tab.
  const GALLERY = [
    { key:'sample_jewelcurtain_ruby',   hangStyle:'jewelcurtain',    jewel:true, jewelIdx:1, price:'$24' },
    { key:'sample_jewelcurtain_emerald',hangStyle:'jewelcurtain',    jewel:true, jewelIdx:2, price:'$24' },
    { key:'sample_jewelcurtain_gold',   hangStyle:'jewelcurtain',    jewel:true, jewelIdx:4, price:'$28' },
    { key:'sample_jewelcurtain_crystal',hangStyle:'jewelcurtain',    jewel:true, jewelIdx:0, price:'$22' },
    { key:'sample_windchime_doorway', hangStyle:'windchime',         wood:true, woodIdx:0, price:'$16' },
    { key:'sample_windchime_gold',    hangStyle:'windchime',         wood:true, woodIdx:4, price:'$22' },
    { key:'sample_krama_everyday',    hangStyle:'krama',             pattern:'krama',     colorIdx:8, price:'$6' },
    { key:'sample_sampot_hol',        hangStyle:'sampot',            pattern:'hol',       colorIdx:4, price:'$34' },
    { key:'sample_chongkraben',       hangStyle:'chongkraben',       pattern:'check',     colorIdx:1, price:'$28' },
    { key:'sample_chongkraben_royal', hangStyle:'chongkraben_royal', pattern:'chorabap',  colorIdx:9, price:'$62' },
    { key:'sample_sbai_blush',        hangStyle:'sbai',              pattern:'solid',     colorIdx:7, price:'$22' },
    { key:'sample_sbai_wedding_gold', hangStyle:'sbai_wedding',      pattern:'chorabap',  colorIdx:5, price:'$48' },
    { key:'sample_sarong_everyday',   hangStyle:'sarong',            pattern:'check',     colorIdx:2, price:'$12' },
    { key:'sample_sampot_pidan',      hangStyle:'sampot',            pattern:'pidan',     colorIdx:9, price:'$58' },
    { key:'sample_krama_gold',        hangStyle:'krama',             pattern:'krama',     colorIdx:9, price:'$9' },
    { key:'sample_curtain_sage',      hangStyle:'curtain',           pattern:'stripe',    colorIdx:2, price:'$14' },
    { key:'sample_swatch_mustard',    hangStyle:'swatch',            pattern:'dot',       colorIdx:6, price:'$4' },
    { key:'sample_sampot_terracotta', hangStyle:'sampot',            pattern:'phamuong',  colorIdx:3, price:'$30' },
    { key:'sample_krama_plum',        hangStyle:'krama',             pattern:'hol',       colorIdx:5, price:'$11' },
  ];

  function resolveColor(sample){
    if(sample.wood) return WOOD_COLORS[sample.woodIdx];
    if(sample.jewel) return JEWEL_COLORS[sample.jewelIdx];
    return COLORS[sample.colorIdx];
  }

  function isChimeStyle(hangStyle){
    return hangStyle === 'windchime' || hangStyle === 'jewelcurtain';
  }

  // =================================================================
  // Homepage gallery — several independent, always-moving, draggable
  // live previews. Tapping "Open" on a card jumps into the full stage.
  // =================================================================
  const homeGrid = document.getElementById('homeGrid');
  const homeScenes = [];

  function buildHomeGrid(){
    homeGrid.innerHTML = '';
    homeScenes.forEach(s=> s.scene.destroy());
    homeScenes.length = 0;

    HOME_ITEMS.forEach(sample=>{
      const card = document.createElement('div');
      card.className = 'home-card';

      const canvas = document.createElement('canvas');
      canvas.className = 'home-card-canvas';
      card.appendChild(canvas);

      const price = document.createElement('div');
      price.className = 'home-card-price';
      price.textContent = sample.price;
      card.appendChild(price);

      const footer = document.createElement('div');
      footer.className = 'home-card-footer';
      const label = document.createElement('div');
      label.className = 'home-card-label';
      label.textContent = t(sample.key);
      footer.appendChild(label);
      const openBtn = document.createElement('button');
      openBtn.className = 'home-card-open';
      openBtn.setAttribute('data-i18n','home_open');
      openBtn.textContent = t('home_open');
      openBtn.addEventListener('click', (e)=>{ e.stopPropagation(); openStage(sample); });
      footer.appendChild(openBtn);
      card.appendChild(footer);

      const glare = document.createElement('div');
      glare.className = 'home-card-glare';
      card.appendChild(glare);

      card.addEventListener('mousemove', e=>{
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        const tiltX = (y - 0.5) * 8;
        const tiltY = (0.5 - x) * 8;
        card.style.transform = 'perspective(800px) rotateX('+tiltX+'deg) rotateY('+tiltY+'deg) scale(1.02) translateY(-4px)';
        glare.style.setProperty('--gx', (x*100)+'%');
        glare.style.setProperty('--gy', (y*100)+'%');
        glare.style.opacity = '1';
      });
      card.addEventListener('mouseleave', ()=>{
        card.style.transform = '';
        glare.style.opacity = '0';
      });

      homeGrid.appendChild(card);

      const scene = new FabricScene(canvas, {
        color: resolveColor(sample),
        pattern: sample.pattern,
        hangStyle: sample.hangStyle,
        interactive: true,
        autoWind: true,
      });
      scene.state.scale = 0.92;
      scene.applyHangStyle();
      scene.start();
      homeScenes.push({ scene, sample });
    });
  }
  buildHomeGrid();

  // =================================================================
  // Stage — the big single-piece interactive studio with the full
  // control panel (colour, pattern, hang style, physics, scene, tag).
  // =================================================================
  const homeView = document.getElementById('homeView');
  const stageView = document.getElementById('stageView');
  const stageCanvas = document.getElementById('glcanvas');
  let stageScene = null;

  function openStage(sample){
    homeScenes.forEach(s=> s.scene.stop());
    homeView.style.display = 'none';
    stageView.style.display = 'block';
    document.body.classList.add('stage-open');

    if(!stageScene){
      stageScene = new FabricScene(stageCanvas, {
        color: resolveColor(sample),
        pattern: sample.pattern || 'solid',
        hangStyle: sample.hangStyle,
        interactive: true,
        autoWind: false,
      });
      stageScene.onGrab = (e)=>{ moveIndicator(e.pointerId, e.clientX, e.clientY); };
      stageScene.onDrag = (e)=>{ moveIndicator(e.pointerId, e.clientX, e.clientY); };
      stageScene.onRelease = (e)=>{ removeIndicator(e && e.pointerId); };
      bindStageControls();
    } else {
      applySample(sample);
    }
    stageScene.resize();
    stageScene.start();
    syncStagePanelToState();
  }

  function closeStage(){
    if(stageScene) stageScene.stop();
    stageView.style.display = 'none';
    homeView.style.display = 'block';
    document.body.classList.remove('stage-open');
    homeScenes.forEach(s=> s.scene.start());
  }
  document.getElementById('backToGallery').addEventListener('click', closeStage);

  const indicator = document.getElementById('indicator');
  indicator.remove(); // template only — real dots are cloned from it per pointer
  const indicatorPool = new Map(); // pointerId -> element
  function moveIndicator(pointerId, x, y){
    let el = indicatorPool.get(pointerId);
    if(!el){
      el = indicator.cloneNode(true);
      el.removeAttribute('id');
      el.style.display = 'block';
      document.getElementById('stage').appendChild(el);
      indicatorPool.set(pointerId, el);
    }
    el.style.left = x+'px';
    el.style.top = y+'px';
  }
  function removeIndicator(pointerId){
    const el = indicatorPool.get(pointerId);
    if(el){ el.remove(); indicatorPool.delete(pointerId); }
  }

  function bindStageControls(){
    // ---- colour ----
    const colorRow = document.getElementById('colorRow');
    const colorSectionLabel = document.getElementById('colorSectionLabel');
    const customColorInput = document.getElementById('customColor');

    function activePalette(){
      const hs = stageScene.state.hangStyle;
      if(hs === 'windchime') return WOOD_COLORS;
      if(hs === 'jewelcurtain') return JEWEL_COLORS;
      return COLORS;
    }

    window.renderColorRow = function renderColorRow(){
      colorSectionLabel.textContent = isChimeStyle(stageScene.state.hangStyle) ? t('section_material') : t('section_color');
      colorRow.innerHTML = '';
      activePalette().forEach(c=>{
        const el = document.createElement('div');
        el.className = 'swatch' + (c===stageScene.state.color ? ' active' : '');
        el.style.background = c.hex;
        el.title = c.name;
        el.addEventListener('click', ()=> selectColor(c));
        colorRow.appendChild(el);
      });
      customColorInput.value = stageScene.state.color.hex;
    };

    function selectColor(c){
      stageScene.setColor(c);
      document.querySelectorAll('.swatch').forEach(s=>s.classList.remove('active'));
      const idx = activePalette().indexOf(c);
      if(idx!==-1 && colorRow.children[idx]) colorRow.children[idx].classList.add('active');
      customColorInput.value = c.hex;
      syncGalleryActive();
    }
    renderColorRow();

    customColorInput.addEventListener('input', ()=>{
      const hex = customColorInput.value;
      const c = { name:'Custom', hex, thread: shade(hex) };
      stageScene.setColor(c);
      document.querySelectorAll('.swatch').forEach(s=>s.classList.remove('active'));
      syncGalleryActive();
    });
    function shade(hex){
      const {r,g,b} = hexToRgb(hex);
      const f = c => Math.max(0, Math.min(255, Math.round(c*0.7)));
      return `rgb(${f(r)},${f(g)},${f(b)})`;
    }

    // ---- pattern ----
    const patternRow = document.getElementById('patternRow');
    const patternChimeNote = document.getElementById('patternChimeNote');
    const patternKeys = { solid:'pattern_solid', stripe:'pattern_stripe', check:'pattern_check',
                           dot:'pattern_dot', krama:'pattern_krama', hol:'pattern_hol', pidan:'pattern_pidan',
                           phamuong:'pattern_phamuong', chorabap:'pattern_chorabap' };
    window.renderPatternRow = function renderPatternRow(){
      const isChime = isChimeStyle(stageScene.state.hangStyle);
      patternRow.style.display = isChime ? 'none' : '';
      patternChimeNote.style.display = isChime ? '' : 'none';
      patternChimeNote.textContent = t('pattern_chime_note');
      patternRow.innerHTML = '';
      PATTERNS.forEach(p=>{
        const el = document.createElement('button');
        el.className = 'pill' + (p===stageScene.state.pattern ? ' active' : '');
        el.dataset.i18n = patternKeys[p];
        el.textContent = t(patternKeys[p]);
        el.addEventListener('click', ()=> selectPattern(p));
        patternRow.appendChild(el);
      });
    };
    function selectPattern(p){
      stageScene.setPattern(p);
      document.querySelectorAll('#patternRow .pill').forEach(s=>s.classList.remove('active'));
      const idx = PATTERNS.indexOf(p);
      if(idx!==-1 && patternRow.children[idx]) patternRow.children[idx].classList.add('active');
      syncGalleryActive();
    }
    renderPatternRow();

    // ---- hang style ----
    const hangButtons = document.querySelectorAll('#typeSeg button, #typeSeg2 button, #typeSeg3 button, #typeSeg4 button, #typeSeg5 button, #typeSeg6 button');
    function selectHangStyle(styleKey){
      stageScene.setHangStyle(styleKey);
      hangButtons.forEach(b=> b.classList.toggle('active', b.dataset.type === styleKey));
      renderPatternRow();
      renderColorRow();
      syncGalleryActive();
    }
    hangButtons.forEach(btn=>{
      btn.addEventListener('click', ()=> selectHangStyle(btn.dataset.type));
    });

    // ---- sliders ----
    function bindSlider(id, key){
      const el = document.getElementById(id);
      el.addEventListener('input', ()=>{
        if(key==='scale') stageScene.setScale(parseFloat(el.value));
        else stageScene.setPhysics({ [key]: parseFloat(el.value) });
      });
    }
    bindSlider('stiffnessSlider','stiffness');
    bindSlider('windSlider','windMul');
    bindSlider('gravitySlider','gravity');
    bindSlider('scaleSlider','scale');

    // ---- gather/fold toggle ----
    const gatherToggle = document.getElementById('gatherToggle');
    gatherToggle.addEventListener('click', ()=>{
      const on = !gatherToggle.classList.contains('on');
      gatherToggle.classList.toggle('on', on);
      stageScene.setGatherMode(on);
    });

    // ---- ambient breeze ----
    const windToggle = document.getElementById('windToggle');
    windToggle.addEventListener('click', ()=>{
      stageScene.setWindOn(!stageScene.state.windOn);
      windToggle.classList.toggle('on', stageScene.state.windOn);
    });

    // ---- chime / bead sound ----
    const soundToggle = document.getElementById('soundToggle');
    soundToggle.classList.toggle('on', ChimeAudio.isEnabled());
    soundToggle.addEventListener('click', ()=>{
      ChimeAudio.setEnabled(!ChimeAudio.isEnabled());
      soundToggle.classList.toggle('on', ChimeAudio.isEnabled());
      syncSoundButtons();
    });

    // ---- backdrop ----
    document.querySelectorAll('#backdropSeg button').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        document.querySelectorAll('#backdropSeg button').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        document.body.classList.toggle('dark-backdrop', btn.dataset.backdrop==='dark');
      });
    });

    // ---- hanger rod toggle ----
    const hangerRod = document.getElementById('hangerRod');
    const hangerToggle = document.getElementById('hangerToggle');
    hangerToggle.addEventListener('click', ()=>{
      const on = !hangerToggle.classList.contains('on');
      hangerToggle.classList.toggle('on', on);
      hangerRod.style.display = on ? '' : 'none';
    });

    // ---- product tag ----
    const tagName = document.getElementById('tagName');
    const tagPrice = document.getElementById('tagPrice');
    const tagShowToggle = document.getElementById('tagShowToggle');
    const onCanvasTag = document.getElementById('onCanvasTag');
    const onCanvasTagName = document.getElementById('onCanvasTagName');
    const onCanvasTagPrice = document.getElementById('onCanvasTagPrice');
    function refreshTag(){
      onCanvasTagName.textContent = tagName.value || t('product_name_ph');
      onCanvasTagPrice.textContent = tagPrice.value || '';
      onCanvasTag.style.display = (stageScene.state.showTag && (tagName.value || tagPrice.value)) ? 'block' : 'none';
    }
    tagName.addEventListener('input', refreshTag);
    tagPrice.addEventListener('input', refreshTag);
    tagShowToggle.addEventListener('click', ()=>{
      stageScene.state.showTag = !stageScene.state.showTag;
      tagShowToggle.classList.toggle('on', stageScene.state.showTag);
      refreshTag();
    });

    // ---- reset / save ----
    document.getElementById('resetBtn').addEventListener('click', ()=>{
      stageScene.gatherMode = false;
      document.getElementById('gatherToggle').classList.remove('on');
      stageScene.applyHangStyle();
    });
    document.getElementById('saveBtn').addEventListener('click', ()=>{
      const link = document.createElement('a');
      link.download = 'soutr-preview.png';
      link.href = stageScene.toDataURL();
      link.click();
    });

    // ---- tabs ----
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

    // ---- auto-hide panel ----
    const panelWrap = document.getElementById('panelWrap');
    const panelHandle = document.getElementById('panelHandle');
    const panelScrim = document.getElementById('panelScrim');
    const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    let hideTimer = null;
    function openPanel(){ clearTimeout(hideTimer); document.body.classList.add('panel-open'); }
    function closePanelSoon(delay){ clearTimeout(hideTimer); hideTimer = setTimeout(()=> document.body.classList.remove('panel-open'), delay===undefined?350:delay); }
    function closePanelNow(){ clearTimeout(hideTimer); document.body.classList.remove('panel-open'); }
    if(canHover){
      panelWrap.addEventListener('mouseenter', openPanel);
      panelWrap.addEventListener('mouseleave', ()=> closePanelSoon());
    }
    panelHandle.addEventListener('click', ()=>{
      if(document.body.classList.contains('panel-open')) closePanelNow();
      else openPanel();
    });
    panelScrim.addEventListener('click', closePanelNow);

    // ---- shop-the-look gallery ----
    const galleryGrid = document.getElementById('galleryGrid');
    const galleryThumbCanvas = document.createElement('canvas');
    galleryThumbCanvas.width = 220; galleryThumbCanvas.height = 290;
    const gtx = galleryThumbCanvas.getContext('2d');

    function thumbFor(sample){
      const c = resolveColor(sample);
      if(sample.hangStyle==='windchime') drawWindChimeTexture(gtx, galleryThumbCanvas.width, galleryThumbCanvas.height, c);
      else if(sample.hangStyle==='jewelcurtain') drawJewelCurtainTexture(gtx, galleryThumbCanvas.width, galleryThumbCanvas.height, c);
      else drawFabricTexture(gtx, galleryThumbCanvas.width, galleryThumbCanvas.height, c, sample.pattern);
      return galleryThumbCanvas.toDataURL('image/jpeg', 0.85);
    }

    function sampleMatchesState(sample){
      return stageScene.state.hangStyle===sample.hangStyle &&
             (isChimeStyle(sample.hangStyle) ? true : stageScene.state.pattern===sample.pattern) &&
             stageScene.state.color === resolveColor(sample);
    }

    window.renderGallery = function renderGallery(){
      galleryGrid.innerHTML = '';
      GALLERY.forEach(sample=>{
        const el = document.createElement('div');
        el.className = 'gallery-card' + (sampleMatchesState(sample) ? ' active' : '');
        el.style.backgroundImage = `url(${thumbFor(sample)})`;

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
    };

    window.applySample = function applySample(sample){
      if(sample.pattern) stageScene.state.pattern = sample.pattern;
      stageScene.setHangStyle(sample.hangStyle);
      stageScene.setColor(resolveColor(sample));
      hangButtons.forEach(b=> b.classList.toggle('active', b.dataset.type === sample.hangStyle));
      renderPatternRow();
      renderColorRow();
      renderGallery();
    };

    window.syncGalleryActive = function syncGalleryActive(){
      document.querySelectorAll('.gallery-card').forEach((el, i)=>{
        el.classList.toggle('active', sampleMatchesState(GALLERY[i]));
      });
    };

    renderGallery();
  }

  function syncStagePanelToState(){
    document.querySelectorAll('#typeSeg button, #typeSeg2 button, #typeSeg3 button, #typeSeg4 button, #typeSeg5 button, #typeSeg6 button')
      .forEach(b=> b.classList.toggle('active', b.dataset.type === stageScene.state.hangStyle));
    if(window.renderColorRow) renderColorRow();
    if(window.renderPatternRow) renderPatternRow();
    if(window.renderGallery) renderGallery();
  }

  document.addEventListener('lang-changed', ()=>{
    homeScenes.forEach(({ sample }, i) => {
      const card = homeGrid.children[i];
      if(!card) return;
      const label = card.querySelector('.home-card-label');
      if(label) label.textContent = t(sample.key);
      const openBtn = card.querySelector('.home-card-open');
      if(openBtn) openBtn.textContent = t('home_open');
    });
    if(stageScene){
      if(window.renderPatternRow) renderPatternRow();
      if(window.renderColorRow) renderColorRow();
      if(window.renderGallery) renderGallery();
    }
  });

  // ---- sound mute buttons (home header + stage header) ----
  function syncSoundButtons(){
    const on = ChimeAudio.isEnabled();
    document.querySelectorAll('.sound-btn').forEach(b=> b.classList.toggle('muted', !on));
    const soundToggle = document.getElementById('soundToggle');
    if(soundToggle) soundToggle.classList.toggle('on', on);
  }
  document.querySelectorAll('.sound-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      ChimeAudio.setEnabled(!ChimeAudio.isEnabled());
      syncSoundButtons();
    });
  });
  syncSoundButtons();

  // language init (affects both home and, once built, stage strings)
  document.querySelectorAll('.lang-btn').forEach(btn=>{
    btn.addEventListener('click', ()=> setLang(btn.dataset.lang));
  });
  applyTranslations();
  setLang(currentLang);

})();
