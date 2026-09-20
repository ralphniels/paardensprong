const cycle = [0, 5, 6, 1, 8, 3, 2, 7];
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

const state = {
    answer: '',
    layout: [],
    solutionPositions: [],
    selectedPositions: [],
    revealed: false,
    solved: false,
};

function getLetter(position) {
    return state.layout[position] ?? '';
}

function getCurrentWord() {
    return state.selectedPositions.map(getLetter).join('');
}

function getSelectablePositions() {
    if (state.solved || state.layout.length === 0) {
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

    for (let position = 0; position < 9; position += 1) {
        const letter = state.layout[position];

        if (position === 4) {
            const hole = document.createElement('div');
            hole.className = 'cell empty';
            hole.setAttribute('aria-hidden', 'true');
            board.appendChild(hole);
            continue;
        }

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'cell';
        button.textContent = letter ?? '';

        if (!letter) {
            button.disabled = true;
        } else {
            button.dataset.position = String(position);
            button.disabled = !selectable.has(position);
        }

        if (selected.has(position)) {
            button.classList.add('selected');
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
    state.solved = isSolved;
    updateStatus();
    renderBoard();
}

function selectPosition(position) {
    if (!getSelectablePositions().includes(position)) {
        return;
    }

    state.selectedPositions.push(position);

    if (state.selectedPositions.length === 8 && getCurrentWord() === state.answer) {
        applySolvedState(true);
        return;
    }

    updateStatus();
    renderBoard();
}

function loadPuzzle(puzzle) {
    state.answer = puzzle.answer;
    state.layout = puzzle.layout;
    state.solutionPositions = puzzle.solutionPositions;
    state.selectedPositions = [];
    state.revealed = false;
    state.solved = false;
    updateStatus();
    renderBoard();
}

async function fetchPuzzle() {
    statusText.textContent = 'Nieuw spel laden…';

    const response = await fetch('api.php?action=puzzle');
    const data = await response.json();

    if (!data.ok) {
        state.answer = '';
        state.layout = [];
        state.solutionPositions = [];
        state.selectedPositions = [];
        state.revealed = false;
        state.solved = false;
        updateStatus();
        renderBoard();
        return;
    }

    loadPuzzle(data.puzzle);
}

async function deleteCurrentWord() {
    if (!state.answer) {
        return;
    }

    const confirmed = window.confirm(`Weet je zeker dat je ${state.answer} uit de woordenlijst wilt verwijderen?`);
    if (!confirmed) {
        return;
    }

    const response = await fetch('api.php?action=delete', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ word: state.answer.toLowerCase() }),
    });

    const data = await response.json();

    if (!data.ok) {
        statusText.textContent = data.message;
        return;
    }

    if (data.puzzle) {
        loadPuzzle(data.puzzle);
        statusText.textContent = `${data.removedWord} verwijderd. Nieuw woord geladen.`;
        return;
    }

    state.answer = '';
    state.layout = [];
    state.solutionPositions = [];
    state.selectedPositions = [];
    state.revealed = false;
    state.solved = false;
    updateStatus();
    renderBoard();
    statusText.textContent = `${data.removedWord} verwijderd. Er zijn geen woorden meer beschikbaar.`;
}

board.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement) || !target.dataset.position) {
        return;
    }

    selectPosition(Number(target.dataset.position));
});

backspaceButton.addEventListener('click', () => {
    state.selectedPositions.pop();
    state.revealed = false;
    state.solved = false;
    updateStatus();
    renderBoard();
});

showSolutionButton.addEventListener('click', () => {
    state.selectedPositions = [...state.solutionPositions];
    state.revealed = true;
    applySolvedState(true);
});

restartButton.addEventListener('click', () => {
    void fetchPuzzle();
});

deleteWordButton.addEventListener('click', () => {
    void deleteCurrentWord();
});

void fetchPuzzle();
