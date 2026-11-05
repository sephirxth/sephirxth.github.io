// All sounds are synthesized locally. Creating this object never unlocks audio.
// Each material sings one of the five tones (宫商角徵羽); where you write picks the degree,
// so a stroke across the canvas plays a pentatonic run. Everything passes a small hall reverb.
export function createAudio() {
  const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
  let available = typeof AudioContext === 'function', enabled = false, unlocked = false;
  let context, master, bus, noise, ambient = [], pendingResume;
  let activity = { fire: 0, water: 0, steam: 0, charge: 0, paused: false };
  const voices = new Set(), last = new Map();
  const maxVoices = 30, masterVolume = .42;
  let tokens = 10, tokenTime = 0;
  const hidden = () => Boolean(globalThis.document?.hidden);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const number = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
  const rand = (a, b) => a + Math.random() * (b - a);
  const canPlay = () => available && enabled && unlocked && context && !hidden() && !activity.paused;
  // Semitone of each material's tone above C: 土宫 金商 木角 火徵 水羽.
  const TONE = { 1: 9, 2: 7, 3: 4, 4: 2, 5: 0, 6: 9, 7: 9, 8: 2, 9: 0, 10: 2 };
  const PENTA = [0, 2, 4, 7, 9];
  const hz = semitones => 130.81 * Math.pow(2, semitones / 12);

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
    for (const voice of [...voices]) voice.stopNow();
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

  function hall(seconds = 2.4) {
    const rate = context.sampleRate, length = Math.floor(rate * seconds), ir = context.createBuffer(2, length, rate);
    for (let channel = 0; channel < 2; channel++) {
      const data = ir.getChannelData(channel);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.6) * (i < rate * .012 ? .25 : 1);
      for (const ms of [17, 29, 41, 53]) { const i = Math.floor(rate * ms / 1000) + channel * 3; if (i < length) data[i] += (channel ? -.5 : .5); }
    }
    return ir;
  }

  function makeGraph() {
    context = new AudioContext({ latencyHint: 'interactive' });
    master = context.createGain();
    master.gain.value = 0;
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -16;
    limiter.knee.value = 12;
    limiter.ratio.value = 5;
    limiter.attack.value = .004;
    limiter.release.value = .18;
    master.connect(limiter).connect(context.destination);
    bus = context.createGain();
    const wet = context.createGain(), reverb = context.createConvolver();
    reverb.buffer = hall();
    wet.gain.value = .3;
    bus.connect(master);
    bus.connect(reverb).connect(wet).connect(master);
    noise = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const samples = noise.getChannelData(0);
    // Independent audio noise never consumes the simulation's random sequence.
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    ambient = [makeAmbient(190, 'lowpass', .73), makeAmbient(700, 'bandpass', 1.13), makeAmbient(2600, 'highpass', .91), makeAmbient(110, 'bandpass', .61)];
  }

  // A note group: several sources share one filter and panner, and clean up together.
  function group(pan, lowpass = 0) {
    if (voices.size >= maxVoices) return null;
    const input = context.createGain(), nodes = [input];
    let tail = input;
    if (lowpass) { const filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = lowpass; filter.Q.value = .4; tail.connect(filter); tail = filter; nodes.push(filter); }
    if (context.createStereoPanner) { const panner = context.createStereoPanner(); panner.pan.value = pan; tail.connect(panner); tail = panner; nodes.push(panner); }
    tail.connect(bus);
    const sources = [];
    let ended = 0, done = false;
    const voice = {
      input, nodes,
      add(source, start, stop, offset = 0) {
        sources.push(source);
        source.onended = () => { if (++ended >= sources.length) voice.cleanup(); };
        source.start(start, offset); source.stop(stop);
      },
      stopNow() { for (const source of sources) { try { source.stop(); } catch { /* Already ended. */ } } voice.cleanup(); },
      cleanup() { if (done) return; done = true; voices.delete(voice); for (const node of [...sources, ...nodes]) { try { node.disconnect(); } catch { /* Gone. */ } } },
    };
    voices.add(voice);
    return voice;
  }
  function tone(voice, frequency, at, attack, decay, peak, type = 'sine', bend = 1) {
    if (!voice) return;
    const source = context.createOscillator(), envelope = context.createGain();
    source.type = type;
    source.frequency.setValueAtTime(frequency, at);
    if (bend !== 1) source.frequency.exponentialRampToValueAtTime(Math.max(20, frequency * bend), at + attack + decay);
    envelope.gain.setValueAtTime(.0001, at);
    envelope.gain.exponentialRampToValueAtTime(Math.max(.0002, peak), at + attack);
    envelope.gain.exponentialRampToValueAtTime(.0001, at + attack + decay);
    source.connect(envelope).connect(voice.input); voice.nodes.push(envelope);
    voice.add(source, at, at + attack + decay + .05);
  }
  function hiss(voice, at, duration, peak, type, frequency, q = .8, sweep = 1, attack = .006) {
    if (!voice) return;
    const source = context.createBufferSource(), filter = context.createBiquadFilter(), envelope = context.createGain();
    source.buffer = noise; source.playbackRate.value = rand(.85, 1.15);
    filter.type = type; filter.frequency.setValueAtTime(frequency, at); filter.Q.value = q;
    if (sweep !== 1) filter.frequency.exponentialRampToValueAtTime(Math.max(40, frequency * sweep), at + duration);
    envelope.gain.setValueAtTime(.0001, at);
    envelope.gain.exponentialRampToValueAtTime(Math.max(.0002, peak), at + Math.min(attack, duration * .5));
    envelope.gain.exponentialRampToValueAtTime(.0001, at + duration);
    source.connect(filter).connect(envelope).connect(voice.input); voice.nodes.push(filter, envelope);
    if (duration > 1.6) source.loop = true;
    voice.add(source, at, at + duration + .05, rand(0, Math.max(0, 1.9 - duration)));
  }

  // Instruments
  function pluck(f, peak, pan, at, decay = 1.3, bright = 3600) {
    const v = group(pan, bright); if (!v) return;
    for (const [ratio, amp] of [[1, 1], [2, .42], [3, .17], [4.02, .07]]) tone(v, f * ratio, at, .004, decay / (1 + (ratio - 1) * .45), peak * amp, 'sine', .9975);
    hiss(v, at, .022, peak * .35, 'bandpass', Math.min(5000, f * 6), 1.2);
  }
  function chime(f, peak, pan, at, decay = 2.6) {
    const v = group(pan, 6500); if (!v) return;
    for (const [ratio, amp] of [[1, 1], [2.76, .42], [5.4, .2], [8.93, .08]]) tone(v, f * ratio, at, .002, decay / (1 + (ratio - 1) * .3), peak * amp);
  }
  function glass(f, peak, pan, at) {
    const v = group(pan, 9000); if (!v) return;
    for (const [ratio, amp] of [[1, 1], [3.2, .38], [6.1, .16]]) tone(v, f * ratio, at, .002, 1.1 / ratio, peak * amp);
    hiss(v, at, .03, peak * .3, 'highpass', 6500, .7);
  }
  function droplet(f, peak, pan, at) {
    const v = group(pan, 5000); if (!v) return;
    tone(v, f, at, .003, .13, peak, 'sine', .55);
    tone(v, f * 2.1, at + .012, .002, .05, peak * .3, 'sine', .7);
  }
  function crackle(peak, pan, at) {
    const v = group(clamp(pan + rand(-.3, .3), -1, 1)); if (!v) return;
    hiss(v, at, rand(.006, .02), peak * rand(.5, 1), 'highpass', rand(1800, 4200), .6, 1, .001);
  }
  function thunder(peak, pan, at) {
    let v = group(pan); if (v) { hiss(v, at, .05, peak * 1.3, 'highpass', 3200, .6, .5, .002); }
    v = group(pan * .6, 900);
    if (v) { hiss(v, at + .03, 2.3, peak * 1.2, 'lowpass', 220, .7, .5, .06); hiss(v, at + .42, 1.6, peak * .8, 'lowpass', 160, .7, .6, .12); tone(v, 46, at + .02, .02, 1.3, peak * .7, 'sine', .62); }
  }

  function note(kind, options) {
    const width = Math.max(2, number(options.width, 64)), height = Math.max(2, number(options.height, 34));
    const steps = 13, d = Math.round(clamp(number(options.x) / (width - 1), 0, 1) * (steps - 1));
    const lift = number(options.y, height) < height / 3 ? 12 : 0;
    return hz((TONE[kind] ?? 0) + PENTA[d % 5] + 12 * Math.floor(d / 5) + 12 + lift);
  }
  function writeSound(kind, peak, pan, options) {
    const at = context.currentTime + .005, f = note(kind, options);
    switch (kind) {
      case 1: droplet(f * 2, peak * .7, pan, at); pluck(f, peak * .55, pan, at, .8, 2600); break;
      case 2: pluck(f, peak * .8, pan, at, 1.1, 4200); for (let i = 0; i < 3; i++) crackle(peak * .35, pan, at + rand(.01, .12)); break;
      case 3: { const v = group(pan); if (v) { hiss(v, at, .07, peak * .7, 'bandpass', f * 2, 9, 1, .002); tone(v, f * 1.5, at, .002, .16, peak * .45); } pluck(f, peak * .45, pan, at, .9, 2400); break; }
      case 4: case 10: chime(f, peak * .55, pan, at); break;
      case 5: case 9: { const v = group(pan, 900); if (v) tone(v, f / 2, at, .004, .24, peak * .8, 'sine', .7); pluck(f, peak * .4, pan, at, .8, 1800); break; }
      case 6: glass(f * 2, peak * .5, pan, at); break;
      case 7: { const v = group(pan); if (v) { hiss(v, at, .5, peak * .4, 'bandpass', f * 2, 3, 1.2, .08); tone(v, f, at, .09, .45, peak * .25); } break; }
      case 8: { const v = group(pan, 5000); if (v) { tone(v, f * 4, at, .002, .06, peak * .3, 'sawtooth', .5); hiss(v, at, .05, peak * .5, 'highpass', 4000); } break; }
      default: { const v = group(pan); if (v) hiss(v, at, .1, peak * .45, 'bandpass', 1600, .9, 1.4); }
    }
  }

  function scheduleCrackles() {
    const fire = Math.max(0, number(activity.fire));
    if (!fire) return;
    const now = context.currentTime, n = Math.min(7, Math.round(fire * .06 * rand(.5, 1.5)));
    for (let i = 0; i < n; i++) crackle(.05 * Math.min(1.6, .5 + fire / 60), rand(-.7, .7), now + rand(.01, .19));
  }

  function applyActivity() {
    if (!canPlay()) { silence(); return; }
    ramp(master.gain, masterVolume, .035);
    const amounts = [activity.fire, activity.water, activity.steam, activity.charge];
    const scales = [22, 90, 35, 14], peaks = [.05, .022, .024, .02];
    ambient.forEach((track, i) => ramp(track.gain.gain, (1 - Math.exp(-Math.max(0, number(amounts[i])) / scales[i])) * peaks[i], .35));
    if (context.state === 'suspended' && !pendingResume) {
      pendingResume = context.resume().then(() => { if (!canPlay()) silence(); }).catch(fail).finally(() => { pendingResume = null; });
    }
    if (context.state === 'running') scheduleCrackles();
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

  const cooldowns = { write: .07, erase: .08, select: .07, move: .085, dry: .4, reset: .3, ignite: .16, boil: .16, condense: .2, freeze: .2, thaw: .2, melt: .22, solidify: .22, extinguish: .2, lightning: .3 };
  function trigger(type, options = {}) {
    if (!canPlay() || context.state !== 'running' || !Object.hasOwn(cooldowns, type)) return false;
    const now = context.currentTime, key = type === 'write' ? `${type}:${options.kind}` : type;
    if (now - (last.get(key) ?? -Infinity) < cooldowns[type]) return false;
    tokens = Math.min(10, tokens + Math.max(0, now - tokenTime) * 14);
    tokenTime = now;
    if (tokens < 1 || voices.size > maxVoices - 4) return false;
    tokens--;
    last.set(key, now);
    const strength = clamp(number(options.intensity, 1), .25, 2);
    const peak = .15 * Math.sqrt(strength);
    const pan = options.width > 1 ? clamp(number(options.x) / (options.width - 1) * 2 - 1, -1, 1) * .7 : 0;
    const at = now + .005;
    try {
      switch (type) {
        case 'write': writeSound(options.kind, peak, pan, options); break;
        case 'erase': { const v = group(pan); if (v) hiss(v, at, .12, peak * .45, 'bandpass', 1500, .9, 1.6, .02); break; }
        case 'select': pluck(hz((TONE[options.kind] ?? 0) + 24), peak * .22, 0, at, .5, 2400); break;
        case 'move': { const v = group(pan, 1200); if (v) tone(v, 220, at, .003, .05, peak * .18, 'triangle', .8); break; }
        case 'dry': { const v = group(0, 900); if (v) tone(v, 196, at, .01, .22, peak * .35, 'triangle', .75); break; }
        case 'reset': { const v = group(0); if (v) hiss(v, at, .45, peak * .35, 'bandpass', 700, 1.2, 4, .08); break; }
        case 'ignite': { const v = group(pan); if (v) hiss(v, at, .4, peak * .8, 'bandpass', 320, 1.1, 5.5, .05); pluck(hz(7), peak * .5, pan, at, 1.4, 1600); for (let i = 0; i < 4; i++) crackle(peak * .45, pan, at + rand(.02, .3)); break; }
        case 'boil': { for (let i = 0; i < 4; i++) droplet(rand(500, 1100), peak * .35, pan, at + rand(0, .22)); const v = group(pan); if (v) hiss(v, at, .32, peak * .4, 'highpass', 2600, .7, 1, .05); break; }
        case 'condense': droplet(hz(9 + 36), peak * .4, pan, at); droplet(hz(4 + 36), peak * .3, pan, at + .09); break;
        case 'freeze': [9, 16, 21].forEach((s, i) => glass(hz(s + 36), peak * .3, pan, at + i * .045)); break;
        case 'thaw': droplet(hz(9 + 24), peak * .45, pan, at); break;
        case 'melt': { chime(hz(2), peak * .55, pan, at, 3.2); const v = group(pan); if (v) hiss(v, at, .45, peak * .5, 'highpass', 3000, .7, 1, .04); break; }
        case 'solidify': chime(hz(14), peak * .4, pan, at, 1.8); break;
        case 'extinguish': { const v = group(pan); if (v) { hiss(v, at, .5, peak * .9, 'highpass', 2400, .7, 1.3, .03); hiss(v, at + .05, .3, peak * .3, 'bandpass', 900, 1.5, .7, .02); } break; }
        case 'lightning': thunder(peak * 1.5, pan, at); chime(hz(2 + 36), peak * .25, pan, at, 1.2); break;
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
