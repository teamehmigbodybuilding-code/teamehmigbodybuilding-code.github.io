/* Leonie Coaching — zentrale Einstellungen
   Hier stehen alle Werte, die du später anpassen willst. Sonst nichts ändern. */
window.LEONIE_CONFIG = {

  /* Google-Apps-Script-Web-App-URL (schreibt jede Anfrage in dein Google Sheet
     und schickt dir eine Mail). Anleitung: backend/apps-script.gs
     Solange hier "" steht, öffnet der Fragebogen beim Absenden dein Mailprogramm. */
  endpoint: 'https://script.google.com/macros/s/AKfycbwxRFpzIt21vuYQldbIFGMjlA-A18dGmVDRAuxGfQNJeftcmzpzokLZMgHv_GYzBGYo/exec',

  /* Fallback-Adresse: Hier landen die Anfragen, solange kein Endpoint gesetzt ist. */
  email: 'team.ehmig.bodybuilding@gmail.com',

  /* Speicherschlüssel für den Zwischenstand im Browser */
  storageKey: 'leonie-coaching-fragebogen'
};
