import * as z from "zod/v4";
import * as drive from "../drive";
import type { Tool } from "../mcp";

export const createFromTemplate: Tool = {
  name: "createFromTemplate",
  description:
    "Creates a new file by copying an existing template.",
  parameters: z.object({
    templateId: z.string().describe("ID of the template file to copy."),
    newTitle: z.string().min(1).describe("Title for the new file."),
    parentFolderId: z
      .string()
      .optional()
      .describe("Destination folder ID. Omit for Drive root."),
  }),
  execute: async (args) => {
    const res = await drive.copyFile(args.templateId, {
      name: args.newTitle,
      ...(args.parentFolderId && { parents: [args.parentFolderId] }),
    });
    return JSON.stringify(
      { id: res.id, name: res.name, mimeType: res.mimeType, url: res.webViewLink },
      null,
      2
    );
  },
};
