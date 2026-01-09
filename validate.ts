#!/usr/bin/env -S bun run
import { readFileSync } from 'fs';
import { execSync } from 'child_process';

interface Package {
  name: string;
  executable: string;
  path: string;
  is_mcp: boolean;
  autoupdate: boolean;
  validate?: boolean; // Optional field for validation
}

function runCommand(command: string): boolean {
  try {
    console.log(`Running: ${command}`);
    execSync(command, { stdio: 'inherit' });
    console.log('✓ Success\n');
    return true;
  } catch {
    console.error('✗ Failed\n');
    return false;
  }
}

function main() {
  const packagesJson = readFileSync('./packages.json', 'utf-8');
  const packages: Package[] = JSON.parse(packagesJson);
  
  console.log('Validating all packages...\n');
  
  let allPassed = true;
  
  for (const pkg of packages) {
    if (pkg.validate === false) {
      console.log(`Skipping validation for ${pkg.name}`);
      continue;
    }
    const command = `nix run .#${pkg.executable} -- --version`;
    
    const success = runCommand(command);
    if (!success) {
      allPassed = false;
    }
  }
  
  if (allPassed) {
    console.log('🎉 All packages validated successfully!');
    process.exit(0);
  } else {
    console.log('❌ Some packages failed validation');
    process.exit(1);
  }
}

main();