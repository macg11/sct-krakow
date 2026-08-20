/* SCT Kraków — automat opłaty za wjazd.
 * Przechodzi: tablica -> formularz (mail, data = teraz + N min, "Do końca dnia 5 zł)
 *             -> podsumowanie (szybka płatność, akceptacja regulaminu) -> ZAPŁAĆ.
 * Kończy na bramce płatniczej — wybór banku/BLIK-a i sama płatność należą do Ciebie.
 * Konfiguracja: window.SCT_CFG = {plate, email, offsetMin, price, autoPay}
 */
(function () {
  var CFG        = window.SCT_CFG || {};
  var PLATE      = (CFG.plate || '').toUpperCase().replace(/\s+/g, '');
  var EMAIL      = CFG.email || '';
  var OFFSET_MIN = CFG.offsetMin == null ? 5 : CFG.offsetMin;
  var PRICE      = CFG.price || '5';               // wybór okresu i kontrola kwoty
  var AUTOPAY    = CFG.autoPay !== false;          // czy sam kliknąć ZAPŁAĆ
  var TIMEOUT_MS = 45000;

  if (window.__sctRunning) return;
  window.__sctRunning = true;

  if (!PLATE) { window.__sctRunning = false; return; }

  function log(m) {
    try { console.log('[SCT] ' + m); } catch (e) {}
    try { if (window.SCTBridge) SCTBridge.status(m); } catch (e) {}
  }
  function fail(m) { window.__sctRunning = false; log('⚠ ' + m); say('Automat się zatrzymał. Dokończ ręcznie.'); }

  /* komunikat głosowy — w aucie nie trzeba patrzeć na ekran */
  function say(m) { try { if (window.SCTBridge && SCTBridge.say) SCTBridge.say(m); } catch (e) {} }

  /* wpis do pola kontrolowanego przez Reacta */
  function setValue(el, v) {
    var d = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value');
    el.focus();
    d.set.call(el, v);
    el.dispatchEvent(new Event('input',  { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function waitFor(what, test, cb) {
    var deadline = Date.now() + TIMEOUT_MS;
    var t = setInterval(function () {
      var r; try { r = test(); } catch (e) { r = null; }
      if (r) { clearInterval(t); cb(r); }
      else if (Date.now() > deadline) { clearInterval(t); fail('nie doczekałem się: ' + what); }
    }, 200);
  }

  function btn(re) {
    return [].slice.call(document.querySelectorAll('button'))
             .filter(function (b) { return re.test((b.innerText || '').trim()); })[0];
  }
  function fieldByLabel(re) {
    return [].slice.call(document.querySelectorAll('form .MuiFormControl-root'))
             .filter(function (f) {
               var l = f.querySelector('label');
               return l && re.test(l.innerText);
             })[0];
  }

  function stamp() {
    var d = new Date(Date.now() + OFFSET_MIN * 60000);
    var p = function (n) { return String(n).padStart(2, '0'); };
    return p(d.getDate()) + '.' + p(d.getMonth() + 1) + '.' + d.getFullYear() +
           ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  /* ---------- krok 1: numer rejestracyjny ---------- */
  function step1() {
    waitFor('pola tablicy', function () {
      var i = document.querySelectorAll('input[name^="registrationNumber"]');
      return i.length >= 2 ? i : null;
    }, function (inputs) {
      [].forEach.call(inputs, function (i) { setValue(i, PLATE); });
      log('tablica: ' + PLATE);
      setTimeout(function () {
        var next = document.querySelector('form button[type="submit"]');
        if (!next) return fail('brak przycisku DALEJ w kroku 1');
        next.click();
        step2();
      }, 300);
    });
  }

  /* ---------- krok 2: e-mail, data, okres ---------- */
  function step2() {
    waitFor('formularz opłaty', function () {
      return /enter-payment/.test(location.href) && document.querySelector('input[name="email"]');
    }, function () {
      var email = document.querySelector('input[name="email"]');
      if (EMAIL && email.value !== EMAIL) { setValue(email, EMAIL); log('e-mail: ' + EMAIL); }

      var hourly = btn(/godzinow|hourly/i);
      if (hourly && !/contained/.test(hourly.className)) hourly.click();

      setTimeout(function () {
        var date = document.querySelector('input[placeholder*="RRRR"], input[placeholder*="YYYY"]');
        if (!date) return fail('brak pola daty wjazdu');
        var s = stamp();
        setValue(date, s);
        date.blur();
        log('wjazd: ' + s);
        setTimeout(function () { pickPeriod(1); }, 400);
      }, 300);
    });
  }

  /* Autocomplete "Okres": pierwszy wybór potrafi nie trafić do stanu formularza
     (pole "Liczba dni" pojawia się dopiero po wyborze i resetuje wartość),
     więc sprawdzamy i w razie czego powtarzamy. */
  function pickPeriod(attempt) {
    if (attempt > 4) return fail('nie udało się wybrać okresu');
    var boxes = document.querySelectorAll('input[role="combobox"]');
    var cb = boxes[boxes.length - 1];
    if (!cb) return fail('brak listy "Okres"');

    cb.focus();
    var opener = cb.closest('.MuiFormControl-root').querySelector('.MuiAutocomplete-popupIndicator');
    if (opener) opener.click(); else cb.click();

    waitFor('opcji ' + PRICE + ' zł', function () {
      return [].slice.call(document.querySelectorAll('li[role="option"]'))
               .filter(function (o) { return new RegExp(PRICE + '\\s*z', 'i').test(o.innerText); })[0];
    }, function (opt) {
      var txt = opt.innerText.trim();
      opt.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      opt.click();
      setTimeout(function () {
        var fc = fieldByLabel(/Okres|Period/);
        var ok = fc && fc.querySelector('input').value;
        if (!ok) { log('okres nie przyjęty, ponawiam (' + attempt + ')'); return pickPeriod(attempt + 1); }
        log('okres: ' + txt);
        submitForm(1);
      }, 900);
    });
  }

  function submitForm(attempt) {
    if (attempt > 3) return fail('formularz nie przechodzi walidacji — dokończ ręcznie');
    var next = btn(/^(DALEJ|NEXT)$/i);
    if (!next) return fail('brak przycisku DALEJ');
    next.click();
    setTimeout(function () {
      if (/summary/.test(location.href)) return step3();
      var err = document.querySelector('form .Mui-error, form .MuiFormHelperText-root');
      var msg = err ? err.innerText : '';
      if (/Okres|niezbędne/i.test(msg) || !document.querySelector('form .MuiFormHelperText-root')) {
        log('walidacja odrzuciła formularz, poprawiam…');
        return pickPeriod(attempt + 1);
      }
      fail('błąd formularza: ' + msg);
    }, 2000);
  }

  /* ---------- krok 3: podsumowanie ---------- */
  function step3() {
    waitFor('podsumowania', function () {
      return /summary/.test(location.href) && btn(/^ZAPŁAĆ|^PAY/i);
    }, function () {
      var body = document.body.innerText;
      var kwota = (body.match(/Kwota:\s*([\d.,]+)\s*zł/) || [])[1];
      var od    = (body.match(/Data rozpocz\S+ uprawnienia:\s*\n?\s*(.+)/) || [])[1];
      var doD   = (body.match(/Data ko\S+ uprawnienia:\s*\n?\s*(.+)/) || [])[1];

      if (kwota && parseFloat(kwota.replace(',', '.')) !== parseFloat(PRICE)) {
        return fail('kwota ' + kwota + ' zł ≠ oczekiwane ' + PRICE + ' zł — sprawdź ręcznie');
      }
      log('podsumowanie: ' + PLATE + ', ' + kwota + ' zł, ' + od + ' → ' + doD);

      var fast = btn(/SZYBKA P|FAST/i);
      if (fast && !fast.disabled && !/contained/.test(fast.className)) fast.click();

      setTimeout(function () {
        var box = document.querySelector('input[type="checkbox"]');
        if (!box) return fail('brak zgody na regulamin');
        if (!box.checked) box.click();

        setTimeout(function () {
          if (!AUTOPAY) {
            window.__sctRunning = false;
            say('Formularz gotowy. Zatwierdź płatność.');
            return log('gotowe — kliknij ZAPŁAĆ.');
          }
          var pay = btn(/^ZAPŁAĆ|^PAY/i);
          if (!pay || pay.disabled) return fail('ZAPŁAĆ niedostępny — dokończ ręcznie');
          pay.click();
          window.__sctRunning = false;
          say('Opłata pięć złotych do końca dnia. Wybierz metodę płatności.');
          log('przekazuję do bramki — wybierz bank / BLIK i zapłać.');
        }, 400);
      }, 400);
    });
  }

  /* ---------- start ---------- */
  if (localStorage.getItem('CloudCollector-sctClient-i18nextLng') !== 'pl' &&
      !sessionStorage.getItem('sctLangFix')) {
    localStorage.setItem('CloudCollector-sctClient-i18nextLng', 'pl');
    sessionStorage.setItem('sctLangFix', '1');
    window.__sctRunning = false;
    location.reload();
    return;
  }

  if (/summary/.test(location.href))            { step3(); }
  else if (/enter-payment/.test(location.href)) { step2(); }
  else if (/payment\/lookup/.test(location.href)) { step1(); }
  else { location.hash = '#/payment/lookup'; setTimeout(step1, 1200); }
})();
