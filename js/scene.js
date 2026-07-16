/**
 * scene.js — a self-contained live preview: one WebGL context, one cloth
 * (or, for the wind-chime hang style, a small group of independent narrow
 * strands), driven by the same Verlet solver in cloth.js. Used both for the
 * big interactive stage and for the small auto-animating homepage cards, so
 * all the GL boilerplate and drag/pick logic lives in exactly one place.
 */

const HANG_STYLES = {
  curtain:          { width:3.0, height:6.0, offsetY:3.0, pinMode:'top-row',    camY:-2.0, camZ:8.5 },
  swatch:           { width:3.6, height:4.6, offsetY:1.6, pinMode:'corners',    camY:-0.8, camZ:8.0 },
  krama:            { width:1.3, height:7.2, offsetY:3.4, pinMode:'center-pair',camY:-1.6, camZ:9.2 },
  sampot:           { width:5.2, height:3.4, offsetY:1.4, pinMode:'top-row',    camY:-0.4, camZ:9.8 },
  chongkraben:      { width:2.2, height:6.4, offsetY:3.0, pinMode:'top-row',    camY:-1.4, camZ:8.8 },
  sbai:             { width:1.8, height:5.6, offsetY:2.7, pinMode:'center-pair',camY:-1.0, camZ:8.6 },
  sarong:           { width:4.2, height:3.0, offsetY:1.3, pinMode:'top-row',    camY:-0.2, camZ:8.6 },
  chongkraben_royal:{ width:2.8, height:6.8, offsetY:3.2, pinMode:'top-row',    camY:-1.5, camZ:9.6 },
  sbai_wedding:     { width:2.3, height:7.0, offsetY:3.4, pinMode:'center-pair',camY:-1.4, camZ:9.8 },
  windchime:        { chime:true, strands:13, strandWidth:0.15, spread:4.8, height:6.2,
                       offsetY:3.2, camY:-0.6, camZ:11.2, sound:'wood' },
  jewelcurtain:     { chime:true, strands:9, strandWidth:0.32, spread:4.8, height:6.6,
                       offsetY:3.3, camY:-0.6, camZ:11.2, sound:'crystal' },
};

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

function createShader(gl, type, src){
  const s = gl.createShader(type);
  gl.shaderSource(s,src); gl.compileShader(s);
  if(!gl.getShaderParameter(s, gl.COMPILE_STATUS)){ console.error(gl.getShaderInfoLog(s)); return null; }
  return s;
}

function setPerspective(out, fovy, aspect, near, far){
  const f = 1.0/Math.tan(fovy/2), nf = 1/(near-far);
  out.fill(0);
  out[0]=f/aspect; out[5]=f; out[10]=(far+near)*nf; out[11]=-1; out[14]=(2*far*near)*nf;
}
function setTranslation(out,x,y,z){
  out.fill(0); out[0]=1; out[5]=1; out[10]=1; out[15]=1; out[12]=x; out[13]=y; out[14]=z;
}

