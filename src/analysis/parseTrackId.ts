export function parseTrackId(input: string): string | null {
  const trimmed = input.trim()

  if (!trimmed) {
    return null
  }

  if (/^[a-zA-Z0-9]{22}$/.test(trimmed)) {
    return trimmed
  }

  const uriMatch = trimmed.match(/spotify:track:([a-zA-Z0-9]{22})/)
  if (uriMatch) {
    return uriMatch[1]
  }

  const urlMatch = trimmed.match(/track\/([a-zA-Z0-9]{22})/)
  if (urlMatch) {
    return urlMatch[1]
  }

  return null
}
