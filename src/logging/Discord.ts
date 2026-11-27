import type { HttpRequestConfig } from '../network/HttpClient'
import type { LogLevel } from './Logger'
import { createNotificationQueue, enqueueNotification, flushQueue } from './Queue'
import { resolveLogColor, resolveLogAccent, type LogColor } from './LogStyle'

const DISCORD_LIMIT = 2000

const discordQueue = createNotificationQueue()

function truncate(text: string) {
    return text.length <= DISCORD_LIMIT ? text : text.slice(0, DISCORD_LIMIT - 14) + ' ...(truncated)'
}

interface DiscordEmbedField {
    name: string
    value: string
    inline?: boolean
}

interface DiscordEmbed {
    title?: string
    description?: string
    color?: number
    timestamp?: string
    fields?: DiscordEmbedField[]
}

function formatDiscordEmbed(rawContent: string, level: LogLevel, color?: LogColor): DiscordEmbed {
    const accentColor = resolveLogAccent(resolveLogColor(level, undefined, color))
    const nowIso = new Date().toISOString()

    const match = rawContent.match(
        /^\[([^\]]+)\]\s+\[([^\]]+)\]\s+\[([^\]]+)\]\s+(?:(MAIN|DESKTOP|MOBILE)\s+)?\[([^\]]+)\]\s*(.*)$/s
    )

    if (!match) {
        return {
            description: truncate(rawContent),
            color: accentColor,
            timestamp: nowIso
        }
    }

    const user = match[2]
    const platform = match[4]
    const cleanTag = (match[5] ?? 'LOG').trim()
    const msg = (match[6] ?? '').trim()
    const account = user && user !== 'MAIN' ? user : undefined

    let title: string
    switch (cleanTag) {
        case 'RUN-START':
            title = 'Rewards Automation Started'
            break
        case 'RUN-END':
            title = 'Rewards Automation Finished'
            break
        case 'ACCOUNT-START':
            title = 'Account Started'
            break
        case 'ACCOUNT-END':
            title = 'Account Finished'
            break
        case 'SEARCH-BING':
            title = 'Bing Search'
            break
        case 'POINTS':
            title = 'Points Overview'
            break
        case 'LOGIN':
            title = 'Login Status'
            break
        case 'DAILY-CHECK-IN':
            title = 'Daily Check-In'
            break
        default:
            title = cleanTag.replace(/[-_]/g, ' ')
            break
    }

    const fields: DiscordEmbedField[] = []
    if (account) {
        fields.push({ name: 'Account', value: `\`${account}\``, inline: true })
    }
    if (platform && platform !== 'MAIN') {
        fields.push({ name: 'Platform', value: platform, inline: true })
    }

    if (msg.includes('|')) {
        const parts = msg.split('|').map(p => p.trim()).filter(Boolean)
        const summaryText = parts[0]
        const kvParts = parts.slice(1)

        for (const kv of kvParts) {
            const eqIndex = kv.indexOf('=')
            if (eqIndex > 0) {
                const k = kv.slice(0, eqIndex).trim()
                const v = kv.slice(eqIndex + 1).trim()
                if (k && v) {
                    const isAccounts = k === 'accounts'
                    const displayValue = isAccounts ? v.replace(/;\s+/g, '\n') : v
                    fields.push({ name: k, value: truncate(displayValue), inline: !isAccounts })
                }
            } else {
                fields.push({ name: 'Detail', value: truncate(kv), inline: true })
            }
        }

        return {
            title,
            description: summaryText ? truncate(summaryText) : undefined,
            color: accentColor,
            fields: fields.slice(0, 25),
            timestamp: nowIso
        }
    }

    return {
        title,
        description: truncate(msg),
        color: accentColor,
        fields: fields.length ? fields.slice(0, 25) : undefined,
        timestamp: nowIso
    }
}

export async function sendDiscord(
    discordUrl: string,
    content: string,
    level: LogLevel,
    color?: LogColor
): Promise<void> {
    if (!discordUrl) return

    const embed = formatDiscordEmbed(content, level, color)

    const request: HttpRequestConfig = {
        method: 'POST',
        url: discordUrl,
        headers: { 'Content-Type': 'application/json' },
        data: {
            embeds: [embed],
            allowed_mentions: { parse: [] }
        },
        timeout: 10000
    }

    await enqueueNotification(discordQueue, 'Discord', content, level, request)
}

export function flushDiscordQueue(timeoutMs = 5000): Promise<void> {
    return flushQueue(discordQueue, timeoutMs)
}
