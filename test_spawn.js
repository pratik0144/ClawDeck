const { spawn } = require('child_process');
console.log('starting...');
const child = spawn('opencode', ['run', 'echo "test"', '--model', 'opencode/minimax-m2.5-free', '--dangerously-skip-permissions'], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, FORCE_COLOR: '0', CI: '1' }
});
child.stdout.on('data', d => console.log('OUT:', d.toString()));
child.stderr.on('data', d => console.log('ERR:', d.toString()));
child.on('close', code => console.log('closed with code', code));
