/**
 * cloth.js — a small Verlet-integration cloth solver.
 * Grid topology (numX * numY) is fixed once created; hang style / size
 * changes just reset particle positions and pin masks, so buffers and
 * index lists never need to be rebuilt.
 */
class ClothSim {
  constructor(numX, numY){
    this.numX = numX;
    this.numY = numY;
    this.numParticles = numX * numY;

    this.particles = [];
    this.pinned = new Array(this.numParticles).fill(false);

    this.uvData = new Float32Array(this.numParticles * 2);
    for(let y=0;y<numY;y++){
      for(let x=0;x<numX;x++){
        const i = y*numX+x;
        this.uvData[i*2] = x/(numX-1);
        this.uvData[i*2+1] = y/(numY-1);
      }
    }

    this.constraints = [];
    const addC = (i1,i2) => this.constraints.push({p1:i1, p2:i2, rest:0});
    for(let y=0;y<numY;y++){
      for(let x=0;x<numX;x++){
        const i = y*numX+x;
        if(x<numX-1) addC(i,i+1);
        if(y<numY-1) addC(i,i+numX);
        if(x<numX-1 && y<numY-1){ addC(i,i+numX+1); addC(i+1,i+numX); }
        if(x<numX-2) addC(i,i+2);
        if(y<numY-2) addC(i,i+numX*2);
      }
    }

    this.indices = [];
    for(let y=0;y<numY-1;y++){
      for(let x=0;x<numX-1;x++){
        const i = y*numX+x;
        this.indices.push(i,i+1,i+numX);
        this.indices.push(i+1,i+numX+1,i+numX);
      }
    }

    this.posData = new Float32Array(this.numParticles*3);
    this.normalData = new Float32Array(this.numParticles*3);
    this.grabbedIndex = -1;
  }

  /** (Re)lay out particles for a given hang style. Recomputes rest lengths. */
  reset(layout){
    const { width, height, offsetY, pinMode } = layout;
    this.width = width;
    this.height = height;

    this.particles = [];
    for(let y=0;y<this.numY;y++){
      for(let x=0;x<this.numX;x++){
        const px = (x/(this.numX-1)-0.5) * width;
        const py = -(y/(this.numY-1)) * height + offsetY;
        const pz = 0;
        this.particles.push({x:px,y:py,z:pz, ox:px, oy:py, oz:pz});
      }
    }

    this.pinned.fill(false);
    if(pinMode === 'top-row'){
      for(let x=0;x<this.numX;x++) this.pinned[x] = true;
    } else if(pinMode === 'corners'){
      this.pinned[0] = true;
      this.pinned[this.numX-1] = true;
    } else if(pinMode === 'center-pair'){
      const c = Math.floor(this.numX/2);
      this.pinned[Math.max(0,c-1)] = true;
      this.pinned[Math.min(this.numX-1,c)] = true;
    }

    for(const c of this.constraints){
      const p1 = this.particles[c.p1], p2 = this.particles[c.p2];
      const dx=p2.x-p1.x, dy=p2.y-p1.y, dz=p2.z-p1.z;
      c.rest = Math.sqrt(dx*dx+dy*dy+dz*dz);
    }
  }

