const cycle = [0, 5, 6, 1, 8, 3, 2, 7];
const AUTOCOMPLETE_DELAY_MS = 220;
let knightIconTemplate = null;
const adjacency = cycle.reduce((map, position, index) => {
    const previous = cycle[(index + cycle.length - 1) % cycle.length];
    const next = cycle[(index + 1) % cycle.length];
    map[position] = [previous, next];
    return map;
}, {});

const board = document.getElementById('board');
const guess = document.getElementById('guess');
const statusText = document.getElementById('status');
const backspaceButton = document.getElementById('backspace');
const showSolutionButton = document.getElementById('show-solution');
const restartButton = document.getElementById('restart');
const deleteWordButton = document.getElementById('delete-word');
const csrfToken = document.querySelector('meta[name=\"csrf-token\"]')?.content ?? '';

const state = {
    answer: '',
    layout: [],
    solutionPositions: [],
    selectedPositions: [],
    revealed: false,
    solved: false,
    autocompleteTimer: null,
    autocompleteStartLength: 0,
    autocompleting: false,
};

function cancelAutocomplete(resetStartLength = true) {
    if (state.autocompleteTimer !== null) {
        window.clearTimeout(state.autocompleteTimer);
        state.autocompleteTimer = null;
    }

    if (resetStartLength) {
        state.autocompleteStartLength = 0;
    }

    state.autocompleting = false;
}

function resetState() {
    cancelAutocomplete();
    state.answer = '';
    state.layout = [];
    state.solutionPositions = [];
    state.selectedPositions = [];
    state.revealed = false;
    state.solved = false;
}

function getLetter(position) {
    return state.layout[position] ?? '';
}

function getCurrentWord() {
    return state.selectedPositions.map(getLetter).join('');
}

function getSelectablePositions() {
    if (state.solved || state.autocompleting || state.layout.length === 0) {
        return [];
    }

    const used = new Set(state.selectedPositions);

    if (state.selectedPositions.length === 0) {
        return state.layout
            .map((letter, position) => (letter ? position : null))
            .filter((position) => position !== null);
    }

    const currentPosition = state.selectedPositions[state.selectedPositions.length - 1];
    return adjacency[currentPosition].filter((position) => !used.has(position));
}

function updateStatus() {
    const currentWord = getCurrentWord();

    if (state.layout.length === 0) {
        guess.textContent = '........';
        statusText.textContent = 'Er zijn geen woorden meer beschikbaar.';
        return;
    }

    guess.textContent = currentWord.padEnd(8, '.');

    if (state.solved) {
        if (state.revealed) {
            statusText.textContent = `Oplossing getoond: ${state.answer}.`;
            return;
        }

        statusText.textContent = `Goed gedaan! Het woord is ${state.answer}.`;
        return;
    }

    if (state.selectedPositions.length === 8) {
        statusText.textContent = 'Nog niet goed. Gebruik backspace of bekijk de oplossing.';
        return;
    }

    statusText.textContent = 'Kies de volgende letter met een geldige paardensprong.';
}

function renderBoard() {
    board.innerHTML = '';
    const selectable = new Set(getSelectablePositions());
    const selected = new Set(state.selectedPositions);
    const firstSelectedPosition = state.selectedPositions[0];

    for (let position = 0; position < 9; position += 1) {
        const letter = state.layout[position];

        if (position === 4) {
            const hole = document.createElement('div');
            hole.className = 'cell empty';
            hole.setAttribute('aria-hidden', 'true');
            hole.appendChild(createKnightIcon());
            board.appendChild(hole);
            continue;
        }

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'cell';
        button.textContent = letter ?? '';
        button.setAttribute('aria-label', `Vak ${position + 1}, letter ${letter ?? 'leeg'}`);
        button.setAttribute('aria-selected', selected.has(position) ? 'true' : 'false');

        if (!letter) {
            button.disabled = true;
        } else {
            button.dataset.position = String(position);
            button.disabled = !selectable.has(position);
        }

        if (selected.has(position)) {
            button.classList.add('selected');

            if (position === firstSelectedPosition) {
                button.classList.add('first-selected');
            }
        }

        if (!button.disabled && !selected.has(position)) {
            button.classList.add('selectable');
        }

        board.appendChild(button);
    }

    backspaceButton.disabled = state.selectedPositions.length === 0;
    showSolutionButton.disabled = state.layout.length === 0 || state.solved;
    deleteWordButton.disabled = state.answer === '';
}

