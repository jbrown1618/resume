# Resume

My resume, stored as structured JSON and generated in LaTeX, Markdown, and HTML.

## Generated artifacts

- [PDF](out/resume.pdf)
- [HTML](out/resume.html)
- [Markdown](out/resume.md)
- [LaTeX](out/resume.tex)

## Generate documents

Install the development dependencies:

```sh
npm install
```

Edit `src/resume.json`, then regenerate the documents:

```sh
npm run generate
```

The TypeScript generator type-checks `src/resume.json`, writes `out/resume.tex`,
`out/resume.md`, and `out/resume.html`, then runs `pdflatex` twice to produce
`out/resume.pdf`. A missing LaTeX installation or PDF build error emits a warning without
failing document generation. The generator runs directly on Node.js 22.18 or newer.

Type-check the JSON structure and verify that committed outputs match it:

```sh
npm run typecheck
npm run check
```

## Generate the PDF

Install LaTeX and the required packages to let `npm run generate` build the PDF:

```sh
sudo tlmgr install enumitem tools bold-extra cm-mf-extra-bold
```