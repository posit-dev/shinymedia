import base64
import math
import os
from pathlib import Path

from faicons import icon_svg
from htmltools import HTMLDependency, TagAttrValue
from shiny import module, ui

__all__ = (
    "input_video_clip",
    "audio_spinner",
)

multimodal_dep = HTMLDependency(
    "multimodal",
    "0.0.1",
    source={
        "subdir": str(Path(__file__).parent / "dist"),
    },
    script={"src": "index.js"},
    stylesheet={"href": "index.css"},
)


def input_video_clip(
    id: str,
    *,
    reset_on_record: bool = True,
    mime_type: str | None = None,
    video_bits_per_second: int | None = None,
    audio_bits_per_second: int | None = None,
    **kwargs: TagAttrValue,
):
    """
    A video clip input control that records short videos from webcam.

    Parameters
    ----------
    id
        The input ID to use for this control.
    reset_on_record
        Whether to reset the video clip input value when recording starts. If
        `True`, the video clip input value will become `None` at the moment the
        Record button is pressed; if `False`, the value will not change until
        the user stops recording. By default, this is `True`.
    mime_type
        The MIME type of the video clip to record. By default, this is `None`,
        which means the browser will choose a suitable MIME type for video
        recording. Common MIME types include `video/webm` and
        `video/x-matroska`.
    video_bits_per_second
        The target video bitrate in bits per second. By default, this is `None`,
        which means the browser will choose a suitable bitrate for video
        recording (according to the spec, `2_500_000`). This is only a
        suggestion; the browser may choose a different bitrate.
    audio_bits_per_second
        The target audio bitrate in bits per second. By default, this is `None`,
        which means the browser will choose a suitable bitrate for audio
        recording. This is only a suggestion; the browser may choose a different
        bitrate.
    **kwargs
        Additional attributes for the video clip input, to be added directly to
        the `<video-clipper>` element.

    Returns
    -------
    ui.Tag
        The video clip input tag, to be inserted into a Shiny app. From the
        server's `input` object, you can access the video clip input value using
        the ID you provided here; for example, `input_video_clip("foo")` would
        be available as `input.foo()`. The value is either `None` (if no video
        has been recorded) or a base64-encoded data URL representing the video
        clip.
    """

    id = module.resolve_id(id)

    # Set or extend the class_ attribute
    extend_attr(kwargs, "class_", "shiny-video-clip")

    return ui.Tag(
        "video-clipper",
        multimodal_dep,
        ui.Tag(
            "av-settings-menu",
            ui.div(
                ui.tags.button(
                    icon_svg("gear").add_class("fw"),
                    class_="btn btn-sm btn-secondary dropdown-toggle px-3 py-2",
                    type="button",
                    data_bs_toggle="dropdown",
                ),
                ui.tags.ul(
                    ui.tags.li(
                        ui.tags.h6("Camera", class_="dropdown-header"),
                        class_="camera-header",
                    ),
                    # Camera items will go here
                    ui.tags.li(ui.tags.hr(class_="dropdown-divider")),
                    ui.tags.li(
                        ui.tags.h6("Microphone", class_="dropdown-header"),
                        class_="mic-header",
                    ),
                    # Microphone items will go here
                    class_="dropdown-menu",
                ),
                class_="btn-group",
            ),
            slot="settings",
        ),
        ui.div(
            ui.tags.button(
                ui.TagList(
                    ui.tags.div(
                        style="display: inline-block; background-color: red; width: 1rem; height: 1rem; border-radius: 100%; position: relative; top: 0.175rem; margin-right: 0.3rem;"
                    ),
                    "Record",
                ),
                style="display: block;",
                class_="record-button btn btn-secondary px-3 mx-auto",
            ),
            ui.tags.button(
                ui.TagList(
                    ui.tags.div(
                        style="display: inline-block; background-color: currentColor; width: 1rem; height: 1rem; position: relative; top: 0.175rem; margin-right: 0.3rem;"
                    ),
                    "Stop",
                ),
                style="display: block;",
                class_="stop-button btn btn-secondary px-3 mx-auto",
            ),
            slot="recording-controls",
            class_="btn-group",
            aria_label="Recording controls",
        ),
        id=id,
        data_reset_on_record=reset_on_record,
        data_mime_type=mime_type,
        data_video_bits_per_second=video_bits_per_second,
        data_audio_bits_per_second=audio_bits_per_second,
        **kwargs,
    )


