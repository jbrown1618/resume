#!/usr/bin/env node

import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import resumeJson from "./resume.json" with { type: "json" };

type Basics = {
  name: string;
  email: string;
  phone: string;
  github: string;
  linkedin: string;
};

type Skill = {
  category: string;
  items: string[];
};

type Role = {
  title: string;
  team?: string;
  bullets: string[];
};

type Experience = {
  company: string;
  division?: string;
  dates: string;
  page_break_before?: boolean;
  roles: Role[];
};

type Project = {
  title: string;
  context?: string;
  bullets: string[];
};

type Education = {
  institution: string;
  bullets: string[];
};

type Resume = {
  basics: Basics;
  summary: string;
  skills: Skill[];
  experience: Experience[];
  projects_and_leadership: Project[];
  education: Education[];
};

const resume: Resume = resumeJson;
const sourceDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(sourceDirectory, "..");
const templatePath = resolve(sourceDirectory, "resume.tex.template");
const outputDirectory = resolve(projectRoot, "out");
const outputPaths = {
  latex: resolve(outputDirectory, "resume.tex"),
  markdown: resolve(outputDirectory, "resume.md"),
  html: resolve(outputDirectory, "resume.html"),
} as const;

function latexEscape(value: string): string {
  const replacements: Record<string, string> = {
    "\\": String.raw`\textbackslash{}`,
    "&": String.raw`\&`,
    "%": String.raw`\%`,
    "$": String.raw`\$`,
    "#": String.raw`\#`,
    _: String.raw`\_`,
    "{": String.raw`\{`,
    "}": String.raw`\}`,
    "~": String.raw`\textasciitilde{}`,
    "^": String.raw`\textasciicircum{}`,
  };
  const escaped = [...value]
    .map((character) => replacements[character] ?? character)
    .join("");
  return escaped.replace(/"([^"]+)"/g, "``$1''");
}

function latexDate(value: string): string {
  return latexEscape(value).replaceAll("-", "--");
}

function latexItems(items: string[]): string {
  return items.map((item) => `    \\item ${latexEscape(item)}`).join("\n");
}

function renderLatex(data: Resume): string {
  const { basics } = data;
  const keywords = [
    "Software Engineer",
    "Architecture",
    "GitHub Copilot",
    ...data.skills.flatMap((skill) => skill.items),
  ];
  const pdfInfo = [
    String.raw`\pdfinfo{`,
    `  /Author (${latexEscape(basics.name)})`,
    `  /Title (Resume - ${latexEscape(basics.name)})`,
    "  /Subject (Resume)",
    `  /Keywords (${latexEscape(keywords.join(";"))})`,
    "}",
  ].join("\n");
  const header = [
    `\\resumeHeader{${latexEscape(basics.name)}}`,
    `  {\\textbf{Contact} \\\\ ${latexEscape(basics.email)} \\\\ ${latexEscape(basics.phone)}}`,
    `  {\\textbf{More} \\\\ ${latexEscape(basics.github)} \\\\ ${latexEscape(basics.linkedin)}}`,
  ].join("\n");

  const sections = [
    String.raw`\resumeSection{Summary}{`,
    `  ${latexEscape(data.summary)}`,
    "}",
    "",
    String.raw`\resumeSection{Technical Skills}{`,
    String.raw`  \skillsTable{`,
  ];
  for (const skill of data.skills) {
    sections.push(
      `    \\skillsCategory{${latexEscape(skill.category)}}{`,
      `      ${latexEscape(skill.items.join(", "))}`,
      "    }",
    );
  }
  sections.push(
    "  }",
    "}",
    "",
    String.raw`\resumeSection{Professional Experience}{`,
    "",
  );

  for (const company of data.experience) {
    if (company.page_break_before) {
      sections.push(String.raw`  \newpage`, "");
    }
    let companyName = latexEscape(company.company);
    if (company.division) {
      companyName += `---${latexEscape(company.division)}`;
    }
    sections.push(
      `  \\company{${companyName}}{${latexDate(company.dates)}}`,
      "",
    );
    for (const role of company.roles) {
      let roleName = latexEscape(role.title);
      if (role.team) {
        roleName += `---${latexEscape(role.team)}`;
      }
      sections.push(
        `  \\experience{${roleName}}{`,
        latexItems(role.bullets),
        "  }",
      );
    }
    sections.push("");
  }
  sections.push("}", "", String.raw`\resumeSection{Projects \& Leadership}{`);

  for (const project of data.projects_and_leadership) {
    const title = latexEscape(project.title);
    const heading = project.context
      ? `\\leadershipExperience{${title}}{${latexEscape(project.context)}}`
      : `\\project{${title}}`;
    sections.push(
      `  ${heading}{`,
      latexItems(project.bullets),
      "  }",
      "",
    );
  }
  sections.push("}", "", String.raw`\resumeSection{Education}{`);
  for (const education of data.education) {
    sections.push(
      `  \\experience{${latexEscape(education.institution)}}{`,
      latexItems(education.bullets),
      "  }",
    );
  }
  sections.push("}");

  return readFileSync(templatePath, "utf8")
    .replace("{{PDF_INFO}}", pdfInfo)
    .replace("{{HEADER}}", header)
    .replace("{{CONTENT}}", sections.join("\n"));
}

