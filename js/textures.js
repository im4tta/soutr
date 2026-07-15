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

const PATTERNS = ['solid','stripe','check','dot','krama','hol','pidan','phamuong'];

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
