describe('vaultParsingExtension', () => {
  it('stub', () => {});

  // TODO: we would need to spin up a vault server in CI for this to work

  /*
  it('reads from vault server', async () => {
    process.env.APP_CONFIG = JSON.stringify({
      $vault: { secret: 'foo', name: 'bar' },
    });

    const { fullConfig } = await loadUnvalidatedConfig({
      environmentExtensions: defaultEnvExtensions().concat(vaultParsingExtension()),
      parsingExtensions: defaultExtensions().concat(vaultParsingExtension()),
    });

    expect(fullConfig).toEqual('baz');
  });
  */
});
