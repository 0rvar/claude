import { unzipSync } from "fflate";

// Parse a .docx buffer into text or markdown.
// docx is a ZIP containing word/document.xml with the content.

export function parseDocx(
  buf: ArrayBuffer,
  format: "text" | "markdown" = "text"
): string {
  const files = unzipSync(new Uint8Array(buf));
  const docXml = files["word/document.xml"];
  if (!docXml) throw new Error("Invalid docx: missing word/document.xml");

  const xml = new TextDecoder().decode(docXml);

  // Also load relationships for hyperlinks
  const relsXml = files["word/_rels/document.xml.rels"];
  const linkMap = relsXml ? parseRels(new TextDecoder().decode(relsXml)) : {};

  // Also load numbering definitions for list detection
  const numXml = files["word/numbering.xml"];
  const numberingInfo = numXml
    ? parseNumbering(new TextDecoder().decode(numXml))
    : {};

  const body = extractBetween(xml, "<w:body", "</w:body>");
  if (!body) throw new Error("Invalid docx: no body element");

  if (format === "text") {
    return extractPlainText(body);
  }
  return extractMarkdownFromBody(body, linkMap, numberingInfo);
}

// --- Relationship parsing (for hyperlinks) ---

function parseRels(xml: string): Record<string, string> {
  const map: Record<string, string> = {};
  const re =
    /<Relationship[^>]+Id="([^"]+)"[^>]+Target="([^"]+)"[^>]*\/>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    map[m[1]] = m[2];
  }
  return map;
}

// --- Numbering parsing (for ordered vs unordered lists) ---

function parseNumbering(
  xml: string
): Record<string, { numId: string; isOrdered: boolean }> {
  const info: Record<string, { numId: string; isOrdered: boolean }> = {};
  // Extract abstract numbering definitions
  const abstractMap: Record<string, boolean> = {};
  const absRe =
    /<w:abstractNum[^>]+w:abstractNumId="(\d+)"[^>]*>([\s\S]*?)<\/w:abstractNum>/g;
  let m: RegExpExecArray | null;
  while ((m = absRe.exec(xml))) {
    const absId = m[1];
    const content = m[2];
    // Check first level's numFmt
    const fmtMatch = content.match(
      /<w:lvl[^>]+w:ilvl="0"[^>]*>[\s\S]*?<w:numFmt[^>]+w:val="([^"]+)"/
    );
    abstractMap[absId] = fmtMatch
      ? fmtMatch[1] !== "bullet"
      : false;
  }

  // Map numId -> abstractNumId
  const numRe =
    /<w:num\s+w:numId="(\d+)"[^>]*>[\s\S]*?<w:abstractNumId\s+w:val="(\d+)"/g;
  while ((m = numRe.exec(xml))) {
    info[m[1]] = {
      numId: m[1],
      isOrdered: abstractMap[m[2]] ?? false,
    };
  }
  return info;
}

// --- Plain text extraction ---

function extractPlainText(body: string): string {
  let text = "";
  // Walk through paragraphs and tables
  const parts = splitElements(body);
  for (const part of parts) {
    if (part.startsWith("<w:p ") || part.startsWith("<w:p>")) {
      text += extractParagraphText(part) + "\n";
    } else if (part.startsWith("<w:tbl")) {
      text += extractTableText(part) + "\n";
    }
  }
  return text;
}

function extractParagraphText(pXml: string): string {
  let text = "";
  const runs = allMatches(pXml, /<w:r[ >][\s\S]*?<\/w:r>/g);
  for (const run of runs) {
    const t = allMatches(run, /<w:t[^>]*>([\s\S]*?)<\/w:t>/g, 1);
    text += t.join("");
  }
  return text;
}

function extractTableText(tblXml: string): string {
  let text = "";
  const rows = allMatches(tblXml, /<w:tr[ >][\s\S]*?<\/w:tr>/g);
  for (const row of rows) {
    const cells = allMatches(row, /<w:tc[ >][\s\S]*?<\/w:tc>/g);
    const cellTexts = cells.map((cell) => {
      const paras = allMatches(cell, /<w:p[ >][\s\S]*?<\/w:p>/g);
      return paras.map((p) => extractParagraphText(p)).join(" ");
    });
    text += cellTexts.join("\t") + "\n";
  }
  return text;
}

// --- Markdown extraction ---

function extractMarkdownFromBody(
  body: string,
  linkMap: Record<string, string>,
  numbering: Record<string, { numId: string; isOrdered: boolean }>
): string {
  const parts: string[] = [];
  const elements = splitElements(body);

  for (const el of elements) {
    if (el.startsWith("<w:p ") || el.startsWith("<w:p>")) {
      parts.push(convertParagraphMd(el, linkMap, numbering));
    } else if (el.startsWith("<w:tbl")) {
      parts.push(convertTableMd(el, linkMap));
    } else if (el.startsWith("<w:sectPr")) {
      // Section properties - skip
    }
  }

  return parts.join("").replace(/\n{3,}/g, "\n\n");
}

