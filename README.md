# SCT Kraków — automat opłaty za wjazd

Wypełnia całą ścieżkę na `sct.zdmk.krakow.pl` i **kończy na bramce płatniczej Autopay**,
gdzie sam wybierasz BLIK / kartę / przelew i płacisz.

Co robi automat:

1. `#/payment/lookup` → wpisuje numer rejestracyjny (dwa razy) → DALEJ
2. formularz opłaty → e-mail, tryb **OPŁATA GODZINOWA**, data wjazdu = **teraz + 5 min**,
   okres **„Do końca dnia (5 zł)"** (z weryfikacją — pole potrafi nie przyjąć pierwszego wyboru) → DALEJ
3. podsumowanie → sprawdza, czy kwota to 5 zł, wybiera **SZYBKA PŁATNOŚĆ**,
   zaznacza akceptację regulaminu → **ZAPŁAĆ**
4. stop — dalej Ty

Wymusza polską wersję językową serwisu (`localStorage: CloudCollector-sctClient-i18nextLng`),
żeby etykiety były przewidywalne.

## Pliki

| plik | co to |
|---|---|
| `autofill.js` | cała logika; konfiguracja przez `window.SCT_CFG` |
| `bookmarklet.txt` | ten sam skrypt jako zakładka — działa od ręki, bez kompilacji |
| `android/` | projekt Android Studio: WebView + wstrzyknięcie skryptu |

## Wariant A — bookmarklet (najszybszy, 2 minuty)

Działa w przeglądarkach na Androidzie obsługujących zakładki ze słowem kluczowym
(Firefox, Kiwi, Lemur). W Chrome na Androida `javascript:` z paska adresu jest zablokowane.

1. Skopiuj całą zawartość `bookmarklet.txt`.
2. Firefox → dowolna strona → zakładki → dodaj zakładkę.
3. Adres: wklejona treść. Słowo kluczowe: `sct`.
4. Odtąd wpisujesz `sct` w pasku adresu i zatwierdzasz.

Dane (tablica, e-mail, offset) są zaszyte w pierwszej linijce zakładki — edytujesz je wprost w zakładce.

## Wariant B — aplikacja Android

Na tym Macu nie ma JDK ani Android SDK, więc APK **nie jest zbudowany** — projekt jest gotowy do otwarcia.

1. Zainstaluj Android Studio (dociągnie JDK 17 i SDK 34).
2. `File → Open` → katalog `android/`. Przy pierwszym syncu Studio dogra Gradle wrapper.
3. `Run` na podpiętym telefonie, albo `Build → Build APK(s)`.

Z terminala, gdy masz już JDK 17 + SDK:

```bash
cd /Users/studio/Documents/SCENOPISAPP/sct-auto/android && ./gradlew assembleDebug
```

APK ląduje w `android/app/build/outputs/apk/debug/`.

W apce: pasek statusu na dole pokazuje postęp, **Wypełnij od nowa** restartuje proces,
**Ustawienia** zmieniają tablicę, e-mail, liczbę minut i to, czy apka sama klika ZAPŁAĆ
(wyłącz, jeśli wolisz najpierw obejrzeć podsumowanie).

WebView przepuszcza `intent://` i schematy aplikacji bankowych, więc BLIK i aplikacje banków
otworzą się normalnie na etapie płatności.

## Uwagi

- Zgłoszenie powstaje w systemie ZDMK dopiero po kliknięciu DALEJ na formularzu; nieopłacone po prostu wygasa.
- Skrypt zatrzymuje się i wypisuje ostrzeżenie, jeśli kwota na podsumowaniu ≠ 5 zł.
- Jeśli ZDMK przebuduje formularz, najpewniej pęknie wybór „Okres" — selektory oparte są
  na `name="registrationNumber"`, `name="email"`, `placeholder="DD.MM.RRRR GG:mm"` i tekstach przycisków.
