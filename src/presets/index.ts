interface ProtocolPreset {
  name: string;
  pack: string;
  unpack: string;
  toString?: string;
}

const modules = import.meta.glob('./*.ts', { eager: true });
const PROTOCOL_PRESETS: Record<string, ProtocolPreset> = {};

for (const path in modules) {
  if (path === './index.ts') continue;
  
  const module = modules[path] as { default: ProtocolPreset };
  const key = path.replace(/^\.\/(.*)\.ts$/, '$1');
  
  if (module.default) {
    PROTOCOL_PRESETS[key] = module.default;
  }
}

export { PROTOCOL_PRESETS };
export type { ProtocolPreset };
