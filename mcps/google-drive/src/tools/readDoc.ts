import * as z from "zod/v4";
import * as docs from "../docs";
import type { Tool } from "../mcp";

export const readDoc: Tool = {
  name: "readDoc",
  description:
    "Reads a Google Doc's content. Returns plain text by default, or markdown/json format. Use json format to get character indices for editing.",
  parameters: z.object({
    documentId: z
      .string()
      .describe("The document ID (the long string between /d/ and /edit in a Google Docs URL)."),
    format: z
      .enum(["text", "markdown", "json"])
      .optional()
      .default("text")
      .describe("Output format: 'text' (plain), 'markdown' (formatted), 'json' (raw structure with indices)."),
    maxLength: z
      .number()
      .optional()
      .describe("Truncate output to this many characters."),
    tabId: z
      .string()
      .optional()
      .describe("Read a specific tab. Use listDocTabs to get tab IDs."),
  }),
  execute: async (args) => {
    const needsTabs = !!args.tabId;
    const fields =
      args.format === "json" || args.format === "markdown"
        ? "*"
        : "body(content(paragraph(elements(textRun(content))),table(tableRows(tableCells(content(paragraph(elements(textRun(content)))))))))";

    const doc = await docs.getDocument(args.documentId, {
      fields: needsTabs ? "*" : fields,
      includeTabsContent: needsTabs,
    });

    let body: any;
    if (args.tabId) {
      const tab = docs.findTabById(doc, args.tabId);
      if (!tab) throw new Error(`Tab "${args.tabId}" not found.`);
      if (!tab.documentTab) throw new Error(`Tab "${args.tabId}" has no content.`);
      body = tab.documentTab.body;
    } else {
      body = doc.body;
    }

    let output: string;
    if (args.format === "json") {
      output = JSON.stringify(args.tabId ? { body } : doc, null, 2);
    } else if (args.format === "markdown") {
      output = docs.extractMarkdown(body);
    } else {
      output = docs.extractText(body);
      if (!output.trim()) return "Document is empty.";
    }

    if (args.maxLength && output.length > args.maxLength) {
      return output.slice(0, args.maxLength) + `\n... [truncated, ${output.length} total chars]`;
    }
    return output;
  },
};
