import type * as MDAST from "mdast";
import type { default as PdfDocument } from "pdfkit";

export interface PdfkitMarkdownSettings {
  /** Indent for block quotes per depth in points */
  blockQuoteIndent: number;
  /** Gap between paragraphs in points */
  paragraphGap: number;
  /** Gap between list items in points */
  listItemGap: number;
  /** Offset for ordered list item indent */
  listItemIndentOffsetOrdered: number;
  /** Indent per ordered list item depth in points */
  listItemIndentOrdered: number;
  /** Offset for unordered list item indent */
  listItemIndentOffsetUnordered: number;
  /** Indent per unordered list item depth in points */
  listItemIndentUnordered: number;
  /** Font name for code */
  codeFont: string;
  /** Font name for normal text */
  normalFont: string;
  /** Font name for bold text */
  boldFont: string;
  /** Font name for italic text */
  italicFont: string;
  /** Font name for bold italic text */
  boldItalicFont: string;
  /** Normal font size */
  fontSize: number;
  /** Function to determine font size by header depth */
  headerFontSize: (depth: number) => number;
  /** Function to determine font name by header depth */
  headerFontName: (depth: number) => string;
  /** Function to determine gap size before a header by depth */
  headerGapBefore: (depth: number) => number;
  /** Function to determine gap size after a header by depth */
  headerGapAfter: (depth: number) => number;
  /** Throw error on unsupported markdown feature, otherwise silently ignored */
  throwOnUnsupported: boolean;
}

export class MarkdownRenderer {
  private settings: PdfkitMarkdownSettings = {
    blockQuoteIndent: 7,
    paragraphGap: 8,
    listItemGap: 4,
    listItemIndentOffsetOrdered: 7,
    listItemIndentOrdered: 14,
    listItemIndentOffsetUnordered: 7,
    listItemIndentUnordered: 14,
    codeFont: "Courier",
    normalFont: "Helvetica",
    boldItalicFont: "Helvetica-BoldOblique",
    boldFont: "Helvetica-Bold",
    italicFont: "Helvetica-Oblique",
    headerFontName: () => "Helvetica-Bold",
    headerFontSize: (h) => 20 - h * 1.5,
    headerGapBefore: () => 12,
    headerGapAfter: () => 8,
    fontSize: 10,
    throwOnUnsupported: false,
  };

  constructor(
    private doc: typeof PdfDocument,
    settings?: Partial<PdfkitMarkdownSettings>
  ) {
    if (settings) {
      Object.assign(this.settings, settings);
    }
  }

  render(tree: MDAST.Root) {
    this.doc.fontSize(this.settings.fontSize);
    this.updateFont();

    for (const c of tree.children) this.handleChild(c);
  }

  private listIndent = 0;
  private bold = false;
  private italic = false;
  private link: string | null = null;
  private strike = false;
  private blockquoteIndex = 0;

  private handleChild(child: MDAST.Content) {
    switch (child.type) {
      case "blockquote":
        this.handleBlockquote(child);
        break;
      case "heading":
        this.handleHeading(child);
        break;
      case "link":
        this.handleLink(child);
        break;
      case "paragraph":
        this.handleParagraph(child);
        break;
      case "text":
        this.handleText(child);
        break;
      case "break":
        this.handleBreak(child);
        break;
      case "strong":
        this.handleBold(child);
        break;
      case "emphasis":
        this.handleItalic(child);
        break;
      case "list":
        this.handleList(child);
        break;
      case "link":
        this.handleLink(child);
        break;
      case "delete":
        this.handleDelete(child);
        break;
      case "thematicBreak":
        this.doc
          .moveTo(this.doc.page.margins.left, this.doc.y)
          .lineTo(this.doc.page.width - this.doc.page.margins.right, this.doc.y)
          .stroke("black");

        this.doc.text("\n", { paragraphGap: 0 });
        break;
      case "code":
        this.handleCode(child);
        break;
      case "inlineCode":
        this.handleInlineCode(child);
        break;
      default:
        if (this.settings.throwOnUnsupported)
          throw new Error("Unsupported markdown feature " + child.type);
      //  ignore otherwise
    }
  }

  private handleBlockquote(child: MDAST.Blockquote) {
    this.blockquoteIndex++;
    this.doc.x =
      this.doc.page.margins.left +
      this.blockquoteIndex * this.settings.blockQuoteIndent;
    for (const c of child.children) this.handleChild(c);
    this.blockquoteIndex--;
    this.doc.x =
      this.doc.page.margins.left +
      this.blockquoteIndex * this.settings.blockQuoteIndent;
  }

