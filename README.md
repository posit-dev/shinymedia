# shinymedia

**shinymedia** is a Python and R package that provides [Shiny](https://shiny.posit.co/py/) UI controls for recording and playing back media.

At this time it includes two components:

- `input_video_clip` for recording video clips using attached cameras
- `audio_spinner` for playing back audio with a spinning visualization

You can see these two components in action together in our [live demo](https://jcheng.shinyapps.io/multimodal/) ([source code](https://github.com/jcheng5/multimodal)), or keep reading.

## Installation

### Python

From PyPI:

```bash
pip install shinymedia
```

Or to install the latest from GitHub:

```bash
pip install "shinymedia @ git+https://github.com/posit-dev/shinymedia?subdirectory=pkg-py"
```

### R

From CRAN:

```bash
install.packages("shinymedia")  # Not published yet
```

Or to install the latest from GitHub:

```bash
pak::pak("posit-dev/shinymedia/pkg-r")
```

## Documentation

See the [docs website](https://posit-dev.github.io/shinymedia/).

## Development

### JavaScript

To develop the JavaScript components, you will need to have Node.js installed. Then, `npm install` in this directory to install dependencies.

After making changes to the TypeScript code in srcts, run `npm run build` to compile to JavaScript (or `npm run watch` to automatically recompile on changes). You can also run `npm run typecheck` to check for TypeScript type errors.

### Python

To develop the Python package, you can install it in editable mode:

```bash
pip install -e pkg-py
```

### Documentation

To build the documentation, first install additional dependencies:

```bash
pip install -e "pkg-py[docs]"
```

Then:

```bash
cd quarto
quartodoc build  # Build reference docs
quarto preview   # Serve the docs locally
```
