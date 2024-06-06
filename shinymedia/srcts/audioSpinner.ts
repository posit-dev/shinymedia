class AudioSpinnerElement extends HTMLElement {
  #audio!: HTMLAudioElement;
  #canvas!: HTMLCanvasElement;
  #ctx2d!: CanvasRenderingContext2D;
  #analyzer!: AnalyserNode;
  #dataArray!: Float32Array;
  #smoother!: Smoother<Float32Array>;
  #secondsOffset = 0;
  #tooltip?: bootstrap.Tooltip;

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot!.innerHTML = `
        <style>
          :host {
            display: block;
            position: relative;
          }
          ::slotted(canvas) {
            position: absolute;
            top: 0;
            left: 0;
            cursor: pointer;
          }
          ::slotted(audio) {
            display: none;
          }
        </style>
        <slot name="audio"></slot>
        <slot name="canvas"></slot>
        `;
  }

  connectedCallback() {
    // Create <audio>. This will play the sound.
    const audioSlot = this.shadowRoot!.querySelector(
      "slot[name=audio]"
    )! as HTMLSlotElement;
    this.#audio = this.ownerDocument.createElement("audio");
    // this.#audio.autoplay = true;
    this.#audio.controls = false;
    this.#audio.src = this.getAttribute("src")!;
    this.#audio.slot = "audio";
    audioSlot.assign(this.#audio);
    this.#audio.addEventListener("play", () => {
      this.#draw();
    });
    this.#audio.addEventListener("ended", () => {
      if (typeof this.dataset.autodismiss !== "undefined") {
        this.style.transition = "opacity 0.5s 1s";
        this.classList.add("fade");
        this.addEventListener("transitionend", () => {
          this.remove();
        });
      } else {
        // Use #secondsOffset to prevent the spinner from jumping when we move
        // the playhead back to the start
        this.#secondsOffset += this.#audio.currentTime;
        this.#audio.pause();
        this.#audio.currentTime = 0;
      }
    });

    // Create <canvas>. This will be the target of our vizualization.
    const canvasSlot = this.shadowRoot!.querySelector(
      "slot[name=canvas]"
    )! as HTMLSlotElement;
    this.#canvas = this.ownerDocument.createElement("canvas");
    this.#canvas.slot = "canvas";
    this.#canvas.width = this.clientWidth * window.devicePixelRatio;
    this.#canvas.height = this.clientHeight * window.devicePixelRatio;
    this.#canvas.style.width = this.clientWidth + "px";
    this.#canvas.style.height = this.clientHeight + "px";
    this.#canvas.onclick = () => {
      if (this.#audio.paused) {
        this.#audio.play();
      } else {
        this.#audio.pause();
      }
    };
    this.appendChild(this.#canvas);
    canvasSlot.assign(this.#canvas);
    this.#ctx2d = this.#canvas.getContext("2d")!;
    new ResizeObserver(() => {
      this.#canvas.width = this.clientWidth * 2;
      this.#canvas.height = this.clientHeight * 2;
      this.#canvas.style.width = this.clientWidth + "px";
      this.#canvas.style.height = this.clientHeight + "px";
    }).observe(this);

    // Initialize analyzer
    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaElementSource(this.#audio);
    this.#analyzer = new AnalyserNode(audioCtx, {
      fftSize: 2048,
    });
    this.#dataArray = new Float32Array(this.#analyzer.frequencyBinCount);
    source.connect(this.#analyzer);
    this.#analyzer.connect(audioCtx.destination);

    // Initialize persistent data structures needed for vizualization
    const dataArray2 = new Float32Array(this.#analyzer.frequencyBinCount);
    this.#smoother = new Smoother<Float32Array>(5, (samples) => {
      for (let i = 0; i < dataArray2.length; i++) {
        dataArray2[i] = 0;
        for (let j = 0; j < samples.length; j++) {
          dataArray2[i] += samples[j][i];
        }
        dataArray2[i] /= samples.length;
      }
      return dataArray2;
    });

    this.#draw();

    if (typeof this.dataset.autoplay !== "undefined") {
      this.#audio.play().catch((err) => {
        // Autoplay failed! Mobile Safari in particular requires a user gesture
        // to play audio. We'll show a tooltip to the user to let them know they
        // need to click/tap to play.
        this.#showTooltip();
      });
    }
  }

  disconnectedCallback() {
    if (this.#tooltip) {
      this.#tooltip.dispose();
      this.#tooltip = undefined;
    }
    if (!this.#audio.paused) {
      this.#audio.pause();
    }
  }

  #showTooltip() {
    // Autoplay failed
    const isMobile = /Mobi/.test(navigator.userAgent);
    const gesture = isMobile ? "Tap" : "Click";
    this.#tooltip = new window.bootstrap.Tooltip(this, {
      title: `${gesture} to play`,
      trigger: "manual",
      placement: "right",
    });
    this.#audio.addEventListener(
      "play",
      () => {
        if (this.#tooltip) {
          this.#tooltip.dispose();
          this.#tooltip = undefined;
        }
      },
      { once: true }
    );
    this.#tooltip.show();
  }

  #draw() {
    if (!this.isConnected) {
      return;
    }

    requestAnimationFrame(() => this.#draw());

    const pixelRatio = window.devicePixelRatio;
    const physicalWidth = this.#canvas.width;
    const physicalHeight = this.#canvas.height;
    const width = physicalWidth / pixelRatio;
    const height = physicalHeight / pixelRatio;
    this.#ctx2d.reset();
    this.#ctx2d.clearRect(0, 0, physicalWidth, physicalHeight);
    this.#ctx2d.scale(pixelRatio, pixelRatio);
    this.#ctx2d.translate(width / 2, height / 2);

    this.#analyzer.getFloatTimeDomainData(this.#dataArray);
    const smoothed = this.#smoother.add(new Float32Array(this.#dataArray));

    let {
      rpm,
      gap,
      stroke,
      minRadius,
      radiusCompression,
      radiusOverscan,
      steps,
      blades,
    } = this.#getSettings(width, height);

    if (blades === 0) {
      blades = 1;
      gap = 0;
    }

    stroke = Math.max(0, stroke);
    minRadius = Math.max(0, minRadius);
    steps = Math.max(0, steps);

    // A value between 0 and 1 representing the amplitude
    const scalarVal = Math.max(0, ...smoothed.map(Math.abs));
    // Compress the scalar value to make quieter sounds more visible
    const compressedScalarVal = Math.pow(scalarVal, radiusCompression);
    const maxRadius = (Math.min(width, height) / 2) * radiusOverscan;
    const radius = minRadius + compressedScalarVal * (maxRadius - minRadius);

    const sweep = (Math.PI * 2) / blades - gap;
    const staticAngle =
      Math.PI / -2 + // rotate -90 degrees to start at the top
      sweep / -2; // center the blade

    for (let step = 0; step < steps + 1; step++) {
      const this_radius = radius - step * (radius / (steps + 2));
      if (step === steps) {
        this.#drawPie(0, Math.PI * 2, this_radius, stroke);
      } else {
        const seconds = (this.#audio.currentTime || 0) + this.#secondsOffset;
        const spinVelocity = (rpm / 60) * Math.PI * 2;
        const startAngle =
          staticAngle + ((seconds * spinVelocity) % (Math.PI * 2));
        for (let blade = 0; blade < blades; blade++) {
          const angleOffset = ((Math.PI * 2) / blades) * blade;
          this.#drawPie(startAngle + angleOffset, sweep, this_radius, stroke);
        }
      }
    }
  }

  #drawPie(startAngle: number, sweep: number, radius: number, stroke?: number) {
    this.#ctx2d.beginPath();
    this.#ctx2d.fillStyle = window.getComputedStyle(this.#canvas).color;
    if (!stroke) {
      this.#ctx2d.moveTo(0, 0);
    }
    this.#ctx2d.arc(0, 0, radius, startAngle, startAngle + sweep);
    if (!stroke) {
      this.#ctx2d.lineTo(0, 0);
    } else {
      this.#ctx2d.arc(
        0,
        0,
        radius - stroke,
        startAngle + sweep,
        startAngle,
        true
      );
    }
    this.#ctx2d.fill();
  }

  #getSettings(width: number, height: number) {
    // Visualization settings
    const settings = {
      rpm: 10,
      gap: Math.PI / 5,
      stroke: 2.5,
      minRadius: Math.min(width, height) / 6,
      radiusCompression: 0.5,
      radiusOverscan: 1,
      steps: 2,
      blades: 3,
    };
    for (const key in settings) {
      const value = tryParseFloat(this.dataset[key]);
      if (typeof value !== "undefined") {
        Object.assign(settings, { [key]: value });
      }
    }
    return settings;
  }
}

window.customElements.define("audio-spinner", AudioSpinnerElement);

class Smoother<T> {
  #samples: T[] = [];
  #smooth: (samples: T[]) => T;
  #size: number;
  #pos: number;

  constructor(size: number, smooth: (samples: T[]) => T) {
    this.#size = size;
    this.#pos = 0;
    this.#smooth = smooth;
  }

  add(sample: T): T {
    this.#samples[this.#pos] = sample;
    this.#pos = (this.#pos + 1) % this.#size;
    return this.smoothed();
  }

  smoothed(): T {
    return this.#smooth(this.#samples);
  }
}

function tryParseFloat(str?: string): number | undefined {
  if (typeof str === "undefined") {
    return undefined;
  }
  const parsed = parseFloat(str);
  return isNaN(parsed) ? undefined : parsed;
}
