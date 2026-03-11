import * as z from "zod/v4";
import { logger } from "./logger";

export interface Tool {
  name: string;
  description: string;
  parameters: z.ZodType;
  execute: (args: any) => Promise<string>;
}

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number;
  method: string;
  params?: any;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: any;
  error?: { code: number; message: string };
}

export class McpServer {
  tools = new Map<string, Tool>();
  private name: string;
  private version: string;

  constructor(opts: { name: string; version: string }) {
    this.name = opts.name;
    this.version = opts.version;
  }

  addTool(tool: Tool) {
    this.tools.set(tool.name, tool);
  }

  private send(msg: JsonRpcResponse) {
    process.stdout.write(JSON.stringify(msg) + "\n");
  }

  private handleInitialize(id: string | number) {
    this.send({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2025-11-25",
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: this.name, version: this.version },
      },
    });
  }

  private handleToolsList(id: string | number) {
    const tools = Array.from(this.tools.values()).map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: z.toJSONSchema(t.parameters, { target: "draft-07" }),
    }));
    this.send({ jsonrpc: "2.0", id, result: { tools } });
  }

  private async handleToolsCall(id: string | number, params: any) {
    const toolName = params?.name;
    const args = params?.arguments ?? {};

    const tool = this.tools.get(toolName);
    if (!tool) {
      this.send({
        jsonrpc: "2.0",
        id,
        error: { code: -32602, message: `Unknown tool: ${toolName}` },
      });
      return;
    }

    try {
      const parsed = tool.parameters.parse(args);
      const result = await tool.execute(parsed);
      this.send({
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: result }],
          isError: false,
        },
      });
    } catch (err: any) {
      const message = err?.message ?? String(err);
      this.send({
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: message }],
          isError: true,
        },
      });
    }
  }

  private async dispatch(msg: JsonRpcRequest) {
    const { id, method, params } = msg;

    // Notifications (no id) - don't respond
    if (id === undefined) return;

    switch (method) {
      case "initialize":
        return this.handleInitialize(id);
      case "ping":
        return this.send({ jsonrpc: "2.0", id, result: {} });
      case "tools/list":
        return this.handleToolsList(id);
      case "tools/call":
        return this.handleToolsCall(id, params);
      default:
        return this.send({
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: `Method not found: ${method}` },
        });
    }
  }

  async start() {
    logger.info(`${this.name} v${this.version} starting on stdio...`);

    const decoder = new TextDecoder();
    let buffer = "";

    for await (const chunk of Bun.stdin.stream()) {
      buffer += decoder.decode(chunk, { stream: true });

      let newlineIdx: number;
      while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newlineIdx).trim();
        buffer = buffer.slice(newlineIdx + 1);
        if (!line) continue;

        try {
          const msg = JSON.parse(line) as JsonRpcRequest;
          await this.dispatch(msg);
        } catch (err) {
          logger.error("Failed to parse message:", err);
        }
      }
    }
  }
}
