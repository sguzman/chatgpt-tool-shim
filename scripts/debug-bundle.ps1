param(
    [string]$OutputDir = "debug-bundles",
    [string]$BrokerUrl = "http://127.0.0.1:3210"
)

$ErrorActionPreference = "Continue"
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$bundleName = "chatgpt-tool-shim-debug-$timestamp"
$root = (Get-Location).Path
$work = Join-Path $env:TEMP $bundleName
$zipDir = Join-Path $root $OutputDir
$zipPath = Join-Path $zipDir "$bundleName.zip"

if (Test-Path $work) { Remove-Item -Recurse -Force $work }
New-Item -ItemType Directory -Force -Path $work | Out-Null
New-Item -ItemType Directory -Force -Path $zipDir | Out-Null

$dirs = @("git", "runtime", "checks", "broker", "project", "debug-input")
foreach ($dir in $dirs) {
    New-Item -ItemType Directory -Force -Path (Join-Path $work $dir) | Out-Null
}

function Capture-Command {
    param(
        [string]$File,
        [scriptblock]$Command
    )
    $target = Join-Path $work $File
    try {
        & $Command *>&1 | Out-String | Set-Content -Encoding UTF8 $target
        return $LASTEXITCODE
    } catch {
        $_ | Out-String | Set-Content -Encoding UTF8 $target
        return 999
    }
}

$branchExit = Capture-Command "git/branch.txt" { git branch --show-current }
$statusExit = Capture-Command "git/status.txt" { git status --short --branch }
$logExit = Capture-Command "git/recent-commits.txt" { git log -n 20 --date=iso --pretty=format:"%h %ad %s" }
$filesExit = Capture-Command "git/tracked-files.txt" { git ls-files }

$versions = @()
$versions += "PowerShell: $($PSVersionTable.PSVersion)"
try { $versions += "Node: $(node --version 2>&1)" } catch { $versions += "Node: unavailable" }
try { $versions += "npm: $(npm --version 2>&1)" } catch { $versions += "npm: unavailable" }
$versions | Set-Content -Encoding UTF8 (Join-Path $work "runtime/versions.txt")

try {
    Get-CimInstance Win32_OperatingSystem |
        Select-Object Caption, Version, BuildNumber, OSArchitecture |
        Format-List | Out-String |
        Set-Content -Encoding UTF8 (Join-Path $work "runtime/os.txt")
} catch {
    $_ | Out-String | Set-Content -Encoding UTF8 (Join-Path $work "runtime/os.txt")
}

$testExit = Capture-Command "checks/npm-test.txt" { npm test }
$buildExit = Capture-Command "checks/npm-build.txt" { npm run build }

$healthTarget = Join-Path $work "broker/health.txt"
try {
    $healthUrl = $BrokerUrl.TrimEnd('/') + "/health"
    $response = Invoke-WebRequest -UseBasicParsing -TimeoutSec 3 -Uri $healthUrl
    @(
        "URL: $healthUrl",
        "Status: $($response.StatusCode)",
        "Body:",
        $response.Content
    ) | Set-Content -Encoding UTF8 $healthTarget
} catch {
    @(
        "URL: $($BrokerUrl.TrimEnd('/') + '/health')",
        "Broker health request failed:",
        ($_ | Out-String)
    ) | Set-Content -Encoding UTF8 $healthTarget
}

$projectFiles = @("manifest.json", "package.json", "tsconfig.json", "vite.config.ts")
foreach ($file in $projectFiles) {
    $source = Join-Path $root $file
    if (Test-Path $source) {
        Copy-Item $source (Join-Path $work "project")
    }
}

$debugInput = Join-Path $root "debug-input"
if (Test-Path $debugInput) {
    Get-ChildItem -Force $debugInput | ForEach-Object {
        Copy-Item -Recurse -Force $_.FullName (Join-Path $work "debug-input")
    }
}

$manifest = [ordered]@{
    protocol = "chatgpt-tool-shim-debug/1"
    generated_at = (Get-Date).ToUniversalTime().ToString("o")
    bundle = $bundleName
    broker_url = $BrokerUrl
    checks = [ordered]@{
        git_branch_exit = $branchExit
        git_status_exit = $statusExit
        git_log_exit = $logExit
        git_files_exit = $filesExit
        npm_test_exit = $testExit
        npm_build_exit = $buildExit
    }
    privacy = [ordered]@{
        arbitrary_user_files_collected = $false
        environment_variables_collected = $false
        browser_profile_collected = $false
        debug_input_is_user_supplied = $true
    }
}
$manifest | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 (Join-Path $work "bundle-manifest.json")

@"
ChatGPT Tool Shim debug bundle

This bundle contains project revision/build/test information, a broker health probe,
and any files that were explicitly placed in ./debug-input.

It does NOT intentionally collect browser profiles, environment variables, credentials,
or arbitrary user files.

Before sharing, inspect the archive if the failure involved sensitive data.
"@ | Set-Content -Encoding UTF8 (Join-Path $work "README.txt")

if (Test-Path $zipPath) { Remove-Item -Force $zipPath }
Compress-Archive -Path (Join-Path $work "*") -DestinationPath $zipPath -CompressionLevel Optimal
Remove-Item -Recurse -Force $work

Write-Host "Debug bundle created: $zipPath"
Write-Host "npm test exit: $testExit"
Write-Host "npm build exit: $buildExit"
