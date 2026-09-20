# paardensprong

Start de app lokaal met bijvoorbeeld:

```bash
cd paardensprong
php -S 127.0.0.1:8000 -t .
```

Het verwijderen van woorden uit `woorden_8_letters.txt` werkt expres alleen via `localhost`/`127.0.0.1`, omdat de PHP-endpoint hiervoor een lokale request plus sessie/CSRF-controle vereist.