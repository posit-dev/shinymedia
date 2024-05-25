class AudioSpinnerElement extends HTMLElement {
  #audio!: HTMLAudioElement;
  #canvas!: HTMLCanvasElement;
  #ctx2d!: CanvasRenderingContext2D;
  #analyzer!: AnalyserNode;
  #dataArray!: Float32Array;
  #smoother!: Smoother<Float32Array>;
  #lastKnownSeconds = 0;

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
    this.#audio.onended = () => {
      this.style.transition = "opacity 0.5s 1s";
      this.classList.add("fade");
      this.addEventListener("transitionend", () => {
        this.remove();
      });
    };

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
    this.#ctx2d.scale(window.devicePixelRatio, window.devicePixelRatio);
    new ResizeObserver(() => {
      this.#canvas.width = this.clientWidth;
      this.#canvas.height = this.clientHeight;
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

    this.#audio.play();
  }

  #draw() {
    if (!this.isConnected) {
      return;
    }

    requestAnimationFrame(() => this.#draw());

    const width = this.#canvas.width;
    const height = this.#canvas.height;
    this.#ctx2d.clearRect(0, 0, width, height);

    this.#analyzer.getFloatTimeDomainData(this.#dataArray);
    const smoothed = this.#smoother.add(new Float32Array(this.#dataArray));

    const {
      spinVelocity,
      gap,
      thickness,
      minRadius,
      radiusFactor,
      steps,
      blades,
    } = this.#getSettings(width, height);

    const avg =
      (smoothed.reduce((a, b) => a + Math.abs(b), 0) / smoothed.length) * 4;

    const radius = minRadius + (avg * (height - minRadius)) / radiusFactor;
    for (let step = 0; step < steps; step++) {
      const this_radius = radius - step * (radius / (steps + 1));
      if (step === steps - 1) {
        this.#drawPie(width, height, 0, Math.PI * 2, this_radius, thickness);
      } else {
        const seconds =
          this.#lastKnownSeconds && this.#audio.paused && !this.#audio.ended
            ? this.#lastKnownSeconds
            : new Date().getTime() / 1000;
        this.#lastKnownSeconds = seconds;
        const startAngle = (seconds * spinVelocity) % (Math.PI * 2);
        for (let blade = 0; blade < blades; blade++) {
          const angleOffset = ((Math.PI * 2) / blades) * blade;
          const sweep = (Math.PI * 2) / blades - gap;
          this.#drawPie(
            width,
            height,
            startAngle + angleOffset,
            sweep,
            this_radius,
            thickness
          );
        }
      }
    }
  }

  #drawPie(
    width: number,
    height: number,
    startAngle: number,
    sweep: number,
    radius: number,
    thickness?: number
  ) {
    this.#ctx2d.beginPath();
    this.#ctx2d.fillStyle = this.#canvas
      .computedStyleMap()
      .get("color")
      ?.toString()!;
    if (!thickness) {
      this.#ctx2d.moveTo(width / 2, height / 2);
    }
    this.#ctx2d.arc(
      width / 2,
      height / 2,
      radius,
      startAngle,
      startAngle + sweep
    );
    if (!thickness) {
      this.#ctx2d.lineTo(width / 2, height / 2);
    } else {
      this.#ctx2d.arc(
        width / 2,
        height / 2,
        radius - thickness,
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
      spinVelocity: 5,
      gap: Math.PI / 5,
      thickness: 2.5,
      minRadius: Math.min(width, height) / 6,
      radiusFactor: 1.8,
      steps: 3,
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
