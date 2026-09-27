<#
  run-forever.ps1 — runs OpenCode on Breakwater around the clock.

  What it does, every cycle:
    1. Picks a session mode (FEATURE, BUGFIX, POLISH, TEST, VISUAL, PERF, CODEHEALTH).
    2. Starts a fresh headless OpenCode session with that mode.
    3. Independently runs `npm run verify` after the session.
    4. If verify fails: gives the agent one REPAIR session, then verifies again.
    5. If it still fails: saves the broken work on a `failed/...` branch and rolls
       back to the last good commit, so the next cycle starts clean.
    6. Pushes good work. Every 12 good cycles it runs the slow suites and tags a checkpoint.

  Controls (create these empty files in the repo folder while it runs):
    STOP   -> finishes the current cycle, then exits cleanly.
    PAUSE  -> waits (checks every minute) until you delete it.

  Usage (from C:\dev\breakwater, in a normal PowerShell window):
    powershell -ExecutionPolicy Bypass -File run-forever.ps1
    powershell -ExecutionPolicy Bypass -File run-forever.ps1 -Model "opencode/longcat-2.5-preview-free"
#>

[CmdletBinding()]
param(
    [string]$Model = "",                  # blank = OpenCode's default model
    [int]$SessionTimeoutMinutes = 90,     # a session running longer than this gets killed
    [int]$RepairTimeoutMinutes = 45,
    [int]$MaxCycles = 0,                  # 0 = run forever
    [int]$MilestoneEvery = 12             # run slow suites + tag every N good cycles
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Continue'

# ---------------------------------------------------------------------------
# Paths and setup
# ---------------------------------------------------------------------------
$Repo = [System.IO.Path]::GetFullPath($PSScriptRoot)
Set-Location -LiteralPath $Repo

$LoopDir  = Join-Path $Repo '.loop'
$LogDir   = Join-Path $Repo 'logs'
$StateFile = Join-Path $LoopDir 'state.json'
New-Item -ItemType Directory -Force -Path $LoopDir, $LogDir | Out-Null

$RunStamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$MainLog  = Join-Path $LogDir "loop-$RunStamp.log"

function Log([string]$msg, [string]$color = 'Gray') {
    $line = "[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $msg
    Write-Host $line -ForegroundColor $color
    Add-Content -LiteralPath $MainLog -Value $line
}

# Keep the PC awake while this script runs (no system settings are changed).
Add-Type -Namespace Loop -Name Power -MemberDefinition @'
[System.Runtime.InteropServices.DllImport("kernel32.dll")]
public static extern uint SetThreadExecutionState(uint esFlags);
'@
[void][Loop.Power]::SetThreadExecutionState([uint32]2147483649)  # ES_CONTINUOUS | ES_SYSTEM_REQUIRED

# Sanity checks
foreach ($cmd in 'git', 'npm', 'opencode') {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        Log "ERROR: '$cmd' was not found on PATH." 'Red'
        exit 1
    }
}
if (-not (Test-Path (Join-Path $Repo 'package.json'))) {
    Log "ERROR: package.json not found. Put this script in the Breakwater repo root." 'Red'
    exit 1
}
if (-not (Test-Path (Join-Path $Repo 'AGENTS.md'))) {
    Log "ERROR: AGENTS.md not found in the repo root." 'Red'
    exit 1
}

# Make sure loop files, logs, and the owner's notes are never committed or stashed by a rollback.
$gitignore = Join-Path $Repo '.gitignore'
if (-not (Test-Path $gitignore)) { New-Item -ItemType File -Path $gitignore | Out-Null }
$ignoreLines = Get-Content $gitignore
$needed = @('.loop/', 'logs/', 'shots/', 'verify-shots/', 'STOP', 'PAUSE', 'docs/OWNER_NOTES.md', 'opencode.json')
$missing = $needed | Where-Object { $ignoreLines -notcontains $_ }
if ($missing) {
    Add-Content -LiteralPath $gitignore -Value $missing
    git add .gitignore | Out-Null
    git commit -m "chore: ignore loop, log, and owner-note files" | Out-Null
    Log "Added to .gitignore: $($missing -join ', ')"
}

# ---------------------------------------------------------------------------
# State
# ---------------------------------------------------------------------------
function Load-State {
    if (Test-Path $StateFile) {
        try { return Get-Content $StateFile -Raw | ConvertFrom-Json } catch { }
    }
    return [pscustomobject]@{
        cycle = 0; goodCycles = 0; consecutiveFailures = 0
        rotationIndex = 0; forcedMode = ''; forcedReason = ''
    }
}
function Save-State($s) { $s | ConvertTo-Json | Set-Content -LiteralPath $StateFile }

