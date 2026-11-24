import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '../..')
const action = process.argv[2] || 'status'
const taskName = 'Microsoft-Rewards-Script'

function runPs(cmd) {
    try {
        return execSync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${cmd}"`, {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe']
        }).trim()
    } catch (err) {
        return err.stdout?.trim() || err.stderr?.trim() || err.message
    }
}

if (action === 'install') {
    const time = process.argv[3] || '03:00'
    const scriptPath = path.join(projectRoot, 'dist', 'index.js').replace(/'/g, "''")
    const dirPath = projectRoot.replace(/'/g, "''")
    const psCmd = [
        `$act = New-ScheduledTaskAction -Execute 'node.exe' -Argument '${scriptPath}' -WorkingDirectory '${dirPath}'`,
        `$t1 = New-ScheduledTaskTrigger -Daily -At '${time}'`,
        `$t2 = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME`,
        `$set = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 2)`,
        `Register-ScheduledTask -TaskName '${taskName}' -Action $act -Trigger @($t1, $t2) -Settings $set -Description 'Microsoft Rewards Daily Automation' -Force`
    ].join('; ')
    const out = runPs(psCmd)
    console.log(`Task '${taskName}' installed. Daily trigger: ${time} + At Logon.`)
    if (out) console.log(out)
} else if (action === 'uninstall') {
    const out = runPs(`Unregister-ScheduledTask -TaskName '${taskName}' -Confirm:$false -ErrorAction SilentlyContinue`)
    console.log(`Task '${taskName}' uninstalled.`)
    if (out) console.log(out)
} else if (action === 'status') {
    const psCmd = [
        `$t = Get-ScheduledTask -TaskName '${taskName}' -ErrorAction SilentlyContinue`,
        `if (-not $t) { Write-Output 'Task not installed.' } else {`,
        `$i = Get-ScheduledTaskInfo -TaskName '${taskName}' -ErrorAction SilentlyContinue`,
        `Write-Output ('TaskName: ' + $t.TaskName)`,
        `Write-Output ('State:    ' + $t.State)`,
        `Write-Output ('NextRun:  ' + $i.NextRunTime)`,
        `Write-Output ('LastRun:  ' + $i.LastRunTime)`,
        `Write-Output ('Result:   ' + $i.LastTaskResult) }`
    ].join('; ')
    const out = runPs(psCmd)
    console.log(out)
} else {
    console.log(`Usage: node ./scripts/main/windowsTask.js [install [HH:mm] | uninstall | status]`)
}
