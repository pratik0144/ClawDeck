const { spawn } = require('child_process');
const child = spawn('lsof -ti :5174 | xargs kill -9 2>/dev/null || true', [], { shell: true });
child.stdout.on('data', d => console.log('OUT:', d.toString()));
child.stderr.on('data', d => console.log('ERR:', d.toString()));
child.on('close', code => console.log('closed with code', code));
