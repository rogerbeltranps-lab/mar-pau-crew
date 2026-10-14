# Connectar el full amb l’app

La connexió té dues direccions concretes:

- Els horaris i pagaments de Firebase s’actualitzen a `Registre app` i `Pagaments app`.
- La pestanya original `Información` alimenta la secció privada `Información para Ana` de l’app.

Els pagaments es modifiquen a l’app. Les instruccions d’Ana es modifiquen a `Información`. Les pestanyes noves són una consulta actualitzada i es reescriuen a cada sincronització. Les pestanyes originals `Registro` i `Resumen` conserven el registre inicial; no són una segona font editable dels pagaments nous.

## Activació una sola vegada

1. A Firebase, substitueix les regles de Firestore pel contingut actual de `firestore.rules` i prem Publish. Inclou l’accés privat a `information`.
2. Al teu full de Google Sheets, obre Extensions → Apps Script amb el compte Google propietari del projecte Firebase.
3. En un fitxer de codi, enganxa tot el contingut de `google-sheets-sync.gs`.
4. A Configuració del projecte, activa «Mostra el fitxer de manifest appsscript.json». Torna a l’editor i substitueix el manifest pel contingut de `appsscript.json` d’aquest repositori.
5. Desa. Selecciona `installCrewSync` al desplegable de funcions i prem Executar. Revisa i autoritza els permisos de Google per al teu propi script.
6. Comprova que les dues pestanyes mostren la data de l’última actualització i els imports de Firebase, i que l’app mostra la informació d’Ana.

El script usa l’autorització Google del propietari, no les contrasenyes de l’app ni credencials de servei. El compte que l’autoritza ha de tenir permisos IAM de lectura i escriptura de Firestore al projecte Firebase. Si surt un error 403, revisa que sigui el compte amb què vas crear Firebase i que el manifest tingui tots els permisos indicats. No cal publicar el script com a web ni donar accés públic al full.

S’actualitza cada 30 minuts aproximadament. Per actualitzar al moment: menú Mar & Pau’s Crew → Actualitzar ara. El mateix menú permet aturar l’actualització automàtica.

Si l’app encara no té registres, importa el teu Excel a Gestió: el script no importa `Registro` cap a Firebase. Reimportar també pot incorporar la informació d’Ana sense sobreescriure dies existents.

## Validació

`node tests.mjs` i `node sync-tests.mjs` comproven càlculs, pagaments agrupats, text tractat com a dades, lectura paginada i la informació. L’autorització, els activadors i el primer refresc real s’han de comprovar després de l’activació al compte de Google.

## Email notifications

After publishing the GitHub Pages changes, finish the **one-time private setup** to deliver emails. Merely updating GitHub does **not** deploy Firestore rules or install Apps Script triggers.

1. In Firebase Console → Firestore Database → **Rules**, publish the updated `firestore.rules` from this repository (it permits authenticated users to create private notification events without giving Anna schedule-editing rights).
2. In the Google Sheet linked to the project, open **Extensions → Apps Script**. Replace the script with the latest `google-sheets-sync.gs`, and its manifest with the latest `appsscript.json` (which adds MailApp permission). Save both files.
3. In Apps Script → **Project Settings → Script properties**, enter the following private values:
   - `crewAnnaEmail`: the email address Anna should receive when Roger edits the app.
   - `crewRogerEmail`: the email address Roger should receive when Anna reports unavailability or changes her message.
4. In the Apps Script function selector, run **`setupCrewNotifications`** once and approve the Google permissions. This creates a trigger for **`notifyCrew` every five minutes**, using the Google account authorizing the script as sender. Run **`testCrewNotifications`** to send one test email to each recipient.
5. Edit a shift or message from each account and check both mailboxes, including Spam. If notifications do not arrive, inspect **Apps Script → Executions** for errors and confirm that the Google account authorizing the script has Firestore IAM access.

The first setup begins notifications from the setup time: old edits will not be emailed retroactively. Edits are saved even if email notification is not configured; the app warns when it cannot enqueue an event. Only manual actions produce events; automatically generated schedule days and sheet synchronization do not. To pause emails without affecting synchronization, run `stopCrewNotifications`; re-running `setupCrewNotifications` restores the trigger without resetting the delivery cursor.

Email credentials and addresses belong in private Apps Script properties, **not in GitHub**. Sending uses the current Google Apps Script MailApp quota and does not require a paid mail API.
