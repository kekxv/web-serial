export default {
  name: 'Face Detection Protocol',
  pack: `/**
 * 打包函数
 * @param {Object} option
 * @param {Object} option.data - 预期格式: { width: 640, height: 480, faces: [{score: 0.9, x: 10, y: 10, w: 100, h: 100}] }
 * @param {Object} option.utils - 工具类
 */
function(option) {
  const { data, utils } = option;
  const STA = 0xFE; // 假设 STA 为 0xFE
  const faces = data.faces || [];
  const faceCount = Math.min(faces.length, 2);
  
  const buf = [];
  buf.push(STA);
  buf.push(0); // 长度占位
  buf.push((data.width >> 8) & 0xFF);
  buf.push(data.width & 0xFF);
  buf.push((data.height >> 8) & 0xFF);
  buf.push(data.height & 0xFF);
  buf.push(faceCount);
  
  for (let i = 0; i < faceCount; i++) {
    const face = faces[i];
    buf.push(Math.min(0xFF, Math.floor(face.score * 0xFF)));
    buf.push((face.x >> 8) & 0xFF);
    buf.push(face.x & 0xFF);
    buf.push((face.y >> 8) & 0xFF);
    buf.push(face.y & 0xFF);
    buf.push((face.w >> 8) & 0xFF);
    buf.push(face.w & 0xFF);
    buf.push((face.h >> 8) & 0xFF);
    buf.push(face.h & 0xFF);
  }
  
  // 设置长度: 当前大小 + 4字节CRC
  buf[1] = (buf.length + 4) & 0xFF;
  
  const uint8 = new Uint8Array(buf);
  const crc = utils.crc32(uint8);
  
  const final = new Uint8Array(uint8.length + 4);
  final.set(uint8);
  final[uint8.length] = (crc >> 24) & 0xFF;
  final[uint8.length + 1] = (crc >> 16) & 0xFF;
  final[uint8.length + 2] = (crc >> 8) & 0xFF;
  final[uint8.length + 3] = crc & 0xFF;
  
  return final;
}`,
  unpack: `/**
 * 解包函数：解析包含宽高和人脸坐标的自定义帧
 * @param {Object} option
 * @param {Uint8Array} option.data - 接收原始字节
 * @param {Object} option.utils - 工具类
 */
function(option) {
  const { data, utils } = option;
  if (data.length < 11) return data; // 最小长度检查
  
  const len = data[1];
  if (data.length < len) return data; // 长度不足
  
  const payload = data.slice(0, len - 4);
  const crcReceived = ((data[len-4] << 24) | (data[len-3] << 16) | (data[len-2] << 8) | data[len-1]) >>> 0;
  const crcCalc = utils.crc32(payload);
  
  const width = (data[2] << 8) | data[3];
  const height = (data[4] << 8) | data[5];
  const faceCount = data[6];
  const faces = [];
  
  for (let i = 0; i < faceCount && i < 2; i++) {
    const offset = 7 + i * 9;
    if (data.length < offset + 9) break;
    faces.push({
      score: data[offset] / 255,
      x: (data[offset+1] << 8) | data[offset+2],
      y: (data[offset+3] << 8) | data[offset+4],
      w: (data[offset+5] << 8) | data[offset+6],
      h: (data[offset+7] << 8) | data[offset+8]
    });
  }
  
  return { width, height, faceCount, faces, crcValid: crcReceived === crcCalc };
}`,
  toString: `/**
 * 输出函数：将解包后的对象转换为显示的文本
 * @param {Object} option
 * @param {any} option.data - unpack 后的数据
 */
function(option) {
  const { data, utils } = option;
  if (typeof data === 'object' && data.width !== undefined) {
    let str = \`[FaceDet] Res: \${data.width}x\${data.height} | Faces: \${data.faceCount}\`;
    data.faces.forEach((f, i) => {
      str += \`\\n  #\${i+1}: Score: \${f.score.toFixed(2)} [x:\${f.x}, y:\${f.y}, w:\${f.w}, h:\${f.h}]\`;
    });
    if (!data.crcValid) str += ' (CRC ERROR)';
    return str;
  }
  return utils.uint8ArrayToHex(data);
}`
}
