import * as z from "zod/v4";
import * as drive from "../drive";
import type { Tool } from "../mcp";

export const deleteFileTool: Tool = {
  name: "deleteFile",
  description:
    "Moves a file or folder to trash, or permanently deletes it with permanent=true.",
  parameters: z.object({
    fileId: z.string().describe("The file or folder ID."),
    permanent: z
      .boolean()
      .optional()
      .default(false)
      .describe("If true, permanently deletes instead of trashing."),
  }),
  execute: async (args) => {
    const info = await drive.getFile(args.fileId, "name,mimeType");
    const type =
      info.mimeType === "application/vnd.google-apps.folder"
        ? "folder"
        : "file";

    if (args.permanent) {
      await drive.deleteFile(args.fileId);
    } else {
      await drive.updateFile(args.fileId, { trashed: true });
    }

    return JSON.stringify(
      {
        success: true,
        action: args.permanent ? "permanently_deleted" : "trashed",
        fileId: args.fileId,
        fileName: info.name,
        type,
        message: args.permanent
          ? `Permanently deleted ${type} "${info.name}".`
          : `Moved ${type} "${info.name}" to trash.`,
      },
      null,
      2
    );
  },
};
