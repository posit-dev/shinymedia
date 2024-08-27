docs: docs-python docs-r docs-render

docs-python:
	quartodoc build

docs-r:
	./build-r-package-docs.R
	cp reference/python/index.qmd reference/r/index.qmd
	@sed -i '' 's/Python Package/R Package/g' reference/r/index.qmd
	@sed -i '' 's/#shinymedia[.][^)]+//g' reference/r/index.qmd

docs-render:
	quarto render

docs-preview: docs-python docs-r
	quarto preview
