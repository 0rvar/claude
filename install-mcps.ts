#!/usr/bin/env -S bun run
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { homedir } from 'os';
import { join } from 'path';

interface Package {
  name: string;
  executable: string;
  path: string;
  is_mcp: boolean;
  autoupdate: boolean;
}

interface ClaudeDesktopConfig {
  mcpServers: Record<string, {
    command: string;
    args?: string[];
    env?: Record<string, string>;
  }>;
}

function getClaudeDesktopConfigPath(): string {
  const platform = process.platform;
  if (platform === 'darwin') {
    return join(homedir(), 'Library/Application Support/Claude/claude_desktop_config.json');
  } else if (platform === 'win32') {
    return join(process.env.APPDATA || '', 'Claude/claude_desktop_config.json');
  } else {
    throw new Error('Claude Desktop is only supported on macOS and Windows');
  }
}

function installToClaudeDesktop(mcpPackages: Package[]) {
  const configPath = getClaudeDesktopConfigPath();
  
  let config: ClaudeDesktopConfig = { mcpServers: {} };
  
  if (existsSync(configPath)) {
    const configData = readFileSync(configPath, 'utf-8');
    config = JSON.parse(configData);
  }
  
  console.log('Installing MCP packages to Claude Desktop...');
  
  const nixProfilePath = join(homedir(), '.nix-profile/bin');
  
  for (const pkg of mcpPackages) {
    console.log(`Adding ${pkg.name} to Claude Desktop config...`);
    config.mcpServers[pkg.name] = {
      command: pkg.executable,
      env: {
        PATH: nixProfilePath
      }
    };
  }
  
  try {
    writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    console.log(`✓ Claude Desktop config updated at ${configPath}`);
    console.log('Please restart Claude Desktop for changes to take effect.');
  } catch (error) {
    console.error('✗ Failed to write Claude Desktop config:', error);
  }
}

function installToClaudeCode(mcpPackages: Package[]) {
  console.log('Installing MCP packages to Claude Code...');
  
  for (const pkg of mcpPackages) {
    console.log(`Installing ${pkg.name}...`);
    try {
      execSync(`claude mcp add --scope user ${pkg.name} ${pkg.executable}`, { stdio: 'inherit' });
      console.log(`✓ ${pkg.name} installed successfully`);
    } catch (error) {
      console.error(`✗ Failed to install ${pkg.name}:`, error);
    }
  }
  
  console.log('\nListing installed MCPs:');
  try {
    execSync('claude mcp list', { stdio: 'inherit' });
  } catch (error) {
    console.error('Failed to list MCPs:', error);
  }
}

function main() {
  const packagesJson = readFileSync('./packages.json', 'utf-8');
  const packages: Package[] = JSON.parse(packagesJson);
  
  const mcpPackages = packages.filter(pkg => pkg.is_mcp);
  
  installToClaudeCode(mcpPackages);
  installToClaudeDesktop(mcpPackages);
}

main();