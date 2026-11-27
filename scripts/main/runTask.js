import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '../..')
const logsDir = path.join(projectRoot, 'logs')
const logFile = path.join(logsDir, 'task.log')
const markerFile = path.join(logsDir, 'last-completed.txt')
const MAX_LOG_BYTES = 5 * 1024 * 1024

function localDateString(date = new Date()) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

function appendLog(line) {
    fs.mkdirSync(logsDir, { recursive: true })
    try {
        const stat = fs.statSync(logFile)
        if (stat.size > MAX_LOG_BYTES) {
            fs.truncateSync(logFile, 0)
        }
    } catch {
        // Log file may not exist yet
    }
    fs.appendFileSync(logFile, line, 'utf-8')
}

const today = localDateString()
try {
    const lastCompleted = fs.readFileSync(markerFile, 'utf-8').trim()
    if (lastCompleted === today) {
        appendLog(`[${new Date().toISOString()}] [TASK] Already completed today (${today}), skipping.\n`)
        process.exit(0)
    }
} catch {
    // No marker file yet; proceed with run
}

appendLog(`[${new Date().toISOString()}] [TASK] Starting scheduled run for ${today}...\n`)

const logStream = fs.createWriteStream(logFile, { flags: 'a' })
const child = spawn(process.execPath, [path.join(projectRoot, 'dist', 'index.js')], {
    cwd: projectRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
})

child.stdout.pipe(logStream, { end: false })
child.stderr.pipe(logStream, { end: false })

child.on('error', err => {
    appendLog(`[${new Date().toISOString()}] [TASK] Failed to spawn: ${err.message}\n`)
    logStream.end(() => process.exit(1))
})

child.on('close', code => {
    logStream.write(`[${new Date().toISOString()}] [TASK] Run exited with code ${code ?? 0}.\n`, () => {
        logStream.end(() => process.exit(code ?? 0))
    })
})
