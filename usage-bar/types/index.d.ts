declare module 'claude-code' {
  interface PluginState {
    'usage-bar': { usd: number | null; mark: number | null; turns: number[] }
  }
}

export {}