  private handleDelete(child: MDAST.Delete) {
    this.strike = true;
    for (const c of child.children) this.handleChild(c);
    this.strike = false;
  }

  private handleBreak(child: MDAST.Break) {
    this.doc.text("\n", { paragraphGap: 0 });
  }

  private handleInlineCode(code: MDAST.InlineCode) {
    this.doc.font(this.settings.codeFont);
    this.doc.text(code.value, { continued: true });
    this.updateFont();
  }

  private handleCode(code: MDAST.Code) {
    this.doc.font(this.settings.codeFont);
    this.doc.text(code.value);
    this.updateFont();
  }

  private handleLink(link: MDAST.Link) {
    this.link = link.url;
    for (const c of link.children) this.handleChild(c);
    this.link = null;
  }

  private handleHeading(heading: MDAST.Heading) {
    this.doc.y += this.settings.headerGapBefore(heading.depth);
    this.doc.font(this.settings.headerFontName(heading.depth));
    this.doc.fontSize(this.settings.headerFontSize(heading.depth));
    for (const c of heading.children) this.handleChild(c);
    this.doc.text("\n");
    this.updateFont();
    this.doc.fontSize(this.settings.fontSize);
    this.doc.y += this.settings.headerGapAfter(heading.depth);
  }

  private handleList(list: MDAST.List) {
    this.listIndent++;
    if (list.ordered) {
      let i = list.start || 1;
      for (const item of list.children) {
        this.handleListItemOrdered(item, i++);
      }
    } else {
      for (const item of list.children) {
        this.handleListItem(item);
      }
    }
    this.listIndent--;
    if (this.listIndent === 0) {
      this.doc.y += this.settings.paragraphGap - this.settings.listItemGap;
    }
  }

  private handleListItemOrdered(item: MDAST.ListItem, i: number) {
    const indent =
      this.doc.page.margins.left +
      (this.listIndent - 1) * this.settings.listItemIndentOrdered +
      this.settings.listItemIndentOffsetOrdered;
    // Hack: use { continued: true } first to enforce page break before adding the list item,
    // then { lineBreak: false } to escape the continued text
    this.doc.text(i + ".", indent, undefined, { continued: true });
    this.doc.text("", { lineBreak: false });

    const minIndent = this.doc.widthOfString(i + ". ");
    this.doc.x = Math.max(
      indent + minIndent,
      indent + this.settings.listItemIndentOrdered
    );
    for (const child of item.children) this.handleChild(child);
    this.doc.x = this.doc.page.margins.left;
  }

  private handleListItem(item: MDAST.ListItem) {
    const indent =
      this.doc.page.margins.left +
      (this.listIndent - 1) * this.settings.listItemIndentUnordered +
      this.settings.listItemIndentOffsetUnordered;
    this.doc.x = indent + this.settings.listItemIndentUnordered;
    this.doc.text("", { continued: true }); // Make pdfkit page break before adding the list item, if needed
    this.doc.circle(indent + 1, this.doc.y + 4, 1).fill("black");
    for (const child of item.children) this.handleChild(child);
    this.doc.x = this.doc.page.margins.left;
  }

  private updateFont() {
    if (this.bold && this.italic) {
      this.doc.font(this.settings.boldItalicFont);
    } else if (this.bold) {
      this.doc.font(this.settings.boldFont);
    } else if (this.italic) {
      this.doc.font(this.settings.italicFont);
    } else this.doc.font(this.settings.normalFont);
  }

  private handleItalic(node: MDAST.Emphasis) {
    this.italic = true;
    this.updateFont();
    for (const child of node.children) {
      this.handleChild(child);
    }
    this.italic = false;
    this.updateFont();
  }

  private handleBold(node: MDAST.Strong) {
    this.bold = true;
    this.updateFont();
    for (const child of node.children) {
      this.handleChild(child);
    }
    this.bold = false;
    this.updateFont();
  }

  private handleParagraph(node: MDAST.Paragraph) {
    for (const child of node.children) {
      this.handleChild(child);
    }
    this.doc.text("\n", {
      paragraphGap:
        this.listIndent > 0
          ? this.settings.listItemGap
          : this.settings.paragraphGap,
    });
  }

  private handleText(text: MDAST.Text) {
    const raw = text.value.replace(/[\s\r\n]+/g, " ");
    this.doc.text(raw, {
      continued: true,
      link: this.link,
      underline: !!this.link,
      strike: this.strike,
    });
  }
}
