export default {
    name: 'Modbus RTU Read (03)',
    pack: `/**
 * 打包函数：将用户输入转换为原始字节流
 * @param {Object} option
 * @param {string|Uint8Array} option.data - 用户在发送框输入的数据
 * @param {Object} option.utils - 工具类 (crc16modbus, hexToUint8Array, etc.)
 * @returns {Uint8Array|string} 发送到设备的原始数据
 */
function(option) {
  const { data, utils } = option;
  // 示例：给输入数据添加 Modbus RTU CRC 校验
  // data 预期为: [slaveId, funcCode, startAddrH, startAddrL, countH, countL]
  const buf = new Uint8Array(data.length + 2);
  buf.set(data);
  const crc = utils.crc16modbus(data);
  buf[data.length] = crc & 0xFF;         // CRC 低字节
  buf[data.length + 1] = (crc >> 8) & 0xFF; // CRC 高字节
  return buf;
}`,
    unpack: `/**
 * 解包函数：将接收到的原始字节流转换为逻辑对象
 * @param {Object} option
 * @param {Uint8Array} option.data - 从串口接收到的原始字节
 * @param {Object} option.utils - 工具类
 * @returns {any} 解包后的数据对象，将传递给 toString 函数
 */
function(option) {
  const { data, utils } = option;
  if (data.length < 4) return data;
  
  const payload = data.slice(0, data.length - 2);
  const crcReceived = data[data.length - 2] | (data[data.length - 1] << 8);
  const crcCalc = utils.crc16modbus(payload);
  
  // 返回一个结构化对象
  return { 
    slaveId: data[0],
    func: data[1],
    byteCount: data[2],
    values: Array.from(data.slice(3, data.length - 2)),
    crcValid: crcReceived === crcCalc
  };
}`,
    toString: `/**
 * 输出函数：将解包后的对象转换为显示的文本
 * @param {Object} option
 * @param {any} option.data - unpack 函数返回的对象
 * @param {Object} option.utils - 工具类
 * @returns {string} 终端显示的字符串
 */
function(option) {
  const { data, utils } = option;
  // 如果是对象且包含 Modbus 字段，格式化输出
  if (typeof data === 'object' && data.values) {
    const hexValues = data.values.map(v => v.toString(16).padStart(2, '0')).join(' ');
    return \`[Modbus] 从站: \${data.slaveId} | 数据: \${hexValues} \${data.crcValid ? '' : '(校验失败)'}\`;
  }
  // 默认使用 HEX 打印
  return utils.uint8ArrayToHex(data);
}`
};