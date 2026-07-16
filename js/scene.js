/**
 * scene.js — a self-contained live preview: one WebGL context, one cloth
 * (or, for the wind-chime hang style, a small group of independent narrow
 * strands), driven by the same Verlet solver in cloth.js. Used both for the
 * big interactive stage and for the small auto-animating homepage cards, so
 * all the GL boilerplate and drag/pick logic lives in exactly one place.
 */

const HANG_STYLES = {
  curtain:          { width:3.0, height:6.0, offsetY:3.0, pinMode:'top-row',    camY:-2.0, camZ:8.5, hasRod:true, grommetCount:12, rodOffsetY:0.05 },
  swatch:           { width:3.6, height:4.6, offsetY:1.6, pinMode:'corners',    camY:-0.8, camZ:8.0, hasRod:false },
  krama:            { width:1.3, height:7.2, offsetY:3.4, pinMode:'center-pair',camY:-1.6, camZ:9.2, hasRod:false },
  sampot:           { width:5.2, height:3.4, offsetY:1.4, pinMode:'top-row',    camY:-0.4, camZ:9.8, hasRod:false },
  chongkraben:      { width:2.2, height:6.4, offsetY:3.0, pinMode:'top-row',    camY:-1.4, camZ:8.8, hasRod:false },
  sbai:             { width:1.8, height:5.6, offsetY:2.7, pinMode:'center-pair',camY:-1.0, camZ:8.6, hasRod:false },
  sarong:           { width:4.2, height:3.0, offsetY:1.3, pinMode:'top-row',    camY:-0.2, camZ:8.6, hasRod:false },
  chongkraben_royal:{ width:2.8, height:6.8, offsetY:3.2, pinMode:'top-row',    camY:-1.5, camZ:9.6, hasRod:false },
  sbai_wedding:     { width:2.3, height:7.0, offsetY:3.4, pinMode:'center-pair',camY:-1.4, camZ:9.8, hasRod:false },
  windchime:        { chime:true, strands:13, strandWidth:0.15, spread:4.8, height:6.2,
                        offsetY:3.2, camY:-0.6, camZ:11.2, sound:'wood', hasRod:false },
  jewelcurtain:     { chime:true, strands:9, strandWidth:0.32, spread:4.8, height:6.6,
                        offsetY:3.3, camY:-0.6, camZ:11.2, sound:'crystal', hasRod:false },
};

const vsSource = `
  attribute vec3 a_pos;
  attribute vec3 a_norm;
  attribute vec2 a_uv;
  uniform mat4 u_proj;
  uniform mat4 u_view;
  uniform mat4 u_model;
  uniform float u_time;
  varying vec3 v_norm;
  varying vec2 v_uv;
  varying vec3 v_worldPos;
  void main(){
    vec4 worldPos = u_model * vec4(a_pos, 1.0);
    v_worldPos = worldPos.xyz;
    v_norm = mat3(u_model) * a_norm;
    v_uv = a_uv;
    gl_Position = u_proj * u_view * worldPos;
  }`;
