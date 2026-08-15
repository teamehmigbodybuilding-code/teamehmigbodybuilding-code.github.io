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
 *  6. Themen: Der Tab "Themen" (entsteht beim ersten Lauf, mit 12 fertigen Wochen-Impulsen
 *     vorbefüllt) ist die Warteschlange. Jede Woche wird automatisch die oberste Zeile
 *     ohne "Verschickt am"-Datum verschickt. Neue Themen = einfach neue Zeilen anhängen.
 *     Ist die Warteschlange leer, greift der Standardtext im Tab "Wochenmail" (B1/B2).
 *     Steht in "Wochenmail" B3 das Wort PAUSE, wird in der Woche nichts verschickt.
 */

var ABSENDER_NAME = 'Leonie — Online-Coaching';
var WEBSITE = 'https://teamehmigbodybuilding-code.github.io';
var TAB_ABOS = 'Abonnentinnen';
var TAB_MAIL = 'Wochenmail';
var TAB_THEMEN = 'Themen';

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

  // Nächstes unverbrauchtes Thema aus dem "Themen"-Tab, sonst Standardtext
  var thema = nextThema();
  var betreff = thema ? thema.betreff : mail.betreff;
  var intro = thema ? thema.text : mail.intro;

  var sh = abosSheet();
  var rows = sh.getDataRange().getValues();
  var gesendet = 0;

  for (var i = 1; i < rows.length; i++) {
    if (rows[i][1] !== 'bestätigt') continue;
    var email = rows[i][0];
    var token = rows[i][2];
    MailApp.sendEmail({
      to: email,
      subject: betreff,
      htmlBody: mailBody(intro, token),
      name: ABSENDER_NAME
    });
    gesendet++;
  }

  if (gesendet > 0) {
    if (thema) themenTab().getRange(thema.row, 3).setValue(new Date());
    var log = mailTab();
    log.getRange('B4').setValue('Zuletzt verschickt: ' + new Date() + ' an ' + gesendet + ' Adressen' +
      (thema ? ' · Thema: ' + thema.betreff : ' · Standardtext (Themen-Vorrat leer!)'));
  }
}

/* ── Themen-Warteschlange ────────────────────────────────────────── */

function nextThema() {
  var sh = themenTab();
  var rows = sh.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] && !rows[i][2]) {
      return { betreff: String(rows[i][0]), text: String(rows[i][1]), row: i + 1 };
    }
  }
  return null;
}