class FabricScene {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {Object} opts
   *   color, pattern, hangStyle — initial look
   *   interactive — whether pointer drag/grab is wired up (true for the
   *     stage and, more gently, for the homepage cards too)
   *   autoWind — keep a gentle ambient breeze animating even with no user
   *     input (used on homepage cards so they never sit still)
   */
  constructor(canvas, opts){
    this.canvas = canvas;
    this.state = {
      color: opts.color,
      pattern: opts.pattern || 'solid',
      hangStyle: opts.hangStyle || 'curtain',
      stiffness: 0.9, windMul: 1.0, gravity: 0.007, scale: 1.0,
      windOn: true, showTag: false,
    };
    this.interactive = opts.interactive !== false;
    this.autoWind = !!opts.autoWind;

    this.gl = canvas.getContext('webgl', { antialias:true, alpha:true, preserveDrawingBuffer:true });
    if(!this.gl){ return; }
    const gl = this.gl;

    this.program = gl.createProgram();
    gl.attachShader(this.program, createShader(gl, gl.VERTEX_SHADER, vsSource));
    gl.attachShader(this.program, createShader(gl, gl.FRAGMENT_SHADER, fsSource));
    gl.linkProgram(this.program);
    gl.useProgram(this.program);

    this.aPos = gl.getAttribLocation(this.program,'a_pos');
    this.aNorm = gl.getAttribLocation(this.program,'a_norm');
    this.aUv = gl.getAttribLocation(this.program,'a_uv');
    this.uProj = gl.getUniformLocation(this.program,'u_proj');
    this.uView = gl.getUniformLocation(this.program,'u_view');

    this.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    this.texCanvas = document.createElement('canvas');
    this.texCanvas.width = 512; this.texCanvas.height = 512;
    this.tctx = this.texCanvas.getContext('2d');

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    this.camPos = { x:0, y:0, z:0 };
    this.fov = 45*Math.PI/180;
    this.projMatrix = new Float32Array(16);
    this.viewMatrix = new Float32Array(16);
    this.aspect = 1;

    // Strands share one grid topology (uv + index buffer) since every
    // strand mesh has the same numX/numY — only positions differ.
    this.strandNumX = 4; this.strandNumY = 18;
    this.clothNumX = 26; this.clothNumY = 42;

    this.meshes = []; // [{ cloth, posBuf, normBuf, uvBuf, idxBuf, windPhase }]
    this.time = Math.random()*10;
    this.running = false;
    this._hasPointerOver = false;
    this.zoomLevel = 1;
    this.gatherMode = false;
    this._pinchPoints = new Map(); // pointerId -> { clientX, clientY }
    this._lastPinchDist = null;
    // Multi-touch: one entry per active pointer, so two fingers (or a
    // mouse plus a touch) can each grab and drag a different point at once.
    this._pointers = new Map(); // pointerId -> { meshIndex, particleIndex }
    this._lastTipX = null; // per-mesh previous tip x, for chime "clink" detection

    this._buildMeshesFor(this.state.hangStyle);
    this.resize();
    this.applyHangStyle();
    this.updateTexture();

    if(this.interactive){
      this._eventController = new AbortController();
      this._bindPointerEvents();
      this._bindZoom();
    }
  }

