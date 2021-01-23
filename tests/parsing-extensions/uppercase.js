module.exports = (options) => (value) => {
  if (typeof value === 'string') {
    return (parse) => parse(value.toUpperCase());
  }

  return false;
};
