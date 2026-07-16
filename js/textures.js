/**
 * textures.js — procedural fabric textures drawn onto a 2D canvas,
 * then uploaded as a WebGL texture by renderer.js.
 *
 * Includes a few Khmer textile motifs, simplified for a real-time canvas:
 *   - Krama check : the tight two-tone gingham of the everyday krama scarf
 *   - Hol ikat     : soft-edged diamond banding evoking Khmer ikat silk (hol)
 *   - Pidan band   : repeating temple-motif banding used on ceremonial silk
 * These are stylised approximations for preview purposes, not reproductions
 * of specific registered textile designs.
 */

const COLORS = [
  { name:'Ivory',      hex:'#efe8d8', thread:'#d8cfba' },
  { name:'Charcoal',   hex:'#3a3a3d', thread:'#242426' },
  { name:'Sage',       hex:'#7c8c74', thread:'#5f6d58' },
  { name:'Terracotta', hex:'#c06a44', thread:'#9a5233' },
  { name:'Ink Blue',   hex:'#31465f', thread:'#22334a' },
  { name:'Plum',       hex:'#5b3a53', thread:'#432b3e' },
  { name:'Mustard',    hex:'#cf9a3a', thread:'#a97b28' },
  { name:'Blush',      hex:'#dfb3ae', thread:'#c48f89' },
  { name:'Krama Red',  hex:'#a63a2e', thread:'#f2ede1' },
  { name:'Royal Gold', hex:'#8a1f2b', thread:'#c9992e' },
];

const PATTERNS = ['solid','stripe','check','dot','krama','hol','pidan','phamuong','chorabap'];

// Wood / bead tones for the wind-chime hang style — a doorway string of
// small carved wood or bamboo pieces, not woven fabric, so it gets its
// own palette rather than reusing the fabric COLORS array.
const WOOD_COLORS = [
  { name:'Natural Rattan', hex:'#c9a06a', thread:'#8f6a3d' },
  { name:'Bamboo',         hex:'#d9c17a', thread:'#a68b3f' },
  { name:'Dark Rosewood',  hex:'#6b3a2a', thread:'#3f2015' },
  { name:'Ebony Black',    hex:'#2b2422', thread:'#141110' },
  { name:'Gilded Gold',    hex:'#b8862f', thread:'#7c5a1c' },
];

// Glass/crystal bead tones for the jewelry doorway curtain — Khmer beaded
// door curtains are typically strung from bright faceted glass or plastic
// "gem" beads with gold spacer beads, not fabric, so this gets its own
// sparkling palette rather than reusing fabric or wood colours.
const JEWEL_COLORS = [
  { name:'Clear Crystal', hex:'#dce8ec', thread:'#ffffff' },
  { name:'Ruby Red',      hex:'#9c1f34', thread:'#ff6b7f' },
  { name:'Emerald Green', hex:'#0f5c42', thread:'#4fd8a4' },
  { name:'Sapphire Blue', hex:'#1c3f7a', thread:'#5aa3ff' },
  { name:'Amber Gold',    hex:'#c98a1f', thread:'#ffd873' },
  { name:'Rose Quartz',   hex:'#c96b8a', thread:'#ffc2d8' },
  { name:'Amethyst',      hex:'#5a2f79', thread:'#c79bff' },
  { name:'Pearl White',   hex:'#eee7da', thread:'#ffffff' },
];

function hexToRgb(hex){
  const n = parseInt(hex.slice(1),16);
  return { r:(n>>16)&255, g:(n>>8)&255, b:n&255 };
}

/** Draws the selected colour + pattern onto the given 2D context. */
function drawFabricTexture(ctx, W, H, color, pattern){
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle = color.hex;
  ctx.fillRect(0,0,W,H);

  // subtle woven noise so nothing reads as flat plastic
  const img = ctx.getImageData(0,0,W,H);
  const d = img.data;
  for(let i=0;i<d.length;i+=4){
    const n = (Math.random()-0.5)*10;
    d[i]+=n; d[i+1]+=n; d[i+2]+=n;
  }
  ctx.putImageData(img,0,0);
  ctx.globalAlpha = 1;

  switch(pattern){
    case 'stripe': drawStripe(ctx,W,H,color); break;
    case 'check': drawCheck(ctx,W,H,color); break;
    case 'dot': drawDot(ctx,W,H,color); break;
    case 'krama': drawKrama(ctx,W,H,color); break;
    case 'hol': drawHol(ctx,W,H,color); break;
    case 'pidan': drawPidan(ctx,W,H,color); break;
    case 'phamuong': drawPhamuong(ctx,W,H,color); break;
    case 'chorabap': drawChorabap(ctx,W,H,color); break;
    // 'solid' -> base fill + noise only
  }

  // soft vignette for depth
  const grad = ctx.createRadialGradient(W/2,H/2,W*0.2,W/2,H/2,W*0.72);
  grad.addColorStop(0,'rgba(0,0,0,0)');
  grad.addColorStop(1,'rgba(0,0,0,0.10)');
  ctx.fillStyle = grad;
  ctx.fillRect(0,0,W,H);
}

