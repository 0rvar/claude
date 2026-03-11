import * as z from "zod/v4";
import * as docs from "../docs";
import type { Tool } from "../mcp";

export const replaceText: Tool = {
  name: "replaceText",
  description:
    "Finds and replaces all occurrences of a text string in a Google Doc.",
  parameters: z.object({
    documentId: z.string().describe("The document ID."),
    find: z.string().min(1).describe("Text to find."),
    replace: z.string().describe("Replacement text (empty string to delete matches)."),
    matchCase: z
      .boolean()
      .optional()
      .default(false)
      .describe("Whether the search is case-sensitive."),
  }),
  execute: async (args) => {
    const result = await docs.batchUpdate(args.documentId, [
      {
        replaceAllText: {
          containsText: { text: args.find, matchCase: args.matchCase },
          replaceText: args.replace,
        },
      },
    ]);

    const count =
      result.replies?.[0]?.replaceAllText?.occurrencesChanged || 0;
    return `Replaced ${count} occurrence${count !== 1 ? "s" : ""} of "${args.find}".`;
  },
};
