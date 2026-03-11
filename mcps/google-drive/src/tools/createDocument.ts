import * as z from "zod/v4";
import * as drive from "../drive";
import type { Tool } from "../mcp";

const WORKSPACE_TYPES: Record<string, string> = {
  document: "application/vnd.google-apps.document",
  spreadsheet: "application/vnd.google-apps.spreadsheet",
  presentation: "application/vnd.google-apps.presentation",
  form: "application/vnd.google-apps.form",
};

export const createDocument: Tool = {
  name: "createDocument",
  description:
    "Creates a new Google Workspace document (Doc, Sheet, Slides, or Form).",
  parameters: z.object({
    title: z.string().min(1).describe("Title for the new document."),
    type: z
      .enum(["document", "spreadsheet", "presentation", "form"])
      .optional()
      .default("document")
      .describe("Type of document."),
    parentFolderId: z
      .string()
      .optional()
      .describe("Folder ID. Omit for Drive root."),
  }),
  execute: async (args) => {
    const res = await drive.createFile(
      {
        name: args.title,
        mimeType: WORKSPACE_TYPES[args.type],
        ...(args.parentFolderId && { parents: [args.parentFolderId] }),
      },
      "id,name,mimeType,webViewLink"
    );
    return JSON.stringify(
      { id: res.id, name: res.name, type: args.type, url: res.webViewLink },
      null,
      2
    );
  },
};
