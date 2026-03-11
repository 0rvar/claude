import * as z from "zod/v4";
import * as docs from "../docs";
import type { Tool } from "../mcp";

export const insertText: Tool = {
  name: "insertText",
  description:
    "Inserts text at a specific character index in a Google Doc. Use readDoc with format='json' to find indices.",
  parameters: z.object({
    documentId: z.string().describe("The document ID."),
    text: z.string().min(1).describe("Text to insert."),
    index: z
      .number()
      .int()
      .min(1)
      .describe("1-based character index to insert at."),
    tabId: z.string().optional().describe("Target tab ID."),
  }),
  execute: async (args) => {
    const location: any = { index: args.index };
    if (args.tabId) location.tabId = args.tabId;

    await docs.batchUpdate(args.documentId, [
      { insertText: { location, text: args.text } },
    ]);
    return `Inserted text at index ${args.index}.`;
  },
};