const fsSource = `
  precision mediump float;
  varying vec3 v_norm;
  varying vec2 v_uv;
  varying vec3 v_worldPos;
  uniform sampler2D u_tex;
  uniform vec3 u_color;
  uniform float u_metalness;
  uniform float u_roughness;
  uniform float u_time;
  void main(){
    vec3 norm = normalize(v_norm);
    if(!gl_FrontFacing) norm = -norm;
    vec3 lightDir1 = normalize(vec3(0.35,0.85,0.55));
    vec3 lightDir2 = normalize(vec3(-0.5,-0.15,0.75));
    float diff1 = max(dot(norm,lightDir1),0.0);
    float diff2 = max(dot(norm,lightDir2),0.0);
    float ambient = 0.45;
    vec4 texColor = texture2D(u_tex, v_uv);
    vec3 baseColor = texColor.rgb;
    // Use u_color for metallic objects, texture for cloth
    vec3 albedo = u_metalness > 0.5 ? u_color : baseColor;
    vec3 finalColor;
    if(u_metalness > 0.5){
      // Metallic rod/grommet - PBR-like
      vec3 F0 = mix(vec3(0.04), u_color, u_metalness);
      vec3 viewDir = normalize(-v_worldPos);
      vec3 halfDir = normalize(lightDir1 + viewDir);
      float NdotH = max(dot(norm, halfDir), 0.0);
      float NdotV = max(dot(norm, viewDir), 0.0);
      float NdotL = max(dot(norm, lightDir1), 0.0);
      float roughness = max(u_roughness, 0.04);
      float roughness2 = roughness * roughness;
      float NdotH2 = NdotH * NdotH;
      float denom = NdotH2 * (roughness2 - 1.0) + 1.0;
      float D = roughness2 / (3.14159 * denom * denom);
      float G = min(1.0, min(2.0 * NdotH * NdotV / max(NdotH, 0.001), 2.0 * NdotH * NdotL / max(NdotH, 0.001)));
      vec3 F = F0 + (1.0 - F0) * pow(1.0 - NdotH, 5.0);
      vec3 specular = D * G * F / (4.0 * NdotV * NdotL + 0.001);
      vec3 diffuse = (1.0 - F) * albedo / 3.14159;
      finalColor = (diffuse + specular) * (ambient + diff1 * 0.5 + diff2 * 0.3) * 1.2;
      // Add subtle rim light for rod
      float rim = pow(1.0 - max(dot(norm, viewDir), 0.0), 3.0);
      finalColor += vec3(1.0, 0.85, 0.6) * rim * 0.15;
    } else {
      // Fabric
      finalColor = albedo * (ambient + diff1 * 0.42 + diff2 * 0.22);
      // Subtle fresnel for fabric edges
      float fresnel = pow(1.0 - max(dot(norm, normalize(-v_worldPos)), 0.0), 3.0);
      finalColor += vec3(1.0, 0.95, 0.85) * fresnel * 0.08;
    }
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
      showRod: true, // new: toggle for rod visibility
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
    this.uModel = gl.getUniformLocation(this.program,'u_model');
    this.uTime = gl.getUniformLocation(this.program,'u_time');
    this.uColor = gl.getUniformLocation(this.program,'u_color');
    this.uMetalness = gl.getUniformLocation(this.program,'u_metalness');
    this.uRoughness = gl.getUniformLocation(this.program,'u_roughness');

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
    this.modelMatrix = new Float32Array(16);
    this.aspect = 1;

    this.strandNumX = 4; this.strandNumY = 18;
    this.clothNumX = 26; this.clothNumY = 42;

    this.meshes = [];
    this.rodMesh = null;
    this.grommetMeshes = [];
    this.time = Math.random()*10;
    this.running = false;
    this._hasPointerOver = false;
    this.zoomLevel = 1;
    this.gatherMode = false;
    this._pinchPoints = new Map();
    this._lastPinchDist = null;
    this._pointers = new Map();
    this._lastTipX = null;

    // Cursor wind burst for doorway wave effect
    this.cursorWindX = 0;
    this.cursorWindZ = 0;
    this._lastCursorX = null;
    this._lastCursorY = null;
    this.cursorWindEnabled = true;
    this.cursorWindStrength = 1.0;

    // Mouse parallax / hover effect state
    this.mouseX = 0;
    this.mouseY = 0;
    this.targetMouseX = 0;
    this.targetMouseY = 0;
    this.cameraSwayX = 0;
    this.cameraSwayY = 0;

    this._buildMeshesFor(this.state.hangStyle);
    this._buildRodAndGrommets();
    this.resize();
    this.applyHangStyle();
    this.updateTexture();

    if(this.interactive){
      this._eventController = new AbortController();
      this._bindPointerEvents();
      this._bindZoom();
      this._bindMouseMove();
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

  _buildRodAndGrommets(){
    const gl = this.gl;
    // Rod: cylinder with vertices on the surface
    const rodSegments = 24;
    const rodVerts = [];
    const rodNorms = [];
    const rodUvs = [];
    const rodIndices = [];
    for(let i=0;i<=rodSegments;i++){
      const theta = (i/rodSegments)*Math.PI*2;
      const cx = Math.cos(theta), cz = Math.sin(theta);
      // Top rim
      rodVerts.push(cx, 0.5, cz);
      rodNorms.push(cx, 0, cz);
      rodUvs.push(i/rodSegments, 0);
      // Bottom rim
      rodVerts.push(cx, -0.5, cz);
      rodNorms.push(cx, 0, cz);
      rodUvs.push(i/rodSegments, 1);
    }
    for(let i=0;i<rodSegments;i++){
      const a = i*2, b = i*2+1, c = ((i+1)%rodSegments)*2, d = ((i+1)%rodSegments)*2+1;
      rodIndices.push(a, b, c, c, b, d);
    }
    const rodPosBuf = gl.createBuffer();
    const rodNormBuf = gl.createBuffer();
    const rodUvBuf = gl.createBuffer();
    const rodIdxBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, rodPosBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(rodVerts), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, rodNormBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(rodNorms), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, rodUvBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(rodUvs), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, rodIdxBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(rodIndices), gl.STATIC_DRAW);
    this.rodMesh = { posBuf:rodPosBuf, normBuf:rodNormBuf, uvBuf:rodUvBuf, idxBuf:rodIdxBuf, indexCount:rodIndices.length };

    // Grommet: torus (ring)
    const gromMajor = 8, gromMinor = 6;
    const gromVerts = [], gromNorms = [], gromUvs = [], gromIndices = [];
    for(let i=0;i<=gromMajor;i++){
      const phi = (i/gromMajor)*Math.PI*2;
      for(let j=0;j<=gromMinor;j++){
        const theta = (j/gromMinor)*Math.PI*2;
        const cx = Math.cos(phi), sx = Math.sin(phi);
        const cy = Math.cos(theta), sy = Math.sin(theta);
        const r = 0.06, R = 0.1;
        const x = (R + r*cy)*cx;
        const y = r*sy;
        const z = (R + r*cy)*sx;
        const nx = r*cy*cx, ny = r*sy, nz = r*cy*sx;
        gromVerts.push(x, y, z);
        gromNorms.push(nx, ny, nz);
        gromUvs.push(i/gromMajor, j/gromMinor);
      }
    }
    for(let i=0;i<gromMajor;i++){
      for(let j=0;j<gromMinor;j++){
        const a = i*(gromMinor+1)+j;
        const b = a+1;
        const c = ((i+1)%gromMajor)*(gromMinor+1)+j;
        const d = c+1;
        gromIndices.push(a, b, c, c, b, d);
      }
    }
    const gromPosBuf = gl.createBuffer();
    const gromNormBuf = gl.createBuffer();
    const gromUvBuf = gl.createBuffer();
    const gromIdxBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, gromPosBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(gromVerts), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, gromNormBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(gromNorms), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, gromUvBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(gromUvs), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gromIdxBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(gromIndices), gl.STATIC_DRAW);
    this.grommetMesh = { posBuf:gromPosBuf, normBuf:gromNormBuf, uvBuf:gromUvBuf, idxBuf:gromIdxBuf, indexCount:gromIndices.length };
  }

  _buildMeshesFor(hangStyleKey){
    const L = HANG_STYLES[hangStyleKey];
    const wantCount = L.chime ? L.strands : 1;
    if(this.meshes.length === wantCount) return;
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
      // Build grommets at top row positions
      this._updateGrommetPositions(m, L);
    }
    this.meshes.forEach(m => m.cloth.releaseFolds());
    this._baseCamY = L.camY;
    this._baseCamZ = L.camZ;
    this.camPos.y = this._baseCamY;
    this.camPos.z = this._baseCamZ / this.zoomLevel;
  }

  _updateGrommetPositions(m, L){
    const numX = m.cloth.numX;
    const count = L.grommetCount || 12;
    this.grommetPositions = [];
    for(let i=0;i<count;i++){
      const xFrac = i / (count - 1);
      const xIdx = Math.floor(xFrac * (numX - 1));
      this.grommetPositions.push({ x:m.cloth.particles[xIdx].x, y:0, z:0 });
    }
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
  setShowRod(v){ this.state.showRod = v; }
  setCursorWindEnabled(v){ this.cursorWindEnabled = !!v; }
  setCursorWindStrength(v){ this.cursorWindStrength = Math.max(0, v); }

  // ---------------- pointer interaction (multi-touch) ----------------
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
      candidates.forEach(c=>{ if(!(c.mi===bestMesh && c.idx===bestIdx)) this.meshes[c.mi].cloth.release(c.idx); });
      if(bestMesh!==-1){
        this._pointers.set(e.pointerId, { meshIndex:bestMesh, particleIndex:bestIdx });
        canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
        if(window.ChimeAudio && HANG_STYLES[this.state.hangStyle].chime) ChimeAudio.pluck(this.state.hangStyle, bestMesh, 0.6);
        if(this.onGrab) this.onGrab(e);
      } else if(this._pinchPoints.size >= 2 && this._pointers.size === 0){
        this._lastPinchDist = null;
      }
    }, sig);
    canvas.addEventListener('pointermove', e=>{
      this._hasPointerOver = true;

      // --- Cursor wind burst (doorway auto-wave) ---
      if(this.cursorWindEnabled && this._lastCursorX !== null && this._lastCursorY !== null){
        const dx = e.clientX - this._lastCursorX;
        const dy = e.clientY - this._lastCursorY;
        const speed = Math.min(10, Math.sqrt(dx*dx + dy*dy));
        if(speed > 0.5){
          const rect = this.canvas.getBoundingClientRect();
          const px = (e.clientX - rect.left) / rect.width;
          const windStrength = speed * 0.001 * this.cursorWindStrength;
          this.cursorWindX += (-dy * windStrength * (0.6 + 0.4 * (1 - Math.abs(px - 0.5) * 2)));
          this.cursorWindZ += (dx * windStrength * (0.6 + 0.4 * (1 - Math.abs(px - 0.5) * 2)));
        }
      }
      this._lastCursorX = e.clientX;
      this._lastCursorY = e.clientY;

      this._pinchPoints.set(e.pointerId, { clientX:e.clientX, clientY:e.clientY });
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
      this._lastCursorX = null;
      this._lastCursorY = null;
      this.cursorWindX = 0;
      this.cursorWindZ = 0;
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

  _bindMouseMove(){
    const canvas = this.canvas;
    canvas.addEventListener('mousemove', e=>{
      const rect = canvas.getBoundingClientRect();
      this.targetMouseX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      this.targetMouseY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    });
    canvas.addEventListener('mouseleave', ()=>{
      this.targetMouseX = 0;
      this.targetMouseY = 0;
    });
  }

  setZoom(level){
    this.zoomLevel = Math.max(0.5, Math.min(2.5, level));
    this.camPos.z = this._baseCamZ / this.zoomLevel;
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

    // Smooth mouse parallax
    this.mouseX += (this.targetMouseX - this.mouseX) * 0.08;
    this.mouseY += (this.targetMouseY - this.mouseY) * 0.08;
    this.cameraSwayX += (this.mouseX * 0.15 - this.cameraSwayX) * 0.05;
    this.cameraSwayY += (-this.mouseY * 0.1 - this.cameraSwayY) * 0.05;
    this.camPos.x = this.cameraSwayX;
    this.camPos.y = this._baseCamY + this.cameraSwayY;

    const windMul = (this.state.windOn || this.autoWind) ? Math.max(this.state.windMul, this.autoWind?0.55:0) : 0;

    gl.clearColor(0,0,0,0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    setPerspective(this.projMatrix, this.fov, this.aspect, 0.1, 100.0);
    setTranslation(this.viewMatrix, -this.camPos.x, -this.camPos.y, -this.camPos.z);
    gl.uniformMatrix4fv(this.uProj, false, this.projMatrix);
    gl.uniformMatrix4fv(this.uView, false, this.viewMatrix);
    gl.uniform1f(this.uTime, this.time);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);

    // Decay cursor wind (slower decay = longer wave)
    this.cursorWindX *= 0.94;
    this.cursorWindZ *= 0.94;

    const L = HANG_STYLES[this.state.hangStyle];
    const isChimeScene = !!L.chime;

    // Update cloth simulation
    this.meshes.forEach((m,mi)=>{
      const t = this.time + m.windPhase;
      const ambientWindX = Math.sin(t*1.5)*0.0015*windMul;
      const ambientWindZ = Math.cos(t*1.1)*0.0015*windMul;
      // Cursor wind burst (stronger for fabric, gentler for chime)
      const cursorMul = this.cursorWindEnabled ? (isChimeScene ? 0.3 : 1.0) : 0.0;
      const windX = ambientWindX + this.cursorWindX * cursorMul;
      const windZ = ambientWindZ + this.cursorWindZ * cursorMul;
      m.cloth.step({
        gravity: this.state.gravity,
        damping: 0.985,
        windX, windZ,
        iterations: 15,
        stiffness: this.state.stiffness,
      });

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

      // Update grommet X positions from cloth particles (Y calculated in render)
      if(!isChimeScene && this.grommetPositions && this.grommetPositions.length > 0){
        const numX = m.cloth.numX;
        const count = L.grommetCount || 12;
        for(let i=0;i<count;i++){
          const xFrac = i / (count - 1);
          const xIdx = Math.floor(xFrac * (numX - 1));
          this.grommetPositions[i].x = m.cloth.particles[xIdx].x;
        }
      }
    });

    // --- Render Cloth (back layer) ---
    gl.enableVertexAttribArray(this.aPos);
    gl.enableVertexAttribArray(this.aNorm);
    gl.enableVertexAttribArray(this.aUv);
    setTranslation(this.modelMatrix, 0, 0, 0);
    gl.uniformMatrix4fv(this.uModel, false, this.modelMatrix);
    this.meshes.forEach(m=>{
      gl.bindBuffer(gl.ARRAY_BUFFER, m.posBuf);
      gl.vertexAttribPointer(this.aPos,3,gl.FLOAT,false,0,0);
      gl.bindBuffer(gl.ARRAY_BUFFER, m.normBuf);
      gl.vertexAttribPointer(this.aNorm,3,gl.FLOAT,false,0,0);
      gl.bindBuffer(gl.ARRAY_BUFFER, m.uvBuf);
      gl.vertexAttribPointer(this.aUv,2,gl.FLOAT,false,0,0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.idxBuf);
      gl.uniform1f(this.uMetalness, 0.0);
      gl.uniform1f(this.uRoughness, 0.9);
      gl.drawElements(gl.TRIANGLES, m.cloth.indices.length, gl.UNSIGNED_SHORT, 0);
    });

    // --- Render Rod + Grommets (always on top of cloth) ---
    gl.depthFunc(gl.ALWAYS);
    if(this.state.showRod && L.hasRod && this.rodMesh && this.meshes[0]){
      const rodColor = this._getRodColor();
      const halfWidth = (L.width * this.state.scale) / 2 + 0.35;
      // Position rod at clip Y = 0.78 so it stays at top of screen
      const ft = Math.tan(this.fov/2);
      const clipY = 0.78;
      const rodY = this.camPos.y + clipY * this.camPos.z * ft;
      setTranslation(this.modelMatrix, 0, rodY, 0);
      this.modelMatrix[0] = halfWidth;
      this.modelMatrix[5] = 0.08;
      this.modelMatrix[10] = 0.04;
      gl.uniformMatrix4fv(this.uModel, false, this.modelMatrix);
      gl.uniform3fv(this.uColor, new Float32Array(rodColor));
      gl.uniform1f(this.uMetalness, 0.9);
      gl.uniform1f(this.uRoughness, 0.2);
      this._drawMesh(this.rodMesh);

      // Rod end caps (ornamental balls at rod ends)
      const endCapOffset = halfWidth * 1.08;
      for(const sign of [-1, 1]){
        setTranslation(this.modelMatrix, sign * endCapOffset, rodY, 0);
        this.modelMatrix[0] = 0.07;
        this.modelMatrix[5] = 0.07;
        this.modelMatrix[10] = 0.07;
        gl.uniformMatrix4fv(this.uModel, false, this.modelMatrix);
        this._drawMesh(this.rodMesh);
      }
    }

    // --- Render Grommets (topmost, on cloth at rod holes) ---
    if(this.state.showRod && L.hasRod && this.grommetMesh && this.grommetPositions && this.grommetPositions.length > 0){
      const grommetColor = this._getRodColor();
      const ft = Math.tan(this.fov/2);
      const clipY = 0.78;
      const rodY = this.camPos.y + clipY * this.camPos.z * ft;
      // Place grommets just below the rod on the cloth
      this.grommetPositions.forEach(pos=>{
        setTranslation(this.modelMatrix, pos.x, rodY - 0.2, 0.01);
        this.modelMatrix[0] = 1.5;
        this.modelMatrix[5] = 1.5;
        this.modelMatrix[10] = 1.5;
        gl.uniformMatrix4fv(this.uModel, false, this.modelMatrix);
        gl.uniform3fv(this.uColor, new Float32Array(grommetColor));
        gl.uniform1f(this.uMetalness, 0.85);
        gl.uniform1f(this.uRoughness, 0.25);
        this._drawMesh(this.grommetMesh);
      });
    }
    gl.depthFunc(gl.LESS);
  }

  _drawMesh(mesh){
    const gl = this.gl;
    gl.enableVertexAttribArray(this.aPos);
    gl.enableVertexAttribArray(this.aNorm);
    gl.enableVertexAttribArray(this.aUv);
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.posBuf);
    gl.vertexAttribPointer(this.aPos,3,gl.FLOAT,false,0,0);
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normBuf);
    gl.vertexAttribPointer(this.aNorm,3,gl.FLOAT,false,0,0);
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.uvBuf);
    gl.vertexAttribPointer(this.aUv,2,gl.FLOAT,false,0,0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.idxBuf);
    gl.drawElements(gl.TRIANGLES, mesh.indexCount, gl.UNSIGNED_SHORT, 0);
  }

  _getRodColor(){
    // Return warm brass/gold color
    return [0.85, 0.65, 0.25];
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
    if(this.rodMesh){
      gl.deleteBuffer(this.rodMesh.posBuf); gl.deleteBuffer(this.rodMesh.normBuf);
      gl.deleteBuffer(this.rodMesh.uvBuf); gl.deleteBuffer(this.rodMesh.idxBuf);
    }
    if(this.grommetMesh){
      gl.deleteBuffer(this.grommetMesh.posBuf); gl.deleteBuffer(this.grommetMesh.normBuf);
      gl.deleteBuffer(this.grommetMesh.uvBuf); gl.deleteBuffer(this.grommetMesh.idxBuf);
    }
    gl.deleteTexture(this.tex);
    gl.deleteProgram(this.program);
  }
}