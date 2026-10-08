export function formatLastSeen(lastSeen) {
  if (!lastSeen) return 'Offline'

  const diffMs = Date.now() - new Date(lastSeen).getTime()
  const minutes = Math.floor(diffMs / 60000)

  // Stricter: only “Online now” if seen in the last 3 minutes
  if (minutes < 3) return 'Online now'
  if (minutes < 60) return `Last seen ${minutes} min ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Last seen ${hours} hour${hours > 1 ? 's' : ''} ago`

  const days = Math.floor(hours / 24)
  if (days === 1) return 'Last seen yesterday'
  return `Last seen ${days} days ago`
}
