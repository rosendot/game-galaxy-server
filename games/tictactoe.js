// Tic Tac Toe game logic

export function initializeBoard() {
  return [
    [null, null, null],
    [null, null, null],
    [null, null, null]
  ];
}

export function applyMove(board, row, col, playerSymbol) {
  // Validate move
  if (row < 0 || row > 2 || col < 0 || col > 2) {
    return false;
  }
  if (board[row][col] !== null) {
    return false;
  }

  // Apply move
  board[row][col] = playerSymbol;
  return true;
}

export function checkWinner(board) {
  // Check rows
  for (let row = 0; row < 3; row++) {
    if (board[row][0] &&
        board[row][0] === board[row][1] &&
        board[row][1] === board[row][2]) {
      return board[row][0];
    }
  }

  // Check columns
  for (let col = 0; col < 3; col++) {
    if (board[0][col] &&
        board[0][col] === board[1][col] &&
        board[1][col] === board[2][col]) {
      return board[0][col];
    }
  }

  // Check diagonals
  if (board[0][0] &&
      board[0][0] === board[1][1] &&
      board[1][1] === board[2][2]) {
    return board[0][0];
  }

  if (board[0][2] &&
      board[0][2] === board[1][1] &&
      board[1][1] === board[2][0]) {
    return board[0][2];
  }

  return null;
}

export function checkDraw(board) {
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      if (board[row][col] === null) {
        return false;
      }
    }
  }
  return true;
}