  _makeMeshBuffers(numX, numY){
    const gl = this.gl;
    const cloth = new ClothSim(numX, numY);
    const posBuf = gl.createBuffer();
    const normBuf = gl.createBuffer();
    const uvBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
    gl.bufferData(gl.ARRAY_BUFFER, cloth.uvData, gl.STATIC_DRAW);
    const idxBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(cloth.indices), gl.STATIC_DRAW);
    return { cloth, posBuf, normBuf, uvBuf, idxBuf, windPhase: Math.random()*10 };
  }

  _buildMeshesFor(hangStyleKey){
    const L = HANG_STYLES[hangStyleKey];
    const wantCount = L.chime ? L.strands : 1;
    if(this.meshes.length === wantCount) return; // topology unchanged
    this.meshes = [];
    if(L.chime){
      for(let i=0;i<L.strands;i++){
        this.meshes.push(this._makeMeshBuffers(this.strandNumX, this.strandNumY));
      }
    } else {
      this.meshes.push(this._makeMeshBuffers(this.clothNumX, this.clothNumY));
    }
  }

  resize(){
    const gl = this.gl;
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio||1, 2);
    const w = Math.max(1, Math.round(rect.width*dpr));
    const h = Math.max(1, Math.round(rect.height*dpr));
    if(this.canvas.width!==w || this.canvas.height!==h){
      this.canvas.width = w; this.canvas.height = h;
    }
    gl.viewport(0,0,this.canvas.width, this.canvas.height);
    this.aspect = this.canvas.width / this.canvas.height;
  }

  applyHangStyle(){
    const L = HANG_STYLES[this.state.hangStyle];
    this._buildMeshesFor(this.state.hangStyle);
    if(L.chime){
      const spread = L.spread * this.state.scale;
      this.meshes.forEach((m,i)=>{
        const cx = L.strands>1 ? (i/(L.strands-1)-0.5)*spread : 0;
        // deterministic per-strand jitter (stable across resets) so the
        // curtain hangs with natural, uneven lengths like real strung beads
        const jitter = 1 + (Math.sin(i*12.9898)*0.5) * 0.09;
        m.cloth.reset({
          width: L.strandWidth * this.state.scale,
          height: L.height * this.state.scale * jitter,
          offsetY: L.offsetY,
          pinMode: 'top-row',
          centerX: cx,
        });
      });
    } else {
      const m = this.meshes[0];
      m.cloth.reset({
        width: L.width * this.state.scale,
        height: L.height * this.state.scale,
        offsetY: L.offsetY,
        pinMode: L.pinMode,
      });
    }
    this.meshes.forEach(m => m.cloth.releaseFolds());
    this._baseCamY = L.camY;
    this._baseCamZ = L.camZ;
    this.camPos.y = this._baseCamY;
    this.camPos.z = this._baseCamZ / this.zoomLevel;
  }

  updateTexture(){
    const style = this.state.hangStyle;
    if(style === 'windchime') drawWindChimeTexture(this.tctx, this.texCanvas.width, this.texCanvas.height, this.state.color);
    else if(style === 'jewelcurtain') drawJewelCurtainTexture(this.tctx, this.texCanvas.width, this.texCanvas.height, this.state.color);
    else drawFabricTexture(this.tctx, this.texCanvas.width, this.texCanvas.height, this.state.color, this.state.pattern);
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.texCanvas);
  }

  setColor(c){ this.state.color = c; this.updateTexture(); }
  setPattern(p){ this.state.pattern = p; this.updateTexture(); }
  setHangStyle(key){
    this.state.hangStyle = key;
    this._pointers.clear();
    this.zoomLevel = 1;
    this.meshes.forEach(m => m.cloth.releaseFolds());
    this.applyHangStyle();
    this.updateTexture();
    this.setZoom(1);
  }
  setGatherMode(v){ this.gatherMode = !!v; if(!v) this.meshes.forEach(m => m.cloth.releaseFolds()); }
  setScale(v){ this.state.scale = v; this.applyHangStyle(); }
  setPhysics(p){ Object.assign(this.state, p); }
  setWindOn(v){ this.state.windOn = v; }

  // ---------------- pointer interaction (multi-touch) ----------------
  // Every pointer (mouse, pen, or a single finger in a multi-touch gesture)
  // is tracked independently by its pointerId, each with its own ray and
  // its own grabbed particle. That's what lets two fingers grab two
  // different points of the same curtain/chime at once and stretch it,
  // the way you'd push through a real beaded doorway curtain with both hands.
  _bindPointerEvents(){
    const canvas = this.canvas;
    canvas.style.touchAction = 'none';
    const rayFromClient = (clientX, clientY)=>{
      const rect = canvas.getBoundingClientRect();
      const px = ((clientX-rect.left)/rect.width)*2 - 1;
      const py = -((clientY-rect.top)/rect.height)*2 + 1;
      const tanFov = Math.tan(this.fov/2);
      const dx = px*this.aspect*tanFov, dy = py*tanFov, dz = -1;
      const len = Math.sqrt(dx*dx+dy*dy+dz*dz);
      return { origin:{x:this.camPos.x,y:this.camPos.y,z:this.camPos.z}, dir:{x:dx/len,y:dy/len,z:dz/len} };
    };
    const sig = { signal: this._eventController.signal };
    canvas.addEventListener('pointerenter', ()=> this._hasPointerOver = true, sig);
    const release = e=>{
      this._pinchPoints.delete(e.pointerId);
      this._lastPinchDist = null;
      const entry = this._pointers.get(e.pointerId);
      if(entry){
        const m = this.meshes[entry.meshIndex];
        if(this.gatherMode && this._pointers.size >= 2){
          const releasedP = m.cloth.particles[entry.particleIndex];
          let closestIdx = -1, closestD = Infinity;
          this._pointers.forEach((other, pid)=>{
            if(pid === e.pointerId) return;
            const p = m.cloth.particles[other.particleIndex];
            const dx=releasedP.x-p.x, dy=releasedP.y-p.y, dz=releasedP.z-p.z;
            const d = dx*dx+dy*dy+dz*dz;
            if(d<closestD){ closestD=d; closestIdx=other.particleIndex; }
          });
          if(closestIdx !== -1 && closestD < 0.5){
            m.cloth.foldTo(entry.particleIndex, closestIdx);
          }
        }
        m.cloth.release(entry.particleIndex);
        this._pointers.delete(e.pointerId);
        if(this.onRelease) this.onRelease(e);
      }
    };
    canvas.addEventListener('pointerdown', e=>{
      this._pinchPoints.set(e.pointerId, { clientX:e.clientX, clientY:e.clientY });
      const ray = rayFromClient(e.clientX, e.clientY);
      let bestDist = Infinity, bestMesh = -1, bestIdx = -1;
      const candidates = [];
      this.meshes.forEach((m, mi)=>{
        const idx = m.cloth.pick(ray, 1.0);
        if(idx!==-1){
          const p = m.cloth.particles[idx];
          const dx=p.x-ray.origin.x, dy=p.y-ray.origin.y, dz=p.z-ray.origin.z;
          const d = dx*dx+dy*dy+dz*dz;
          candidates.push({ mi, idx });
          if(d<bestDist){ bestDist=d; bestMesh=mi; bestIdx=idx; }
        }
      });
      // pick() provisionally grabs every candidate it touches — release
      // every candidate that isn't the one closest to the pointer.
      candidates.forEach(c=>{ if(!(c.mi===bestMesh && c.idx===bestIdx)) this.meshes[c.mi].cloth.release(c.idx); });
      if(bestMesh!==-1){
        this._pointers.set(e.pointerId, { meshIndex:bestMesh, particleIndex:bestIdx });
        canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
        if(window.ChimeAudio && HANG_STYLES[this.state.hangStyle].chime) ChimeAudio.pluck(this.state.hangStyle, bestMesh, 0.6);
        if(this.onGrab) this.onGrab(e);
      } else if(this._pinchPoints.size >= 2 && this._pointers.size === 0){
        // two-finger pinch on empty space
        this._lastPinchDist = null;
      }
    }, sig);
    canvas.addEventListener('pointermove', e=>{
      this._hasPointerOver = true;
      // Update pinch tracking
      this._pinchPoints.set(e.pointerId, { clientX:e.clientX, clientY:e.clientY });
      // Check for pinch-to-zoom (2+ pointers, none grabbing particles)
      if(this._pinchPoints.size >= 2 && this._pointers.size === 0){
        const pts = Array.from(this._pinchPoints.values());
        const dx = pts[0].clientX-pts[1].clientX;
        const dy = pts[0].clientY-pts[1].clientY;
        const dist = Math.sqrt(dx*dx+dy*dy);
        if(this._lastPinchDist !== null && dist > 0){
          const ratio = this._lastPinchDist / dist;
          this.setZoom(this.zoomLevel * ratio);
        }
        this._lastPinchDist = dist;
      }
      const entry = this._pointers.get(e.pointerId);
      if(entry){
        const ray = rayFromClient(e.clientX, e.clientY);
        const m = this.meshes[entry.meshIndex];
        if(this.gatherMode){
          m.cloth.gatherTo(entry.particleIndex, ray, 1.2);
        } else {
          m.cloth.dragTo(entry.particleIndex, ray);
        }
        if(this.onDrag) this.onDrag(e);
      }
    }, sig);
    const onPointerLeave = e=>{
      this._hasPointerOver = false;
      this._pinchPoints.delete(e.pointerId);
      this._lastPinchDist = null;
      release(e);
    };
    canvas.addEventListener('pointerup', release, sig);
    canvas.addEventListener('pointercancel', (e)=>{
      this._pinchPoints.delete(e.pointerId);
      this._lastPinchDist = null;
      release(e);
    }, sig);
    canvas.addEventListener('pointerleave', onPointerLeave, sig);
  }

  _bindZoom(){
    const canvas = this.canvas;
    canvas.addEventListener('wheel', e=>{
      e.preventDefault();
      this.setZoom(this.zoomLevel - e.deltaY * 0.0015);
    }, { signal: this._eventController.signal, passive: false });
  }

  _syncHangerRod(){
    const rod = document.getElementById('hangerRod');
    if(!rod || rod.style.display === 'none') return;
    if(!this.canvas.closest('#stage')) return;
    const L = HANG_STYLES[this.state.hangStyle];
    if(!L) return;
    const ft = Math.tan(this.fov/2);
    const topY = L.offsetY * this.state.scale;
    const vy = topY - this.camPos.y;
    const ndcY = vy / (ft * this.camPos.z);
    const canvasH = this.canvas.height;
    const dpr = Math.min(window.devicePixelRatio||1, 2);
    const screenY = (1 - ndcY) / 2 * (canvasH / dpr);
    const meshHalfW = L.width * this.state.scale / 2;
    const ndcRight = meshHalfW / (ft * this.camPos.z);
    const screenW = ndcRight * this.canvas.clientWidth;
    const zoom = this.zoomLevel;
    const frameRod = rod.querySelector('.frame-rod');
    if(frameRod) frameRod.style.width = (screenW / zoom) + 'px';
    rod.style.top = screenY + 'px';
    rod.style.transform = 'scale(' + zoom + ')';
  }

  setZoom(level){
    this.zoomLevel = Math.max(0.5, Math.min(2.5, level));
    this.camPos.z = this._baseCamZ / this.zoomLevel;
    this._syncHangerRod();
  }

  // ---------------- render loop ----------------
  start(){
    if(this.running) return;
    this.running = true;
    const loop = ()=>{
      if(!this.running) return;
      this._frame();
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }
  stop(){
    this.running = false;
    if(this._raf) cancelAnimationFrame(this._raf);
  }

  _frame(){
    this.time += 0.016;
    const gl = this.gl;
    this.resize();

    const windMul = (this.state.windOn || this.autoWind) ? Math.max(this.state.windMul, this.autoWind?0.55:0) : 0;

    gl.clearColor(0,0,0,0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    setPerspective(this.projMatrix, this.fov, this.aspect, 0.1, 100.0);
    setTranslation(this.viewMatrix, -this.camPos.x, -this.camPos.y, -this.camPos.z);
    gl.uniformMatrix4fv(this.uProj, false, this.projMatrix);
    gl.uniformMatrix4fv(this.uView, false, this.viewMatrix);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);

    const L = HANG_STYLES[this.state.hangStyle];
    const isChimeScene = !!L.chime;

    this.meshes.forEach((m,mi)=>{
      const t = this.time + m.windPhase;
      const windX = Math.sin(t*1.5)*0.0015*windMul;
      const windZ = Math.cos(t*1.1)*0.0015*windMul;
      m.cloth.step({
        gravity: this.state.gravity,
        damping: 0.985,
        windX, windZ,
        iterations: 15,
        stiffness: this.state.stiffness,
      });

      // Chime "clink" sound: watch the bottom-most particle of each strand
      // and fire a bell/bead pluck whenever its swing speed crosses a
      // threshold, whether that swing came from wind, gravity settling, or
      // a finger flicking it — same as a real chime only sounding when it
      // actually moves fast enough to strike its neighbour.
      if(isChimeScene && window.ChimeAudio && (this._hasPointerOver || this._pointers.size > 0)){
        const tipIdx = m.cloth.numParticles - Math.ceil(m.cloth.numX/2);
        const tip = m.cloth.particles[tipIdx];
        if(m._lastTipX === undefined){ m._lastTipX = tip.x; m._lastTipZ = tip.z; m._chimeCooldown = 0; }
        const vx = tip.x - m._lastTipX, vz = tip.z - m._lastTipZ;
        const speed = Math.sqrt(vx*vx+vz*vz);
        m._lastTipX = tip.x; m._lastTipZ = tip.z;
        m._chimeCooldown = Math.max(0, m._chimeCooldown - 0.016);
        const threshold = L.sound==='crystal' ? 0.012 : 0.016;
        if(speed > threshold && m._chimeCooldown <= 0){
          ChimeAudio.pluck(this.state.hangStyle, mi, Math.min(1, speed*18));
          m._chimeCooldown = 0.09 + Math.random()*0.1;
        }
      }

      gl.bindBuffer(gl.ARRAY_BUFFER, m.posBuf);
      gl.bufferData(gl.ARRAY_BUFFER, m.cloth.posData, gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, m.normBuf);
      gl.bufferData(gl.ARRAY_BUFFER, m.cloth.normalData, gl.DYNAMIC_DRAW);
    });

    gl.enableVertexAttribArray(this.aPos);
    gl.enableVertexAttribArray(this.aNorm);
    gl.enableVertexAttribArray(this.aUv);
    this.meshes.forEach(m=>{
      gl.bindBuffer(gl.ARRAY_BUFFER, m.posBuf);
      gl.vertexAttribPointer(this.aPos,3,gl.FLOAT,false,0,0);
      gl.bindBuffer(gl.ARRAY_BUFFER, m.normBuf);
      gl.vertexAttribPointer(this.aNorm,3,gl.FLOAT,false,0,0);
      gl.bindBuffer(gl.ARRAY_BUFFER, m.uvBuf);
      gl.vertexAttribPointer(this.aUv,2,gl.FLOAT,false,0,0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.idxBuf);
      gl.drawElements(gl.TRIANGLES, m.cloth.indices.length, gl.UNSIGNED_SHORT, 0);
    });
    this._syncHangerRod();
  }

  toDataURL(){ return this.canvas.toDataURL('image/png'); }

  destroy(){
    this.stop();
    this._eventController?.abort();
    const gl = this.gl;
    if(!gl) return;
    this.meshes.forEach(m=>{
      gl.deleteBuffer(m.posBuf); gl.deleteBuffer(m.normBuf);
      gl.deleteBuffer(m.uvBuf); gl.deleteBuffer(m.idxBuf);
    });
    gl.deleteTexture(this.tex);
    gl.deleteProgram(this.program);
  }
}
