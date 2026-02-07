module.exports = {
  target: (/** @type {string} */ name /*, semver */) => (name === '@types/node' ? 'minor' : 'latest'),
};
