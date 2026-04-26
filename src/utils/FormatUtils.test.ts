import { describe, it, expect } from 'vitest'
import { uint8ArrayToHex, hexToUint8Array } from './FormatUtils'

describe('FormatUtils', () => {
  describe('uint8ArrayToHex', () => {
    it('should convert valid UTF-8 bytes to hex', () => {
      const data = new Uint8Array([0x02, 0x0b, 0x01, 0x2c, 0x1a, 0x39])
      expect(uint8ArrayToHex(data)).toBe('02 0B 01 2C 1A 39')
    })

    it('should preserve invalid UTF-8 bytes (0xE0, 0x80, 0xB3)', () => {
      // 这些字节在 UTF-8 中是非法的，但十六进制转换应保留原始值
      // 0xE0: 三字节序列起始，但后面不是合法延续字节
      // 0x80, 0xB3: 延续字节，不能单独出现
      const data = new Uint8Array([0x02, 0x0b, 0x01, 0xe0, 0x02, 0x80, 0x00, 0xb3, 0x2c, 0x1a, 0x39])
      expect(uint8ArrayToHex(data)).toBe('02 0B 01 E0 02 80 00 B3 2C 1A 39')
    })

    it('should handle all byte values from 0x00 to 0xFF', () => {
      const data = new Uint8Array([0x00, 0x7f, 0x80, 0xbf, 0xc0, 0xff])
      expect(uint8ArrayToHex(data)).toBe('00 7F 80 BF C0 FF')
    })

    it('should handle empty array', () => {
      expect(uint8ArrayToHex(new Uint8Array([]))).toBe('')
    })
  })

  describe('hexToUint8Array', () => {
    it('should convert hex string to Uint8Array', () => {
      expect(hexToUint8Array('02 0B 01 E0 02 80 00 B3 2C 1A 39')).toEqual(
        new Uint8Array([0x02, 0x0b, 0x01, 0xe0, 0x02, 0x80, 0x00, 0xb3, 0x2c, 0x1a, 0x39])
      )
    })

    it('should handle hex without spaces', () => {
      expect(hexToUint8Array('020B01E0028000B32C1A39')).toEqual(
        new Uint8Array([0x02, 0x0b, 0x01, 0xe0, 0x02, 0x80, 0x00, 0xb3, 0x2c, 0x1a, 0x39])
      )
    })
  })

  describe('roundtrip', () => {
    it('should preserve bytes through hex conversion roundtrip', () => {
      const original = new Uint8Array([0x02, 0x0b, 0x01, 0xe0, 0x02, 0x80, 0x00, 0xb3, 0x2c, 0x1a, 0x39])
      const hex = uint8ArrayToHex(original)
      const restored = hexToUint8Array(hex)
      expect(restored).toEqual(original)
    })
  })

  describe('TextDecoder vs hexMode', () => {
    it('should demonstrate that TextDecoder corrupts invalid UTF-8 bytes', () => {
      const data = new Uint8Array([0x02, 0x0b, 0x01, 0xe0, 0x02, 0x80, 0x00, 0xb3, 0x2c, 0x1a, 0x39])

      // TextDecoder 会将无效 UTF-8 字节替换为 U+FFFD (0xFFFD)
      const decoder = new TextDecoder('utf-8')
      const decoded = decoder.decode(data)

      // 检查解码后的字符串包含替换字符 U+FFFD
      expect(decoded.includes('�')).toBe(true)

      // 而 uint8ArrayToHex 保留所有原始字节
      expect(uint8ArrayToHex(data)).toBe('02 0B 01 E0 02 80 00 B3 2C 1A 39')
    })
  })
})