  /** Advance the simulation by one frame. opts: {gravity, damping, windX, windZ, iterations, stiffness} */
  step(opts){
    const { gravity, damping, windX, windZ, iterations, stiffness } = opts;
    const height = this.height;

    for(let i=0;i<this.numParticles;i++){
      if(this.pinned[i] || i===this.grabbedIndex) continue;
      const p = this.particles[i];
      const vx=(p.x-p.ox)*damping, vy=(p.y-p.oy)*damping, vz=(p.z-p.oz)*damping;
      p.ox=p.x; p.oy=p.y; p.oz=p.z;
      const windFactor = Math.max(0, -p.y)/height;
      p.x += vx + windX*windFactor;
      p.y += vy - gravity;
      p.z += vz + windZ*windFactor;
    }

    for(let iter=0; iter<iterations; iter++){
      for(let i=0;i<this.constraints.length;i++){
        const c = this.constraints[i];
        const p1 = this.particles[c.p1], p2 = this.particles[c.p2];
        const dx=p2.x-p1.x, dy=p2.y-p1.y, dz=p2.z-p1.z;
        const dist = Math.sqrt(dx*dx+dy*dy+dz*dz) || 0.0001;
        const w1 = (this.pinned[c.p1] || c.p1===this.grabbedIndex) ? 0 : 1;
        const w2 = (this.pinned[c.p2] || c.p2===this.grabbedIndex) ? 0 : 1;
        const wSum = w1+w2;
        if(wSum>0){
          const diff = ((dist-c.rest)/(dist*wSum)) * stiffness;
          const ox=dx*diff, oy=dy*diff, oz=dz*diff;
          if(w1){ p1.x+=ox; p1.y+=oy; p1.z+=oz; }
          if(w2){ p2.x-=ox; p2.y-=oy; p2.z-=oz; }
        }
      }
    }

    this._updateBuffers();
  }

  _updateBuffers(){
    this.normalData.fill(0);
    for(let i=0;i<this.numParticles;i++){
      const p = this.particles[i];
      this.posData[i*3]=p.x; this.posData[i*3+1]=p.y; this.posData[i*3+2]=p.z;
    }
    const idx = this.indices, pos = this.posData, norm = this.normalData;
    for(let i=0;i<idx.length;i+=3){
      const i1=idx[i], i2=idx[i+1], i3=idx[i+2];
      const v1x=pos[i1*3], v1y=pos[i1*3+1], v1z=pos[i1*3+2];
      const v2x=pos[i2*3], v2y=pos[i2*3+1], v2z=pos[i2*3+2];
      const v3x=pos[i3*3], v3y=pos[i3*3+1], v3z=pos[i3*3+2];
      const dx1=v2x-v1x, dy1=v2y-v1y, dz1=v2z-v1z;
      const dx2=v3x-v1x, dy2=v3y-v1y, dz2=v3z-v1z;
      const nx=dy1*dz2-dz1*dy2, ny=dz1*dx2-dx1*dz2, nz=dx1*dy2-dy1*dx2;
      norm[i1*3]+=nx; norm[i1*3+1]+=ny; norm[i1*3+2]+=nz;
      norm[i2*3]+=nx; norm[i2*3+1]+=ny; norm[i2*3+2]+=nz;
      norm[i3*3]+=nx; norm[i3*3+1]+=ny; norm[i3*3+2]+=nz;
    }
  }

  /** Ray-pick the nearest particle within `maxDist`, returns index or -1. */
  pick(ray, maxDist){
    let minDist = Infinity, bestIdx = -1, bestT = 0;
    for(let i=0;i<this.numParticles;i++){
      const p = this.particles[i];
      const vx=p.x-ray.origin.x, vy=p.y-ray.origin.y, vz=p.z-ray.origin.z;
      const t = vx*ray.dir.x + vy*ray.dir.y + vz*ray.dir.z;
      const px=ray.origin.x+ray.dir.x*t, py=ray.origin.y+ray.dir.y*t, pz=ray.origin.z+ray.dir.z*t;
      const dx=p.x-px, dy=p.y-py, dz=p.z-pz;
      const dist = Math.sqrt(dx*dx+dy*dy+dz*dz);
      if(dist<minDist && dist<maxDist){ minDist=dist; bestIdx=i; bestT=t; }
    }
    if(bestIdx!==-1) this.grabDepth = bestT;
    return bestIdx;
  }

  dragTo(ray){
    if(this.grabbedIndex===-1) return;
    const p = this.particles[this.grabbedIndex];
    p.x = ray.origin.x + ray.dir.x*this.grabDepth;
    p.y = ray.origin.y + ray.dir.y*this.grabDepth;
    p.z = ray.origin.z + ray.dir.z*this.grabDepth;
    p.ox=p.x; p.oy=p.y; p.oz=p.z;
  }

  release(){ this.grabbedIndex = -1; }
}
