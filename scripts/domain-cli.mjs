import { configRoot, discoverDomains, detectDomain } from './domains.mjs';

const [action, directory] = process.argv.slice(2);
try {
  if (action === 'list' || action === 'check') {
    const { domains, errors } = discoverDomains();
    console.log(JSON.stringify({ domains: domains.map(d => ({ id: d.id, name: d.name, routes: d.routes })), errors }, null, 2));
    if (errors.length) process.exitCode = 1;
  } else if (action === 'detect') {
    console.log(JSON.stringify(detectDomain(directory ?? process.cwd(), configRoot()), null, 2));
  } else {
    throw new Error('Usage: piw domain <list|check|detect [project-directory]>');
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