function markdownBullets(items: string[]): string[] {
  return items.map((item) => `- ${item}`);
}

function renderMarkdown(data: Resume): string {
  const { basics } = data;
  const lines = [
    `# ${basics.name}`,
    "",
    `${basics.email} | ${basics.phone} | [${basics.github}](https://${basics.github}) | [${basics.linkedin}](https://${basics.linkedin})`,
    "",
    "## Summary",
    "",
    data.summary,
    "",
    "## Technical Skills",
    "",
  ];
  for (const skill of data.skills) {
    lines.push(`- **${skill.category}:** ${skill.items.join(", ")}`);
  }

  lines.push("", "## Professional Experience", "");
  for (const company of data.experience) {
    let companyName = company.company;
    if (company.division) {
      companyName += ` - ${company.division}`;
    }
    lines.push(`### ${companyName} (${company.dates})`, "");
    for (const role of company.roles) {
      let roleName = role.title;
      if (role.team) {
        roleName += ` - ${role.team}`;
      }
      lines.push(
        `#### ${roleName}`,
        "",
        ...markdownBullets(role.bullets),
        "",
      );
    }
  }

  lines.push("## Projects & Leadership", "");
  for (const project of data.projects_and_leadership) {
    let title = project.title;
    if (project.context) {
      title += `, ${project.context}`;
    }
    lines.push(`### ${title}`, "", ...markdownBullets(project.bullets), "");
  }

  lines.push("## Education", "");
  for (const education of data.education) {
    lines.push(
      `### ${education.institution}`,
      "",
      ...markdownBullets(education.bullets),
      "",
    );
  }
  return `<!-- Generated by src/generate.ts from src/resume.json. Do not edit directly. -->\n\n${lines.join("\n").trimEnd()}\n`;
}

function htmlEscape(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character] ?? character,
  );
}

function htmlList(items: string[]): string {
  return `<ul>${items.map((item) => `<li>${htmlEscape(item)}</li>`).join("")}</ul>`;
}

