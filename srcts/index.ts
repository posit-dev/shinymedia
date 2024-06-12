import { BindScope } from "rstudio-shiny/srcts/types/src/shiny/bind";

// Register custom elements
import "./videoClipper";
import "./avSettingsMenu";
import "./audioSpinner";

// Only run the following code if the Shiny object is available
if (window.Shiny) {
  // Create input binding to send video clips from <video-clipper> to Shiny
  class VideoClipperBinding extends Shiny.InputBinding {
    #lastKnownValue = new WeakMap<HTMLElement, unknown>();
    #handlers = new WeakMap<
      HTMLElement,
      [(ev: Event) => Promise<void>, (ev: Event) => void]
    >();

    find(scope: BindScope): JQuery<HTMLElement> {
      return $(scope).find("video-clipper.shiny-video-clip");
    }

    getValue(el: HTMLElement): unknown {
      return this.#lastKnownValue.get(el);
    }

    subscribe(el: HTMLElement, callback: (value: boolean) => void): void {
      const handler = async (ev: Event) => {
        const blob = (ev as BlobEvent).data;
        console.log(
          `Recorded video of type ${blob.type} and size ${blob.size} bytes`
        );
        const encoded = `data:${blob.type};base64,${await base64(blob)}`;
        this.#lastKnownValue.set(el, encoded);
        callback(true);
      };
      el.addEventListener("data", handler);

      const handler2 = (ev: Event) => {
        if (typeof el.dataset.resetOnRecord !== "undefined") {
          this.#lastKnownValue.set(el, null);
          callback(true);
        }
      };
      el.addEventListener("recordstart", handler2);

      this.#handlers.set(el, [handler, handler2]);
    }

    unsubscribe(el: HTMLElement): void {
      const handlers = this.#handlers.get(el)!;
      el.removeEventListener("data", handlers[0]);
      el.removeEventListener("recordstart", handlers[1]);
      this.#handlers.delete(el);
    }
  }

  window.Shiny.inputBindings.register(
    new VideoClipperBinding(),
    "video-clipper"
  );

  /**
   * Encode a Blob as a base64 string
   * @param blob The Blob to encode
   * @returns A base64-encoded string
   */
  async function base64(blob: Blob): Promise<string> {
    const buf = await blob.arrayBuffer();
    const results = [];
    const CHUNKSIZE = 1024;
    for (let i = 0; i < buf.byteLength; i += CHUNKSIZE) {
      const chunk = buf.slice(i, i + CHUNKSIZE);
      results.push(String.fromCharCode(...new Uint8Array(chunk)));
    }
    return btoa(results.join(""));
  }

  function bustAutoPlaySuppression() {
    // Create an AudioContext
    const audioContext = new AudioContext();

    // Create a buffer of 0.5 seconds of silence
    const buffer = audioContext.createBuffer(
      1,
      audioContext.sampleRate * 105,
      audioContext.sampleRate
    );

    // Fill the buffer with silence (it is already initialized to 0, so this step is not strictly necessary)
    // const channelData = buffer.getChannelData(0);
    // for (let i = 0; i < buffer.length; i++) {
    //     channelData[i] = 0;
    // }

    // Create a MediaStreamAudioDestinationNode
    const destination = audioContext.createMediaStreamDestination();

    // Create an AudioBufferSourceNode and set its buffer to the silent buffer
    const source = audioContext.createBufferSource();
    source.buffer = buffer;

    // Connect the source to the destination
    source.connect(destination);

    // Start the source
    source.start();

    // Create an <audio> element
    const audioElement = document.createElement("audio");
    audioElement.controls = true; // Add controls to the audio element for playback
    audioElement.autoplay = true; // Autoplay the audio element
    audioElement.style.display = "none"; // Hide the audio element
    audioElement.addEventListener("play", () => {
      audioElement.remove();
    });

    // Set the srcObject of the <audio> element to the MediaStream from the destination node
    audioElement.srcObject = destination.stream;

    // Append the <audio> element to the body (or any other desired location in the DOM)
    document.body.appendChild(audioElement);

    document.body.addEventListener(
      "click",
      () => {
        audioElement.play();
      },
      { capture: true, once: true }
    );
  }
  document.addEventListener("DOMContentLoaded", bustAutoPlaySuppression);
}
