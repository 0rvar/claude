import * as z from "zod/v4";
import * as drive from "../drive";
import type { Tool } from "../mcp";

export const copyFileTool: Tool = {
  name: "copyFile",
  description:
    "Creates a copy of a file in Google Drive. Returns the new copy's ID and URL.",
  parameters: z.object({
    fileId: z.string().describe("The file ID to copy."),
    newName: z
      .string()
      .optional()
      .describe('Name for the copy. Defaults to "Copy of [original name]".'),
    parentFolderId: z
      .string()
      .optional()
      .describe("Destination folder ID. Omit for same location as original."),
  }),
  execute: async (args) => {
    const original = await drive.getFile(args.fileId, "name,parents");
    const res = await drive.copyFile(args.fileId, {
      name: args.newName || `Copy of ${original.name}`,
      ...(args.parentFolderId
        ? { parents: [args.parentFolderId] }
        : original.parents
          ? { parents: original.parents }
          : {}),
    });
    return JSON.stringify(
      { id: res.id, name: res.name, url: res.webViewLink },
      null,
      2
    );
  },
};
