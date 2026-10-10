import { describe, expect, it } from "vitest";
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

  it("renders footnotes with working anchors", () => {
    for (const markdownExtensionsEnabled of [true, false]) {
      const html = renderMarkdown("Text[^1]\n\n[^1]: Die Notiz.", {
        markdownExtensionsEnabled,
      });
      expect(html).toContain('class="footnote-ref"');
      expect(html).toContain('href="#fn1"');
      expect(html).toContain('id="fn1"');
      expect(html).toContain("Die Notiz.");
      expect(html).not.toContain('href="Note"');
    }
  });

  it("renders definition lists", () => {
    const html = renderMarkdown("Begriff\n: Definition");
    expect(html).toContain("<dl>");
    expect(html).toContain("<dt>Begriff</dt>");
    expect(html).toContain("<dd>Definition</dd>");
  });

  it("renders grammar-box without title correctly (no empty title line)", () => {
    const noTitleHtml = renderMarkdown("::: grammar-box\nInhalt\n:::");
    expect(noTitleHtml).not.toContain("md-box__title");
    expect(noTitleHtml).not.toContain("<p></p>");
    expect(noTitleHtml).toContain('<div class="grammar-box custom-block">');

    const emptyBracketsHtml = renderMarkdown("::: grammar-box []\nInhalt\n:::");
    expect(emptyBracketsHtml).not.toContain("md-box__title");
    expect(emptyBracketsHtml).not.toContain("<p></p>");
    expect(emptyBracketsHtml).toContain(
      '<div class="grammar-box custom-block">',
    );

    const withTitleHtml = renderMarkdown(
      "::: grammar-box [Mein Titel]\nInhalt\n:::",
    );
    expect(withTitleHtml).toContain(
      '<div class="md-box__title">Mein Titel</div>',
    );
  });

  it("renders grammar-box in typst without empty title", () => {
    const typstNoTitle = convertMarkdownToTypst("::: grammar-box\nInhalt\n:::");
    expect(typstNoTitle).not.toContain("**\n");
    expect(typstNoTitle).toContain("Inhalt");

    const typstEmpty = convertMarkdownToTypst(
      "::: grammar-box []\nInhalt\n:::",
    );
    expect(typstEmpty).not.toContain("**\n");
    expect(typstEmpty).toContain("Inhalt");

    const typstWithTitle = convertMarkdownToTypst(
      "::: grammar-box [Mein Titel]\nInhalt\n:::",
    );
    expect(typstWithTitle).toContain("*Mein Titel*");
  });

  it("renders other boxes (note-box, metrik-schema, tip, deleteme-box) without empty title lines", () => {
    const boxes = [
      "note-box",
      "metrik-schema",
      "tip",
      "deleteme-box",
      "important",
    ];
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
    const openDivCount = (
      html.match(/<div class="[^"]*custom-block[^"]*">/g) || []
    ).length;
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

  it("preserves pipe syntax and container keywords inside fenced code blocks", () => {
    const codeMd = "```bash\n|| test |\n::: grammar-box\n```";
    const html = renderMarkdown(codeMd);
    expect(html).toContain("|| test |");
    expect(html).toContain("::: grammar-box");
    expect(html).not.toContain("custom-block");
  });

  it("respects markdownExtensionsEnabled option", () => {
    const mdSrc = "::: grammar-box\nInhalt\n:::";
    const withExt = renderMarkdown(mdSrc, { markdownExtensionsEnabled: true });
    expect(withExt).toContain("grammar-box custom-block");

    const withoutExt = renderMarkdown(mdSrc, {
      markdownExtensionsEnabled: false,
    });
    expect(withoutExt).not.toContain("grammar-box custom-block");
  });

  it("does not treat currency as inline math and handles escaped dollars", () => {
    const currencyHtml = renderMarkdown("The price is $10 and $20.");
    expect(currencyHtml).not.toContain("katex");
    expect(currencyHtml).toContain("$10 and $20.");

    const escapedHtml = renderMarkdown("Escaped: \\$100 total.");
    expect(escapedHtml).not.toContain("katex");
    expect(escapedHtml).toContain("$100 total.");

    const validMath = renderMarkdown("Formula: $\\alpha$");
    expect(validMath).toContain("katex");
  });

  it("safely handles unclosed math block without swallowing following text", () => {
    const unclosedMd = "$$\nx = 1\n\nSome trailing text";
    const html = renderMarkdown(unclosedMd);
    expect(html).toContain("Some trailing text");
  });

  it("sanitizes dangerous javascript and data:text/html links while keeping safe images", () => {
    const maliciousHtml = renderMarkdown(
      '<a href="javascript:alert(1)">bad link</a> <a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">bad data link</a> <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY44YAAAAASUVORK5CYII=" alt="dot">',
    );
    expect(maliciousHtml).not.toContain("javascript:");
    expect(maliciousHtml).not.toContain("data:text/html");
    expect(maliciousHtml).toContain("data:image/png;base64");
  });

  it("injects data-source-line attributes on block elements when sourceLines option is true", () => {
    const md =
      "# Title\n\nFirst paragraph\n\n## Subheading\n\n```js\nconst x = 1;\n```";
    const withLines = renderMarkdown(md, { sourceLines: true });
    expect(withLines).toContain('data-source-line="1"');
    expect(withLines).toContain('data-source-line="3"');
    expect(withLines).toContain('data-source-line="5"');
    expect(withLines).toContain('data-source-line="7"');

    const withoutLines = renderMarkdown(md, { sourceLines: false });
    expect(withoutLines).not.toContain("data-source-line");
  });
});
