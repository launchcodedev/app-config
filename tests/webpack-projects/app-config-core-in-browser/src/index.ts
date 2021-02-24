import { LiteralSource } from '@app-config/core';

const value = {
  foo: 'bar',
  baz: {
    qux: 42,
  },
};

new LiteralSource(value).read().then((value) => {
  document.body.innerHTML = `<pre>${JSON.stringify(value)}</pre>`;
});
