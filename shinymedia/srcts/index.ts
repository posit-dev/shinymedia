import { BindScope } from "rstudio-shiny/srcts/types/src/shiny/bind";

// Register custom elements
import "./videoClipper";
import "./avSettingsMenu";
import "./audioSpinner";

// Create input binding to send video clips from <video-clipper> to Shiny
class VideoClipperBinding extends Shiny.InputBinding {
  #lastKnownValue = new WeakMap<HTMLElement, unknown>();
  #handlers = new WeakMap<HTMLElement, (ev: Event) => Promise<void>>();

  find(scope: BindScope): JQuery<HTMLElement> {
    return $(scope).find("video-clipper");
  }

  getValue(el: HTMLElement): unknown {
    return this.#lastKnownValue.get(el);
  }

  subscribe(el: HTMLElement, callback: (value: boolean) => void): void {
    const handler = async (ev: Event) => {
      const blob = (ev as BlobEvent).data;
      this.#lastKnownValue.set(
        el,
        `data:${blob.type};base64,${await base64(blob)}`
      );
      callback(true);
    };
    el.addEventListener("data", handler);
    this.#handlers.set(el, handler);
  }

  unsubscribe(el: HTMLElement): void {
    const handler = this.#handlers.get(el)!;
    el.removeEventListener("data", handler);
    this.#handlers.delete(el);
  }
}

window.Shiny.inputBindings.register(new VideoClipperBinding(), "video-clipper");

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
