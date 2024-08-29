import { createWriteStream, readFileSync } from "fs";
import PDFDocument from "pdfkit";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { MarkdownRenderer } from ".";

const readme = readFileSync(`README.md`, "utf-8");

const tree = unified().use(remarkParse).parse(readme);

const doc = new PDFDocument({});
doc.pipe(createWriteStream("README.pdf"));

new MarkdownRenderer(doc, {
  /* optional settings */
}).render(tree);

doc.end();