def audio_spinner(
    *,
    src: str,
    rpm: float = 10,
    gap: float = math.pi / 5,
    stroke: float = 2.5,
    min_radius: float = 30,
    radius_compression: float = 0.8,
    radius_overscan: float = 1.1,
    steps: float = 2,
    blades: float = 3,
    width: str = "125px",
    height: str = "125px",
    autoplay: bool = True,
    autodismiss: bool = False,
    class_="mx-auto",
    **kwargs: TagAttrValue,
):
    """Create an audio spinner.

    Parameters
    ----------
    src
        The source of the audio file. If this is a path to a file that exists,
        the file will be read and embedded as a base64-encoded data URL. Any
        other value will be passed through as the `src` attribute of the
        `<audio>` element.
    rpm
        The speed of the spinner, in clockwise revolutions per minute. By
        default, it's 10 RPM. Use 0 to disable rotation, or a negative value to
        rotate counter-clockwise.
    gap
        The gap between the blades of the spinner, in radians. By default it's
        `π/5`, or 36°.
    stroke
        The stroke thickness of the individual arcs that make up each blade of
        the spinner, in pixels. By default, 2.5.
    min_radius
        The radius of the spinner when there is only silence, in pixels; default
        is 30.
    radius_compression
        The raw `[-1, 1]` amplitude of the audio is compressed using
        `x^radius_compression` to make the spinner more responsive to quiet
        sounds. By default, this is 0.8. Set to 1.0 to disable compression.
        (Note that this only affects the vizualization, not the audio playback.)
    radius_overscan
        Use this parameter to set the maximum possible radius of the spinner,
        relative to the width/height of the container. By default, this is 1.1,
        meaning the spinner radius will be scaled such that at maximum
        amplitude, it will be 10% larger than the container (the spinner blades
        will be clipped). Use larger values if you're expecting generally quiet
        audio.
    steps
        The number of concetric arcs that make up each blade of the spinner, not
        including the central circle. By default, this is 2.
    blades
        The number of blades in the spinner, by default 3. Set to 0 to use
        concentric circles instead of blades.
    width
        The width of the spinner in CSS units, by default "125px".
    height
        The height of the spinner in CSS units, by default "125px".
    autoplay
        Whether to autoplay the audio, by default True. Note that many browsers
        will not allow autoplaying audio without user interaction; if autoplay
        fails, the spinner will show a tooltip instructing the user to tap or
        click to start the audio.
    autodismiss
        Whether to remove the spinner after the audio finishes playing, by
        default False.
    class_ : str, optional
        The class of the spinner, by default "mx-auto" which horizontally
        centers the element inside its container (assuming Bootstrap is loaded).
    **kwargs : TagAttrValue
        Additional attributes for the spinner, to be added directly to the
        `<audio-spinner>` element.

    Returns
    -------
    ui.Tag
        The audio spinner tag.
    """

    if width:
        extend_attr(kwargs, "style", f"width: {width};")
    if height:
        extend_attr(kwargs, "style", f"height: {height};")

    if os.path.isfile(src):
        with open(src, "rb") as f:
            src = f"data:audio/mpeg;base64,{base64.b64encode(f.read()).decode('utf-8')}"

    return ui.Tag(
        "audio-spinner",
        multimodal_dep,
        class_=class_,
        data_rpm=rpm,
        data_gap=gap,
        data_stroke=stroke,
        data_min_radius=min_radius,
        data_radius_compression=radius_compression,
        data_radius_overscan=radius_overscan,
        data_steps=steps,
        data_blades=blades,
        data_autoplay=autoplay,
        data_autodismiss=autodismiss,
        **kwargs,
        src=src,
    )


def extend_attr(attrs: dict[str, TagAttrValue], key: str, value: TagAttrValue, sep: str = " "):
    if key in attrs:
        attrs[key] += sep + value
    else:
        attrs[key] = value
