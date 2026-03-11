import * as z from "zod/v4";
import * as drive from "../drive";
import type { Tool } from "../mcp";

export const convertToDoc: Tool = {
  name: "convertToDoc",
  description:
    "Converts a file (docx, xlsx, pptx, pdf, etc.) to a native Google Workspace format. The original file is unchanged; a new converted copy is created. Use readDoc on the result to read its content.",
  parameters: z.object({
    fileId: z.string().describe("The file ID to convert."),
    targetType: z
      .enum(["document", "spreadsheet", "presentation"])
      .optional()
      .default("document")
      .describe("Target Google Workspace type."),
    parentFolderId: z
      .string()
      .optional()
      .describe("Folder for the converted file. Omit to place next to original."),
  }),
  execute: async (args) => {
    const mimeTypes: Record<string, string> = {
      document: "application/vnd.google-apps.document",
      spreadsheet: "application/vnd.google-apps.spreadsheet",
      presentation: "application/vnd.google-apps.presentation",
    };

    const original = await drive.getFile(args.fileId, "name,parents");
    const baseName = (original.name || "Untitled").replace(/\.[^.]+$/, "");

    const res = await drive.copyFile(args.fileId, {
      name: baseName,
      mimeType: mimeTypes[args.targetType],
      ...(args.parentFolderId
        ? { parents: [args.parentFolderId] }
        : original.parents
          ? { parents: original.parents }
          : {}),
    });

    return JSON.stringify(
      {
        id: res.id,
        name: res.name,
        mimeType: res.mimeType,
        url: res.webViewLink,
        message: `Converted "${original.name}" to Google ${args.targetType}. Use readDoc with documentId="${res.id}" to read it.`,
      },
      null,
      2
    );
  },
};
