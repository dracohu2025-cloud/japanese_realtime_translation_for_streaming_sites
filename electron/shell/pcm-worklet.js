class KotobaPCM extends AudioWorkletProcessor {
  constructor() {
    super();
    this.samples = new Int16Array(1600);
    this.offset = 0;
    this.peak = 0;
  }
  process(inputs) {
    const channels = inputs[0];
    if (!channels?.length) return true;
    for (let i = 0; i < channels[0].length; i++) {
      let sample = 0;
      for (const channel of channels) sample += channel[i] || 0;
      sample = Math.max(-1, Math.min(1, sample / channels.length));
      this.peak = Math.max(this.peak, Math.abs(sample));
      this.samples[this.offset++] = sample < 0 ? sample * 32768 : sample * 32767;
      if (this.offset === this.samples.length) {
        this.port.postMessage({ buffer: this.samples.buffer, level: this.peak }, [this.samples.buffer]);
        this.samples = new Int16Array(1600);
        this.offset = 0;
        this.peak = 0;
      }
    }
    return true;
  }
}
registerProcessor('kotoba-pcm', KotobaPCM);
