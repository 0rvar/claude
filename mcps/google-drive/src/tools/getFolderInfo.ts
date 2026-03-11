import * as z from "zod/v4";
import * as drive from "../drive";
import type { Tool } from "../mcp";

const FIELDS =
  "id,name,description,mimeType,createdTime,modifiedTime,webViewLink,owners(displayName,emailAddress),lastModifyingUser(displayName),shared,parents";

export const getFolderInfo: Tool = {
  name: "getFolderInfo",
  description:
    "Gets metadata about a Drive folder including name, owner, sharing status, and parent.",
  parameters: z.object({
    folderId: z.string().describe("Folder ID."),
  }),
  execute: async (args) => {
    const f = await drive.getFile(args.folderId, FIELDS);
    if (f.mimeType !== "application/vnd.google-apps.folder") {
      throw new Error("The specified ID does not belong to a folder.");
    }
    return JSON.stringify(
      {
        id: f.id,
        name: f.name,
        createdTime: f.createdTime,
        modifiedTime: f.modifiedTime,
        owner: f.owners?.[0]?.displayName || null,
        lastModifyingUser: f.lastModifyingUser?.displayName || null,
        shared: f.shared || false,
        url: f.webViewLink,
        description: f.description || null,
        parentFolderId: f.parents?.[0] || null,
      },
      null,
      2
    );
  },
};
