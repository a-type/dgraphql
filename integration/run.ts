import { Docker } from 'node-docker-api';
import seed from './seed';
// importing starts the server immediately
import server from '../examples/apollo/server';
import { execSync } from 'child_process';
import { resolve } from 'path';
let container;

const promisifyStream = stream =>
  new Promise((resolve, reject) => {
    stream.on('data', d => console.log(d.toString()));
    stream.on('end', resolve);
    stream.on('error', reject);
  });

try {
  (async () => {
    try {
      // start a dgraph docker container
      // const config =
      //   process.platform === 'win32'
      //     ? {
      //         socketPath: '//./pipe/docker_engine',
      //       }
      //     : { socketPath: '/var/run/docker.sock' };
      // const docker = new Docker(config);

      // await docker.image
      //   .create({}, { fromImage: 'dgraph', tag: 'v1.0.12-rc5' })
      //   .then(promisifyStream);

      // container = await docker.container.create({
      //   Image: 'dgraph/dgraph',
      //   name: 'dgraph',
      // });
      // await container.start();
      // seed the database
      await seed();
      // run the test suite
      execSync('npm run test:integration:run', {
        cwd: resolve(__dirname, '..'),
      });
      // clean up
      await server.stop();
      await container.kill();
    } catch (err) {
      console.error(err);
      if (container) {
        await container.kill();
      }
      await server.stop();
      process.exit(1);
    }
  })();
} catch (err) {
  try {
    (async () => {
      console.error(err);
      if (container) {
        await container.kill();
      }
      await server.stop();
      process.exit(1);
    })();
  } catch (err2) {
    console.error(err2);
    process.exit(1);
  }
}
