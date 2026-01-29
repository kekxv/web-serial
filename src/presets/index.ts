export interface ProtocolOption {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  utils: any;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ProtocolFunction = (option: ProtocolOption) => any;

export interface ProtocolPreset {
  name: string;
  pack: string | ProtocolFunction;
  unpack: string | ProtocolFunction;
  toString?: string | ProtocolFunction;
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
