# Evidence Collection Scripts

This directory contains PowerShell scripts for collecting comprehensive evidence from the Hunters-Run repository for auditing, analysis, or documentation purposes.

## Available Scripts

### 1. `collect-evidence.ps1` - Comprehensive Collection
Full-featured evidence collection with detailed categorization and options.

**Features:**
- 10 categorized collection areas
- Configurable exclusions
- Security scanning
- Detailed metadata and logging
- Optional inclusion of node_modules and git history

**Usage:**
```powershell
# Basic collection (excludes node_modules and git history)
.\scripts\collect-evidence.ps1

# Include everything
.\scripts\collect-evidence.ps1 -IncludeNodeModules -IncludeGitHistory

# Verbose output
.\scripts\collect-evidence.ps1 -Verbose

# Custom output name
.\scripts\collect-evidence.ps1 -OutputName "audit_2024"
```

**Categories Collected:**
1. **Project Structure** - File inventory, directory tree, statistics
2. **Source Code** - TypeScript, JavaScript, API code
3. **Configuration** - Package files, environment vars (redacted), build configs
4. **Infrastructure** - Docker, CI/CD, database schemas
5. **Documentation** - All markdown files, API specs
6. **Scripts** - Utility and deployment scripts
7. **Tests** - Test files and configurations
8. **Git Information** - Status, history, branches, contributors
9. **Security Scan** - Pattern-based secret detection
10. **Metadata** - Collection manifest, system info

### 2. `collect-evidence-fast.ps1` - Quick Collection
Optimized for speed, collecting essential artifacts quickly.

**Features:**
- Streamlined collection process
- Progress indicators
- Automatic exclusion of heavy directories
- Minimal output with key artifacts

**Usage:**
```powershell
# Quick collection
.\scripts\collect-evidence-fast.ps1

# Custom name
.\scripts\collect-evidence-fast.ps1 -OutputName "quick_audit"
```

## Output

Both scripts create a ZIP archive on your Desktop containing:
- Organized directory structure
- Redacted environment files (secrets removed)
- File inventories and metadata
- Collection manifest with timestamps

## Security Considerations

1. **Environment Variables**: All `.env` files are automatically redacted
   - Values are replaced with `***REDACTED***`
   - Keys are preserved for reference

2. **Secrets Scanning**: The comprehensive script scans for patterns like:
   - API keys
   - Passwords
   - Tokens
   - Private keys
   - Cloud credentials

3. **Exclusions**: By default excludes:
   - `node_modules/` - Dependencies
   - `.git/` - Git history (unless requested)
   - `dist/`, `build/` - Build artifacts
   - `.cache/`, `tmp/` - Temporary files

## Requirements

- PowerShell 5.1 or higher
- Git (for repository information)
- Windows OS (scripts use Windows-specific paths)

## File Structure of Output

```
evidence_archive.zip
├── 00_metadata/        # Collection information
├── 01_structure/       # Project structure
├── 02_source/          # Source code
├── 03_configuration/   # Config files
├── 04_infrastructure/  # Deploy configs
├── 05_documentation/   # Docs
├── 06_scripts/         # Scripts
├── 07_tests/          # Test files
├── 08_git/            # Git info
└── 09_security/       # Security scan
```

## Use Cases

1. **Security Audit**: Use comprehensive script with security scanning
2. **Quick Review**: Use fast script for rapid collection
3. **Full Backup**: Use comprehensive with `-IncludeNodeModules -IncludeGitHistory`
4. **Documentation**: Collect structure and docs only
5. **Compliance**: Generate evidence for regulatory requirements

## Troubleshooting

- **Access Denied**: Run PowerShell as Administrator
- **Script Blocked**: Use `-ExecutionPolicy Bypass` flag
- **Large Archives**: Exclude node_modules to reduce size
- **Timeout**: Use fast script for quicker collection

## Privacy Note

These scripts are designed to:
- Never expose actual secrets or credentials
- Redact sensitive environment variables
- Exclude unnecessary binary files
- Provide clear visibility into what's collected

Always review the generated archive before sharing to ensure no sensitive data is included.