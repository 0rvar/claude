import * as z from "zod/v4";
import * as drive from "../drive";
import type { Tool } from "../mcp";

export const searchFiles: Tool = {
  name: "searchFiles",
  description:
    "Searches for files by name, content, or both. Supports MIME type and date filtering.",
  parameters: z.object({
    query: z
      .string()
      .min(1)
      .describe("Search term to find in file names or content."),
    searchIn: z
      .enum(["name", "content", "both"])
      .optional()
      .default("both")
      .describe("Where to search: file names, content, or both."),
    mimeType: z.string().optional().describe("Filter by MIME type."),
    maxResults: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .default(10)
      .describe("Maximum number of results."),
    modifiedAfter: z
      .string()
      .optional()
      .describe("Only return files modified after this date (ISO 8601)."),
  }),
  execute: async (args) => {
    let q = "trashed=false";

    if (args.searchIn === "name") {
      q += ` and name contains '${args.query}'`;
    } else if (args.searchIn === "content") {
      q += ` and fullText contains '${args.query}'`;
    } else {
      q += ` and (name contains '${args.query}' or fullText contains '${args.query}')`;
    }

    if (args.mimeType) q += ` and mimeType='${args.mimeType}'`;
    if (args.modifiedAfter) q += ` and modifiedTime > '${args.modifiedAfter}'`;

    const res = await drive.listFiles({
      q,
      pageSize: args.maxResults,
      orderBy: "modifiedTime desc",
      fields:
        "files(id,name,mimeType,modifiedTime,webViewLink,owners(displayName),parents)",
    });

    const files = (res.files || []).map((f: any) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      modifiedTime: f.modifiedTime,
      owner: f.owners?.[0]?.displayName || null,
      url: f.webViewLink,
    }));
    return JSON.stringify({ files }, null, 2);
  },
};
