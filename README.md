# Mar & Pau’s Crew

Agenda compartida per a Roger i l’Ana: calendari, horaris de matí i tarda, disponibilitat,  notes i pagaments. Dissenyada per al mòbil. El codi és públic; les dades familiars es guarden a Firestore amb accés autenticat.

## Activació inicial

1. A GitHub, obre **Settings → Pages**. A **Build and deployment**, selecciona **Deploy from a branch**, **main** i **/(root)**. Desa. GitHub mostrarà l’enllaç quan la publicació acabi.
2. Obre [Firebase Console](https://console.firebase.google.com/). Crea un projecte i registra una aplicació **Web**. No cal activar Analytics. Copia la configuració `firebaseConfig`.
3. A **Authentication → Sign-in method**, activa **Email/Password**. A **Users**, crea dos comptes amb contrasenyes diferents: Roger i Ana. Les contrasenyes no es guarden al repositori. Copia el **UID** de cadascun. Es poden canviar amb el botó de recuperació de contrasenya.
4. A **Firestore Database**, crea la base de dades en mode producció (una ubicació europea). A **Rules**, copia íntegrament `firestore.rules` i publica les regles. No utilitzis regles obertes de prova.
5. A **Data**, crea la col·lecció `members`. Crea un document amb ID igual al UID de Roger i un camp de tipus string `role` amb valor `owner`. Crea un altre document amb ID igual al UID de l’Ana i `role` amb valor `anna`. Només aquests membres tindran accés; des de l’app no es poden donar permisos.
6. A **Authentication → Settings → Authorized domains**, afegeix el domini que GitHub mostri per a la web.
7. Per configurar-ho per a tots els dispositius, substitueix `null` a `firebase-config.js` per l’objecte de configuració web de Firebase (amb camps `apiKey`, `authDomain`, `projectId`, `appId`, etc.). Aquesta configuració identifica l’app; els permisos els imposen Authentication i les regles. No publiquis credencials de servei ni contrasenyes. Com a alternativa, enganxa la configuració en format JSON a la pantalla inicial de cada dispositiu.
8. Entra com a Roger, ves a **Gestió** i selecciona l’Excel original `Control_canguro_curso_2026-2027.xlsx`. Revisa el resum i prem **Incorporar dies nous**. En el fitxer adjunt s’esperen 12 dies amb assistència, 19,25 hores i 192,50 € pagats. La importació manté les marques Sí/No, horaris, pagaments, dates, notes i valors originals dins de `source`. Cap dia existent es sobreescriu: si s’interromp, torna a importar per incorporar només els dies que faltin.

## Ús

- Toca un dia per ajustar l’entrada i la sortida o indicar que no cal venir. Els imports es recalculen amb aquestes hores. La icona 💶 al calendari indica que l’import del dia està completament pagat; si l’horari canvia i queda saldo pendent, desapareix. Per canviar a entrada més tard, canvia l’hora d’entrada.
- Els comptes de gestió poden editar la planificació, la tarifa, les notes de Roger i els horaris registrats. L’Ana pot confirmar disponibilitat, avisar que no pot venir i escriure el seu missatge. Els permisos s’apliquen a la base de dades, no només als botons.
- Confirmar que vindrà és opcional i no genera cap import. Només els horaris registrats marcada Sí genera hores a cobrar.
- Els pagaments es registren per dia, amb import i data; s’accepten pagaments parcials. El registre importat conserva els imports distribuïts per dia del full, encara que el pagament original fos conjunt. A Comptes, el formulari «Pagament dels divendres» permet registrar un pagament conjunt d’un període. Proposa la setmana de l’últim divendres i permet canviar les dates. Distribueix l’import entre els dies pendents, començant pel més antic, en una única transacció. La llista de pagaments els agrupa per operació; els importats s’agrupen per data original.
- El saldo és hores realitzades × tarifa menys pagaments. Si es corregeix després una assistència o tarifa i apareix un saldo negatiu, indica diners pagats de més; es mostra sense amagar-lo.
- Cada canvi confirmat es comparteix amb la resta de sessions obertes. Cal connexió per desar. Tancar el formulari sense desar descarta els canvis del formulari. No hi ha avisos push ni missatges automàtics.
- A **Gestió**, descarrega una còpia privada JSON. No pugis l’Excel ni la còpia JSON al repositori públic.
- Pots afegir l’enllaç a la pantalla d’inici del mòbil des del navegador.

## Comprovacions

Executa `node tests.mjs`. Les proves cobreixen conversió de dates Excel, torns separats, càlcul d’hores, pagaments parcials i preservació de les dades d’importació. El lector d’Excel utilitza XML i fflate 0.8.2, carregat des de jsDelivr; Firebase SDK web 12.19.0 es carrega des de gstatic. No cal cap compilació.

Abans de considerar-la activa, comprova amb els dos comptes que l’Ana veu un canvi de Roger, que pot confirmar disponibilitat i que no pot modificar pagaments. La connexió real i les regles requereixen el projecte Firebase configurat.

## Informació per a Ana i full compartit

La secció privada Info Ana incorpora les cinc seccions de la pestanya Información en importar l’Excel. Requereix publicar les regles actualitzades de `firestore.rules`. Per actualitzar automàticament els pagaments de l’app al full Google Sheets i les instruccions del full a l’app, segueix [SYNC.md](SYNC.md). La connexió queda pendent d’instal·lar i autoritzar el script al teu compte.

### Dies previstos per defecte

En entrar amb un compte de gestió i rebre les dades del servidor, l’app incorpora els dies laborables que falten des d’avui fins al 22 de juny de 2027. No modifica els dies existents i no genera registres històrics. Els horaris nous són compartits amb Ana i s’inclouen en la sincronització amb Google Sheets. Marca «No cal venir» per cancel·lar qualsevol torn, inclosos festius o vacances no registrats.

Els dies automàtics porten una marca interna `automatic`. Quan la família els edita, deixa de ser un horari automàtic. En importar l’Excel, només es poden substituir dies automàtics intactes; es conserven els modificats, els pagaments, les respostes i els missatges d’Ana.
