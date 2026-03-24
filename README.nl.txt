Tuya Direct — lokale LAN-besturing voor compatibele Tuya-apparaten op Homey Pro.

Verbind apparaten rechtstreeks via je lokale netwerk met hun apparaat-ID, lokale sleutel en datapunten voor snellere statusupdates en cloudloze besturing.

Functies:
- 5 apparaatdrivers: Stopcontact, Lamp, Ventilator, Klimaat, Luchtreiniger
- Stopcontact: aan/uit, vermogen (W), energie (kWh), stroom (A), spanning (V)
- Lamp: aan/uit, helderheid, kleurtemperatuur, tint, verzadiging, lichtmodus
- Ventilator: aan/uit, snelheidsregeling
- Klimaat: aan/uit, doeltemperatuur, gemeten temperatuur
- Luchtreiniger: aan/uit, modus, ventilatorsnelheid, PM2.5, luchtkwaliteit, filterlevensduur, kinderslot, ionisator
- Persistente TCP-verbinding met heartbeat en automatische herverbinding
- Fallback-polling wanneer push-updates onbetrouwbaar zijn
- Protocolondersteuning: 3.1, 3.2, 3.3, 3.4, 3.5
- Aangepaste koppelingsstroom met verbindingsvalidatie en datapuntdetectie
- Reparatiestroom voor het bijwerken van host, lokale sleutel of protocolversie
- 3 flow-triggerkaarten: apparaat verbonden, apparaat losgekoppeld, datapunt gewijzigd
- 2 flow-conditiekaarten met inversieondersteuning: apparaat is/is niet verbonden, datapuntwaarde is/is niet gelijk aan
- 2 flow-actiekaarten: datapuntwaarde instellen, apparaatstatus verversen
- Geavanceerde DP-level flow-kaarten voor directe datapuntbesturing
- Volledig gelokaliseerd in het Engels en Nederlands

Ondersteunde apparaten:
- Tuya Wi-Fi slimme stekkers, schakelaars, stekkerdozen
- Tuya Wi-Fi slimme lampen, LED-strips, dimmers
- Tuya Wi-Fi ventilatoren en ventilatiecontrollers
- Tuya Wi-Fi thermostaten, verwarmingen, airco-controllers
- Tuya Wi-Fi luchtreinigers

Installatie:
1. Installeer de app op je Homey
2. Voeg een nieuw apparaat toe: Tuya Direct > Stopcontact / Lamp / Ventilator / Klimaat / Luchtreiniger
3. Voer de apparaatgegevens in: host (IP-adres), apparaat-ID, lokale sleutel, protocolversie
4. De app valideert de verbinding en detecteert beschikbare datapunten
5. Bevestig het apparaat om de koppeling te voltooien
6. Verbindingsinstellingen kunnen later worden gewijzigd in de apparaatinstellingen

Bekende beperkingen:
- Apparaat-ID en lokale sleutel moeten worden verkregen via het Tuya IoT Platform of tinytuya
- Veel Tuya-apparaten staan slechts één lokale TCP-verbinding tegelijk toe
- Opnieuw koppelen in de Tuya/Smart Life-app kan de lokale sleutel wijzigen
- Batterijgevoede Wi-Fi Tuya-apparaten werken vaak niet betrouwbaar via lokaal LAN
- Datapuntnummers variëren per apparaatmodel; handmatige configuratie kan nodig zijn
- Niet alle Tuya-apparaten ondersteunen lokale LAN-besturing
