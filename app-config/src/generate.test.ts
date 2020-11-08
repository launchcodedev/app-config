import { generateQuicktype } from './generate';

describe('TypeScript File Generation', () => {
  it('creates a simple TypeScript file', async () => {
    const schema = {
      type: 'object',
      additionalProperties: false,
      properties: {
        foo: { type: 'string' },
      },
    };

    const generated = await generateQuicktype(schema, 'ts', 'Configuration');

    expect(generated).toMatchSnapshot();
  });
});
