# EALU para iPhone

Cliente iOS no oficial de la plataforma EALU de la Universidad Nacional de Asunción
(la web es https://www.cnc.una.py/ealu). App nativa en Expo / React Native: consume
la misma API REST que usa la web, no es un contenedor de WebView.

## Por qué existe

La versión web no tiene app para iPhone, se ve mal en pantalla chica y cierra la sesión
seguido. Esto último no es culpa de Safari: el backend usa **cookie de sesión de servidor**
(`JSESSIONID`), sin JWT ni refresh token, así que caduca por inactividad.

La app lo resuelve guardando las credenciales en el **Keychain** (`expo-secure-store`) y
re-autenticando de forma transparente cuando el servidor devuelve 401/403. El usuario ve
la pantalla de login una sola vez.

## La API

Base: `https://api.una.py:8443/ealu-backend/`
Autenticación: cookie de sesión. En iOS, `fetch` usa `NSHTTPCookieStorage`, que persiste
entre reinicios, así que la cookie sobrevive sola.

| Endpoint | Método | Notas |
| --- | --- | --- |
| `facultades` | GET | **Público**, sin sesión. Trae `codigo` (el `codfacul` del login) y flags por facultad: `tieneParciales`, `tienePreinscasig`, `tieneInscexafinal`. |
| `login?codfacul={cod}` | POST | `application/x-www-form-urlencoded` con `username` (cédula) y `password`. |
| `logout` | POST | |
| `sesion-ealu/info` | GET | `{ user, alumno, facultad, matriculaList[] }`. Un alumno puede tener **varias matrículas**; cada una con su `codcarsec`. |
| `ultimas-notas/{codcarsec}` | GET | `[{ asignatura, tipoexamen, fechaexamen, nota, ausente, puntajeobtenido }]` |
| `notas_finales/{codcarsec}` | GET | `{ notas: [...], promedio }` — ojo, envuelto. |
| `notas_parciales/{codcarsec}` | GET | Array pelado. Vacío si la facultad tiene `tieneParciales: false`. |
| `notas_libres/{codcarsec}` | GET | Array pelado. |
| `inscripciones-registradas/{codcarsec}` | GET | Materias que cursa: `asignatura, curso, turno, seccion, anho, porcasis, derechoexa`. |
| `preinscripciones-registradas/{codcarsec}` | GET | |
| `asig-habilitadas/{codcarsec}` | GET | Envuelto en `{ success, errorMessage, data }`. |
| `inscexafinal/registradas/{codcarsec}` | GET | Vacío fuera del período de inscripción. |
| `inscexafinal/examenes-habilitados/{codcarsec}` | GET | Ídem. |
| `inscexaparcial/reg/*`, `inscexaparcial/recup/*` | GET/POST | Solo facultades con `tieneParciales`. |
| `deudas/tiene-deuda` | GET | Booleano. |
| `deudas/pendientes` | GET | `[{ concepto, monto, montoStr, saldo, saldoStr, numeroCuota, fechaVencimiento }]` |
| `arancel0/datatable` | GET | Conceptos con arancel cero **del alumno**. Devuelve `{ aaData, recordsTotal }`. |
| `actividad_extension/{codcarsec}` | GET | `{ resumenExtension: { horasRequeridas, horasCumplidas, extensionList[] }, resumenExtensionPorTipoEvento }` |
| `firmas/{codcarsec}` | GET | Incluye `promedioponderado` y duración de la firma. |
| `acciones-acad`, `dashboard/mensajes` | GET | |
| `perfil?codcarsec={codcarsec}` | GET | Datos personales. |
| `perfil/foto.png`, `perfil/qr.png` | GET | Imágenes; requieren cookie de sesión. |
| `horarios` | GET | |

Las respuestas mezclan dos convenciones: algunos endpoints devuelven el array pelado y
otros lo envuelven en `data`. `desenvolver()` en `src/lib/api.ts` normaliza ambos casos.

## Estructura

```
src/lib/api.ts            cliente HTTP, login, re-login transparente, tipos
src/lib/sesion.tsx        contexto de sesión + selección de matrícula
src/lib/useApi.ts         hook GET con carga / error / pull-to-refresh
src/components/base.tsx   piezas visuales + render genérico de fallback
src/components/login.tsx  login con selector de facultad buscable
src/app/                  5 pestañas: Inicio, Notas, Inscripción, Cuenta, Perfil
```

## Compilar e instalar (desde Windows, sin Mac)

**La vía que funciona es GitHub Actions** (`.github/workflows/ios.yml`), no EAS Build. Ver
"Por qué GitHub Actions y no EAS" más abajo.

```
Actions > Compilar IPA iOS > Run workflow  ->  artefacto "ealu-ipa" (~14 MB)
```

Necesita tres secrets en el repositorio (`Settings > Secrets and variables > Actions`):
`IOS_P12_BASE64`, `IOS_PROFILE_BASE64` e `IOS_P12_PASSWORD`. Los dos primeros se generan con:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("certs\certificado.p12")) | Set-Clipboard
```

Cuatro cosas que costaron un build cada una, por si hay que rehacer el workflow:

1. SDK 57 usa CocoaPods: hay `.xcworkspace` **después** de `pod install`, no antes.
2. El certificado es `Apple Distribution`; sin `CODE_SIGN_IDENTITY="Apple Distribution"`
   Xcode busca uno de tipo *iOS Development* y falla.
3. Las dependencias Swift Package Manager conviene resolverlas en un paso aparte.
4. Hace falta **Xcode 26** (Swift 6.2). En `macos-15` (Xcode 16.4 / Swift 6.1) falla con
   `package 'apple' is using Swift tools version 6.2.0`. Por eso `runs-on: macos-26`.

### Por qué GitHub Actions y no EAS

EAS Build falla en la fase *Prepare credentials* con este certificado:

```
Distribution certificate with fingerprint ... hasn't been imported successfully
```

No es problema del certificado. Se verificó que el par clave/certificado coincide (mismo
módulo), que el fingerprint es idéntico al del perfil, que no está revocado (OCSP responde
`good`) y —sobre todo— que **macOS lo importa sin problemas**: en el runner de GitHub,
`security find-identity` lo lista como identidad válida y firma correctamente. Es una
validación interna de EAS la que lo rechaza.

Reempaquetar el `.p12` con AES-256 y agregarle la cadena WWDR no cambió nada en EAS.

---

Lo que sigue queda como referencia histórica de las vías con EAS.

### A. Certificado propio ad-hoc (la vía que usa este proyecto)

Con un `.p12` y un `.mobileprovision`, EAS los usa tal cual en vez de gestionar una cuenta
de Apple, y devuelve un IPA que se instala directo, sin TestFlight.

```bash
cp credentials.example.json credentials.json   # completar rutas y contraseña
npx eas-cli build --platform ios --profile firmado-propio
```

El perfil en uso es **ad-hoc**, no in-house. Eso tiene tres consecuencias que hay que
respetar o el build falla o la app no abre:

- `enterpriseProvisioning` va en `"adhoc"`. Con `"universal"` el build falla.
- El **App ID es explícito**: `J87YM9ZQCJ.app.carrot4037.persimmon1148`. `app.json` usa ese
  `bundleIdentifier` exacto — no es wildcard, no admite otro.
- Solo corre en los **UDIDs listados** en `ProvisionedDevices` (hoy, uno solo). En cualquier
  otro iPhone instala pero no arranca.

Vencimientos vigentes: el perfil y el certificado caducan el **2026-12-03**. Cuando eso pase,
la app instalada deja de abrir hasta recompilar con credenciales nuevas.

### A-bis. Re-firmar con Feather

Si el IPA que devuelve EAS da problemas de firma, Feather (o cualquier sideloader que firme
en el dispositivo) lo re-firma con el mismo `.p12` y `.mobileprovision`, y ahí el bundle
identifier lo ajusta la herramienta. Es el camino más tolerante: EAS solo tiene que producir
un IPA válido, la firma definitiva la pone Feather en el teléfono.

#### Si EAS falla con "certificate ... hasn't been imported successfully"

El `.p12` está empaquetado con cifrado antiguo (RC2/3DES). Los sideloaders que firman en el
dispositivo lo aceptan, pero el llavero de macOS que usa EAS lo rechaza. Es habitual en los
certificados que venden los servicios de firma.

Se detecta así: si el archivo **necesita** la bandera `-legacy` para abrirse, está en el
formato viejo.

```bash
openssl pkcs12 -in certs/certificado.p12 -nokeys -passin pass:LACONTRASENA   # falla
openssl pkcs12 -in certs/certificado.p12 -nokeys -passin pass:LACONTRASENA -legacy   # funciona
```

Se arregla reempaquetándolo con AES-256. Es el mismo certificado y la misma clave: solo
cambia el contenedor, y el fingerprint tiene que quedar idéntico.

```bash
openssl pkcs12 -in viejo.p12 -legacy -passin pass:LACONTRASENA -nodes -out tmp.pem
openssl pkcs12 -export -in tmp.pem -out certificado.p12 -passout pass:LACONTRASENA \
  -keypbe AES-256-CBC -certpbe AES-256-CBC -macalg sha256
