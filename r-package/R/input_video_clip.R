#' A video clip input control that records short videos from webcam
#'
#' @param inputId The input slot that will be used to access the value.
#' @param reset_on_record Whether to reset the video clip input value when recording starts. If
#'   TRUE, the video clip input value will become NULL at the moment the
#'   Record button is pressed; if FALSE, the value will not change until
#'   the user stops recording. Default is TRUE.
#' @param mime_type The MIME type of the video clip to record. By default, this is NULL,
#'   which means the browser will choose a suitable MIME type for video
#'   recording. Common MIME types include 'video/webm' and 'video/x-matroska'.
#' @param video_bits_per_second The target video bitrate in bits per second. By default, this is NULL,
#'   which means the browser will choose a suitable bitrate for video
#'   recording (according to the spec, 2,500,000). This is only a
#'   suggestion; the browser may choose a different bitrate.
#' @param audio_bits_per_second The target audio bitrate in bits per second. By default, this is NULL,
#'   which means the browser will choose a suitable bitrate for audio
#'   recording. This is only a suggestion; the browser may choose a different
#'   bitrate.
#' @param ... Additional parameters to pass to the underlying HTML tag.
#'
#' @return A video clip input control that can be added to a UI definition.
#' @export
input_video_clip <- function(
  inputId,
  reset_on_record = TRUE,
  mime_type = NULL,
  video_bits_per_second = NULL,
  audio_bits_per_second = NULL,
  ...
) {
  
  # Create the settings menu
  settings_menu <- tag("av-settings-menu", list(
    slot = "settings",
    div(
      class = "btn-group",
      tags$button(
        class = "btn btn-sm btn-secondary dropdown-toggle px-3 py-2",
        type = "button",
        `data-bs-toggle` = "dropdown",
        icon("gear")
      ),
      tags$ul(
        class = "dropdown-menu",
        tags$li(
          class = "camera-header",
          tags$h6("Camera", class = "dropdown-header")
        ),
        # Camera items will go here
        tags$li(tags$hr(class = "dropdown-divider")),
        tags$li(
          class = "mic-header",
          tags$h6("Microphone", class = "dropdown-header")
        )
        # Microphone items will go here
      )
    )
  ))
  
  # Create the recording controls
  recording_controls <- div(
    class = "btn-group",
    slot = "recording-controls",
    `aria-label` = "Recording controls",
    tags$button(
      class = "record-button btn btn-secondary px-3 mx-auto",
      style = "display: block;",
      div(
        style = "display: inline-block; background-color: red; width: 1rem; height: 1rem; border-radius: 100%; position: relative; top: 0.175rem; margin-right: 0.3rem;"
      ),
      "Record"
    ),
    tags$button(
      class = "stop-button btn btn-secondary px-3 mx-auto",
      style = "display: block;",
      div(
        style = "display: inline-block; background-color: currentColor; width: 1rem; height: 1rem; position: relative; top: 0.175rem; margin-right: 0.3rem;"
      ),
      "Stop"
    )
  )
  
  # Create the main video-clipper tag
  tag("video-clipper", list(
    id = inputId,
    class = "shiny-video-clip",
    `data-reset-on-record` = if(reset_on_record) "true" else "false",
    `data-mime-type` = mime_type,
    `data-video-bits-per-second` = video_bits_per_second,
    `data-audio-bits-per-second` = audio_bits_per_second,
    multimodal_dep(),
    settings_menu,
    recording_controls,
    ...
  ))
}
