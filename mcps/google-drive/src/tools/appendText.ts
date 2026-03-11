import * as z from "zod/v4";
import * as docs from "../docs";
import type { Tool } from "../mcp";

export const appendText: Tool = {
  name: "appendText",
  description: "Appends text to the end of a Google Doc.",
  parameters: z.object({
    documentId: z.string().describe("The document ID."),
    text: z.string().min(1).describe("Text to append."),
    tabId: z.string().optional().describe("Target tab ID."),
  }),
  execute: async (args) => {
    const needsTabs = !!args.tabId;
    const doc = await docs.getDocument(args.documentId, {
      fields: needsTabs ? "tabs" : "body(content(endIndex))",
      includeTabsContent: needsTabs,
    });

    let body: any;
    if (args.tabId) {
      const tab = docs.findTabById(doc, args.tabId);
      if (!tab) throw new Error(`Tab "${args.tabId}" not found.`);
      body = tab.documentTab?.body;
    } else {
      body = doc.body;
    }

    const endIndex = docs.getBodyEndIndex(body);
    const location: any = { index: endIndex };
    if (args.tabId) location.tabId = args.tabId;

    const text = endIndex > 1 ? "\n" + args.text : args.text;

    await docs.batchUpdate(args.documentId, [
      { insertText: { location, text } },
    ]);
    return `Appended text to document.`;
  },
};
