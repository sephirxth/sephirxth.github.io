// All sounds are synthesized locally. Creating this object never unlocks audio.
export function createAudio() {
  const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
  let available = typeof AudioContext === 'function', enabled = false, unlocked = false;
  let context, master, noise, ambient = [], pendingResume;
  let activity = { fire: 0, water: 0, steam: 0, charge: 0, paused: false };
  const voices = new Set(), last = new Map();
  const maxSources = 24, masterVolume = .38;
  let tokens = 8, tokenTime = 0;
  const hidden = () => Boolean(globalThis.document?.hidden);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const number = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
  const canPlay = () => available && enabled && unlocked && context && !hidden() && !activity.paused;

  function ramp(parameter, target, duration = .08) {
    const now = context.currentTime;
    parameter.cancelScheduledValues(now);
    parameter.setValueAtTime(parameter.value, now);
    parameter.linearRampToValueAtTime(target, now + duration);
  }

  function silence() {
    if (!context || !master) return;
    master.gain.cancelScheduledValues(context.currentTime);
    master.gain.setValueAtTime(0, context.currentTime);
    for (const voice of voices) {
      try { voice.source.stop(); } catch { /* Already ended. */ }
      voice.cleanup();
    }
    for (const track of ambient) track.gain.gain.value = 0;
    if (context.state === 'running') context.suspend().catch(() => {});
  }

  function fail() {
    available = false;
    enabled = false;
    silence();
  }

  function makeAmbient(frequency, type, rate) {
    const source = context.createBufferSource(), filter = context.createBiquadFilter(), gain = context.createGain();
    source.buffer = noise;
    source.loop = true;
    source.playbackRate.value = rate;
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = .6;
    gain.gain.value = 0;
    source.connect(filter).connect(gain).connect(master);
    source.start();
    return { gain };
  }

  function makeGraph() {
    context = new AudioContext({ latencyHint: 'interactive' });
    master = context.createGain();
    master.gain.value = 0;
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -19;
    limiter.knee.value = 14;
    limiter.ratio.value = 6;
    limiter.attack.value = .004;
    limiter.release.value = .15;
    master.connect(limiter).connect(context.destination);
    noise = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const samples = noise.getChannelData(0);
    // Independent audio noise never consumes the simulation's random sequence.
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    ambient = [makeAmbient(210, 'lowpass', .73), makeAmbient(720, 'bandpass', 1.13), makeAmbient(2400, 'highpass', .91), makeAmbient(100, 'bandpass', .61)];
  }

  function applyActivity() {
    if (!canPlay()) { silence(); return; }
    ramp(master.gain, masterVolume, .035);
    const amounts = [activity.fire, activity.water, activity.steam, activity.charge];
    const scales = [22, 90, 35, 14], peaks = [.052, .025, .025, .025];
    ambient.forEach((track, i) => ramp(track.gain.gain, (1 - Math.exp(-Math.max(0, number(amounts[i])) / scales[i])) * peaks[i], .35));
    if (context.state === 'suspended' && !pendingResume) {
      pendingResume = context.resume().then(() => { if (!canPlay()) silence(); }).catch(fail).finally(() => { pendingResume = null; });
    }
  }

  async function unlock() {
    if (!available || hidden()) return false;
    try {
      if (!context) makeGraph();
      // This method is called only by the explicit sound-toggle click handler.
      await context.resume();
      unlocked = true;
      if (enabled) applyActivity();
      return true;
    } catch { fail(); return false; }
  }

  function connectVoice(source, duration, peak, pan, filter, delay = 0, attack = .006) {
    if (voices.size >= maxSources) return;
    const envelope = context.createGain(), nodes = [source];
    let output = source;
    if (filter) {
      const shape = context.createBiquadFilter();
      shape.type = filter.type || 'lowpass';
      shape.frequency.value = filter.frequency;
      shape.Q.value = filter.q || .7;
      output.connect(shape);
      output = shape;
      nodes.push(shape);
    }
    output.connect(envelope);
    nodes.push(envelope);
    if (context.createStereoPanner) {
      const panner = context.createStereoPanner();
      panner.pan.value = pan;
      envelope.connect(panner).connect(master);
      nodes.push(panner);
    } else envelope.connect(master);
    const at = context.currentTime + delay;
    envelope.gain.setValueAtTime(.0001, at);
    envelope.gain.exponentialRampToValueAtTime(Math.max(.0002, peak), at + attack);
    envelope.gain.exponentialRampToValueAtTime(.0001, at + Math.max(attack + .01, duration));
    const voice = { source, cleanup() { voices.delete(voice); for (const node of nodes) { try { node.disconnect(); } catch {} } } };
    source.onended = voice.cleanup;
    voices.add(voice);
    source.start(at);
    source.stop(at + duration + .02);
  }

  function tone(frequency, end, duration, peak, pan, type = 'sine', delay = 0) {
    if (voices.size >= maxSources) return;
    const source = context.createOscillator(), at = context.currentTime + delay;
    source.type = type;
    source.frequency.setValueAtTime(frequency, at);
    source.frequency.exponentialRampToValueAtTime(Math.max(20, end), at + duration);
    connectVoice(source, duration, peak, pan, null, delay);
  }

  function hiss(frequency, duration, peak, pan, type = 'bandpass', delay = 0) {
    if (voices.size >= maxSources) return;
    const source = context.createBufferSource();
    source.buffer = noise;
    source.playbackRate.value = .85 + Math.random() * .3;
    connectVoice(source, duration, peak, pan, { type, frequency }, delay, .008);
  }

  function water(peak, pan) {
    tone(670, 190, .16, peak * .7, pan);
    tone(1040, 370, .095, peak * .32, pan, 'sine', .027);
    hiss(1300, .07, peak * .3, pan);
  }

  function crystal(peak, pan, rising = false) {
    tone(1590, rising ? 1900 : 1480, .26, peak * .55, pan);
    tone(2530, 2310, .2, peak * .23, pan, 'sine', .025);
    hiss(4200, .035, peak * .4, pan, 'highpass');
  }

  function fire(peak, pan) {
    hiss(260, .3, peak * 1.2, pan, 'lowpass');
    hiss(3200, .035, peak * .75, pan, 'highpass', .025);
    tone(95, 43, .13, peak * .35, pan, 'triangle');
  }

  function earth(peak, pan) {
    hiss(430, .095, peak, pan, 'lowpass');
    tone(145, 62, .09, peak * .55, pan, 'triangle');
    hiss(1100, .04, peak * .35, pan, 'bandpass', .03);
  }

  function metal(peak, pan) {
    tone(720, 690, .35, peak * .65, pan);
    tone(1733, 1700, .25, peak * .28, pan);
    tone(2890, 2790, .14, peak * .13, pan);
  }

  function lightning(peak, pan) {
    hiss(3600, .045, peak * 1.5, pan, 'highpass');
    hiss(180, .7, peak, pan, 'lowpass', .04);
    tone(62, 30, .55, peak * .75, pan, 'triangle', .03);
  }

  function materialSound(kind, peak, pan) {
    switch (kind) {
      case 1: water(peak, pan); break;
      case 2: fire(peak, pan); break;
      case 3: hiss(1700, .045, peak * .7, pan); tone(360, 170, .065, peak * .5, pan, 'triangle'); break;
      case 4: case 10: metal(peak, pan); break;
      case 5: case 9: earth(peak, pan); break;
      case 6: crystal(peak, pan); break;
      case 7: hiss(2100, .26, peak * .6, pan, 'highpass'); break;
      case 8: lightning(peak * .75, pan); break;
      default: hiss(1800, .06, peak * .45, pan);
    }
  }

  const cooldowns = { write: .055, erase: .06, select: .07, move: .085, dry: .4, reset: .3, ignite: .13, boil: .14, condense: .13, freeze: .17, thaw: .16, melt: .17, solidify: .17, extinguish: .15, lightning: .27 };
  function trigger(type, options = {}) {
    if (!canPlay() || context.state !== 'running' || !Object.hasOwn(cooldowns, type)) return false;
    const now = context.currentTime, key = type === 'write' ? `${type}:${options.kind}` : type;
    if (now - (last.get(key) ?? -Infinity) < cooldowns[type]) return false;
    tokens = Math.min(8, tokens + Math.max(0, now - tokenTime) * 16);
    tokenTime = now;
    if (tokens < 1 || voices.size > maxSources - 4) return false;
    tokens--;
    last.set(key, now);
    const strength = clamp(number(options.intensity, 1), .25, 2);
    const peak = .14 * Math.sqrt(strength);
    const pan = options.width > 1 ? clamp(number(options.x) / (options.width - 1) * 2 - 1, -1, 1) * .68 : 0;
    try {
      switch (type) {
        case 'write': materialSound(options.kind, peak, pan); break;
        case 'erase': hiss(1700, .075, peak * .5, pan); break;
        case 'select': tone(410 + number(options.kind) * 29, 350 + number(options.kind) * 29, .045, peak * .23, 0, 'triangle'); break;
        case 'move': hiss(680, .035, peak * .2, pan, 'lowpass'); break;
        case 'dry': tone(180, 115, .11, peak * .35, 0, 'triangle'); break;
        case 'reset': hiss(1300, .17, peak * .4, 0); break;
        case 'ignite': fire(peak * 1.2, pan); break;
        case 'boil': water(peak * .8, pan); hiss(2400, .3, peak * .55, pan, 'highpass', .04); break;
        case 'condense': water(peak * .6, pan); break;
        case 'freeze': crystal(peak, pan, true); break;
        case 'thaw': crystal(peak * .45, pan); water(peak * .5, pan); break;
        case 'melt': metal(peak * .5, pan); hiss(760, .23, peak * .7, pan); break;
        case 'solidify': metal(peak * .7, pan); earth(peak * .4, pan); break;
        case 'extinguish': hiss(2200, .34, peak, pan, 'highpass'); water(peak * .35, pan); break;
        case 'lightning': lightning(peak * 1.45, pan); break;
      }
      return true;
    } catch { fail(); return false; }
  }

  globalThis.document?.addEventListener('visibilitychange', () => {
    if (hidden()) silence();
    else if (enabled) applyActivity();
  });

  return {
    unlock,
    setEnabled(value) {
      enabled = Boolean(value) && available && unlocked;
      try { applyActivity(); } catch { fail(); }
      return enabled;
    },
    setActivity(value = {}) {
      activity = { ...activity, ...value };
      if (!context) return;
      try { applyActivity(); } catch { fail(); }
    },
    trigger,
    suspend: silence,
    get enabled() { return enabled; },
    get available() { return available; },
  };
}
