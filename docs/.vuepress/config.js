module.exports = {
  title: 'App Config',
  description: 'App Config is a configuration loader with schema validation',

  head: [
    [
      'meta',
      { name: 'google-site-verification', content: 'VnAVPQMmtn2kWFj3lZ5qRv_uddtWuDakYRVeDymdowE' },
    ],
  ],

  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Quick Start', link: '/guide/intro/quick-start' },
      { text: 'GitHub', link: 'https://github.com/launchcodedev/app-config' },
    ],

    sidebar: [
      {
        title: 'Introduction Guide',
        path: '/guide/intro/',
        children: [
          '/guide/intro/',
          '/guide/intro/schema-validation',
          '/guide/intro/config-loading',
          '/guide/intro/cli',
          '/guide/intro/codegen',
          '/guide/intro/secrets',
          '/guide/intro/encryption',
          '/guide/intro/extensions',
          '/guide/intro/settings',
        ],
      },
      {
        title: 'Node.js',
        path: '/guide/node/',
        children: ['/guide/node/', '/guide/node/example', '/guide/node/api-reference'],
      },
      {
        title: 'Webpack',
        path: '/guide/webpack/',
        children: ['/guide/webpack/', '/guide/webpack/inject', '/guide/webpack/example'],
      },
      {
        title: 'React Native',
        path: '/guide/react-native/',
        children: ['/guide/react-native/', '/guide/react-native/example'],
      },
      {
        title: 'Vite',
        path: '/guide/vite',
      },
      {
        title: 'Rollup',
        path: '/guide/rollup',
      },
      {
        title: 'Electron',
        path: '/guide/electron',
      },
      {
        title: 'Deployment',
        path: '/guide/deployment/',
        children: ['/guide/deployment/', '/guide/deployment/kubernetes'],
      },
      {
        title: 'Specification',
        path: '/spec/',
        children: ['/spec/', '/spec/golang', '/spec/rust'],
      },
      {
        title: 'Testing',
        path: '/guide/testing/jest',
        children: ['/guide/testing/jest', '/guide/testing/cypress'],
      },
      {
        title: 'Releases',
        path: '/release-notes',
        children: [['/release-notes', 'Release Notes'], '/v2-announcement', '/v2-migration'],
      },
      {
        title: 'FAQ',
        path: '/faq',
      },
    ],

    docsRepo: 'launchcodedev/app-config',
    docsDir: 'docs',
    docsBranch: 'master',
  },

  plugins: [
    ['vuepress-plugin-mermaidjs', { theme: 'base' }],
    [
      'vuepress-plugin-seo',
      {
        description: () => 'App Config is an Easy Configuration Loader with Strict Validation',
        author: () => 'Launchcode',
        image: () => 'https://app-config.dev/hero.png',
        tags: () => [
          'configuration',
          'config',
          'conf',
          'app-config',
          'launchcode',
          'lcdev',
          'node.js',
          'javascript',
          'typescript',
        ],
      },
    ],
  ],

  host: '0.0.0.0',
  port: 8080,
};
