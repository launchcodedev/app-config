declare module '*/package.json' {
  interface Package {
    name?: string;
    description?: string;
    version?: string;
  }

  const package: Package;

  export = package;
}
