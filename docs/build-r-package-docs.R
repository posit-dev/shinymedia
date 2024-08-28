#!/usr/bin/env Rscript

stopifnot(
  "Requires R 4.4.1+" = getRversion() >= package_version("4.4.0"),
  "Requires the {pandoc} package" = requireNamespace("pandoc", quietly = TRUE),
  "Requires the {rvest} package" = requireNamespace("rvest", quietly = TRUE),
  "Requires the {xml2} package" = requireNamespace("xml2", quietly = TRUE),
  "Requires the {yaml} package" = requireNamespace("yaml", quietly = TRUE)
)

# Use new pkg2HTML() from R 4.4.1 to create a single-page reference doc
con <- textConnection("r_package_docs", open = "w")
tools::pkg2HTML(
  "shinymedia",
  "../r-package",
  out = con,
  toc_entry = "name",
  include_description = FALSE,
  prism = FALSE,
  stylesheet = ""
)
close(con)

collapse <- function(x) paste(x, collapse = "\n")

# Move into XML so we can manipulate the singe-page docs. We're going to do a
# bit of cleanup to fixup the HTML, then go through several rounds of pandoc
# conversion to extract each function section individually.
html <- rvest::read_html(paste(r_package_docs, collapse = "\n"))

# Remove empty <span id="topic-{function-name}"> elements
html |>
  rvest::html_nodes("span[id^='topic']") |>
  xml2::xml_remove()

# Arguments in the argument tables have anchors, but they're include a mis-coded
# `":"`. Also pandoc does weird things with <code id="foo">bar</code> so we
# rewrite these as <span id="foo"><code>bar</code></span>.
arg_blocks <- 
  html |> 
  rvest::html_nodes("code[id]") |>
  xml2::xml_set_name("span")

for (arg in arg_blocks) {
  arg_id <- 
    arg |>
    rvest::html_attr("id") |>
    sub("_+3A_", "_", x = _, fixed = TRUE) |>
    sub("...", "dotdotdot", x = _, fixed = TRUE)

  xml2::xml_set_attr(arg, "id", arg_id)
  arg_text <- arg |> rvest::html_text()
  xml2::xml_set_text(arg, "")
  xml2::xml_add_child(arg, xml2::read_xml(sprintf("<code>%s</code>", arg_text)))
}

# First round of HTML -> commonmark -> HTML to clean up the structure and to
# take advantage of pandoc's section divs feature. This wraps sections created
# by <h2> elements in a <section class="level2"> and we'll use this to easily
# split up the single-page doc into multiple pages.
html_text <- 
  html |> 
  rvest::html_node("body") |>
  rvest::html_children() |>
  as.character()

html_pandoc <- 
  pandoc::pandoc_convert(
    text = html_text,
    from = "html",
    to = "commonmark_x"
  ) |>
  pandoc::pandoc_convert(
    text = _,
    from = "commonmark_x",
    to = "html5",
    args = c("--section-divs")
  )

# Now we can separate the single-page doc into one page per function/topic.
html_sections <- 
  html_pandoc |>
  collapse() |>
  rvest::read_html() |>
  rvest::html_nodes("section.level2:not(#contents)")

for (section in html_sections) {
  # Extract the section ID and title from the <section> and <h2> element, then
  # discard them.
  section_id <- section |> rvest::html_attr("id")
  section_title <- section |> rvest::html_node("h2") |> rvest::html_text()
  
  section |> rvest::html_node("h2") |> xml2::xml_remove()
  section |> rvest::html_nodes("hr") |> xml2::xml_remove()

  for (node in rvest::html_nodes(section, "div.sourceCode")) {
    # replace "div.sourceCode#cbN" blocks with their children
    after <- node
    for (child_node in xml2::xml_children(node)) {
      xml2::xml_add_sibling(after, child_node)
      after <- child_node
    }
    xml2::xml_remove(node)
  }

  for (node in rvest::html_nodes(section, ".sourceCode")) {
    # Clean up .sourceCode elements for nicer markdown
    xml2::xml_set_attr(
      node,
      "class",
      sub("sourceCode", "", xml2::xml_attr(node, "class"))
    )
  }

  # We used <h2> to define the page-level heading, so move all others up one,
  # i.e. <h3> --> <h2>, etc.
  heading_levels <- c("h2", "h3", "h4", "h5", "h6")
  for (i in seq_along(heading_levels)[-1]) {
    h_up <- heading_levels[i]
    h_down <- heading_levels[i - 1]
    heading_nodes <- rvest::html_nodes(section, h_up)
    for (node in heading_nodes) {
      xml2::xml_set_name(node, h_down)
    }
  }

  # Now we'll get rid of the <section> containers since they've served their
  # purpose and would otherwise clutter the markup with unnecessary divs.
  contents <- xml2::xml_new_document()
  for (node in rvest::html_nodes(section, "section")) {
    for (child_node in rvest::html_children(node)) {
      xml2::xml_add_child(contents, child_node)
    }
  }

  # Final conversion to markdown (commonmark_x == commonmark with extensions)
  section_pandoc <- 
    pandoc::pandoc_convert(
      text = as.character(contents),
      from = "html",
      to = "commonmark_x"
    )
  
  if (!dir.exists("reference/r")) {
    dir.create("reference/r", FALSE, recursive = TRUE)
  }
  
  writeLines(
    c(
      "---",
      yaml::as.yaml(list(
        title = sprintf("`%s`", section_id),
        subtitle = section_title
      )),
      "---",
      "",
      section_pandoc
    ),
    paste0("reference/r/", section_id, ".qmd")
  )
}