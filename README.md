# SCT Kraków — automat opłaty za wjazd

Nieoficjalna aplikacja na Androida, która opłaca wjazd do Strefy Czystego Transportu
w Krakowie **jednym dotknięciem**. Dane wpisujesz raz, przy pierwszym uruchomieniu.

> Projekt niezależny — nie jest powiązany z ZDMK ani Urzędem Miasta Krakowa.
> Sam automat niczego nie płaci: kończy na bramce płatniczej, gdzie metodę
> płatności wybierasz Ty.

## Co robi

Po dotknięciu ikony aplikacja otwiera `sct.zdmk.krakow.pl` w osadzonej przeglądarce i:

1. wpisuje numer rejestracyjny → **DALEJ**
2. uzupełnia e-mail, wybiera **opłatę godzinową**, ustawia datę wjazdu na **teraz + N minut**
   i okres **„Do końca dnia (5 zł)"** → **DALEJ**
3. sprawdza, czy kwota to 5 zł, zaznacza **szybką płatność** i akceptację regulaminu → **ZAPŁAĆ**
4. zatrzymuje się na bramce Autopay — wybierasz BLIK, kartę albo przelew i płacisz

Jeśli ZDMK zgłosi, że na wybrany okres istnieje już płatność, automat **zatrzymuje się
i ostrzega** zamiast klikać „TAK, ZAPŁAĆ MIMO TO" — decyzja o drugiej opłacie za ten sam
wjazd należy do kierowcy.

Na koniec czyta komunikat na głos („wybierz metodę płatności"), więc nie trzeba patrzeć na ekran.

**Ważne:** w domyślnych ustawieniach aplikacja zaznacza za Ciebie akceptację regulaminu
płatności ZDMK i klika ZAPŁAĆ. Regulamin warto przeczytać samodzielnie; automatyczne
zatwierdzanie wyłączysz w ustawieniach (opcja „sam klikaj ZAPŁAĆ").

## Instalacja

Pobierz `sct-krakow.apk` z [Releases](../../releases/tag/apk) i zainstaluj —
Android poprosi o zgodę na instalację z nieznanego źródła.

Przy pierwszym starcie podajesz numer rejestracyjny, e-mail, liczbę minut do wjazdu
oraz to, czy aplikacja ma sama zatwierdzać płatność i czytać komunikaty. Później zmienisz
to przytrzymując pasek statusu na dole ekranu.

Aplikacja nie wysyła danych nigdzie poza serwis ZDMK — numer rejestracyjny i e-mail
zostają w pamięci telefonu.

## Wariant bez instalacji: bookmarklet

```bash
node make-bookmarklet.js KR12345 adres@example.com 5 > bookmarklet.txt
```

Treść pliku zapisz jako adres zakładki w Firefoksie na Androidzie i nadaj jej słowo
kluczowe, np. `sct`. Wpisanie `sct` w pasku adresu uruchamia ten sam automat.
W Chromie na Androida to nie zadziała — `javascript:` z paska adresu jest tam zablokowane.

## Budowanie

APK powstaje w GitHub Actions (`.github/workflows/build-apk.yml`) i trafia do release’u `apk`.
Lokalnie, z JDK 17 i Android SDK:

```bash
cd android && ./gradlew assembleDebug
```

## Jak to działa w środku

Dwie rzeczy w serwisie ZDMK wymagają obejścia i warto o nich wiedzieć przed grzebaniem w kodzie:

- **Data wjazdu na ekranie dotykowym.** MUI renderuje wtedy mobilną wersję pickera, w której
  pole jest `readonly` i wpis tekstowy nie działa. Automat otwiera okno pickera, przełącza je
  na wpisywanie tekstem (przycisk `aria-label` zawierający „text input"), wpisuje datę
  i zatwierdza. Na desktopie pole przyjmuje wartość wprost.
- **Lista „Okres".** Pierwszy wybór potrafi nie trafić do stanu formularza, bo pole „Liczba dni"
  pojawia się dopiero po wyborze. Skrypt sprawdza wartość i w razie potrzeby powtarza.

## Gdy przestanie działać

Automat opiera się na strukturze formularza ZDMK: `name="registrationNumber"`, `name="email"`,
`placeholder="DD.MM.RRRR GG:mm"` oraz tekstach przycisków. Po przebudowie serwisu najpewniej
pęknie wybór pola „Okres" albo obsługa pickera daty — cała logika siedzi w [`autofill.js`](autofill.js).

Aplikacja wymusza polską wersję językową serwisu
(`localStorage['CloudCollector-sctClient-i18nextLng'] = 'pl'`), żeby etykiety były przewidywalne.

## Licencja

MIT
