const originalEnvironment = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnvironment };
});
