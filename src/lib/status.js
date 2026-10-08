export function formatLastSeen(lastSeen) {
  if (!lastSeen) return 'Offline'
  const diff = Date.now() - new Date(lastSeen).getTime()
  const minutes = Math.floor(diff / 60000)

  if (minutes < 5) return 'Online now'
  if (minutes < 60) return `Last seen ${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Last seen ${hours} hour${hours > 1 ? 's' : ''} ago`
  const days = Math.floor(hours / 24)
  return `Last seen ${days} day${days > 1 ? 's' : ''} ago`
}
