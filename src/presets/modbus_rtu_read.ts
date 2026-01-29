import {type ProtocolPreset} from './index';

const preset: ProtocolPreset = {
  name: 'Modbus RTU Read (03)',
  pack: ({data, utils}) => {
    // data 预期为: [slaveId, funcCode, startAddrH, startAddrL, countH, countL]
    const buf = new Uint8Array(data.length + 2);
    buf.set(data);
    const crc = utils.crc16modbus(data);
    buf[data.length] = crc & 0xFF;         // CRC 低字节
    buf[data.length + 1] = (crc >> 8) & 0xFF; // CRC 高字节
    return buf;
  },
  unpack: ({data, utils}) => {
    if (data.length < 4) return data;

    const payload = data.slice(0, data.length - 2);
    const crcReceived = data[data.length - 2] | (data[data.length - 1] << 8);
    const crcCalc = utils.crc16modbus(payload);

    return {
      slaveId: data[0],
      func: data[1],
      byteCount: data[2],
      values: Array.from(data.slice(3, data.length - 2)),
      crcValid: crcReceived === crcCalc
    };
  },
  toString: ({data, utils}) => {
    if (typeof data === 'object' && data.values) {
      const hexValues = data.values.map((v: number) => v.toString(16).padStart(2, '0')).join(' ');
      return `[Modbus] 从站: ${data.slaveId} | 数据: ${hexValues} ${data.crcValid ? '' : '(校验失败)'}`;
    }
    return utils.uint8ArrayToHex(data);
  }
};

export default preset;
