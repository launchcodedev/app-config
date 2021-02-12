import { generateCert } from './secret-agent-tls';

describe('Certificates', () => {
  it('generates a basic cert', async () => {
    const { key, cert } = await generateCert();

    expect(typeof key).toBe('string');
    expect(typeof cert).toBe('string');
  });

  it('fails with an invalid expiry', async () => {
    await expect(generateCert(Infinity)).rejects.toThrow();
    await expect(generateCert(-1)).rejects.toThrow();
  });
});
