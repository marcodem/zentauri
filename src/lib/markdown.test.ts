import { describe, it, expect } from "vitest";
import { renderMarkdown } from "./markdown";

import { convertMarkdownToTypst } from "./typstConverter";

describe("renderMarkdown", () => {
  it("renders basic markdown elements correctly", () => {
    const html = renderMarkdown("# Hello World\n\nThis is a **bold** text.");
    expect(html).toContain("<h1>Hello World</h1>");
    expect(html).toContain("<strong>bold</strong>");
  });

  it("renders KaTeX math inline ($...$) and block ($$...$$)", () => {
    const inlineMathHtml = renderMarkdown("Math: $e^{i\\pi} + 1 = 0$");
    expect(inlineMathHtml).toContain("katex");

    const blockMathHtml = renderMarkdown(
      "$$\\int_{0}^{\\infty} e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}$$",
    );
    expect(blockMathHtml).toContain("katex-block");
  });

  it("renders table cell merging (rowspan and colspan)", () => {
    const tableMd =
      "| Header 1 | Header 2 | Header 3 |\n|---|---|---|\n| Spanning Columns |||\n| Rowspan Cell | Cell B | Cell C |\n| ^^ | Cell B2 | Cell C2 |\n";
    const tableHtml = renderMarkdown(tableMd);
    expect(tableHtml).toContain('colspan="3"');
    expect(tableHtml).toContain('rowspan="2"');
  });

  it("renders grammar-box without title correctly (no empty title line)", () => {
    const noTitleHtml = renderMarkdown("::: grammar-box\nInhalt\n:::");
    expect(noTitleHtml).not.toContain("md-box__title");
    expect(noTitleHtml).not.toContain("<p></p>");
    expect(noTitleHtml).toContain('<div class="grammar-box custom-block">');

    const emptyBracketsHtml = renderMarkdown("::: grammar-box []\nInhalt\n:::");
    expect(emptyBracketsHtml).not.toContain("md-box__title");
    expect(emptyBracketsHtml).not.toContain("<p></p>");
    expect(emptyBracketsHtml).toContain('<div class="grammar-box custom-block">');

    const withTitleHtml = renderMarkdown("::: grammar-box [Mein Titel]\nInhalt\n:::");
    expect(withTitleHtml).toContain('<div class="md-box__title">Mein Titel</div>');
  });

  it("renders grammar-box in typst without empty title", () => {
    const typstNoTitle = convertMarkdownToTypst("::: grammar-box\nInhalt\n:::");
    expect(typstNoTitle).not.toContain("**\n");
    expect(typstNoTitle).toContain("Inhalt");

    const typstEmpty = convertMarkdownToTypst("::: grammar-box []\nInhalt\n:::");
    expect(typstEmpty).not.toContain("**\n");
    expect(typstEmpty).toContain("Inhalt");

    const typstWithTitle = convertMarkdownToTypst("::: grammar-box [Mein Titel]\nInhalt\n:::");
    expect(typstWithTitle).toContain("*Mein Titel*");
  });

  it("renders other boxes (note-box, metrik-schema, tip, deleteme-box) without empty title lines", () => {
    const boxes = ["note-box", "metrik-schema", "tip", "deleteme-box", "important"];
    for (const box of boxes) {
      const htmlNoTitle = renderMarkdown(`::: ${box}\nInhalt\n:::`);
      expect(htmlNoTitle).not.toContain("md-box__title");
      expect(htmlNoTitle).not.toContain("<p></p>");
      expect(htmlNoTitle).toContain(box);

      const htmlEmptyBrackets = renderMarkdown(`::: ${box} []\nInhalt\n:::`);
      expect(htmlEmptyBrackets).not.toContain("md-box__title");
      expect(htmlEmptyBrackets).not.toContain("<p></p>");
      expect(htmlEmptyBrackets).toContain(box);
    }
  });

  it("renders nested containers with auto-elevated colons correctly in HTML", () => {
    const nestedMd = `::: note-box [Aussere Notiz]
Aussere Einleitung

::: grammar-box [Innere Grammatik]
Innere Regeln
:::

Ausseres Fazit
:::`;

    const html = renderMarkdown(nestedMd);
    expect(html).toContain("note-box");
    expect(html).toContain("grammar-box");
    expect(html).toContain("Aussere Notiz");
    expect(html).toContain("Innere Grammatik");
    expect(html).toContain("Innere Regeln");
    expect(html).toContain("Ausseres Fazit");
    // Verify both containers are present and properly closed
    const openDivCount = (html.match(/<div class="[^"]*custom-block[^"]*">/g) || []).length;
    expect(openDivCount).toBe(2);
  });

  it("renders nested containers correctly in typst converter", () => {
    const nestedMd = `::: note-box [Aussere Notiz]
Aussere Einleitung

::: grammar-box [Innere Grammatik]
Innere Regeln
:::

Ausseres Fazit
:::`;

    const typst = convertMarkdownToTypst(nestedMd);
    expect(typst).toContain("Aussere Notiz");
    expect(typst).toContain("Innere Grammatik");
    expect(typst).toContain("Innere Regeln");
    expect(typst).toContain("Ausseres Fazit");
  });
});
