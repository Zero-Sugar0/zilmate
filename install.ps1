param(
  [ValidateSet("github", "npm")]
  [string]$Source = "github",
  [string]$GitHubPackage = "github:zester4/zilo-manager",
  [string]$NpmPackage = "@zilo/zilmate"
)

$ErrorActionPreference = "Stop"

function Require-Command($Name, $InstallHint) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Name is required. $InstallHint"
  }
}

Require-Command "node" "Install Node.js LTS from https://nodejs.org/."
Require-Command "npm" "Install Node.js LTS from https://nodejs.org/."

$target = if ($Source -eq "npm") { $NpmPackage } else { $GitHubPackage }
Write-Host "Installing ZilMate from $target ..." -ForegroundColor Cyan
npm install -g $target

Write-Host "`nZilMate installed. Checking command..." -ForegroundColor Green
zilmate --help