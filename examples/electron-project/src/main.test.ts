import { Application } from 'spectron';
import path from 'path';

const electronPath = path.join(__dirname, '..', 'node_modules', '.bin', 'electron');

const app = new Application({
  path: electronPath,
  args: [__dirname],
});

describe('launch', function () {
  beforeEach(async function () {
    return app.start()
  });

  afterEach(function () {
    if (app && app.isRunning()) {
      return app.stop()
    }
  });

  it('test', function () {
    return expect(1).toEqual(1);
  });
});