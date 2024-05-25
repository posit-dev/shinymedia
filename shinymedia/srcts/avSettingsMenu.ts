class DeviceChangeEvent extends CustomEvent<{ deviceId: string | null }> {
  constructor(type: string, detail: { deviceId: string | null }) {
    super(type, { detail });
  }
}

class AVSettingsMenuElement extends HTMLElement {
  constructor() {
    super();
    this.addEventListener("click", (e) => {
      if (e.target instanceof HTMLAnchorElement) {
        const a = e.target;
        if (a.classList.contains("camera-device-item")) {
          this.cameraId = a.dataset.deviceId!;
        } else if (a.classList.contains("mic-device-item")) {
          this.micId = a.dataset.deviceId!;
        }
      }
    });
  }

  #setDevices(deviceType: "camera" | "mic", devices: MediaDeviceInfo[]) {
    const deviceEls = devices.map((dev) =>
      this.#createDeviceElement(dev, `${deviceType}-device-item`)
    );
    const header = this.querySelector(`.${deviceType}-header`)!;
    header.after(...deviceEls);
  }

  setCameras(cameras: MediaDeviceInfo[]) {
    this.#setDevices("camera", cameras);
  }

  setMics(mics: MediaDeviceInfo[]) {
    this.#setDevices("mic", mics);
  }

  get cameraId(): string | null {
    return this.#getSelectedDevice("camera");
  }

  set cameraId(id: string | null) {
    this.#setSelectedDevice("camera", id);
  }

  get micId(): string | null {
    return this.#getSelectedDevice("mic");
  }

  set micId(id: string | null) {
    this.#setSelectedDevice("mic", id);
  }

  #createDeviceElement(dev: MediaDeviceInfo, className: string): HTMLLIElement {
    const li = this.ownerDocument.createElement("li");
    const a = li.appendChild(this.ownerDocument.createElement("a"));
    a.onclick = (e) => e.preventDefault();
    a.href = "#";
    a.textContent = dev.label;
    a.dataset.deviceId = dev.deviceId!;
    a.className = className;
    return li;
  }

  #getSelectedDevice(device: "camera" | "mic"): string | null {
    return (
      (
        this.querySelector(
          `a.${device}-device-item.active`
        ) as HTMLAnchorElement
      )?.dataset.deviceId ?? null
    );
  }

  #setSelectedDevice(device: "camera" | "mic", id: string | null) {
    this.querySelectorAll(`a.${device}-device-item.active`).forEach((a) =>
      a.classList.remove("active")
    );
    if (id) {
      this.querySelector(
        `a.${device}-device-item[data-device-id="${id}"]`
      )!.classList.add("active");
    }
    this.dispatchEvent(
      new DeviceChangeEvent(`${device}-change`, {
        deviceId: id,
      })
    );
  }
}
customElements.define("av-settings-menu", AVSettingsMenuElement);
