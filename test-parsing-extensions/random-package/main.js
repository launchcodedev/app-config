module.exports = (options) => (value, [, key]) => {
  const rng = require('seedrandom')(options.seed);

  if (key === '$random') {
    return (parse) => parse(rng(), { shouldFlatten: true });
  }

  return false;
};
