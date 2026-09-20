<?php

declare(strict_types=1);

session_start();

header('Content-Type: application/json; charset=utf-8');

const WORDS_FILE = __DIR__ . '/woorden_8_letters.txt';
const CYCLE = [0, 5, 6, 1, 8, 3, 2, 7];

function readWords(): array
{
    if (!is_file(WORDS_FILE)) {
        return [];
    }

    $lines = file(WORDS_FILE, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);

    if ($lines === false) {
        return [];
    }

    return array_values(array_filter(array_map('trim', $lines), static fn (string $word): bool => isValidWord($word)));
}

function isValidWord(string $word): bool
{
    return preg_match('/^\p{L}{8}$/u', $word) === 1;
}

function parseWordsFromText(string $content): array
{
    $lines = preg_split('/\R/u', $content);

    if ($lines === false) {
        return [];
    }

    return array_values(array_filter(array_map('trim', $lines), static fn (string $word): bool => isValidWord($word)));
}

function jsonResponse(array $payload, int $statusCode = 200): never
{
    http_response_code($statusCode);
    echo json_encode($payload, JSON_THROW_ON_ERROR);
    exit;
}

function isLocalRequest(): bool
{
    $remoteAddress = $_SERVER['REMOTE_ADDR'] ?? '';

    return in_array($remoteAddress, ['127.0.0.1', '::1'], true);
}

function createPuzzle(string $word): array
{
    $letters = preg_split('//u', mb_strtoupper($word), -1, PREG_SPLIT_NO_EMPTY);

    if ($letters === false || count($letters) !== 8) {
        throw new RuntimeException('Ongeldig woord.');
    }

    $layout = array_fill(0, 9, null);
    $solutionPositions = [];
    $start = random_int(0, 7);
    $direction = random_int(0, 1) === 0 ? 1 : -1;

    foreach ($letters as $index => $letter) {
        $cycleIndex = ($start + ($direction * $index)) % 8;
        if ($cycleIndex < 0) {
            $cycleIndex += 8;
        }

        $position = CYCLE[$cycleIndex];
        $layout[$position] = $letter;
        $solutionPositions[] = $position;
    }

    return [
        'answer' => mb_strtoupper($word),
        'layout' => $layout,
        'solutionPositions' => $solutionPositions,
    ];
}

function nextPuzzleResponse(): array
{
    $words = readWords();

    if ($words === []) {
        return [
            'ok' => false,
            'message' => 'Er zijn geen woorden meer beschikbaar.',
        ];
    }

    $word = $words[array_rand($words)];

    return [
        'ok' => true,
        'puzzle' => createPuzzle($word),
        'remainingWords' => count($words),
    ];
}

$action = $_GET['action'] ?? 'puzzle';

if ($action === 'puzzle') {
    $response = nextPuzzleResponse();
    jsonResponse($response, $response['ok'] ? 200 : 409);
}

if ($action === 'delete') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        jsonResponse(['ok' => false, 'message' => 'Gebruik POST om een woord te verwijderen.'], 405);
    }

    if (!isLocalRequest()) {
        jsonResponse(['ok' => false, 'message' => 'Woorden verwijderen mag alleen vanaf de lokale server.'], 403);
    }

    $csrfToken = (string) ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    $sessionToken = (string) ($_SESSION['csrf_token'] ?? '');

    if ($csrfToken === '' || $sessionToken === '' || !hash_equals($sessionToken, $csrfToken)) {
        jsonResponse(['ok' => false, 'message' => 'Ongeldige beveiligingscontrole voor verwijderen.'], 403);
    }

    $input = json_decode(file_get_contents('php://input') ?: '{}', true);
    $word = is_array($input) ? trim((string) ($input['word'] ?? '')) : '';

    if (!isValidWord($word)) {
        jsonResponse(['ok' => false, 'message' => 'Alleen woorden van precies 8 letters kunnen worden verwijderd.'], 422);
    }

    $handle = fopen(WORDS_FILE, 'c+');

    if ($handle === false) {
        jsonResponse(['ok' => false, 'message' => 'Kon de woordenlijst niet openen.'], 500);
    }

    if (!flock($handle, LOCK_EX)) {
        fclose($handle);
        jsonResponse(['ok' => false, 'message' => 'Kon de woordenlijst niet vergrendelen.'], 500);
    }

    rewind($handle);
    $content = stream_get_contents($handle);
    $words = parseWordsFromText($content === false ? '' : $content);
    $filteredWords = array_values(array_filter($words, static fn (string $candidate): bool => mb_strtolower($candidate) !== mb_strtolower($word)));

    if (count($filteredWords) === count($words)) {
        flock($handle, LOCK_UN);
        fclose($handle);
        jsonResponse(['ok' => false, 'message' => 'Woord niet gevonden in de lijst.'], 404);
    }

    $content = $filteredWords === [] ? '' : implode(PHP_EOL, $filteredWords) . PHP_EOL;
    rewind($handle);
    ftruncate($handle, 0);

    $totalBytes = strlen($content);
    $writtenBytes = 0;

    while ($writtenBytes < $totalBytes) {
        $chunk = fwrite($handle, substr($content, $writtenBytes));

        if ($chunk === false || $chunk === 0) {
            flock($handle, LOCK_UN);
            fclose($handle);
            jsonResponse(['ok' => false, 'message' => 'Kon de woordenlijst niet volledig bijwerken.'], 500);
        }

        $writtenBytes += $chunk;
    }

    if ($writtenBytes !== $totalBytes) {
        flock($handle, LOCK_UN);
        fclose($handle);
        jsonResponse(['ok' => false, 'message' => 'Kon de woordenlijst niet volledig bijwerken.'], 500);
    }

    fflush($handle);
    flock($handle, LOCK_UN);
    fclose($handle);

    $response = [
        'ok' => true,
        'removedWord' => mb_strtoupper($word),
        'remainingWords' => count($filteredWords),
        'message' => 'Woord verwijderd uit de woordenlijst.',
    ];

    if ($filteredWords !== []) {
        $nextWord = $filteredWords[array_rand($filteredWords)];
        $response['puzzle'] = createPuzzle($nextWord);
    }

    jsonResponse($response);
}

jsonResponse(['ok' => false, 'message' => 'Onbekende actie.'], 404);
