import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 模拟 FormatUtils
const mockUtils = {
  crc16modbus: () => 0,
  crc32: () => 0,
  uint8ArrayToHex: () => '',
  uint8ArrayToString: () => '',
  hexToUint8Array: () => new Uint8Array(),
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const presetsDir = path.resolve(__dirname, '../src/presets');

async function validate() {
  const files = fs.readdirSync(presetsDir).filter(f => f.endsWith('.ts') && f !== 'index.ts');
  let hasError = false;

  console.log(`🔍 Found ${files.length} presets to validate...\n`);

  for (const file of files) {
    const filePath = path.join(presetsDir, file);
    try {
      const module = await import(`file://${filePath}`);
      const preset = module.default;

      console.log(`Testing [${file}]: "${preset?.name || 'Unknown'}"`);

      // 1. 结构检查
      if (!preset || !preset.name || !preset.pack || !preset.unpack) {
        throw new Error(`Invalid structure: Missing name, pack, or unpack.`);
      }

      const runFunc = (handler: string | ((option: unknown) => unknown), data: unknown) => {
        if (typeof handler === 'function') {
          return handler({ data, utils: mockUtils });
        }
        const trimmed = handler.trim();
        let body = handler;
        if (trimmed.includes('=>') || (trimmed.startsWith('function') && !trimmed.match(/^function\s*\(.*\)\s*\{/))) {
           const fn = new Function('option', `return (${trimmed})(option)`);
           return fn({ data, utils: mockUtils });
        }
        const match = handler.match(/function\s*\(.*\)\s*\{([\s\S]*)\}/);
        if (match) body = match[1];
        const fn = new Function('option', body);
        return fn({ data, utils: mockUtils });
      };

      // 2. 运行测试
      console.log(`  - Testing pack...`);
      runFunc(preset.pack, new Uint8Array([1, 2, 3]));
      
      console.log(`  - Testing unpack...`);
      const unpacked = runFunc(preset.unpack, new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]));
      
      if (preset.toString) {
        console.log(`  - Testing toString...`);
        runFunc(preset.toString, unpacked);
      }

      console.log(`  ✅ Passed\n`);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`  ❌ Failed [${file}]: ${errorMessage}\n`);
      hasError = true;
    }
  }

  if (hasError) {
    process.exit(1);
  } else {
    console.log('🎉 All presets are valid!');
  }
}

validate();