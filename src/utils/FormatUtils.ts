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

// 常用校验算法
export const crc16modbus = (data: Uint8Array): number => {
  let crc = 0xFFFF
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i]
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x0001) !== 0) {
        crc = (crc >> 1) ^ 0xA001
      } else {
        crc >>= 1
      }
    }
  }
  return crc
}

export const crc32 = (data: Uint8Array): number => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    }
    table[i] = c
  }
  let crc = 0xFFFFFFFF
  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xFF]
  }
  return (crc ^ 0xFFFFFFFF) >>> 0
}

export const checksum8 = (data: Uint8Array): number => {
  let sum = 0
  for (let i = 0; i < data.length; i++) {
    sum = (sum + data[i]) & 0xFF
  }
  return sum
}

export const xor8 = (data: Uint8Array): number => {
  let xor = 0
  for (let i = 0; i < data.length; i++) {
    xor ^= data[i]
  }
  return xor
}
