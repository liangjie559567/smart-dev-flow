import { execSync } from 'child_process';

const isWin = process.platform === 'win32';
const cmd = isWin ? 'powershell -File setup.ps1' : 'bash setup.sh';
try {
  execSync(cmd, { stdio: 'inherit' });
} catch {
  process.exit(1);
}
