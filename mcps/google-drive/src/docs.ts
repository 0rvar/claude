import { getAccessToken } from "./auth";

const BASE = "https://docs.googleapis.com/v1/documents";

async function headers(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export async function getDocument(
  documentId: string,
  opts: { fields?: string; includeTabsContent?: boolean } = {}
): Promise<any> {
  const url = new URL(`${BASE}/${encodeURIComponent(documentId)}`);
  if (opts.fields) url.searchParams.set("fields", opts.fields);
  if (opts.includeTabsContent)
    url.searchParams.set("includeTabsContent", "true");

  const res = await fetch(url.toString(), { headers: await headers() });
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`Docs API error (${res.status}): ${text}`);
    (err as any).code = res.status;
    throw err;
  }
  return res.json();
}

export async function batchUpdate(
  documentId: string,
  requests: any[]
): Promise<any> {
  const url = `${BASE}/${encodeURIComponent(documentId)}:batchUpdate`;
  const res = await fetch(url, {
    method: "POST",
    headers: await headers(),
    body: JSON.stringify({ requests }),
  });
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`Docs API batchUpdate error (${res.status}): ${text}`);
    (err as any).code = res.status;
    throw err;
  }
  return res.json();
}

// --- Text extraction ---

export function extractText(body: any): string {
  let text = "";
  for (const el of body?.content || []) {
    if (el.paragraph?.elements) {
      for (const pe of el.paragraph.elements) {
        if (pe.textRun?.content) text += pe.textRun.content;
      }
    }
    if (el.table?.tableRows) {
      for (const row of el.table.tableRows) {
        for (const cell of row.tableCells || []) {
          for (const cellEl of cell.content || []) {
            if (cellEl.paragraph?.elements) {
              for (const pe of cellEl.paragraph.elements) {
                if (pe.textRun?.content) text += pe.textRun.content;
              }
            }
          }
        }
      }
    }
  }
  return text;
}

// --- Docs to markdown ---

const CODE_FONTS = new Set([
  "Courier New",
  "Consolas",
  "Source Code Pro",
  "Roboto Mono",
  "Fira Code",
  "JetBrains Mono",
]);

const HEADING_MAP: Record<string, number> = {
  TITLE: 1,
  SUBTITLE: 2,
  HEADING_1: 1,
  HEADING_2: 2,
  HEADING_3: 3,
  HEADING_4: 4,
  HEADING_5: 5,
  HEADING_6: 6,
};

export function extractMarkdown(body: any): string {
  const parts: string[] = [];

  for (const el of body?.content || []) {
    if (el.paragraph) {
      parts.push(convertParagraph(el.paragraph));
    } else if (el.table) {
      parts.push(convertTable(el.table));
    } else if (el.sectionBreak) {
      parts.push("---\n");
    }
  }

  return parts.join("").replace(/\n{3,}/g, "\n\n");
}

function convertParagraph(para: any): string {
  const style = para.paragraphStyle?.namedStyleType;
  const headingLevel = style ? HEADING_MAP[style] : undefined;
  const bullet = para.bullet;

  let text = formatRuns(para.elements || []);
  if (!text.trim()) return "\n";

  if (headingLevel) {
    return `${"#".repeat(headingLevel)} ${text.trim()}\n\n`;
  }

  if (bullet) {
    const nesting = bullet.nestingLevel || 0;
    const indent = "  ".repeat(nesting);
    const listId = bullet.listId || "";
    // Ordered lists have glyphType set on their nesting levels
    const isOrdered = false; // Simplified - would need list definitions to determine
    const marker = isOrdered ? "1." : "-";
    return `${indent}${marker} ${text.trim()}\n`;
  }

  return `${text}\n`;
}

function formatRuns(elements: any[]): string {
  let result = "";
  for (const el of elements) {
    if (!el.textRun) continue;
    const content = el.textRun.content || "";
    if (content === "\n") {
      result += content;
      continue;
    }

    const style = el.textRun.textStyle || {};
    let formatted = content;

    // Code detection
    const font = style.weightedFontFamily?.fontFamily;
    if (font && CODE_FONTS.has(font)) {
      formatted = `\`${formatted.trim()}\``;
      result += formatted;
      continue;
    }

    // Bold + italic
    if (style.bold && style.italic) {
      formatted = `***${formatted.trim()}***`;
    } else if (style.bold) {
      formatted = `**${formatted.trim()}**`;
    } else if (style.italic) {
      formatted = `*${formatted.trim()}*`;
    }

    if (style.strikethrough) {
      formatted = `~~${formatted.trim()}~~`;
    }

    // Links
    if (style.link?.url) {
      const linkText = formatted.trim();
      formatted = `[${linkText}](${style.link.url})`;
    }

    result += formatted;
  }
  return result;
}

function convertTable(table: any): string {
  const rows: string[][] = [];
  for (const row of table.tableRows || []) {
    const cells: string[] = [];
    for (const cell of row.tableCells || []) {
      let text = "";
      for (const el of cell.content || []) {
        if (el.paragraph?.elements) {
          for (const pe of el.paragraph.elements) {
            if (pe.textRun?.content) text += pe.textRun.content;
          }
        }
      }
      cells.push(text.trim().replace(/\n/g, " "));
    }
    rows.push(cells);
  }

  if (rows.length === 0) return "";

  // Check if it's a 1x1 code block table
  if (
    table.rows === 1 &&
    table.columns === 1 &&
    rows.length === 1 &&
    rows[0].length === 1
  ) {
    return `\`\`\`\n${rows[0][0]}\n\`\`\`\n\n`;
  }

  const lines: string[] = [];
  lines.push("| " + rows[0].map((c) => c || " ").join(" | ") + " |");
  lines.push("| " + rows[0].map(() => "---").join(" | ") + " |");
  for (let i = 1; i < rows.length; i++) {
    lines.push("| " + rows[i].map((c) => c || " ").join(" | ") + " |");
  }
  return lines.join("\n") + "\n\n";
}

// --- Tab helpers ---

export function findTabById(doc: any, tabId: string): any | null {
  for (const tab of doc.tabs || []) {
    if (tab.tabProperties?.tabId === tabId) return tab;
    const found = findInChildTabs(tab.childTabs, tabId);
    if (found) return found;
  }
  return null;
}

function findInChildTabs(tabs: any[] | undefined, tabId: string): any | null {
  for (const tab of tabs || []) {
    if (tab.tabProperties?.tabId === tabId) return tab;
    const found = findInChildTabs(tab.childTabs, tabId);
    if (found) return found;
  }
  return null;
}

export function getAllTabs(doc: any): any[] {
  const result: any[] = [];
  for (const tab of doc.tabs || []) {
    result.push(tab);
    collectChildTabs(tab.childTabs, result);
  }
  return result;
}

function collectChildTabs(tabs: any[] | undefined, result: any[]) {
  for (const tab of tabs || []) {
    result.push(tab);
    collectChildTabs(tab.childTabs, result);
  }
}

// --- End index helper ---

export function getBodyEndIndex(body: any): number {
  const content = body?.content;
  if (!content || content.length === 0) return 1;
  const last = content[content.length - 1];
  return (last.endIndex || 2) - 1;
}
