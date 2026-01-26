// 格式化工具函数
export const stringToHex = (str: string): string => {
  return str
    .split('')
    .map((char) => char.charCodeAt(0).toString(16).padStart(2, '0'))
    .join(' ')
    .toUpperCase()
}

export const hexToString = (hex: string): string => {
  return hex
    .replace(/\s+/g, '')
    .match(/.{1,2}/g)
    ?.map((byte) => String.fromCharCode(parseInt(byte, 16)))
    .join('') || ''
}

export const hexToUint8Array = (hex: string): Uint8Array => {
  const cleanHex = hex.replace(/\s+/g, '')
  const length = (cleanHex.length / 2) | 0
  const result = new Uint8Array(length)
  for (let i = 0; i < length; i++) {
    result[i] = parseInt(cleanHex.substr(i * 2, 2), 16)
  }
  return result
}

export const uint8ArrayToHex = (data: Uint8Array): string => {
  return Array.from(data)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join(' ')
    .toUpperCase()
}

export const uint8ArrayToString = (data: Uint8Array): string => {
  return new TextDecoder().decode(data)
}

export const formatTimestamp = (): string => {
  const now = new Date()
  return now.toLocaleTimeString('zh-CN', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  })
}
