module.exports = {
  target: (/** @type {string} */ name /*, semver */) => {
    if (
      // Node: execution environment is Node 24; do not upgrade to Node 25+.
      name === '@types/node' ||
      // typescript-eslint: supported ESLint is ^8.57.0 || ^9.0.0 only. See https://typescript-eslint.io/users/dependency-versions/
      name === 'eslint'
    ) {
      return 'minor';
    }
    return 'latest';
  },
};
