let cached: any = null;

export async function getNpmGroovyLint(): Promise<any> {
  if (cached) {return cached;}
  const candidates = [
    'npm-groovy-lint',
    'npm-groovy-lint/lib/groovy-lint.js',
    'npm-groovy-lint/lib/index.js'
  ];
  for (const p of candidates) {
    try {
      // dynamic import to support ESM packages
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const mod = await import(p);
      const cls = mod?.default ?? mod?.GroovyLint ?? mod;
      if (cls) {
        cached = cls;
        return cached;
      }
    } catch (e) {
      console.log(`Failed to load ${p}: ${(e as any).message}`);
      // try next candidate
    }
  }
  throw new Error('Cannot load npm-groovy-lint module');
}
