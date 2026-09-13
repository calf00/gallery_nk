/** Quiet, local Web Audio effects. No audio files, network calls or autoplay. */
export function createGallerySound({ createContext = () => {
  const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
  return AudioContext ? new AudioContext() : null;
} } = {}) {
  let context = null, master = null, noiseBuffer = null, enabled = true, suspended = false, disposed = false;
  let pourLoop = null, motorLoop = null, dropClock = 0, walkDistance = 0, stepClock = .35;
  let previousClaw = 'idle', previousInGame = false, seed = 57391;
  const voices = new Set();
  const random = () => { seed = seed * 16807 % 2147483647; return (seed - 1) / 2147483646; };
  const audible = () => master && context?.state === 'running' && enabled && !suspended && !disposed;
  function unlock() {
    if (disposed || !enabled || suspended) return;
    try {
      if (!context) {
        context = createContext(); if (!context) return;
        master = context.createGain(); master.gain.value = .32; master.connect(context.destination);
        noiseBuffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
        const samples = noiseBuffer.getChannelData(0);
        for (let i = 0; i < samples.length; i++) samples[i] = random() * 2 - 1;
      }
      if (context.state === 'suspended') context.resume().catch(() => {});
    } catch { context = master = null; /* Audio failure must never interrupt the gallery. */ }
  }
  function voice(source, filter, gain) {
    source.connect(filter); filter.connect(gain); gain.connect(master);
    const record = { source, gain, stop() {
      const now = context.currentTime;
      gain.gain.cancelScheduledValues(now); gain.gain.setTargetAtTime(0, now, .006);
      try { source.stop(now + .025); } catch { /* Already ended. */ }
    } };
    voices.add(record);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); voices.delete(record); };
    return record;
  }
  function envelope(gain, time, duration, volume) {
    gain.gain.setValueAtTime(.0001, time);
    gain.gain.linearRampToValueAtTime(volume, time + .006);
    gain.gain.exponentialRampToValueAtTime(.0001, time + duration);
  }
  function tone(frequency, endFrequency, duration, volume, offset = 0, type = 'sine') {
    if (!audible()) return;
    const now = context.currentTime + offset, oscillator = context.createOscillator();
    oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, now + duration);
    const filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 2600;
    const gain = context.createGain(); envelope(gain, now, duration, volume);
    voice(oscillator, filter, gain); oscillator.start(now); oscillator.stop(now + duration + .01);
  }
  function noise(frequency, duration, volume) {
    if (!audible()) return;
    const source = context.createBufferSource(); source.buffer = noiseBuffer;
    const filter = context.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = frequency; filter.Q.value = .65;
    const gain = context.createGain(), now = context.currentTime; envelope(gain, now, duration, volume);
    voice(source, filter, gain); source.start(now, random() * .7); source.stop(now + duration + .01);
  }
  function loop(kind) {
    const source = kind === 'pour' ? context.createBufferSource() : context.createOscillator();
    if (kind === 'pour') { source.buffer = noiseBuffer; source.loop = true; }
    else { source.type = 'triangle'; source.frequency.value = 145; }
    const filter = context.createBiquadFilter(); filter.type = kind === 'pour' ? 'bandpass' : 'lowpass';
    filter.frequency.value = kind === 'pour' ? 1000 : 540; filter.Q.value = .6;
    const gain = context.createGain(); gain.gain.value = 0; gain.gain.setValueAtTime(0, context.currentTime);
    gain.gain.linearRampToValueAtTime(kind === 'pour' ? .075 : .052, context.currentTime + .045);
    const result = voice(source, filter, gain); source.start(context.currentTime); return result;
  }
  function halt() {
    for (const record of voices) record.stop();
    pourLoop = motorLoop = null; dropClock = walkDistance = 0; stepClock = .35;
  }
  function tick(deltaMs, { distance = 0, surface = 'carpet', coffee = 'empty', claw = 'idle', inGame = false, motor = false } = {}) {
    if (disposed) return;
    const beforeClaw = previousClaw, startedGame = inGame && !previousInGame;
    previousClaw = claw; previousInGame = inGame;
    if (!audible()) return;
    const dt = Math.min(.1, Math.max(0, deltaMs / 1000));
    if (distance > .00001 && dt > 0) {
      walkDistance += Math.min(distance, .5); stepClock += dt;
      if (walkDistance >= .46 && stepClock >= .34) {
        const variation = .94 + random() * .12;
        // Short, light sole taps: no low-frequency heel thump or lingering bass.
        noise(surface === 'grass' ? 1800 : surface === 'hard' ? 1750 : 1450, .042, (surface === 'grass' ? .095 : .075) * variation);
        tone(surface === 'hard' ? 620 : 480, surface === 'hard' ? 390 : 330, .023, .028 * variation);
        walkDistance %= .50; stepClock = 0;
      }
    } else { walkDistance = 0; stepClock = .35; }
    if (coffee === 'pouring') {
      if (!pourLoop) pourLoop = loop('pour');
      dropClock -= dt;
      if (dropClock <= 0) {
        const frequency = 430 + random() * 520;
        tone(frequency, frequency * (1.7 + random() * .5), .055 + random() * .045, .085 + random() * .055);
        noise(1700, .05, .055);
        dropClock = .075 + random() * .095;
      }
    } else { pourLoop?.stop(); pourLoop = null; dropClock = 0; }
    if (motor) {
      if (!motorLoop) motorLoop = loop('motor');
      motorLoop.source.frequency.setTargetAtTime(claw === 'lifting' ? 185 : claw === 'returning' ? 125 : 145, context.currentTime, .07);
    } else { motorLoop?.stop(); motorLoop = null; }
    if (startedGame) { tone(660, 660, .075, .10); tone(880, 880, .12, .09, .09); }
    if (claw !== beforeClaw) {
      if (claw === 'dropping') tone(740, 430, .11, .12, 0, 'triangle');
      if (claw === 'lifting') { noise(2100, .055, .13); tone(160, 90, .065, .10); }
      if (claw === 'releasing') noise(1550, .07, .12);
      if (claw === 'aiming' && beforeClaw === 'lifting') { tone(392, 392, .12, .075); tone(330, 330, .15, .07, .14); }
      if (claw === 'won') {
        noise(700, .10, .15);
        for (const [i, note] of [523.25, 659.25, 783.99, 1046.5].entries()) tone(note, note, i === 3 ? .34 : .14, .11, .05 + i * .12, 'triangle');
      }
    }
  }
  function setEnabled(value) {
    enabled = Boolean(value);
    if (!enabled) halt(); else unlock();
    if (master) master.gain.setTargetAtTime(enabled && !suspended ? .32 : 0, context.currentTime, .008);
  }
  function setSuspended(value) {
    suspended = Boolean(value);
    if (suspended) { halt(); if (context?.state === 'running') context.suspend().catch(() => {}); }
    else { if (context) unlock(); if (master) master.gain.setTargetAtTime(enabled ? .32 : 0, context.currentTime, .008); }
  }
  return { unlock, tick, setEnabled, setSuspended, reset: halt, get enabled() { return enabled; }, dispose() {
    if (disposed) return;
    halt(); disposed = true; master?.disconnect();
    if (context && context.state !== 'closed') context.close().catch(() => {});
  } };
}
