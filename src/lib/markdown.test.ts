import { describe, it, expect } from "vitest";
import { renderMarkdown } from "./markdown";

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

  it("renders :mark[Text] as yellow highlighter mark tag", () => {
    const html = renderMarkdown("This is :mark[yellow text] highlighted.");
    expect(html).toContain('<mark class="marker-yellow">yellow text</mark>');
  });
});
