# LichtOrgel

![LichtOrgel – psychedelisches Regenbogen-Mandala mit funkelnden Diamanten und dem Schriftzug „Lucy in the Sky with Diamonds“](og-image.jpg)

Eine Lichtorgel im Browser: Audio von Mikrofon oder Computer wird in zehn Frequenzbänder zerlegt und in Echtzeit als Animation dargestellt. Die gesamte Anwendung ist eine einzelne Datei (`index.html`) ohne Abhängigkeiten und ohne Build-Schritt.

**Live:** https://helmutqualtinger.github.io/LichtOrgel/

## Starten

Browser erlauben Audiozugriff nur in einem sicheren Kontext (HTTPS oder `localhost`). Lokal genügt ein einfacher Webserver:

```sh
python3 -m http.server 8000
```

Danach `http://localhost:8000` öffnen, eine Quelle wählen und **Start** drücken.

## Bedienung

Alle Einstellungen befinden sich in der Kopfleiste und werden im Browser gespeichert.

| Element | Funktion |
|---|---|
| **Quelle** | Standard-Mikrofon, ein bestimmtes Eingabegerät oder Computer-Ton |
| **Start / Stopp** | Audio ein- und ausschalten |
| **Auto** | Geht automatisch der Reihe nach durch Effekte und Farbthemen |
| **Animation** | Effekt wählen (Wechsel mit Überblendung) |
| **Thema** | Farbthema wählen (fließender Übergang) |

Rechts zeigt die Leiste das aktive Grafik-Backend und die Bildrate.

### Audioquellen

- **Mikrofon** – Echounterdrückung, Rauschunterdrückung und automatische Verstärkung sind abgeschaltet, damit die Anzeige ohne Verzögerung und mit vollen Pegelspitzen reagiert.
- **Eingabegerät** – jedes erkannte Audio-Eingabegerät. Die Namen erscheinen nach der ersten Mikrofonfreigabe. Ein Loopback-Gerät wie [BlackHole](https://github.com/ExistentialAudio/BlackHole) leitet den Computer-Ton in jedem Browser als Eingang weiter.
- **Computer-Ton** – über die Bildschirm- bzw. Tab-Freigabe; im Dialog **„Audio teilen“** aktivieren. Nur Chrome und Edge; Systemton auf macOS erst in neueren Versionen, Tab-Ton immer. Das Signal wird um 20 dB abgesenkt, da es deutlich lauter ist als ein Mikrofon.

Trennt sich ein Mikrofon (Gerätewechsel, Bluetooth, Ruhezustand), verbindet die Seite automatisch neu und weicht bei Bedarf auf das Standard-Mikrofon aus.

## Effekte

14 Effekte; die mit **GPU** markierten werden als Shader auf der Grafikkarte gerendert.

| Effekt | Darstellung |
|---|---|
| Kreis (GPU) | Radiale Speichen, Bass oben, Höhen unten; der Kern pulsiert mit dem Bass |
| Welle | Drei überlagerte Wellen für Bass, Mitten und Höhen mit Nachleuchten |
| Oszilloskop | Wellenform des Signals, getriggert und automatisch skaliert |
| Tunnel (GPU) | Flug durch einen Tunnel; Ringe und Tempo folgen Spektrum und Bass |
| Partikel | 320 Partikel in einem Strömungsfeld, je eines Frequenzbands |
| Wasserfall | Laufendes Spektrogramm in voller Frequenzauflösung |
| Skyline | 48 Balken mit Spiegelung und fallenden Spitzenwerten |
| Blüte | Drei rotierende Rosenkurven für Bass, Mitten und Höhen |
| Sternflug | Warp-Sternenfeld; Tempo nach Lautstärke, Schub bei Bass-Schlägen |
| Galaxie (GPU) | Spiralgalaxie; Bass im Kern, Höhen in den äußeren Armen |
| Kaleidoskop (GPU) | Zehnfach gespiegelt und siebenfach gefaltet, jede Faltung an ein Band gekoppelt |
| Plasma (GPU) | Interferenzmuster; Frequenzen und Tempo aus dem Spektrum |
| Terrain | 3D-Gitterlandschaft aus dem Spektrumsverlauf mit Sonne am Horizont |
| Blitze | Blitzeinschläge bei Bass-Schlägen und Spitzen in den Höhen |

Farbthemen: **Neon**, **Glut**, **Ozean**, **Aurora**, **Mono**.

Bei jedem Bass-Schlag hellt sich das Bild kurz auf.

## Auto-Modus

Im Auto-Modus wechselt der Effekt alle 20 Sekunden zum nächsten in Menüreihenfolge, jeweils auf dem nächsten Bass-Schlag. Für 2,5 Sekunden laufen alter und neuer Effekt gleichzeitig und werden überblendet. Das Farbthema wechselt alle 12 Sekunden mit einer Überblendung von 4 Sekunden. Der Auto-Modus läuft nur bei aktivem Audio.

## Grafik-Backends

Die Seite wählt automatisch: **WebGPU** → **WebGL2** → **Canvas 2D**. Startet WebGPU nicht innerhalb von 4 Sekunden, wird WebGL2 verwendet. Ohne GPU-Unterstützung laufen alle Effekte als Canvas-2D-Varianten.

Zum Testen lässt sich ein Backend per URL-Parameter erzwingen:

```
index.html?gpu=webgpu
index.html?gpu=webgl
index.html?gpu=off
```

## Datenschutz

Das Audiosignal wird ausschließlich lokal im Browser verarbeitet. Es werden keine Daten übertragen oder gespeichert, außer den Einstellungen im `localStorage` des Browsers.

## Dateien

| Datei | Inhalt |
|---|---|
| `index.html` | Die komplette Anwendung (HTML, CSS, JavaScript, Shader) |
| `og-image.jpg` | Vorschaubild für soziale Medien (1200 × 630) |
| `CLAUDE.md` | Architekturhinweise für die Weiterentwicklung |
