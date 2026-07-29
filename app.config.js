/**
 * Extiende app.json sin duplicarlo: Expo pasa acá lo que ya leyó de ese archivo.
 *
 * El bundle identifier depende del certificado con el que se firme, y cada persona
 * tiene el suyo. En vez de obligar a editar app.json, se puede pasar por entorno:
 *
 *   EALU_BUNDLE_ID=tu.app.id npx eas-cli build --platform ios --profile firmado-propio
 *
 * Si no se define, queda el valor de app.json. Quien re-firme el IPA con Feather,
 * AltStore o Sideloadly no necesita tocar nada: esas herramientas reescriben el
 * bundle identifier al firmar.
 */
module.exports = ({ config }) => ({
  ...config,
  ios: {
    ...config.ios,
    bundleIdentifier: process.env.EALU_BUNDLE_ID ?? config.ios.bundleIdentifier,
  },
});