function renderHtml(data: Resume): string {
  const { basics } = data;
  const sections = [
    "<section>",
    "<h2>Summary</h2>",
    `<p>${htmlEscape(data.summary)}</p>`,
    "</section>",
    "<section>",
    "<h2>Technical Skills</h2>",
    '<dl class="skills">',
  ];
  for (const skill of data.skills) {
    sections.push(
      `<dt>${htmlEscape(skill.category)}</dt>`,
      `<dd>${htmlEscape(skill.items.join(", "))}</dd>`,
    );
  }
  sections.push(
    "</dl>",
    "</section>",
    "<section>",
    "<h2>Professional Experience</h2>",
  );
  for (const company of data.experience) {
    let companyName = company.company;
    if (company.division) {
      companyName += ` - ${company.division}`;
    }
    sections.push(
      '<article class="company">',
      "<header>",
      `<h3>${htmlEscape(companyName)}</h3>`,
      `<p>${htmlEscape(company.dates)}</p>`,
      "</header>",
    );
    for (const role of company.roles) {
      let roleName = role.title;
      if (role.team) {
        roleName += ` - ${role.team}`;
      }
      sections.push(
        `<h4>${htmlEscape(roleName)}</h4>`,
        htmlList(role.bullets),
      );
    }
    sections.push("</article>");
  }
  sections.push(
    "</section>",
    "<section>",
    "<h2>Projects &amp; Leadership</h2>",
  );
  for (const project of data.projects_and_leadership) {
    let title = project.title;
    if (project.context) {
      title += `, ${project.context}`;
    }
    sections.push(
      "<article>",
      `<h3>${htmlEscape(title)}</h3>`,
      htmlList(project.bullets),
      "</article>",
    );
  }
  sections.push("</section>", "<section>", "<h2>Education</h2>");
  for (const education of data.education) {
    sections.push(
      "<article>",
      `<h3>${htmlEscape(education.institution)}</h3>`,
      htmlList(education.bullets),
      "</article>",
    );
  }
  sections.push("</section>");

  return `<!doctype html>
<html lang="en">
<head>
  <!-- Generated by src/generate.ts from src/resume.json. Do not edit directly. -->
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Resume for ${htmlEscape(basics.name)}">
  <title>${htmlEscape(basics.name)} - Resume</title>
  <style>
    :root { color-scheme: light dark; font-family: system-ui, sans-serif; line-height: 1.45; }
    body { max-width: 900px; margin: 0 auto; padding: 2rem; }
    h1, h2, h3, h4, p { margin-bottom: 0.35rem; }
    h2 { border-bottom: 1px solid; padding-bottom: 0.2rem; }
    h4 { margin-top: 0.75rem; }
    ul { margin-top: 0.35rem; }
    .contact { display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; padding: 0; list-style: none; }
    .company > header { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; }
    .company > header p { white-space: nowrap; }
    .skills { display: grid; grid-template-columns: max-content 1fr; gap: 0.35rem 1rem; }
    .skills dt { font-weight: 700; }
    .skills dd { margin: 0; }
    @media (max-width: 600px) {
      body { padding: 1rem; }
      .company > header { display: block; }
      .skills { grid-template-columns: 1fr; gap: 0; }
      .skills dd { margin-bottom: 0.5rem; }
    }
  </style>
</head>
<body>
  <header>
    <h1>${htmlEscape(basics.name)}</h1>
    <ul class="contact">
      <li><a href="mailto:${htmlEscape(basics.email)}">${htmlEscape(basics.email)}</a></li>
      <li>${htmlEscape(basics.phone)}</li>
      <li><a href="https://${htmlEscape(basics.github)}">${htmlEscape(basics.github)}</a></li>
      <li><a href="https://${htmlEscape(basics.linkedin)}">${htmlEscape(basics.linkedin)}</a></li>
    </ul>
  </header>
  <main>
    ${sections.join("\n")}
  </main>
</body>
</html>
`;
}

function generatePdf(): void {
  const macOsPdflatex = "/Library/TeX/texbin/pdflatex";
  const executable = existsSync(macOsPdflatex) ? macOsPdflatex : "pdflatex";
  const args = [
    "-interaction=nonstopmode",
    "-halt-on-error",
    "resume.tex",
  ];

  for (let pass = 1; pass <= 2; pass += 1) {
    const result = spawnSync(executable, args, {
      cwd: outputDirectory,
      encoding: "utf8",
    });
    if (result.status === 0) {
      continue;
    }

    const details =
      result.error?.message ??
      [result.stderr, result.stdout]
        .filter(Boolean)
        .join("\n")
        .trim()
        .split("\n")
        .slice(-10)
        .join("\n");
    console.warn(
      `Warning: pdflatex pass ${pass} failed; resume.pdf may be stale.${details ? `\n${details}` : ""}`,
    );
    return;
  }

  for (const extension of ["aux", "log", "out"]) {
    rmSync(resolve(outputDirectory, `resume.${extension}`), { force: true });
  }
}

const outputs: [string, string][] = [
  [outputPaths.latex, renderLatex(resume)],
  [outputPaths.markdown, renderMarkdown(resume)],
  [outputPaths.html, renderHtml(resume)],
];

if (process.argv.includes("--check")) {
  const stale = outputs
    .filter(
      ([path, content]) =>
        !existsSync(path) || readFileSync(path, "utf8") !== content,
    )
    .map(([path]) => path);

  if (stale.length > 0) {
    console.error(
      `Generated files are stale: ${stale.map((path) => path.split("/").at(-1)).join(", ")}`,
    );
    process.exitCode = 1;
  }
} else {
  mkdirSync(outputDirectory, { recursive: true });
  for (const [path, content] of outputs) {
    writeFileSync(path, content, "utf8");
  }
  generatePdf();
}
