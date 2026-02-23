(function bootstrapMain(global) {
  const ns = global.Minigames || {};
  const GameManager = ns.GameManager;
  const TetrisGame = ns.TetrisGame;
  const ArkanoidGame = ns.ArkanoidGame;
  const AsteroidsGame = ns.AsteroidsGame;
  const GalaxyGame = ns.GalaxyGame;
  const PacmanGame = ns.PacmanGame;
  const SokobanGame = ns.SokobanGame;
  const XonixGame = ns.XonixGame;

  if (!GameManager || !TetrisGame || !ArkanoidGame || !AsteroidsGame || !GalaxyGame || !PacmanGame || !SokobanGame || !XonixGame) {
    throw new Error('Main dependencies are missing. Check script loading order in index.html.');
  }

  const canvas = document.getElementById('game-canvas');
  const menuElement = document.getElementById('game-menu');
  const statusElement = document.getElementById('router-status');

  if (!canvas || !menuElement || !statusElement) {
    throw new Error('Failed to initialize app: required DOM nodes are missing.');
  }

  const manager = new GameManager({
    canvas,
    menuElement,
    statusElement,
  });

  manager.registerGame(new TetrisGame());
  manager.registerGame(new ArkanoidGame());
  manager.registerGame(new AsteroidsGame());
  manager.registerGame(new GalaxyGame());
  manager.registerGame(new PacmanGame());
  manager.registerGame(new SokobanGame());
  manager.registerGame(new XonixGame());
  manager.start();
})(window);
