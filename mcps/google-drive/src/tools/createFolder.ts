import * as z from "zod/v4";
import * as drive from "../drive";
import type { Tool } from "../mcp";

export const createFolder: Tool = {
  name: "createFolder",
  description:
    "Creates a new folder in Google Drive, optionally inside a parent folder.",
  parameters: z.object({
    name: z.string().min(1).describe("Name for the new folder."),
    parentFolderId: z
      .string()
      .optional()
      .describe("Parent folder ID. Omit for Drive root."),
  }),
  execute: async (args) => {
    const res = await drive.createFile({
      name: args.name,
      mimeType: "application/vnd.google-apps.folder",
      ...(args.parentFolderId && { parents: [args.parentFolderId] }),
    });
    return JSON.stringify(
      { id: res.id, name: res.name, url: res.webViewLink },
      null,
      2
    );
  },
};
