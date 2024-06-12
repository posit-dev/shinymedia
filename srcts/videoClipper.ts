class VideoClipperElement extends HTMLElement {
  video: HTMLVideoElement;
  avSettingsMenu!: AVSettingsMenuElement;
  buttonRecord!: HTMLButtonElement;
  buttonStop!: HTMLButtonElement;

  cameraStream?: MediaStream;
  micStream?: MediaStream;

  recorder?: MediaRecorder;
  chunks: Blob[] = [];

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot!.innerHTML = `
        <style>
          :host {
            display: grid;
            grid-template-rows: 1fr;
            grid-template-columns: 1fr;
            width: 100%;
            height: min-content;
          }
          video {
            grid-column: 1 / 2;
            grid-row: 1 / 2;
            width: 100%;
            object-fit: cover;
            background-color: var(--video-clip-bg, black);
            aspect-ratio: auto 16 / 9;
            border-radius: var(--video-clip-border-radius, var(--bs-border-radius-lg));
          }
          video.mirrored {
            transform: scaleX(-1);
          }
          .panel-settings {
            grid-column: 1 / 2;
            grid-row: 1 / 2;
            justify-self: end;
            margin: 0.5em;
          }
          .panel-buttons {
            grid-column: 1 / 2;
            grid-row: 1 / 2;
            justify-self: end;
            align-self: end;
            margin: 0.5em;
          }
        </style>
        <video part="video" muted playsinline></video>
        <div class="panel-settings">
          <slot name="settings"></slot>
        </div>
        <div class="panel-buttons">
          <slot name="recording-controls"></slot>
        </div>
    `;
    this.video = this.shadowRoot!.querySelector("video")!;
  }
  connectedCallback() {
    (async () => {
      const slotSettings = this.shadowRoot!.querySelector(
        "slot[name=settings]"
      )! as HTMLSlotElement;
      slotSettings.addEventListener("slotchange", async () => {
        this.avSettingsMenu =
          slotSettings.assignedElements()[0] as AVSettingsMenuElement;
        await this.#initializeMediaInput();
        if (this.buttonRecord) {
          this.#setEnabledButton(this.buttonRecord);
        }
      });

      const slotControls = this.shadowRoot!.querySelector(
        "slot[name=recording-controls]"
      )! as HTMLSlotElement;
      slotControls.addEventListener("slotchange", () => {
        const findButton = (selector: string): HTMLElement | null => {
          for (const el of slotControls.assignedElements()) {
            if (el.matches(selector)) {
              return el as HTMLElement;
            }
            const sub = el.querySelector(selector);
            if (sub) {
              return sub as HTMLElement;
            }
          }
          return null;
        };
        this.buttonRecord = findButton(".record-button")! as HTMLButtonElement;
        this.buttonStop = findButton(".stop-button")! as HTMLButtonElement;

        this.#setEnabledButton();

        this.buttonRecord.addEventListener("click", () => {
          this.dispatchEvent(new CustomEvent("recordstart"));
          this.#setEnabledButton(this.buttonStop);
          this._beginRecord();
        });
        this.buttonStop.addEventListener("click", () => {
          this._endRecord();
          this.#setEnabledButton(this.buttonRecord);
        });
      });
    })().catch((err) => {
      console.error(err);
    });
  }

  disconnectedCallback() {}

  #setEnabledButton(btn?: HTMLButtonElement) {
    this.buttonRecord.style.display =
      btn === this.buttonRecord ? "inline-block" : "none";
    this.buttonStop.style.display =
      btn === this.buttonStop ? "inline-block" : "none";
  }

  async setMediaDevices(
    cameraId: string | null,
    micId: string | null
  ): Promise<{ cameraId: string; micId: string }> {
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach((track) => track.stop());
    }

    this.cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: cameraId || undefined,
        // If cameraId is not specified, default to the selfie cam
        facingMode: cameraId ? undefined : "user",
      },
      audio: {
        deviceId: micId || undefined,
      },
    });

    // TODO: I can't figure out how to tell if this is actually a selfie cam.
    // Ideally we wouldn't mirror unless we are sure.
    const label = this.cameraStream.getVideoTracks()[0].label;
    const isSelfieCam =
      hasConstraint(
        this.cameraStream.getVideoTracks()[0].getCapabilities().facingMode,
        "user"
      ) || /facetime|isight|front/i.test(label);
    this.video.classList.toggle("mirrored", isSelfieCam);

    /* Prevent the height from jumping around when switching cameras */
    const aspectRatio = this.cameraStream
      .getVideoTracks()[0]
      .getSettings().aspectRatio;
    if (aspectRatio) {
      this.video.style.aspectRatio = `${aspectRatio}`;
    } else {
      this.video.style.aspectRatio = "";
    }
    this.video.srcObject = this.cameraStream!;
    try {
      await this.video.play();
      this.video.style.aspectRatio = "";
    } catch (err) {
      console.error("Error playing video: ", err);
    }

    return {
      cameraId: this.cameraStream.getVideoTracks()[0].getSettings().deviceId!,
      micId: this.cameraStream.getAudioTracks()[0].getSettings().deviceId!,
    };
  }

  async #initializeMediaInput() {
    // Retrieve the user's previous camera and mic settings, if they ever
    // explicitly chose one
    const savedCamera = window.localStorage.getItem("multimodal-camera");
    const savedMic = window.localStorage.getItem("multimodal-mic");

    // Initialize the camera and mic with the saved settings. It's important to
    // request camera/mic access _before_ we attempt to enumerate devices,
    // because if the user has not granted camera/mic access, enumerateDevices()
    // will not prompt the user for permission and will instead return empty
    // devices.
    //
    // The return values are the actual camera and mic IDs that were used, which
    // may be different from the saved values if those devices are no longer
    // available.
    const { cameraId, micId } = await this.setMediaDevices(
      savedCamera,
      savedMic
    );

    // Populate the camera and mic dropdowns with the available devices
    const devices = await navigator.mediaDevices.enumerateDevices();
    this.avSettingsMenu.setCameras(
      devices.filter((dev) => dev.kind === "videoinput")
    );
    this.avSettingsMenu.setMics(
      devices.filter((dev) => dev.kind === "audioinput")
    );

    // Update the dropdown UI to reflect the actual devices that were used
    this.avSettingsMenu.cameraId = cameraId;
    this.avSettingsMenu.micId = micId;

    // Listen for changes to the camera and mic dropdowns
    const handleDeviceChange = async (
      deviceType: string,
      deviceId: string | null
    ) => {
      if (!deviceId) return;
      window.localStorage.setItem(`multimodal-${deviceType}`, deviceId);
      await this.setMediaDevices(
        this.avSettingsMenu.cameraId,
        this.avSettingsMenu.micId
      );
    };
    this.avSettingsMenu.addEventListener("camera-change", (e) => {
      handleDeviceChange("camera", this.avSettingsMenu.cameraId);
    });
    this.avSettingsMenu.addEventListener("mic-change", (e) => {
      handleDeviceChange("mic", this.avSettingsMenu.micId);
    });
  }

  _beginRecord() {
    // Create a MediaRecorder object
    this.recorder = new MediaRecorder(this.cameraStream!, {
      mimeType: this.dataset.mimeType,
      videoBitsPerSecond: safeFloat(this.dataset.videoBitsPerSecond),
      audioBitsPerSecond: safeFloat(this.dataset.audioBitsPerSecond),
    });

    this.recorder.addEventListener("error", (e) => {
      console.error("MediaRecorder error:", (e as ErrorEvent).error);
    });
    this.recorder.addEventListener("dataavailable", (e) => {
      // console.log("chunk: ", e.data.size, e.data.type);
      this.chunks.push(e.data);
    });
    this.recorder.addEventListener("start", () => {
      // console.log("Recording started");
    });
    this.recorder.addEventListener("stop", () => {
      // console.log("Recording stopped");
      if (this.chunks.length === 0) {
        console.warn("No data recorded");
        return;
      }

      const blob = new Blob(this.chunks, { type: this.chunks[0].type });

      // emit blobevent
      const event = new BlobEvent("data", {
        data: blob,
      });
      try {
        this.dispatchEvent(event);
      } finally {
        this.chunks = [];
      }
    });
    this.recorder.start();
  }

  _endRecord(emit: boolean = true) {
    this.recorder!.stop();
  }
}
customElements.define("video-clipper", VideoClipperElement);

function safeFloat(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const floatVal = parseFloat(value);
  if (isNaN(floatVal)) {
    return undefined;
  }
  return floatVal;
}

function hasConstraint(
  constraint: ConstrainDOMString | ConstrainDOMStringParameters | undefined,
  value: string
): boolean {
  if (constraint === undefined) {
    return false;
  }
  if (Array.isArray(constraint)) {
    return constraint.includes(value);
  }
  if (typeof constraint === "string") {
    return constraint === value;
  }
  if (constraint instanceof Object) {
    if (constraint.exact) {
      if (hasConstraint(constraint.exact, value)) {
        return true;
      }
    }
    if (constraint.ideal) {
      if (hasConstraint(constraint.ideal, value)) {
        return true;
      }
    }
  }
  return false;
}
