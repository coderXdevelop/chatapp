const { spawn } = require('child_process');
const path = require('path');

const serverDir = path.join(__dirname, '..', 'server');
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const child = spawn(npmCmd, ['run', 'dev'], {
  cwd: serverDir,
  stdio: 'inherit',
  shell: false
});

child.on('exit', (code) => process.exit(code || 0));
