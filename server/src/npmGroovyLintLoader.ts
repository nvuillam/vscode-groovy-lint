let cached: any = null;

export async function getNpmGroovyLint(): Promise<any> {
  if (cached) {return cached;}
  
  // Try dynamic import first (for ESM packages like npm-groovy-lint v16+)
  // Use eval to prevent TypeScript from transpiling import() to require()
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const dynamicImport = eval('(specifier) => import(specifier)');
    const mod = await dynamicImport('npm-groovy-lint');
    const cls = mod?.default ?? mod?.GroovyLint ?? mod;
    if (cls) {
      cached = cls;
      return cached;
    }
  } catch (e) {
    console.log(`Failed to load npm-groovy-lint via dynamic import: ${(e as any).message}`);
  }

  // Fallback to require for older CommonJS versions
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('npm-groovy-lint');
    const cls = mod?.default ?? mod?.GroovyLint ?? mod;
    if (cls) {
      cached = cls;
      return cached;
    }
  } catch (e) {
    console.log(`Failed to load npm-groovy-lint via require: ${(e as any).message}`);
  }

  throw new Error('Cannot load npm-groovy-lint module');
}
