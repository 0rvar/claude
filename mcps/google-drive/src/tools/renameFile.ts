import * as z from "zod/v4";
import * as drive from "../drive";
import type { Tool } from "../mcp";

export const renameFile: Tool = {
  name: "renameFile",
  description: "Renames a file or folder in Google Drive.",
  parameters: z.object({
    fileId: z.string().describe("The file or folder ID."),
    newName: z.string().min(1).describe("New name."),
  }),
  execute: async (args) => {
    const res = await drive.updateFile(args.fileId, { name: args.newName });
    return `Renamed to "${res.name}" (ID: ${res.id})\nLink: ${res.webViewLink}`;
  },
};
