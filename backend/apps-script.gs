/**
 * Leonie Coaching — Backend für den Fragebogen (kostenlos, läuft in Google).
 *
 * EINRICHTEN (ca. 5 Minuten):
 *  1. Neues Google Sheet anlegen, z. B. "Coaching-Anfragen".
 *  2. Dort: Erweiterungen → Apps Script. Den vorhandenen Code löschen,
 *     diesen hier komplett hineinkopieren.
 *  3. Oben in EMPFAENGER deine Mailadresse eintragen.
 *  4. Bereitstellen → Neue Bereitstellung → Typ "Web-App"
 *       Ausführen als: Ich
 *       Zugriff: Jeder
 *     → Bereitstellen, Zugriff erlauben, die /exec-URL kopieren.
 *  5. Die URL in assets/js/config.js bei "endpoint" eintragen. Fertig.
 *
 * Danach landet jede Anfrage als Zeile im Sheet und du bekommst eine Mail.
 */

var EMPFAENGER = 'team.ehmig.bodybuilding@gmail.com';
var TABELLE = 'Anfragen';

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(TABELLE) || ss.insertSheet(TABELLE);

    var keys = Object.keys(data);

    // Kopfzeile beim ersten Mal anlegen
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['Eingang'].concat(keys));
      sheet.getRange(1, 1, 1, keys.length + 1)
        .setFontWeight('bold').setBackground('#000000').setFontColor('#ffffff');
      sheet.setFrozenRows(1);
    }

    // Reihenfolge an die vorhandene Kopfzeile anpassen
    var header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var row = header.map(function (h) {
      if (h === 'Eingang') return new Date();
      return data[h] !== undefined ? data[h] : '';
    });
    // Neue, noch unbekannte Felder hinten anhängen
    keys.forEach(function (k) {
      if (header.indexOf(k) === -1) {
        sheet.getRange(1, sheet.getLastColumn() + 1).setValue(k)
          .setFontWeight('bold').setBackground('#000000').setFontColor('#ffffff');
        row.push(data[k]);
      }
    });
    sheet.appendRow(row);

    // Benachrichtigung per Mail
    var name = (data['Vorname'] || '') + ' ' + (data['Nachname'] || '');
    var text = keys.map(function (k) { return k + ':\n' + data[k]; }).join('\n\n');
    MailApp.sendEmail({
      to: EMPFAENGER,
      subject: 'Neue Coaching-Anfrage: ' + name.trim(),
      body: text + '\n\n—\nSheet: ' + ss.getUrl(),
      replyTo: data['E-Mail'] || EMPFAENGER
    });

    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

function doGet() {
  return json({ ok: true, info: 'Leonie Coaching Endpoint aktiv' });
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