$State = Load-State

# 12-slot rotation: roughly 40% features, the rest testing and polish.
$Rotation = @(
    'FEATURE', 'FEATURE', 'BUGFIX', 'FEATURE', 'POLISH', 'TEST',
    'FEATURE', 'VISUAL', 'BUGFIX', 'FEATURE', 'POLISH', 'PERF',
    'FEATURE', 'TEST', 'CODEHEALTH', 'VISUAL'
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
function Get-Head { (git rev-parse HEAD 2>$null).Trim() }

function Has-NpmScript([string]$name) {
    $pkg = Get-Content (Join-Path $Repo 'package.json') -Raw | ConvertFrom-Json
    return ($pkg.scripts.PSObject.Properties.Name -contains $name)
}

function Run-Npm([string]$script, [string]$logPath, [int]$timeoutMinutes = 20) {
    # Returns $true on success. Runs through cmd so the exit code is reliable.
    $p = Start-Process -FilePath 'cmd.exe' `
        -ArgumentList '/c', "npm run $script > `"$logPath`" 2>&1" `
        -WorkingDirectory $Repo -NoNewWindow -PassThru
    $null = $p.Handle  # needed so ExitCode is available later
    if (-not $p.WaitForExit($timeoutMinutes * 60 * 1000)) {
        & taskkill /PID $p.Id /T /F | Out-Null
        Add-Content -LiteralPath $logPath -Value "`n[loop] TIMED OUT after $timeoutMinutes minutes"
        return $false
    }
    return ($p.ExitCode -eq 0)
}

function Tail([string]$path, [int]$lines = 60) {
    if (Test-Path $path) { return (Get-Content $path -Tail $lines) -join "`n" }
    return '(no log)'
}

function Owner-Notes-Open {
    $notes = Join-Path $Repo 'docs\OWNER_NOTES.md'
    if (-not (Test-Path $notes)) { return $false }
    return [bool](Select-String -LiteralPath $notes -Pattern '^\s*-\s*\[\s\]' -Quiet)
}

function Run-OpenCode([string]$prompt, [string]$logPath, [int]$timeoutMinutes) {
    # The full prompt goes in a file so Windows quoting can't mangle it.
    $promptFile = Join-Path $LoopDir 'current-prompt.md'
    Set-Content -LiteralPath $promptFile -Value $prompt -Encoding UTF8

    $short = 'Read AGENTS.md completely, then read .loop/current-prompt.md and follow it exactly. Work autonomously; never ask questions.'
    $modelArg = ''
    if ($Model) { $modelArg = "--model `"$Model`" " }
    $cmdLine = "opencode run $modelArg`"$short`" > `"$logPath`" 2>&1"

    $start = Get-Date
    $p = Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', $cmdLine `
        -WorkingDirectory $Repo -NoNewWindow -PassThru
    $null = $p.Handle  # needed so ExitCode is available later
    $finished =$p.WaitForExit($timeoutMinutes * 60 * 1000)
    if (-not $finished) {
        Log "Session hit the $timeoutMinutes-minute timeout; killing it." 'Yellow'
        & taskkill /PID $p.Id /T /F | Out-Null
        Add-Content -LiteralPath $logPath -Value "`n[loop] KILLED after $timeoutMinutes minutes"
    }
    $elapsed = [int]((Get-Date) - $start).TotalSeconds
    return [pscustomobject]@{ Finished = $finished; ExitCode = $(if ($finished) { $p.ExitCode } else { -1 }); Seconds = $elapsed }
}

function Rollback([string]$startHead, [int]$cycle, [string]$mode) {
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $branch = "failed/cycle-$cycle-$mode-$stamp".ToLower()

    # Keep uncommitted work in a stash, and committed work on a branch. Nothing is lost.
    $dirty = git status --porcelain
    if ($dirty) { git stash push -u -m "loop: failed cycle $cycle ($mode)" | Out-Null }
    if ((Get-Head) -ne $startHead) {
        git branch $branch HEAD | Out-Null
        git reset --hard $startHead | Out-Null
        Log "Rolled back to $startHead. Failed commits saved on branch '$branch'." 'Yellow'
    } else {
        Log "Rolled back uncommitted changes (saved in git stash)." 'Yellow'
    }

    # Record it so the next agent knows what didn't work.
    $failLog = Join-Path $Repo 'docs\LOOP_FAILURES.md'
    if (-not (Test-Path $failLog)) {
        Set-Content -LiteralPath $failLog -Value "# Loop failures`n`nSessions whose work was rolled back because npm run verify failed. Read before retrying the same task.`n"
    }
    Add-Content -LiteralPath $failLog -Value "- $(Get-Date -Format 'yyyy-MM-dd HH:mm') cycle $cycle ($mode): verify failed after repair. Work saved on branch ``$branch`` / git stash. See logs/."
    git add docs/LOOP_FAILURES.md | Out-Null
    git commit -m "chore: log rolled-back loop cycle $cycle" | Out-Null
}

# ---------------------------------------------------------------------------
# Prompts
# ---------------------------------------------------------------------------
function Build-Prompt([string]$mode, [string]$extra) {
@"
# Loop session — mode: $mode

You are one session in an unattended 24/7 loop. After you exit, a script runs ``npm run verify`` on its own.
If verify fails and can't be repaired, ALL of your work is rolled back. Small, finished, tested work survives.

## Your mode: $mode
Do only $mode work, as defined in AGENTS.md section 4.

## Do this, in order
1. Follow AGENTS.md section 2 (Session workflow) step by step.
2. Also read docs/LOOP_FAILURES.md if it exists. Don't repeat an approach that already failed.
3. Read docs/OWNER_NOTES.md if it exists. Unchecked items there are P1.
4. Pick ONE task for mode $mode from docs/TASKS.md (create tasks if none exist).
5. Implement it with small verified steps. Add or update a test that proves it.
6. Run ``npm run verify``. It must pass in under 180 seconds.
7. Self-review ``git diff`` (AGENTS.md section 2, step 6).
8. Commit, update docs/TASKS.md and docs/PROGRESS.md, commit again, ``git push origin HEAD``.
9. Exit. Do not start a second task.

$extra
"@
}

function Build-RepairPrompt([string]$mode, [string]$verifyTail) {
@"
# Loop session — mode: REPAIR (after a $mode session)

The previous session's work made ``npm run verify`` FAIL. You have ONE chance to fix it.
If verify still fails after you exit, all of that work gets rolled back.

## Last lines of the verify output
``````
$verifyTail
``````

## Do this
1. Read AGENTS.md sections 1, 6, and 10.
2. Run ``git log --oneline -10`` and ``git diff HEAD~3 --stat`` to see what the last session changed.
3. Reproduce the failure with ``npm run verify`` (or the specific failing test).
4. Fix the root cause. Do NOT weaken, skip, or delete tests.
5. If the fix isn't clear within 3 attempts, revert the last session's commits with ``git revert --no-edit <hash>`` (newest first) until verify passes.
6. Run ``npm run verify`` until it passes, commit, ``git push origin HEAD``, and log what happened in docs/PROGRESS.md.
7. Exit.
"@
}

# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------
Log "Breakwater loop starting in $Repo (model: $(if ($Model) { $Model } else { 'default' }))." 'Cyan'
Log "Create a file named STOP to exit after this cycle, or PAUSE to hold." 'Cyan'

while ($true) {
    if (Test-Path (Join-Path $Repo 'STOP')) {
        Log 'STOP file found. Exiting.' 'Cyan'
        Remove-Item (Join-Path $Repo 'STOP') -Force
        break
    }
    while (Test-Path (Join-Path $Repo 'PAUSE')) {
        Log 'PAUSE file present; waiting 60 s.' 'DarkGray'
        Start-Sleep -Seconds 60
    }
    if ($MaxCycles -gt 0 -and $State.cycle -ge $MaxCycles) {
        Log "Reached MaxCycles ($MaxCycles). Exiting." 'Cyan'
        break
    }

    # ---- pick the mode ----
    $State.cycle++
    $cycle = $State.cycle
    $extra = ''
    if ($State.forcedMode) {
        $mode = $State.forcedMode
        $extra = "## Why this mode`n$($State.forcedReason)"
        $State.forcedMode = ''; $State.forcedReason = ''
    } elseif (Owner-Notes-Open) {
        $mode = 'BUGFIX'
        $extra = "## Owner notes are open`nThe owner left unchecked items in docs/OWNER_NOTES.md. Handle the top one, then check it off there with the commit hash."
    } else {
        $mode = $Rotation[$State.rotationIndex % $Rotation.Count]
        $State.rotationIndex++
    }
    Save-State $State

    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $sessionLog = Join-Path $LogDir "cycle-$cycle-$mode-$stamp.log"
    $verifyLog  = Join-Path $LogDir "cycle-$cycle-verify-$stamp.log"
    $startHead  = Get-Head
    if (git status --porcelain) { Log 'Warning: working tree was not clean at cycle start.' 'Yellow' }

    Log "=== Cycle $cycle | mode $mode | start $($startHead.Substring(0,7)) ===" 'White'

    # ---- run the session ----
    $r = Run-OpenCode (Build-Prompt $mode $extra) $sessionLog $SessionTimeoutMinutes
    Log "Session ended after $($r.Seconds) s (exit $($r.ExitCode))."

    # A session that dies almost instantly is usually the model/provider being down or rate limited.
    if ($r.Seconds -lt 45 -and (Get-Head) -eq $startHead -and -not (git status --porcelain)) {
        $State.consecutiveFailures++
        Save-State $State
        $wait = [Math]::Min(60, 5 * $State.consecutiveFailures)
        Log "Session did nothing (provider down or rate limited?). Waiting $wait min." 'Yellow'
        Start-Sleep -Seconds ($wait * 60)
        continue
    }

    # ---- independent verification ----
    $ok = Run-Npm 'verify' $verifyLog
    if (-not $ok) {
        Log 'Verify FAILED. Starting a repair session.' 'Yellow'
        $repairLog = Join-Path $LogDir "cycle-$cycle-repair-$stamp.log"
        $null = Run-OpenCode (Build-RepairPrompt $mode (Tail $verifyLog 80)) $repairLog $RepairTimeoutMinutes
        $verifyLog2 = Join-Path $LogDir "cycle-$cycle-verify2-$stamp.log"
        $ok = Run-Npm 'verify' $verifyLog2
    }

    if ($ok) {
        # Commit anything the agent forgot to commit, then push.
        if (git status --porcelain) {
            git add -A | Out-Null
            git commit -m "chore: loop auto-commit of leftover changes (cycle $cycle, $mode)" | Out-Null
        }
        git push origin HEAD 2>&1 | Out-Null
        $State.goodCycles++
        $State.consecutiveFailures = 0
        Log "Cycle $cycle PASSED. Good cycles: $($State.goodCycles)." 'Green'

        # ---- milestone checks ----
        if ($State.goodCycles % $MilestoneEvery -eq 0) {
            Log 'Milestone check: running slow suites.' 'Cyan'
            $problems = @()
            foreach ($s in 'verify:full', 'shots', 'perf') {
                if (Has-NpmScript $s) {
                    $mlog = Join-Path $LogDir "milestone-$($State.goodCycles)-$($s -replace ':','-')-$stamp.log"
                    if (-not (Run-Npm $s $mlog 60)) { $problems += "$s (log: logs/$(Split-Path $mlog -Leaf))" }
                } else {
                    $problems += "$s does not exist yet (create it)"
                }
            }
            if ($problems.Count -gt 0) {
                $State.forcedMode = 'TEST'
                $State.forcedReason = "The milestone check found problems. Fix the first one:`n- " + ($problems -join "`n- ")
                Log "Milestone problems: $($problems -join '; ')" 'Yellow'
            } else {
                $tag = "checkpoint-$(Get-Date -Format 'yyyyMMdd-HHmm')"
                git tag $tag | Out-Null
                git push origin $tag 2>&1 | Out-Null
                Log "All slow suites passed. Tagged $tag." 'Green'
            }
        }
    } else {
        Log "Cycle $cycle FAILED after repair. Rolling back." 'Red'
        Rollback $startHead $cycle $mode
        git push origin HEAD 2>&1 | Out-Null
        $State.consecutiveFailures++
        if ($State.consecutiveFailures -ge 3) {
            $State.forcedMode = 'BUGFIX'
            $State.forcedReason = "The last $($State.consecutiveFailures) cycles were rolled back. Read docs/LOOP_FAILURES.md. Before anything else, make sure npm run verify passes on a clean checkout, and pick a much smaller task than the ones that failed."
        }
        if ($State.consecutiveFailures -ge 6) {
            Log 'Six failures in a row. Cooling down for 60 minutes.' 'Red'
            Save-State $State
            Start-Sleep -Seconds 3600
        }
    }

    Save-State $State
    Start-Sleep -Seconds 20
}

[void][Loop.Power]::SetThreadExecutionState([uint32]2147483648)  # let the PC sleep again
Log 'Loop finished.' 'Cyan'