function themenTab() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(TAB_THEMEN);
  if (!sh) {
    sh = ss.insertSheet(TAB_THEMEN);
    sh.appendRow(['Betreff', 'Text', 'Verschickt am']);
    sh.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground('#000000').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    sh.setColumnWidth(1, 320);
    sh.setColumnWidth(2, 700);
    var seeds = [
      ['Du trainierst hart und trotzdem passiert nichts?',
       'dann fehlt dir mit hoher Wahrscheinlichkeit kein Fleiß, sondern Struktur. Fortschritt entsteht, wenn Training, Essen und Erholung zusammenpassen und du von Woche zu Woche ein bisschen mehr leistest als davor. Genau das steht in keinem fertigen Plan aus dem Internet, weil es von deinem Alltag abhängt. Frag dich diese Woche ehrlich: Weißt du, was du letzte Woche im Training geschafft hast? Wenn nein, fang an, es aufzuschreiben.'],
      ['Warum ein kleines Defizit dich weiter bringt',
       'große Kalorienschnitte fühlen sich nach Fortschritt an, aber sie haben einen Preis: Deine Regeneration leidet, dein Training wird schlechter und du hältst es nicht durch. Ein moderates Defizit, das du über Monate fahren kannst, schlägt jedes aggressive, das nach drei Wochen kippt. Abnehmen ist ein Marathon mit Etappen, kein Sprint.'],
      ['Schlaf ist dein unterschätztestes Werkzeug',
       'viele optimieren Supplemente und ignorieren die Basics: Der Schlaf wird geopfert, weil die Serie spannender ist, und dann wundert man sich über fehlenden Fortschritt. Muskeln wachsen in der Erholung, nicht im Training. Wenn du diese Woche nur eine Sache änderst, dann die: eine feste Zeit, zu der das Handy weggelegt wird.'],
      ['Nach der Diät ist vor der Form',
       'das Ziel nach einer Diät ist nicht, so schnell wie möglich alles nachzuholen. Iss auf deinen Erhaltungskalorien, überwiegend aus richtigen Lebensmitteln, und gönn dir bewusst den einen oder anderen Genussmoment. So hältst du dein Ergebnis, statt es in vier Wochen wieder herzugeben. Wer clever isst, muss weder hungern noch stopfen.'],
      ['Refeeds: Pause mit Plan statt Cheat-Chaos',
       'ein Refeed ist keine Belohnung und kein Kontrollverlust, sondern ein geplanter Tag mit mehr Kohlenhydraten, der Kopf und Training entlastet. Der Unterschied zum Cheat Day: Du entscheidest vorher, was und wie viel. Wenn deine Diät nur noch mit Willenskraft läuft, ist das ein Signal, die Pause zu planen, bevor sie sich selbst nimmt.'],
      ['Cardio ist ein Werkzeug, keine Strafe',
       'Cardio ist nicht dazu da, Essen "abzuarbeiten". Es ist ein Regler für deinen Kalorienverbrauch, den man gezielt und dosiert einsetzt, damit das Krafttraining die Hauptrolle behalten kann. Wer jede Diät mit stundenlangem Cardio beginnt, hat später keinen Spielraum mehr, wenn der Fortschritt stockt. Klein anfangen, Luft nach oben lassen.'],
      ['Ohne Daten rate ich nur',
       'Gewicht, Fotos, Kraftwerte: Das sind keine Zahlen für Perfektionistinnen, das ist die Grundlage für jede gute Entscheidung. Ein einzelner Tag sagt fast nichts, der Verlauf über Wochen sagt fast alles. Du musst nicht ewig tracken. Aber in Phasen, in denen du etwas verändern willst, ist Messen der Unterschied zwischen Anpassen und Raten.'],
      ['Weniger Sätze, näher ans Limit',
       'zwanzig halbherzige Sätze machen dich müde, aber nicht stärker. Wenige, saubere Arbeitssätze nah am Muskelversagen setzen den Reiz, für den dein Körper Muskeln aufbaut. Wenn du nach deinem Training noch problemlos zwei weitere Stunden trainieren könntest, war es wahrscheinlich zu viel Beschäftigung und zu wenig Reiz.'],
      ['Die Waage lügt (kurzfristig)',
       'Wassereinlagerungen durch Zyklus, Salz, Stress oder ein hartes Training können das Tagesgewicht deutlich verschieben, ohne dass sich an deinem Körperfett irgendetwas geändert hat. Deshalb gilt: Wochendurchschnitt statt Tageswert, Verlauf statt Momentaufnahme. Ein schwerer Morgen ist kein Rückschritt, er ist Rauschen.'],
      ['Protein konstant, Rest flexibel',
       'die einfachste Ernährungsstruktur, die funktioniert: Protein und Fette bleiben weitgehend konstant, über die Kohlenhydrate wird gesteuert. Das macht Planung leicht, hält dich satt und gibt dir trotzdem Spielraum für echtes Essen mit Familie und Freundinnen. Ernährung muss in dein Leben passen, nicht umgekehrt.'],
      ['Motivation ist wetterfühlig, Routine nicht',
       'es wird Wochen geben, in denen die Motivation ganz unten ist. Das ist kein Zeichen, dass etwas falsch läuft, das ist normal. Der Unterschied zwischen denen, die ihre Form erreichen, und denen, die immer wieder von vorn anfangen: Erstere haben Routinen, die auch in schlechten Wochen funktionieren. Plane für dein schlechtestes Ich, nicht für dein bestes.'],
      ['Mehr ist selten die Antwort',
       'wenn der Fortschritt stockt, ist der Reflex fast immer: mehr Training, weniger Essen, mehr Cardio. Meistens ist das Gegenteil richtig, nämlich erst prüfen, ob Schlaf, Technik und Progression überhaupt stimmen. Ein Plan, der auf dem Papier härter aussieht, ist nicht automatisch der, der dich weiterbringt. Erst sauber, dann mehr.']
    ];
    for (var i = 0; i < seeds.length; i++) sh.appendRow([seeds[i][0], seeds[i][1], '']);
  }
  return sh;
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
