param(
  [string]$Message = "Deploy updates",
  [switch]$SkipSupabase,
  [switch]$SkipGitPush
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repoRoot

function Import-DotEnv {
  param([string]$Path)
  if (!(Test-Path -LiteralPath $Path)) { return }

  foreach ($line in Get-Content -LiteralPath $Path) {
    if ($line -match '^\s*$' -or $line -match '^\s*#') { continue }
    if ($line -notmatch '^\s*([^=]+?)\s*=\s*(.*)\s*$') { continue }

    $name = $matches[1].Trim()
    $value = $matches[2].Trim()
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    [Environment]::SetEnvironmentVariable($name, $value, 'Process')
  }
}

function Invoke-Step {
  param(
    [string]$Name,
    [scriptblock]$Command
  )

  Write-Host "`n==> $Name" -ForegroundColor Cyan
  & $Command
  if ($LASTEXITCODE -ne 0) {
    throw "$Name failed with exit code $LASTEXITCODE"
  }
}

function Require-Command {
  param([string]$Name)
  if (!(Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Missing required command: $Name"
  }
}

Import-DotEnv -Path (Join-Path $repoRoot '.env')
Require-Command git

if (!$SkipSupabase) {
  Require-Command supabase

  $projectRef = $env:SUPABASE_PROJECT_ID
  if (!$projectRef -and (Test-Path -LiteralPath 'supabase/config.toml')) {
    $config = Get-Content -LiteralPath 'supabase/config.toml' -Raw
    if ($config -match 'project_id\s*=\s*"([^"]+)"') { $projectRef = $matches[1] }
  }
  if (!$projectRef) { throw 'SUPABASE_PROJECT_ID is missing from .env and supabase/config.toml.' }

  $linkedRefPath = Join-Path $repoRoot 'supabase/.temp/project-ref'
  $linkedRef = if (Test-Path -LiteralPath $linkedRefPath) { (Get-Content -LiteralPath $linkedRefPath -Raw).Trim() } else { '' }

  if ($linkedRef -eq $projectRef) {
    Write-Host "`n==> Supabase project already linked: $projectRef" -ForegroundColor Yellow
  } else {
    Invoke-Step "Link Supabase project $projectRef" { supabase link --project-ref $projectRef }
  }

  Invoke-Step 'Push Supabase migrations' { supabase db push --yes }
}

$branch = (& git branch --show-current).Trim()
if (!$branch) { throw 'Git is in detached HEAD state; checkout a branch before deploying.' }

Invoke-Step 'Stage Git changes' { git add -A }
$pending = (& git status --porcelain)
if ($pending) {
  Invoke-Step 'Commit Git changes' { git commit -m $Message }
} else {
  Write-Host "`n==> No Git changes to commit" -ForegroundColor Yellow
}

if (!$SkipGitPush) {
  Invoke-Step "Push branch $branch to origin" { git push origin $branch }
  Write-Host "`nCloudflare deploy should start from GitHub Actions after the push." -ForegroundColor Green
  Write-Host "Workflow: https://github.com/nixvdlim-gif/magic-launcher-guy/actions/workflows/deploy.yml" -ForegroundColor Green
}