function convertParagraphMd(
  pXml: string,
  linkMap: Record<string, string>,
  numbering: Record<string, { numId: string; isOrdered: boolean }>
): string {
  // Check for heading style
  const styleMatch = pXml.match(
    /<w:pStyle\s+w:val="([^"]+)"/
  );
  const style = styleMatch?.[1] || "";

  // Check for list numbering
  const numIdMatch = pXml.match(/<w:numId\s+w:val="(\d+)"/);
  const ilvlMatch = pXml.match(/<w:ilvl\s+w:val="(\d+)"/);

  const text = formatRunsMd(pXml, linkMap);
  if (!text.trim()) return "\n";

  // Headings
  const headingLevel = getHeadingLevel(style);
  if (headingLevel) {
    return `${"#".repeat(headingLevel)} ${text.trim()}\n\n`;
  }

  // Lists
  if (numIdMatch) {
    const numId = numIdMatch[1];
    const level = parseInt(ilvlMatch?.[1] || "0");
    const indent = "  ".repeat(level);
    const info = numbering[numId];
    const marker = info?.isOrdered ? "1." : "-";
    return `${indent}${marker} ${text.trim()}\n`;
  }

  return `${text}\n`;
}

function getHeadingLevel(style: string): number | null {
  if (/^Heading(\d)$/i.test(style)) return parseInt(style.replace(/\D/g, ""));
  if (/^Title$/i.test(style)) return 1;
  if (/^Subtitle$/i.test(style)) return 2;
  return null;
}

function formatRunsMd(
  pXml: string,
  linkMap: Record<string, string>
): string {
  let result = "";

  // Handle both regular runs and hyperlink runs
  const tokenRe =
    /<w:hyperlink[^>]*>[\s\S]*?<\/w:hyperlink>|<w:r[ >][\s\S]*?<\/w:r>/g;
  const tokens = allMatches(pXml, tokenRe);

  for (const token of tokens) {
    if (token.startsWith("<w:hyperlink")) {
      const rIdMatch = token.match(/r:id="([^"]+)"/);
      const url = rIdMatch ? linkMap[rIdMatch[1]] || "" : "";
      const innerRuns = allMatches(token, /<w:r[ >][\s\S]*?<\/w:r>/g);
      let linkText = "";
      for (const run of innerRuns) {
        linkText += extractRunText(run);
      }
      if (url && linkText.trim()) {
        result += `[${linkText.trim()}](${url})`;
      } else {
        result += linkText;
      }
    } else {
      const text = extractRunText(token);
      if (!text) continue;

      const rPr = extractBetween(token, "<w:rPr>", "</w:rPr>") || "";
      const bold = rPr.includes("<w:b/>") || rPr.includes('<w:b ');
      const italic = rPr.includes("<w:i/>") || rPr.includes('<w:i ');
      const strike =
        rPr.includes("<w:strike/>") || rPr.includes('<w:strike ');

      let formatted = text;
      if (bold && italic) {
        formatted = `***${formatted.trim()}***`;
      } else if (bold) {
        formatted = `**${formatted.trim()}**`;
      } else if (italic) {
        formatted = `*${formatted.trim()}*`;
      }
      if (strike) {
        formatted = `~~${formatted.trim()}~~`;
      }
      result += formatted;
    }
  }

  return result;
}

function extractRunText(runXml: string): string {
  const texts = allMatches(runXml, /<w:t[^>]*>([\s\S]*?)<\/w:t>/g, 1);
  return texts.join("");
}

function convertTableMd(
  tblXml: string,
  linkMap: Record<string, string>
): string {
  const rows: string[][] = [];
  const rowMatches = allMatches(tblXml, /<w:tr[ >][\s\S]*?<\/w:tr>/g);

  for (const row of rowMatches) {
    const cells: string[] = [];
    const cellMatches = allMatches(row, /<w:tc[ >][\s\S]*?<\/w:tc>/g);
    for (const cell of cellMatches) {
      const paras = allMatches(cell, /<w:p[ >][\s\S]*?<\/w:p>/g);
      const text = paras
        .map((p) => formatRunsMd(p, linkMap).trim())
        .filter(Boolean)
        .join(" ");
      cells.push(text.replace(/\|/g, "\\|"));
    }
    rows.push(cells);
  }

  if (rows.length === 0) return "";

  const lines: string[] = [];
  lines.push("| " + rows[0].map((c) => c || " ").join(" | ") + " |");
  lines.push("| " + rows[0].map(() => "---").join(" | ") + " |");
  for (let i = 1; i < rows.length; i++) {
    lines.push("| " + rows[i].map((c) => c || " ").join(" | ") + " |");
  }
  return lines.join("\n") + "\n\n";
}

// --- XML helpers ---

function extractBetween(
  xml: string,
  startTag: string,
  endTag: string
): string | null {
  const startIdx = xml.indexOf(startTag);
  if (startIdx === -1) return null;
  const afterStart = xml.indexOf(">", startIdx) + 1;
  const endIdx = xml.indexOf(endTag, afterStart);
  if (endIdx === -1) return null;
  return xml.slice(afterStart, endIdx);
}

function allMatches(
  str: string,
  re: RegExp,
  group?: number
): string[] {
  const results: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(str))) {
    results.push(group !== undefined ? m[group] : m[0]);
  }
  return results;
}

// Split body XML into top-level elements (paragraphs, tables, etc.)
function splitElements(body: string): string[] {
  const elements: string[] = [];
  const re =
    /<w:(p|tbl|sectPr)[ >][\s\S]*?<\/w:\1>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    elements.push(m[0]);
  }
  return elements;
}
