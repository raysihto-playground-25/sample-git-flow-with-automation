module.exports = {
  target: (/** @type {string} */ name /*, semver */) =>
    name === '@types/node' || name === '@actions/github' ? 'minor' : 'latest',
};
