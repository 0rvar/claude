import * as z from "zod/v4";
import * as drive from "../drive";
import type { Tool } from "../mcp";

const FIELDS =
  "id,name,description,mimeType,size,createdTime,modifiedTime,webViewLink,owners(displayName,emailAddress),lastModifyingUser(displayName,emailAddress),shared,parents,version";

export const getFileInfo: Tool = {
  name: "getFileInfo",
  description:
    "Gets metadata about a file including name, owner, sharing status, MIME type, and modification history.",
  parameters: z.object({
    fileId: z.string().describe("The file ID."),
  }),
  execute: async (args) => {
    const f = await drive.getFile(args.fileId, FIELDS);
    return JSON.stringify(
      {
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        size: f.size || null,
        createdTime: f.createdTime,
        modifiedTime: f.modifiedTime,
        owner: f.owners?.[0]?.displayName || null,
        ownerEmail: f.owners?.[0]?.emailAddress || null,
        lastModifyingUser: f.lastModifyingUser?.displayName || null,
        shared: f.shared || false,
        url: f.webViewLink,
        description: f.description || null,
        parentId: f.parents?.[0] || null,
      },
      null,
      2
    );
  },
};
