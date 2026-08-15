/**
 * Leonie Coaching — Newsletter-Backend (kostenlos, läuft in Google).
 *
 * Was es macht:
 *  - Nimmt Anmeldungen von der Website entgegen (rechtssicher per Double-Opt-in)
 *  - Verschickt einmal pro Woche automatisch die Coaching-Mail an alle Bestätigten
 *  - Abmelde-Link in jeder Mail, Abmeldung mit einem Klick
 *
 * EINRICHTEN (ca. 10 Minuten):
 *  1. Neues Google Sheet anlegen, z. B. "Newsletter Leonie".
 *  2. Erweiterungen → Apps Script → diesen Code komplett einfügen, speichern.
 *  3. Bereitstellen → Neue Bereitstellung → Typ "Web-App"
 *       Ausführen als: Ich · Zugriff: Jeder
 *     → Bereitstellen, Zugriff erlauben, die /exec-URL kopieren.
 *  4. Die URL in assets/js/config.js bei "newsletterEndpoint" eintragen.
 *  5. Wochenversand aktivieren: links das Uhr-Symbol (Trigger) → "Trigger hinzufügen" →
 *       Funktion: weeklySend · Bereitstellung: Head · Ereignisquelle: Zeitgesteuert ·
 *       Typ: Wochen-Timer · z. B. jeden Montag 8–9 Uhr → Speichern.
 *  6. Mail-Text ändern: Im Sheet gibt es (nach dem ersten Lauf) den Tab "Wochenmail".
 *     Dort stehen Betreff (B1) und Intro-Text (B2) — beides frei änderbar.
 *     Steht in B3 das Wort PAUSE, wird in der Woche nichts verschickt.
 */

var ABSENDER_NAME = 'Leonie — Online-Coaching';
var WEBSITE = 'https://teamehmigbodybuilding-code.github.io';
var TAB_ABOS = 'Abonnentinnen';
var TAB_MAIL = 'Wochenmail';

/* ── Anmeldung von der Website ───────────────────────────────────── */

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    if (data.action !== 'subscribe') return json({ ok: false, error: 'Unbekannte Aktion' });

    var email = String(data['E-Mail'] || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return json({ ok: false, error: 'Ungültige E-Mail-Adresse' });
    }

    var sh = abosSheet();
    var rows = sh.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      if (rows[i][0] === email) {
        if (rows[i][1] === 'bestätigt') return json({ ok: true, info: 'schon angemeldet' });
        sendConfirmMail(email, rows[i][2]); // offen oder abgemeldet: erneut einladen
        return json({ ok: true });
      }
    }

    var token = Utilities.getUuid();
    sh.appendRow([email, 'offen', token, new Date(), '', '']);
    sendConfirmMail(email, token);
    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

/* ── Bestätigen & Abmelden (Links in den Mails) ──────────────────── */

function doGet(e) {
  var action = e && e.parameter ? e.parameter.action : '';
  var token = e && e.parameter ? e.parameter.token : '';

  if (action === 'confirm' && token) {
    if (setStatusByToken(token, 'bestätigt', 4)) {
      return htmlPage('Angemeldet!',
        'Deine Anmeldung ist bestätigt. Ab jetzt bekommst du einmal pro Woche Post von mir. ' +
        'Abmelden kannst du dich jederzeit mit einem Klick in jeder Mail.');
    }
    return htmlPage('Link ungültig', 'Dieser Bestätigungs-Link ist nicht (mehr) gültig. Trag dich einfach neu ein.');
  }

  if (action === 'unsubscribe' && token) {
    if (setStatusByToken(token, 'abgemeldet', 5)) {
      return htmlPage('Abgemeldet', 'Du bekommst keine weiteren Mails von mir. Danke, dass du dabei warst.');
    }
    return htmlPage('Link ungültig', 'Dieser Abmelde-Link ist nicht (mehr) gültig.');
  }

  return json({ ok: true, info: 'Leonie Newsletter Endpoint aktiv' });
}

/* ── Wöchentlicher Versand (per Zeit-Trigger) ────────────────────── */

function weeklySend() {
  var mail = mailConfig();
  if (String(mail.pause).toUpperCase().indexOf('PAUSE') !== -1) return;

  var sh = abosSheet();
  var rows = sh.getDataRange().getValues();
  var gesendet = 0;

  for (var i = 1; i < rows.length; i++) {
    if (rows[i][1] !== 'bestätigt') continue;
    var email = rows[i][0];
    var token = rows[i][2];
    MailApp.sendEmail({
      to: email,
      subject: mail.betreff,
      htmlBody: mailBody(mail.intro, token),
      name: ABSENDER_NAME
    });
    gesendet++;
  }

  if (gesendet > 0) {
    var log = mailTab();
    log.getRange('B4').setValue('Zuletzt verschickt: ' + new Date() + ' an ' + gesendet + ' Adressen');
  }
}

/* ── Mail-Inhalte ────────────────────────────────────────────────── */