function applySolvedState(isSolved) {
    cancelAutocomplete();
    state.solved = isSolved;
    updateStatus();
    renderBoard();
}

function getCompletedPath(startingPositions = state.selectedPositions) {
    if (startingPositions.length < 2) {
        return null;
    }

    const completedPath = [...startingPositions];
    const used = new Set(completedPath);

    while (completedPath.length < 8) {
        const currentPosition = completedPath[completedPath.length - 1];
        const nextPositions = adjacency[currentPosition].filter((position) => !used.has(position));

        if (nextPositions.length !== 1) {
            return null;
        }

        const [nextPosition] = nextPositions;
        completedPath.push(nextPosition);
        used.add(nextPosition);
    }

    return completedPath;
}

function rewindAutocompleteAttempt() {
    if (state.autocompleteStartLength > 0) {
        state.selectedPositions = state.selectedPositions.slice(0, state.autocompleteStartLength);
    }

    cancelAutocomplete();
    updateStatus();
    renderBoard();
}

function scheduleAutocomplete(preserveStartLength = false) {
    cancelAutocomplete(!preserveStartLength);

    const completedPath = getCompletedPath();
    if (completedPath === null) {
        return;
    }

    const completedWord = completedPath.map(getLetter).join('');
    if (completedWord !== state.answer || completedPath.length === state.selectedPositions.length) {
        return;
    }

    if (!preserveStartLength) {
        state.autocompleteStartLength = state.selectedPositions.length;
    }

    state.autocompleting = true;
    updateStatus();
    renderBoard();

    state.autocompleteTimer = window.setTimeout(() => {
        state.autocompleteTimer = null;

        if (!state.autocompleting) {
            return;
        }

        const nextCompletedPath = getCompletedPath();
        const currentSelectionMatches = nextCompletedPath !== null
            && nextCompletedPath
                .slice(0, state.selectedPositions.length)
                .every((position, index) => position === state.selectedPositions[index]);

        if (nextCompletedPath === null || !currentSelectionMatches || nextCompletedPath.map(getLetter).join('') !== state.answer) {
            rewindAutocompleteAttempt();
            return;
        }

        state.selectedPositions.push(nextCompletedPath[state.selectedPositions.length]);
        updateStatus();

        if (state.selectedPositions.length === nextCompletedPath.length) {
            if (getCurrentWord() === state.answer) {
                applySolvedState(true);
                return;
            }

            rewindAutocompleteAttempt();
            return;
        }

        renderBoard();
        scheduleAutocomplete(true);
    }, AUTOCOMPLETE_DELAY_MS);
}

function selectPosition(position) {
    if (!getSelectablePositions().includes(position)) {
        return;
    }

    cancelAutocomplete();
    state.selectedPositions.push(position);

    if (state.selectedPositions.length === 8 && getCurrentWord() === state.answer) {
        applySolvedState(true);
        return;
    }

    updateStatus();
    renderBoard();

    if (state.selectedPositions.length >= 2) {
        scheduleAutocomplete();
    }
}

function loadPuzzle(puzzle, statusMessage = '') {
    cancelAutocomplete();
    state.answer = puzzle.answer;
    state.layout = puzzle.layout;
    state.solutionPositions = puzzle.solutionPositions;
    state.selectedPositions = [];
    state.revealed = false;
    state.solved = false;
    updateStatus();
    renderBoard();

    if (statusMessage) {
        statusText.textContent = statusMessage;
    }
}

