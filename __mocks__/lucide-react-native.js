// Sustituye cada icono por un componente anfitrión con su nombre: el paquete se publica como ESM.
module.exports = new Proxy(
  { __esModule: true },
  { get: (target, name) => (name in target ? target[name] : String(name)) },
);
