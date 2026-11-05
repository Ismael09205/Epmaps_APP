module.exports = {
  preset: 'jest-expo',
  moduleNameMapper: {
    // Las animaciones dotLottie se resuelven como recurso en la app; en las pruebas basta un número.
    '\.lottie$': '<rootDir>/__mocks__/lottie-asset.js',
  },
};
