/**
 * @jest-environment jsdom
 */

const logSpy = jest.spyOn(console, 'log');

const config = {
  externalApiUrl: 'http://localhost:3002',
};

jest.mock('@lcdev/app-config', () => ({ config, default: config }));

import './index';

it('logs config', () => {
  expect(logSpy).toHaveBeenCalledWith('externalApiUrl:', config.externalApiUrl);
  expect(document.body).toMatchSnapshot();
});
