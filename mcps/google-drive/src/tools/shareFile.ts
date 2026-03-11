import * as z from "zod/v4";
import * as drive from "../drive";
import type { Tool } from "../mcp";

export const shareFile: Tool = {
  name: "shareFile",
  description:
    "Shares a file or folder with a user or makes it link-accessible.",
  parameters: z.object({
    fileId: z.string().describe("The file or folder ID."),
    role: z
      .enum(["reader", "commenter", "writer", "organizer"])
      .describe("Permission role to grant."),
    type: z
      .enum(["user", "group", "domain", "anyone"])
      .describe(
        "Grantee type. 'anyone' = link-accessible. 'user'/'group' requires emailAddress."
      ),
    emailAddress: z
      .string()
      .optional()
      .describe("Email (required for type='user' or 'group')."),
    sendNotification: z
      .boolean()
      .optional()
      .default(true)
      .describe("Send notification email (user/group only)."),
  }),
  execute: async (args) => {
    if (
      (args.type === "user" || args.type === "group") &&
      !args.emailAddress
    ) {
      throw new Error(
        `emailAddress is required when type is '${args.type}'.`
      );
    }

    const res = await drive.createPermission(
      args.fileId,
      {
        role: args.role,
        type: args.type,
        ...(args.emailAddress && { emailAddress: args.emailAddress }),
      },
      args.sendNotification
    );

    return JSON.stringify(
      {
        permissionId: res.id,
        role: res.role,
        type: res.type,
        emailAddress: res.emailAddress || null,
        message: `Shared with ${args.type}${args.emailAddress ? ` (${args.emailAddress})` : ""} as ${args.role}.`,
      },
      null,
      2
    );
  },
};
