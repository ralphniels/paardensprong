<!DOCTYPE html>
<html lang="nl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Paardensprong</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
<main class="app">
    <section class="panel">
        <h1>Paardensprong</h1>
        <p>Maak het Nederlandse woord van 8 letters door alleen geldige paardensprongen te volgen.</p>

        <div id="board" class="board" aria-label="Paardensprong bord"></div>

        <div class="guess">
            <span class="label">Jouw oplossing</span>
            <output id="guess">........</output>
        </div>

        <p id="status" class="status" aria-live="polite">Nieuw spel laden…</p>

        <div class="actions">
            <button id="backspace" type="button">Backspace</button>
            <button id="show-solution" type="button">Toon oplossing</button>
            <button id="restart" type="button">Nieuw woord</button>
            <button id="delete-word" type="button" class="danger">Verwijder woord</button>
        </div>
    </section>
</main>

<script src="app.js" defer></script>
</body>
</html>