function drawStripe(ctx,W,H,color){
  ctx.fillStyle = color.thread;
  const w = W/16;
  for(let x=0; x<W; x+=w*2) ctx.fillRect(x,0,w,H);
}

function drawCheck(ctx,W,H,color){
  ctx.fillStyle = color.thread;
  ctx.globalAlpha = 0.55;
  const cell = W/14;
  for(let x=0;x<W;x+=cell*2) ctx.fillRect(x,0,cell,H);
  for(let y=0;y<H;y+=cell*2) ctx.fillRect(0,y,W,cell);
  ctx.globalAlpha = 1;
}

function drawDot(ctx,W,H,color){
  ctx.fillStyle = color.thread;
  const gap = W/13, r = gap*0.16;
  for(let y=gap/2; y<H; y+=gap){
    for(let x=gap/2; x<W; x+=gap){
      ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
    }
  }
}

/** Tight two-tone gingham typical of an everyday krama. */
function drawKrama(ctx,W,H,color){
  const white = '#f2ede1';
  const cell = W/24;
  ctx.fillStyle = white;
  ctx.globalAlpha = 0.9;
  for(let y=0;y<H;y+=cell){
    for(let x=0;x<W;x+=cell){
      const gx = Math.floor(x/cell), gy = Math.floor(y/cell);
      if((gx+gy)%2===0) ctx.fillRect(x,y,cell,cell);
    }
  }
  ctx.globalAlpha = 1;
  // fine overlaid grid line for the woven look
  ctx.strokeStyle = 'rgba(0,0,0,0.08)';
  ctx.lineWidth = 1;
  for(let x=0;x<W;x+=cell){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for(let y=0;y<H;y+=cell){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
}

/** Soft-edged diamond banding evoking Khmer ikat (hol) silk weaving. */
function drawHol(ctx,W,H,color){
  const bandH = H/9;
  const accent = color.thread;
  for(let b=0; b<9; b++){
    const y0 = b*bandH;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0,y0,W,bandH);
    ctx.clip();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = b%2===0 ? accent : color.hex;
    const diamondW = W/8;
    for(let x=-diamondW; x<W+diamondW; x+=diamondW){
      ctx.save();
      ctx.translate(x + (b%2===0? diamondW/2:0), y0+bandH/2);
      ctx.rotate(Math.PI/4);
      const s = bandH*0.62;
      // soft blur via layered, slightly offset, low-alpha squares (ikat "bleed")
      for(let k=0;k<4;k++){
        ctx.globalAlpha = 0.18;
        ctx.fillRect(-s/2-k, -s/2-k, s+k*2, s+k*2);
      }
      ctx.restore();
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

/** Fine, dense multi-tone stripe evoking phamuong plain-woven silk. */
function drawPhamuong(ctx,W,H,color){
  const stripeW = W/64;
  for(let x=0, i=0; x<W; x+=stripeW, i++){
    ctx.globalAlpha = (i%5===0) ? 0.32 : 0.1;
    ctx.fillStyle = (i%5===0) ? color.thread : '#f2ede1';
    ctx.fillRect(x,0,stripeW*0.6,H);
  }
  ctx.globalAlpha = 1;
}

/** Dense gold-banded medallion weave evoking royal chorabap ceremonial silk. */
function drawChorabap(ctx,W,H,color){
  const gold = '#c9a227';
  const bandH = H/16;
  for(let b=0;b<16;b++){
    const y0 = b*bandH;
    ctx.globalAlpha = (b%4===0) ? 0.5 : 0.16;
    ctx.fillStyle = (b%4===0) ? gold : color.thread;
    ctx.fillRect(0,y0,W,bandH*0.5);
  }
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = gold;
  const medW = W/9;
  for(let row=1; row<16; row+=4){
    for(let x=medW/2; x<W; x+=medW){
      ctx.save();
      ctx.translate(x, row*bandH);
      ctx.rotate(Math.PI/4);
      const s = bandH*0.5;
      ctx.fillRect(-s/2,-s/2,s,s);
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
}

/**
 * Vertical strip texture for one wind-chime strand — small carved wood or
 * bamboo links joined by cord, with a Khmer roundel accent bead every few
 * links and a frayed cord tassel at the bottom. Painted once per colour and
 * mapped down the length of each narrow strand mesh.
 */
function drawWindChimeTexture(ctx, W, H, color){
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle = 'rgba(0,0,0,0)';
  ctx.fillRect(0,0,W,H);

  const linkCount = 11;
  const linkH = H / linkCount;
  const gap = linkH * 0.14;

  for(let i=0;i<linkCount;i++){
    const y0 = i*linkH + gap/2;
    const h = linkH - gap;
    const isAccent = (i % 3 === 1);

    if(isAccent){
      // round Khmer roundel bead — small circle with a centre dot motif
      const cx = W/2, cy = y0 + h/2, r = Math.min(W,h)*0.42;
      ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2);
      ctx.fillStyle = color.thread; ctx.fill();
      ctx.beginPath(); ctx.arc(cx,cy,r*0.42,0,Math.PI*2);
      ctx.fillStyle = 'rgba(242,237,225,0.75)'; ctx.fill();
    } else {
      // carved wood/bamboo link
      const pad = W*0.12;
      ctx.fillStyle = color.hex;
      ctx.fillRect(pad, y0, W-pad*2, h);
      // grain lines
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.lineWidth = Math.max(1, H*0.002);
      for(let g=0; g<3; g++){
        const gy = y0 + h*(0.25+g*0.25);
        ctx.beginPath(); ctx.moveTo(pad, gy); ctx.lineTo(W-pad, gy); ctx.stroke();
      }
      // carved end caps
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(pad, y0, W-pad*2, h*0.08);
      ctx.fillRect(pad, y0+h*0.92, W-pad*2, h*0.08);
    }
    // connecting cord between links
    if(i<linkCount-1){
      ctx.strokeStyle = 'rgba(40,32,24,0.5)';
      ctx.lineWidth = Math.max(1, W*0.03);
      ctx.beginPath(); ctx.moveTo(W/2, y0+h); ctx.lineTo(W/2, y0+h+gap); ctx.stroke();
    }
  }

  // frayed cord tassel at the very bottom
  const tassY = linkCount*linkH;
  ctx.strokeStyle = color.thread;
  ctx.lineWidth = Math.max(1, W*0.02);
  for(let f=-2; f<=2; f++){
    ctx.beginPath();
    ctx.moveTo(W/2, tassY - linkH*0.15);
    ctx.lineTo(W/2 + f*W*0.14, H*0.995);
    ctx.stroke();
  }
}

/**
 * Vertical strip texture for one jewelry-curtain strand — a decorative
 * string of faceted glass/crystal beads in the chosen colour, separated
 * by small gold spacer beads, with bright specular highlights on each
 * gem. Has a decorative woven header band at the top and hanging pendant
 * drops at the bottom for a more ornate "beaded door curtain" look
 * common on Khmer doorways.
 */
function drawJewelCurtainTexture(ctx, W, H, color){
  ctx.clearRect(0,0,W,H);

  const gold = '#d9ad3f';
  const beadCount = 12;
  const cellH = H / beadCount;

  // decorative woven top band
  ctx.fillStyle = gold;
  ctx.globalAlpha = 0.55;
  ctx.fillRect(0, 0, W, cellH*0.5);
  ctx.globalAlpha = 0.85;
  ctx.fillRect(W*0.08, cellH*0.08, W*0.84, cellH*0.34);
  // fine horizontal threads in top band
  ctx.strokeStyle = 'rgba(255,221,170,0.5)';
  ctx.lineWidth = 1;
  for(let t=0; t<5; t++){
    const ty = cellH*0.1 + t*cellH*0.07;
    ctx.beginPath(); ctx.moveTo(W*0.1, ty); ctx.lineTo(W*0.9, ty); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const cx = W/2;

  for(let i=0;i<beadCount;i++){
    const cy = i*cellH + cellH*0.5 + cellH*0.5;
    const isGem = (i % 3 !== 2); // 2 gems, 1 gold spacer

    // connecting thread
    const threadTop = i===0 ? cellH*0.5 : i*cellH + cellH*0.5;
    ctx.strokeStyle = 'rgba(30,26,20,0.6)';
    ctx.lineWidth = Math.max(1, W*0.04);
    ctx.beginPath(); ctx.moveTo(cx, threadTop); ctx.lineTo(cx, (i+1)*cellH + cellH*0.5); ctx.stroke();

    if(isGem){
      const r = Math.min(W,cellH)*0.44;
      // gem bead: radial gradient for faceted glass look
      const grd = ctx.createRadialGradient(cx-r*0.25, cy-r*0.3, r*0.05, cx, cy, r);
      grd.addColorStop(0, color.thread);
      grd.addColorStop(0.35, color.hex);
      grd.addColorStop(0.7, color.hex);
      grd.addColorStop(1, 'rgba(0,0,0,0.3)');
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2);
      ctx.fillStyle = grd;
      ctx.fill();
      // bright rim
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = Math.max(1, r*0.07);
      ctx.stroke();
      // main specular highlight
      ctx.beginPath(); ctx.arc(cx-r*0.28, cy-r*0.32, r*0.25, 0, Math.PI*2);
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fill();
      // secondary glint
      ctx.beginPath(); ctx.arc(cx+r*0.18, cy+r*0.22, r*0.1, 0, Math.PI*2);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fill();
      // tiny sparkle dot
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath(); ctx.arc(cx-r*0.15, cy-r*0.15, r*0.06, 0, Math.PI*2);
      ctx.fill();
    } else {
      // gold spacer bead
      const r = Math.min(W,cellH)*0.26;
      const grd = ctx.createRadialGradient(cx-r*0.2, cy-r*0.2, r*0.1, cx, cy, r);
      grd.addColorStop(0, '#fbe9ab');
      grd.addColorStop(0.5, gold);
      grd.addColorStop(1, '#8a6318');
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2);
      ctx.fillStyle = grd;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,221,170,0.25)';
      ctx.lineWidth = Math.max(1, r*0.05);
      ctx.stroke();
    }
  }

  // hanging pendant drops at the bottom
  const tassY = beadCount*cellH + cellH*0.5;
  // gold thread tassel strands
  ctx.strokeStyle = gold;
  ctx.lineWidth = Math.max(1, W*0.012);
  for(let f=-3; f<=3; f++){
    ctx.beginPath();
    ctx.moveTo(cx + f*W*0.06, tassY);
    ctx.lineTo(cx + f*W*0.22, H*0.995);
    ctx.stroke();
  }
  // small pendant beads at bottom of tassel
  for(let p=-1; p<=1; p++){
    const px = cx + p*W*0.12;
    ctx.beginPath(); ctx.arc(px, H*0.96, Math.min(W,cellH)*0.07, 0, Math.PI*2);
    ctx.fillStyle = color.hex;
    ctx.fill();
    ctx.strokeStyle = gold;
    ctx.lineWidth = Math.max(1, W*0.015);
    ctx.stroke();
  }
}

/** Repeating temple-motif-style banding, loosely evoking ceremonial pidan silk. */
function drawPidan(ctx,W,H,color){
  const bandH = H/12;
  ctx.fillStyle = color.thread;
  for(let b=0; b<12; b++){
    if(b % 3 !== 1) continue; // one motif band every third row
    const y0 = b*bandH + bandH*0.2;
    const rowH = bandH*0.6;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(0, y0, W, rowH*0.12); // top rule
    ctx.fillRect(0, y0+rowH-rowH*0.12, W, rowH*0.12); // bottom rule
    const motifW = W/10;
    for(let x=motifW/2; x<W; x+=motifW){
      ctx.save();
      ctx.translate(x, y0+rowH/2);
      // simple stylised spire/temple silhouette
      ctx.beginPath();
      ctx.moveTo(0, -rowH*0.42);
      ctx.lineTo(rowH*0.22, rowH*0.1);
      ctx.lineTo(-rowH*0.22, rowH*0.1);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(-rowH*0.14, rowH*0.08, rowH*0.28, rowH*0.22);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
}
