// Versión para pruebas: conserva las propiedades de la animación sin el módulo nativo.
const React = require('react');
const { View } = require('react-native');

function LottieView(props) {
  return React.createElement(View, { ...props, testID: props.testID ?? 'lottie-animation' });
}

module.exports = { __esModule: true, default: LottieView };
