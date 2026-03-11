import * as z from "zod/v4";
import * as drive from "../drive";
import type { Tool } from "../mcp";

const FIELDS =
  "files(id,name,mimeType,modifiedTime,createdTime,size,webViewLink,owners(displayName,emailAddress))";

export const listFiles: Tool = {
  name: "listFiles",
  description:
    "Lists files in Google Drive, optionally filtered by name, MIME type, or modification date.",
  parameters: z.object({
    maxResults: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .default(20)
      .describe("Maximum number of files to return (1-100)."),
    query: z
      .string()
      .optional()
      .describe("Search query to filter files by name or content."),
    mimeType: z
      .string()
      .optional()
      .describe(
        "Filter by MIME type (e.g. 'application/vnd.google-apps.document')."
      ),
    orderBy: z
      .enum(["name", "modifiedTime", "createdTime"])
      .optional()
      .default("modifiedTime")
      .describe("Sort order for results."),
    modifiedAfter: z
      .string()
      .optional()
      .describe("Only return files modified after this date (ISO 8601)."),
  }),
  execute: async (args) => {
    let q = "trashed=false";
    if (args.query) {
      q += ` and (name contains '${args.query}' or fullText contains '${args.query}')`;
    }
    if (args.mimeType) {
      q += ` and mimeType='${args.mimeType}'`;
    }
    if (args.modifiedAfter) {
      q += ` and modifiedTime > '${new Date(args.modifiedAfter).toISOString()}'`;
    }

    const res = await drive.listFiles({
      q,
      pageSize: args.maxResults,
      orderBy: args.orderBy,
      fields: FIELDS,
    });

    const files = (res.files || []).map((f: any) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      modifiedTime: f.modifiedTime,
      size: f.size || null,
      owner: f.owners?.[0]?.displayName || null,
      url: f.webViewLink,
    }));
    return JSON.stringify({ files }, null, 2);
  },
};