rm tmp.pem   # contiene la clave privada sin cifrar: borrarlo siempre
```

Verificar después que el fingerprint no cambió y que sigue coincidiendo con el del perfil:

```bash
openssl pkcs12 -in certificado.p12 -nokeys -passin pass:LACONTRASENA | openssl x509 -noout -fingerprint -sha1
```

#### Inspeccionar el perfil

Para inspeccionar un `.mobileprovision` en Windows (App ID, vencimiento, tipo, dispositivos):

```powershell
$c = Get-Content perfil.mobileprovision -Raw
$i = $c.IndexOf('<?xml'); $f = $c.IndexOf('</plist>') + 8
$c.Substring($i, $f - $i)
```

Los campos que importan son `application-identifier`, `ExpirationDate`, `ProvisionedDevices`
y, dentro del bloque DER, `ProfileDistributionType` (`ADHOC` o `STORE`).

`credentials.json`, los `.p12` y los `.mobileprovision` están en `.gitignore` — la
contraseña del certificado va en claro en ese archivo.

## Pasarle la app a otra persona

Cada quien firma con **su propio** certificado. Compartir un `.p12` no sirve y sale caro:
los perfiles ad-hoc solo corren en los UDIDs que tienen adentro, y si un certificado se
comparte de más, Apple lo revoca y dejan de abrir las apps de todos los que lo usaban —
incluidas las de quien lo prestó.

Sobre las cuentas: la app no comparte nada entre personas. Las credenciales de EALU se
guardan en el Keychain del teléfono donde se inició sesión, y una instalación nueva arranca
vacía. Quien reciba la app entra con su propia cédula y ve sus propios datos.

### Vía corta: pasarle el IPA ya compilado

Es lo más simple y no requiere que la otra persona instale nada de desarrollo.

1. Le pasás el `.ipa` que devolvió EAS.
2. Lo abre con **Feather**, AltStore o Sideloadly, usando **su** certificado.
3. Esas herramientas reescriben el bundle identifier al firmar, así que no hay que tocar
   ni configurar nada.

Con Apple ID gratuita funciona, pero la firma caduca a los 7 días y hay que reinstalar. Con
un certificado propio (comprado o de cuenta de pago), dura lo que dure ese certificado.

### Vía larga: que compile desde el código

Sirve si quiere modificar la app o prefiere no recibir un binario armado por otro.

```bash
cp credentials.example.json credentials.json    # sus propias rutas y contraseña
EALU_BUNDLE_ID=el.id.de.su.perfil npx eas-cli build --platform ios --profile firmado-propio
```

`EALU_BUNDLE_ID` evita editar `app.json`. Tiene que coincidir con el `application-identifier`
de su `.mobileprovision` (sin el prefijo del equipo), salvo que su perfil sea wildcard.

### B. Con cuenta de Apple Developer (99 USD/año), vía TestFlight

```bash
npx eas-cli login
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform ios
```

## Preinscripción: el flujo real son dos pasos

Guardar y enviar no son lo mismo. La app replica el comportamiento de la web:

1. **Guardar** → `POST registrar-preinscripciones/{codcarsec}`, form-urlencoded con el campo
   `anhoConvocCodcarsecCodasignTurnoSeccionList`: los `value` de las materias marcadas
   separados por coma. Cada `value` es
   `anho:convocatoria:codcarsec:codasign:turno:seccion:electiva` (ej. `2026:2:PA-2017A:Rc121:M:2:N`)
   y sale de `turnoSeccionList[].value` en `asig-habilitadas`. Reversible.
2. **Cerrar** → `POST cerrar-preinscripcion/{codcarsec}?modoPago=CONTADO|CUOTAS`. Esto es lo
   que la envía de verdad, y es **irreversible**.

Ojo con dos cosas: la lista enviada es el estado completo, así que **desmarcar una materia y
guardar la borra**; y `extraValues.cierreHecho` en la respuesta de `asig-habilitadas` indica
que el período ya se cerró y no admite cambios.

## No usar `solicitud-gratuidad`

`GET solicitud-gratuidad` devuelve las solicitudes de **todos los alumnos**, con cédula,
sexo, estado civil, teléfono, dirección y correo, a cualquier usuario autenticado. No filtra
por el alumno de la sesión.

La app **no debe llamar a ese endpoint**. Para los conceptos con arancel cero del alumno se
usa `arancel0/datatable`, que es lo que hace la web.

Es un problema de la plataforma, no del cliente: conviene reportarlo al CNC-UNA.

## Criterio de diseño: no filtrar lo que manda la API

La app muestra **todas** las secciones de la web aunque la facultad no las use, y no oculta
ni "corrige" registros. Dos razones concretas:

- Los flags como `tieneParciales: false` describen cómo está configurada la facultad, no si
  la materia tiene parciales en la realidad.
- Tras un cambio de malla, la API puede ofrecer materias ya cursadas (una asignatura que se
  dividió en dos). Filtrarlas por heurística correría el riesgo de ocultar algo que sí hace
  falta.

Cuando una sección viene vacía, la app lo dice explícitamente en vez de desaparecer.

Un vacío rara vez es un error de la app. En varias facultades la inscripción a exámenes
finales se hace **presencialmente en cada cátedra** y recién después alguien la carga al
sistema —si la carga—, aunque la facultad tenga `tieneInscexafinal: true`. Los mensajes de
sección vacía lo explican para que el usuario no crea que la app falló.

## Pendiente

- **Inscripción a exámenes finales y parciales**: los endpoints están mapeados
  (`inscexafinal/registrar/`, `inscexaparcial/reg/inscribir/`) pero su contrato no se pudo
  confirmar porque esos períodos estaban cerrados.
- **Comprobantes PDF**: los endpoints `*/comprobante.pdf` necesitan la cookie de sesión, que
  `WKWebView` no comparte con `NSURLSession`. Hay que descargarlos y abrirlos localmente.
- **Notificaciones push**: la API no las ofrece; requeriría sondeo propio.

## Aviso

Cliente no oficial que usa una API no documentada: puede cambiar sin previo aviso. Pensado
para uso personal vía TestFlight, no para distribución pública sin permiso del CNC-UNA.
