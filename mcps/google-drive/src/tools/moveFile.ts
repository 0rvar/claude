import * as z from "zod/v4";
import * as drive from "../drive";
import type { Tool } from "../mcp";

export const moveFile: Tool = {
  name: "moveFile",
  description:
    "Moves a file or folder to a different Drive folder. Removes from current parents by default.",
  parameters: z.object({
    fileId: z.string().describe("The file or folder ID."),
    newParentId: z
      .string()
      .describe('Destination folder ID. Use "root" for Drive root.'),
    keepInCurrentParents: z
      .boolean()
      .optional()
      .default(false)
      .describe("If true, adds to new parent while keeping existing parents."),
  }),
  execute: async (args) => {
    const info = await drive.getFile(args.fileId, "name,parents");
    const currentParents = info.parents || [];

    const extraParams: Record<string, string> = {
      addParents: args.newParentId,
    };
    if (!args.keepInCurrentParents && currentParents.length > 0) {
      extraParams.removeParents = currentParents.join(",");
    }

    const res = await drive.updateFile(args.fileId, {}, extraParams);
    return `Moved "${info.name}" to new location.\nFile ID: ${res.id}`;
  },
};