function sendConfirmMail(email, token) {
  var url = ScriptApp.getService().getUrl() + '?action=confirm&token=' + token;
  MailApp.sendEmail({
    to: email,
    subject: 'Bitte bestätige deine Anmeldung',
    htmlBody:
      '<p>Hey!</p>' +
      '<p>Du (oder jemand mit deiner Adresse) hast dich auf ' + WEBSITE + ' für meinen wöchentlichen ' +
      'Coaching-Newsletter eingetragen. Ein Klick, und du bist dabei:</p>' +
      '<p><a href="' + url + '" style="display:inline-block;padding:12px 22px;background:#141312;color:#ffffff;text-decoration:none;font-weight:bold">Anmeldung bestätigen</a></p>' +
      '<p>Wenn du das nicht warst, ignoriere diese Mail einfach. Dann passiert nichts.</p>' +
      mailFooter(null),
    name: ABSENDER_NAME
  });
}

function mailBody(intro, token) {
  var unsub = ScriptApp.getService().getUrl() + '?action=unsubscribe&token=' + token;
  return (
    '<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#141312;max-width:560px">' +
    '<p>Hey!</p>' +
    '<p>' + intro.replace(/\n/g, '<br>') + '</p>' +
    '<hr style="border:none;border-top:1px solid #ddd;margin:24px 0">' +
    '<p style="font-weight:bold">So können wir zusammenarbeiten:</p>' +
    '<ul>' +
    '<li><b>1:1 Online-Coaching</b> — Training + Ernährung, wöchentlicher Check-in, WhatsApp-Draht · 149&nbsp;€/Monat</li>' +
    '<li><b>Wettkampf-Prep</b> — Bikini &amp; Wellness, bis auf die Bühne · 249&nbsp;€/Monat</li>' +
    '<li><b>Starterinnen-Coaching</b> — Technik, Routine, Ernährung ohne Verbotsliste · 129&nbsp;€/Monat</li>' +
    '<li><b>Einmaliger Plan</b> — Training oder Ernährung · 89&nbsp;€</li>' +
    '</ul>' +
    '<p><a href="' + WEBSITE + '/fragebogen.html" style="display:inline-block;padding:12px 22px;background:#141312;color:#ffffff;text-decoration:none;font-weight:bold">Jetzt Platz anfragen →</a></p>' +
    mailFooter(unsub) +
    '</div>'
  );
}

function mailFooter(unsubUrl) {
  return (
    '<p style="margin-top:32px;font-size:12px;color:#888">' +
    'Team Ehmig Bodybuilding · Nicolas Ehmig · Lindenstraße 17 · 21521 Aumühle · Deutschland<br>' +
    '<a href="' + WEBSITE + '/impressum.html" style="color:#888">Impressum</a> · ' +
    '<a href="' + WEBSITE + '/datenschutz.html" style="color:#888">Datenschutz</a>' +
    (unsubUrl ? ' · <a href="' + unsubUrl + '" style="color:#888">Newsletter abbestellen</a>' : '') +
    '</p>'
  );
}

/* ── Hilfsfunktionen ─────────────────────────────────────────────── */

function abosSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(TAB_ABOS);
  if (!sh) {
    sh = ss.insertSheet(TAB_ABOS);
    sh.appendRow(['E-Mail', 'Status', 'Token', 'Angemeldet', 'Bestätigt', 'Abgemeldet']);
    sh.getRange(1, 1, 1, 6).setFontWeight('bold').setBackground('#000000').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  }
  return sh;
}

function mailTab() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(TAB_MAIL);
  if (!sh) {
    sh = ss.insertSheet(TAB_MAIL);
    sh.getRange('A1').setValue('Betreff');
    sh.getRange('B1').setValue('Dein wöchentlicher Impuls von Leonie');
    sh.getRange('A2').setValue('Intro-Text (frei änderbar, gern jede Woche neu)');
    sh.getRange('B2').setValue(
      'kurzer Reminder von mir: Form entsteht nicht in den perfekten Wochen, sondern in denen, ' +
      'in denen du trotzdem trainierst. Wenn du dabei Unterstützung willst, findest du unten alle Wege, ' +
      'wie wir zusammenarbeiten können.');
    sh.getRange('A3').setValue('PAUSE hier eintragen = kein Versand');
    sh.getRange('A1:A4').setFontWeight('bold');
    sh.setColumnWidth(2, 600);
  }
  return sh;
}

function mailConfig() {
  var sh = mailTab();
  return {
    betreff: String(sh.getRange('B1').getValue() || 'Dein wöchentlicher Impuls von Leonie'),
    intro: String(sh.getRange('B2').getValue() || 'Hier ist dein wöchentlicher Impuls.'),
    pause: String(sh.getRange('B3').getValue() || '')
  };
}

function setStatusByToken(token, status, dateCol) {
  var sh = abosSheet();
  var rows = sh.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][2] === token) {
      sh.getRange(i + 1, 2).setValue(status);
      sh.getRange(i + 1, dateCol + 1).setValue(new Date());
      return true;
    }
  }
  return false;
}

function htmlPage(titel, text) {
  return HtmlService.createHtmlOutput(
    '<!DOCTYPE html><html lang="de"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1"><title>' + titel + '</title></head>' +
    '<body style="font-family:Arial,sans-serif;background:#f7f4ef;color:#141312;display:flex;min-height:90vh;align-items:center;justify-content:center">' +
    '<div style="max-width:420px;padding:32px;text-align:center">' +
    '<h1 style="font-size:26px">' + titel + '</h1><p style="line-height:1.6">' + text + '</p>' +
    '<p><a href="' + WEBSITE + '" style="color:#141312;font-weight:bold">Zurück zur Website →</a></p>' +
    '</div></body></html>');
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