function isValidPuzzle(puzzle) {
    return Boolean(
        puzzle &&
        typeof puzzle.answer === 'string' &&
        Array.isArray(puzzle.layout) &&
        puzzle.layout.length === 9 &&
        Array.isArray(puzzle.solutionPositions) &&
        puzzle.solutionPositions.length === 8
    );
}

async function parseJsonResponse(response) {
    const text = await response.text();

    if (!text) {
        return {};
    }

    return JSON.parse(text);
}

async function fetchPuzzle(statusMessage = '') {
    statusText.textContent = 'Nieuw spel laden…';
    try {
        const response = await fetch('api.php?action=puzzle');
        const data = await parseJsonResponse(response);

        if (!response.ok || !data.ok || !isValidPuzzle(data.puzzle)) {
            resetState();
            guess.textContent = '........';
            statusText.textContent = data.message ?? 'Kon geen nieuw spel laden. Probeer het opnieuw.';
            renderBoard();
            return false;
        }

        loadPuzzle(data.puzzle, statusMessage);
        return true;
    } catch (error) {
        resetState();
        guess.textContent = '........';
        statusText.textContent = 'Kon geen nieuw spel laden. Probeer het opnieuw.';
        renderBoard();
        return false;
    }
}

async function deleteCurrentWord() {
    if (!state.answer) {
        return;
    }

    const confirmed = window.confirm(`Weet je zeker dat je ${state.answer} uit de woordenlijst wilt verwijderen?`);
    if (!confirmed) {
        return;
    }

    try {
        const response = await fetch('api.php?action=delete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken,
            },
            body: JSON.stringify({ word: state.answer.toLowerCase() }),
        });

        const data = await parseJsonResponse(response);

        if (!response.ok || !data.ok) {
            statusText.textContent = data.message ?? 'Verwijderen is mislukt. Probeer het opnieuw.';
            return;
        }

        if (isValidPuzzle(data.puzzle)) {
            loadPuzzle(data.puzzle, `${data.removedWord} verwijderd. Nieuw woord geladen.`);
            return;
        }

        if (data.remainingWords > 0) {
            statusText.textContent = data.message ?? 'Woord verwijderd, maar een nieuw woord ontbreekt in de reactie.';
            return;
        }

        resetState();
        updateStatus();
        renderBoard();
        statusText.textContent = `${data.removedWord} verwijderd. Er zijn geen woorden meer beschikbaar.`;
    } catch (error) {
        statusText.textContent = 'Verwijderen is mislukt. Probeer het opnieuw.';
    }
}

board.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement) || !target.dataset.position) {
        return;
    }

    selectPosition(Number(target.dataset.position));
});

backspaceButton.addEventListener('click', () => {
    cancelAutocomplete();
    state.selectedPositions.pop();
    state.revealed = false;
    state.solved = false;
    updateStatus();
    renderBoard();
});

showSolutionButton.addEventListener('click', () => {
    cancelAutocomplete();
    state.selectedPositions = [...state.solutionPositions];
    state.revealed = true;
    applySolvedState(true);
});

restartButton.addEventListener('click', () => {
    cancelAutocomplete();
    void fetchPuzzle();
});

deleteWordButton.addEventListener('click', () => {
    cancelAutocomplete();
    void deleteCurrentWord();
});

function createKnightIcon() {
    if (knightIconTemplate === null) {
        const namespace = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(namespace, 'svg');
        const text = document.createElementNS(namespace, 'text');

        svg.setAttribute('viewBox', '0 0 100 100');
        svg.setAttribute('class', 'knight-icon');
        svg.setAttribute('focusable', 'false');
        svg.setAttribute('aria-hidden', 'true');

        text.setAttribute('x', '50');
        text.setAttribute('y', '76');
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('font-size', '76');
        text.setAttribute('font-family', 'Times New Roman, serif');
        text.setAttribute('fill', 'currentColor');
        text.textContent = '♞';

        svg.appendChild(text);
        knightIconTemplate = svg;
    }

    return knightIconTemplate.cloneNode(true);
}

void fetchPuzzle();
