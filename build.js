const os = require('os');
const cp = require('child_process');

const TAG = '[build]';
const isdev = process.argv.slice(2).includes('--watch');

; (async () => {
  if (isdev) {
    dev();
  } else {
    const status = await build();
    if (status.every(e => !e)) {
      console.log(TAG, 'build success');
    }
  }
})();

function dev() {
  stdio(error(run('dev:es')));
  stdio(error(run('dev:cjs')));
}

/**
 * @type {() => Promise<(number | null)[]>}
 */
function build() {
  return new Promise(resolve => {
    const status = [undefined, undefined];
    const done = () => {
      if (status.every(e => e !== undefined)) {
        resolve(status);
      }
    };
    stdio(error(run('build:es'))).on('exit', code => {
      status[0] = code;
      done();
    });
    stdio(error(run('build:cjs'))).on('exit', code => {
      status[1] = code;
      done();
    });
  });
}

function run(args = []) {
  const npm = os.platform() === 'win32' ? 'npm.cmd' : 'npm';
  return cp.spawn(npm, ['run'].concat(args));
}

/**
 * @type {(cp: import('child_process').ChildProcessWithoutNullStreams) => typeof cp}
 */
function stdio(cp) {
  cp.stdout.pipe(process.stdout);
  cp.stderr.pipe(process.stderr);
  return cp;
}

/**
 * @type {(cp: import('child_process').ChildProcessWithoutNullStreams) => typeof cp}
 */
function error(cp) {
  cp.on('error', error => {
    console.error(TAG, error);
    process.exit(1);
  });
  return cp;
}
