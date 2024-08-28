# HTML dependency for multimodal component
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
