module.exports = {
  title: 'App Config',
  description: 'Easy to use configuration loader with schema validation',
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Quick Start', link: '/guide/intro/quick-start' },
    ],

    sidebar: [
      {
        title: 'Introduction',
        path: '/guide/intro/',
        children: [
          '/guide/intro/',
          '/guide/intro/schema-validation',
          '/guide/intro/secrets',
          '/guide/intro/cli',
          '/guide/intro/codegen',
          '/guide/intro/extensions',
          '/guide/intro/encryption',
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
        children: [
          '/guide/webpack/',
          '/guide/webpack/inject',
          '/guide/webpack/example',
        ],
      },
      {
        title: 'React Native',
        path: '/guide/react-native/',
        children: ['/guide/react-native/', '/guide/react-native/example'],
      },
      {
        title: 'Deployment',
        path: '/guide/deployment/',
        children: ['/guide/deployment/', '/guide/deployment/kubernetes'],
      },
      {
        title: 'Releases',
        path: '/guide/release-notes',
        children: [
          ['/guide/release-notes', 'Release Notes'],
          '/guide/v2-migration',
        ],
      },
    ],

    docsRepo: 'launchcodedev/app-config',
    docsDir: 'docs',
    docsBranch: 'master',
  },

  plugins: [
    ['vuepress-plugin-mermaidjs', { theme: 'base' }],
  ],
};
