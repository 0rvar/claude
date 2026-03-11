import * as z from "zod/v4";
import * as drive from "../drive";
import { parseDocx } from "../docx";
import type { Tool } from "../mcp";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export const readFile: Tool = {
  name: "readFile",
  description:
    "Reads/downloads a file's content. Google Docs export as text, Sheets as CSV. Docx files are automatically parsed to text or markdown. Other files downloaded as-is.",
  parameters: z.object({
    fileId: z.string().describe("The file ID."),
    format: z
      .enum(["text", "markdown"])
      .optional()
      .default("text")
      .describe("Output format for docx files: 'text' (plain) or 'markdown' (with formatting)."),
    exportMimeType: z
      .string()
      .optional()
      .describe(
        "Override export format for Google Workspace files (e.g. 'text/html', 'text/csv')."
      ),
  }),
  execute: async (args) => {
    // Check mime type first to decide strategy
    const meta = await drive.getFile(args.fileId, "mimeType,name");

    if (meta.mimeType === DOCX_MIME || meta.name?.endsWith(".docx")) {
      const { buffer } = await drive.downloadFileBuffer(args.fileId);
      return parseDocx(buffer, args.format);
    }

    // Fall back to text download/export for everything else
    return drive.downloadFile(args.fileId, args.exportMimeType);
  },
};
