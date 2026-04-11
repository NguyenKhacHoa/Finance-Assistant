const { spawn } = require('child_process');
const fs = require('fs');

const child = spawn('npm', ['start'], { stdio: 'pipe' });
const stream = fs.createWriteStream('nest_crash.log');

child.stdout.pipe(stream);
child.stderr.pipe(stream);

setTimeout(() => {
  child.kill();
  process.exit(0);
}, 6000);
