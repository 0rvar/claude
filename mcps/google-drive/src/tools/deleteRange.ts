import * as z from "zod/v4";
import * as docs from "../docs";
import type { Tool } from "../mcp";

export const deleteRange: Tool = {
  name: "deleteRange",
  description:
    "Deletes content in a character range [startIndex, endIndex) from a Google Doc. Use readDoc with format='json' to find indices.",
  parameters: z.object({
    documentId: z.string().describe("The document ID."),
    startIndex: z
      .number()
      .int()
      .min(1)
      .describe("Start of range to delete (inclusive, 1-based)."),
    endIndex: z
      .number()
      .int()
      .min(2)
      .describe("End of range to delete (exclusive, 1-based)."),
    tabId: z.string().optional().describe("Target tab ID."),
  }),
  execute: async (args) => {
    if (args.endIndex <= args.startIndex) {
      throw new Error("endIndex must be greater than startIndex.");
    }

    const range: any = {
      startIndex: args.startIndex,
      endIndex: args.endIndex,
    };
    if (args.tabId) range.tabId = args.tabId;

    await docs.batchUpdate(args.documentId, [
      { deleteContentRange: { range } },
    ]);
    return `Deleted range ${args.startIndex}-${args.endIndex}.`;
  },
};
