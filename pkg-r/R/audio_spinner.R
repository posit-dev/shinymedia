#' Create an audio spinner
#'
#' @param src The source URL or URI for the audio file. This should be used for remote resources
#'   or data URIs. If provided, this takes precedence over `con`.
#' @param con An optional connection object or file path for local audio files. This is ignored
#'   if `src` is provided. Use this for reading local files securely.
#' @param rpm The speed of the spinner, in clockwise revolutions per minute. Default is 10 RPM. 
#'   Use 0 to disable rotation, or a negative value to rotate counter-clockwise.
#' @param gap The gap between the blades of the spinner, in radians. Default is pi/5, or 36°.
#' @param stroke The stroke thickness of the individual arcs that make up each blade of the spinner, 
#'   in pixels. Default is 2.5.
#' @param min_radius The radius of the spinner when there is only silence, in pixels. Default is 30.
#' @param radius_compression The raw `[-1, 1]` amplitude of the audio is compressed using 
#'   `x^radius_compression` to make the spinner more responsive to quiet sounds. Default is 0.8. 
#'   Set to 1.0 to disable compression. (Note that this only affects the visualization, not the audio playback.)
#' @param radius_overscan Use this parameter to set the maximum possible radius of the spinner, 
#'   relative to the width/height of the container. Default is 1.1, meaning the spinner radius 
#'   will be scaled such that at maximum amplitude, it will be 10% larger than the container 
#'   (the spinner blades will be clipped). Use larger values if you're expecting generally quiet audio.
#' @param steps The number of concentric arcs that make up each blade of the spinner, not including 
#'   the central circle. Default is 2.
#' @param blades The number of blades in the spinner. Default is 3. Set to 0 to use concentric circles 
#'   instead of blades.
#' @param width The width of the spinner in CSS units. Default is "125px".
#' @param height The height of the spinner in CSS units. Default is "125px".
#' @param autoplay Whether to autoplay the audio. Default is TRUE. Note that many browsers will not 
#'   allow autoplaying audio without user interaction; if autoplay fails, the spinner will show a 
#'   tooltip instructing the user to tap or click to start the audio.
#' @param autodismiss Whether to remove the spinner after the audio finishes playing. Default is FALSE.
#' @param class The class of the spinner. Default is "mx-auto" which horizontally centers the element 
#'   inside its container (assuming Bootstrap is loaded).
#' @param ... Additional attributes for the spinner, to be added directly to the `<audio-spinner>` element.
#'
#' @return An HTML tag object representing the audio spinner.
#' @import htmltools
#' @import base64enc
#'
#' @examples
#' # Using a URL
#' audio_spinner(src = "https://example.com/audio.mp3", rpm = 15, width = "200px", height = "200px")
#' 
#' # Using a local file
#' audio_spinner(con = "path/to/local/audio.mp3", rpm = 20, width = "150px", height = "150px")
#'
#' @export
audio_spinner <- function(
  ...,
  src = NULL,
  con = NULL,
  rpm = 10,
  gap = pi / 5,
  stroke = 2.5,
  min_radius = 30,
  radius_compression = 0.8,
  radius_overscan = 1.1,
  steps = 2,
  blades = 3,
  width = "125px",
  height = "125px",
  autoplay = TRUE,
  autodismiss = FALSE,
  class = "mx-auto"
) {
  if (is.null(src) && is.null(con)) {
    stop("Either 'src' or 'con' must be provided")
  }

  if (!is.null(src)) {
    audio_src <- src
  } else {
    # Handle file reading and base64 encoding
    if (is.character(con)) {
      if (!file.exists(con)) {
        stop("File does not exist: ", con)
      }
      content <- readBin(con, "raw", file.info(con)$size)
    } else if (inherits(con, "connection")) {
      content <- readBin(con, "raw", n = 1e8)  # Read up to ~100MB
    } else {
      stop("'con' must be a file path or a connection")
    }
    audio_src <- paste0("data:audio/mpeg;base64,", base64encode(content))
  }

  # Create the tag
  tag("audio-spinner", rlang::list2(
    class = class,
    style = css(
      width = validateCssUnit(width),
      height = validateCssUnit(height)
    ),
    `data-rpm` = rpm,
    `data-gap` = gap,
    `data-stroke` = stroke,
    `data-min-radius` = min_radius,
    `data-radius-compression` = radius_compression,
    `data-radius-overscan` = radius_overscan,
    `data-steps` = steps,
    `data-blades` = blades,
    `data-autoplay` = if (isTRUE(autoplay)) NA,
    `data-autodismiss` = if (isTRUE(autodismiss)) NA,
    src = audio_src,
    multimodal_dep(),
    ...
  ))
}