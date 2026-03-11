import * as z from "zod/v4";
import * as docs from "../docs";
import type { Tool } from "../mcp";

export const listDocTabs: Tool = {
  name: "listDocTabs",
  description:
    "Lists all tabs in a Google Doc with their IDs. Use the tab IDs with other doc tools' tabId parameter.",
  parameters: z.object({
    documentId: z.string().describe("The document ID."),
  }),
  execute: async (args) => {
    const doc = await docs.getDocument(args.documentId, {
      fields: "title,tabs(tabProperties,childTabs)",
      includeTabsContent: true,
    });

    const tabs = docs.getAllTabs(doc).map((tab: any) => {
      const props = tab.tabProperties || {};
      const entry: Record<string, any> = {
        id: props.tabId || null,
        title: props.title || null,
        index: props.index ?? null,
      };
      if (props.parentTabId) entry.parentTabId = props.parentTabId;
      return entry;
    });

    return JSON.stringify(
      { documentTitle: doc.title || "Untitled", tabs },
      null,
      2
    );
  },
};
