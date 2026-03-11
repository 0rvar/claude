import * as z from "zod/v4";
import * as drive from "../drive";
import type { Tool } from "../mcp";

export const listFolderContents: Tool = {
  name: "listFolderContents",
  description:
    "Lists files and subfolders within a Drive folder. Use folderId='root' for top-level.",
  parameters: z.object({
    folderId: z
      .string()
      .describe('Folder ID. Use "root" for the root Drive folder.'),
    includeSubfolders: z
      .boolean()
      .optional()
      .default(true)
      .describe("Include subfolders in results."),
    includeFiles: z
      .boolean()
      .optional()
      .default(true)
      .describe("Include files in results."),
    maxResults: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .default(50)
      .describe("Maximum number of items."),
  }),
  execute: async (args) => {
    if (!args.includeSubfolders && !args.includeFiles) {
      throw new Error(
        "At least one of includeSubfolders or includeFiles must be true."
      );
    }

    let q = `'${args.folderId}' in parents and trashed=false`;
    if (!args.includeSubfolders) {
      q += ` and mimeType!='application/vnd.google-apps.folder'`;
    } else if (!args.includeFiles) {
      q += ` and mimeType='application/vnd.google-apps.folder'`;
    }

    const res = await drive.listFiles({
      q,
      pageSize: args.maxResults,
      orderBy: "folder,name",
      fields:
        "files(id,name,mimeType,size,modifiedTime,webViewLink,owners(displayName))",
    });

    const items = res.files || [];
    const folders = items
      .filter((f: any) => f.mimeType === "application/vnd.google-apps.folder")
      .map((f: any) => ({
        id: f.id,
        name: f.name,
        modifiedTime: f.modifiedTime,
      }));
    const files = items
      .filter((f: any) => f.mimeType !== "application/vnd.google-apps.folder")
      .map((f: any) => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        size: f.size || null,
        modifiedTime: f.modifiedTime,
      }));
    return JSON.stringify({ folders, files }, null, 2);
  },
};
