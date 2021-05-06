module.exports = (options) => (value, [, key]) => {
  if (key === '$eval') {
    if (typeof value === 'string') {
      return (parse) => parse(eval(value), { shouldFlatten: true });
    }
  }

  return false;
};
