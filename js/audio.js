/**
 * audio.js — tiny procedural bell/bead "clink" synth built on the Web
 * Audio API. There are no audio files: every tone is generated on the fly
 * from a handful of sine partials tuned to bell-like (inharmonic) ratios,
 * so the doorway wind chime and the jewellery bead curtain each get a real
 * sound with zero network requests and zero asset weight.
 */
const ChimeAudio = (function(){
  let ctx = null;
  let master = null;
  let enabled = true;

  // Two registers: warm wood/bamboo chime tones, and a brighter glass/
  // crystal-bead register for the jewellery curtain. Notes are drawn from
  // a pentatonic-ish set so any random sequence of strikes still sounds
  // musical together, the way real tuned chimes are cut to a scale.
  const scales = {
    wood:    [196.00, 220.00, 261.63, 293.66, 329.63, 392.00, 440.00, 523.25],
    crystal: [523.25, 587.33, 659.25, 783.99, 880.00, 987.77, 1046.50, 1174.66, 1318.51],
  };

  function ensureCtx(){
    if(ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
    return ctx;
  }

  // Browsers require a user gesture before audio can play — the first tap
  // or click anywhere quietly wakes the audio context so chimes are ready
  // to ring the moment the person starts interacting.
  function unlock(){
    const c = ensureCtx();
    if(c && c.state === 'suspended') c.resume();
  }
  document.addEventListener('pointerdown', unlock);
  document.addEventListener('touchstart', unlock, { passive:true });

  function toneFor(kind, index){
    const scale = scales[kind] || scales.wood;
    return scale[Math.abs(index) % scale.length];
  }

  /** Ring one bell/bead tone. kind: 'wood'|'crystal'. velocity: ~0..1 loudness. */
  function ring(kind, index, velocity){
    const c = ensureCtx();
    if(!c || !enabled) return;
    if(c.state === 'suspended') c.resume();
    const now = c.currentTime;
    const f0 = toneFor(kind, index);
    const vel = Math.max(0.15, Math.min(1, velocity));

    // Risset-bell-style inharmonic partials: [frequency ratio, relative
    // amplitude, decay seconds]. Crystal gets more high partials and a
    // longer shimmer; wood is darker and decays faster.
    const partials = kind === 'crystal'
      ? [ [1,1.0,1.5], [2.76,0.55,1.15], [4.07,0.32,0.9], [5.4,0.2,0.65], [8.9,0.12,0.45] ]
      : [ [1,1.0,0.85], [2.4,0.4,0.65], [3.5,0.2,0.45], [5.2,0.1,0.3] ];

    const voice = c.createGain();
    voice.gain.value = 1;
    voice.connect(master);

    partials.forEach(([ratio, amp, decay])=>{
      const osc = c.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f0 * ratio;
      const g = c.createGain();
      const peak = 0.22 * amp * vel;
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0006, peak), now + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, now + decay);
      osc.connect(g);
      g.connect(voice);
      osc.start(now);
      osc.stop(now + decay + 0.15);
    });
  }

  return {
    /** hangStyle picks the register; index picks a note from its scale. */
    pluck(hangStyle, index, velocity){
      const kind = hangStyle === 'jewelcurtain' ? 'crystal' : 'wood';
      ring(kind, index, velocity);
    },
    setEnabled(v){ enabled = !!v; },
    isEnabled(){ return enabled; },
  };
})();
window.ChimeAudio = ChimeAudio;
