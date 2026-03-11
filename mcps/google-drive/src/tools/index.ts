import type { McpServer } from "../mcp";
// Drive tools
import { listFiles } from "./listFiles";
import { searchFiles } from "./searchFiles";
import { getFileInfo } from "./getFileInfo";
import { readFile } from "./readFile";
import { createFolder } from "./createFolder";
import { listFolderContents } from "./listFolderContents";
import { getFolderInfo } from "./getFolderInfo";
import { moveFile } from "./moveFile";
import { copyFileTool } from "./copyFile";
import { renameFile } from "./renameFile";
import { deleteFileTool } from "./deleteFile";
import { shareFile } from "./shareFile";
import { createDocument } from "./createDocument";
import { createFromTemplate } from "./createFromTemplate";
// Docs tools
import { readDoc } from "./readDoc";
import { insertText } from "./insertText";
import { appendText } from "./appendText";
import { deleteRange } from "./deleteRange";
import { replaceText } from "./replaceText";
import { listDocTabs } from "./listDocTabs";
import { convertToDoc } from "./convertToDoc";

export function registerAllTools(server: McpServer) {
  // Drive
  server.addTool(listFiles);
  server.addTool(searchFiles);
  server.addTool(getFileInfo);
  server.addTool(readFile);
  server.addTool(createFolder);
  server.addTool(listFolderContents);
  server.addTool(getFolderInfo);
  server.addTool(moveFile);
  server.addTool(copyFileTool);
  server.addTool(renameFile);
  server.addTool(deleteFileTool);
  server.addTool(shareFile);
  server.addTool(createDocument);
  server.addTool(createFromTemplate);
  // Docs
  server.addTool(readDoc);
  server.addTool(insertText);
  server.addTool(appendText);
  server.addTool(deleteRange);
  server.addTool(replaceText);
  server.addTool(listDocTabs);
  server.addTool(convertToDoc);
}
