#' Create HTML dependency for multimodal component
#'
#' @importFrom htmltools htmlDependency
multimodal_dep <- function() {
  htmlDependency(
    name = "multimodal",
    version = "0.0.1",
    package = "shinymedia",
    src = "dist",
    script = "index.js",
    stylesheet = "index.css"
  )
}
