(function bootstrapGameManager(global) {
  const ns = (global.Minigames = global.Minigames || {});

  class GameManager {
    constructor({ canvas, menuElement, statusElement }) {
      this.canvas = canvas;
      this.menuElement = menuElement;
      this.statusElement = statusElement;

      this.gamesByName = new Map();
      this.gameOrder = [];

      this.activeGame = null;
      this.activeGameName = null;

      this.onHashChange = this.onHashChange.bind(this);
    }

    registerGame(game) {
      if (!game || typeof game.getName !== 'function') {
        throw new Error('Game object must implement getName().');
      }

      const name = game.getName();
      if (!/^[a-z0-9_-]+$/.test(name)) {
        throw new Error(`Invalid game name: ${name}`);
      }
      if (this.gamesByName.has(name)) {
        throw new Error(`Duplicate game name: ${name}`);
      }

      this.gamesByName.set(name, game);
      this.gameOrder.push(name);
    }

    start() {
      this.renderMenu();
      window.addEventListener('hashchange', this.onHashChange);
      this.routeFromHash();
    }

    stop() {
      window.removeEventListener('hashchange', this.onHashChange);
      this.stopActiveGame();
    }

    onHashChange() {
      this.routeFromHash();
    }

    routeFromHash() {
      const hashValue = window.location.hash.replace(/^#/, '').trim();

      if (!hashValue) {
        this.stopActiveGame();
        this.setMenuSelection(null);
        this.setStatus('Выберите игру из меню.');
        this.clearCanvas();
        return;
      }

      const game = this.gamesByName.get(hashValue);
      if (!game) {
        this.stopActiveGame();
        this.setMenuSelection(null);
        this.setStatus(`Неизвестная игра: ${hashValue}`);
        this.clearCanvas();
        return;
      }

      if (this.activeGameName === hashValue) {
        this.setMenuSelection(hashValue);
        this.setStatus('');
        return;
      }

      this.stopActiveGame();
      this.activeGame = game;
      this.activeGameName = hashValue;
      this.setMenuSelection(hashValue);
      this.setStatus('');
      game.run(this.canvas);
    }

    stopActiveGame() {
      if (!this.activeGame) {
        return;
      }

      try {
        this.activeGame.stop();
      } finally {
        this.activeGame = null;
        this.activeGameName = null;
      }
    }

    renderMenu() {
      this.menuElement.innerHTML = '';

      for (const name of this.gameOrder) {
        const game = this.gamesByName.get(name);
        const item = document.createElement('li');
        const link = document.createElement('a');
        link.href = `#${name}`;
        link.textContent = game.getTitle();
        link.dataset.game = name;
        item.appendChild(link);
        this.menuElement.appendChild(item);
      }
    }

    setMenuSelection(selectedName) {
      const links = this.menuElement.querySelectorAll('a[data-game]');
      links.forEach((link) => {
        if (link.dataset.game === selectedName) {
          link.classList.add('active');
        } else {
          link.classList.remove('active');
        }
      });
    }

    setStatus(message) {
      if (!this.statusElement) {
        return;
      }
      this.statusElement.textContent = message;
    }

    clearCanvas() {
      const ctx = this.canvas.getContext('2d');
      if (!ctx) {
        return;
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  ns.GameManager = GameManager;
})(window);
