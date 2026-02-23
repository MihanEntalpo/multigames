(function bootstrapGameManager(global) {
  const ns = (global.Minigames = global.Minigames || {});
  const CrtRenderer = ns.CrtRenderer || null;

  class GameManager {
    constructor({ canvas, menuElement, statusElement }) {
      this.canvas = canvas;
      this.menuElement = menuElement;
      this.statusElement = statusElement;
      this.crtRenderer = CrtRenderer ? new CrtRenderer({ screenCanvas: canvas }) : null;

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
      if (typeof game.run !== 'function' || typeof game.stop !== 'function') {
        throw new Error('Game object must implement run(canvas) and stop().');
      }
      if (typeof game.render !== 'function') {
        throw new Error('Game object must implement render() for CRT wrapper compatibility.');
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
      if (this.crtRenderer) {
        this.crtRenderer.start();
      }
      this.routeFromHash();
    }

    stop() {
      window.removeEventListener('hashchange', this.onHashChange);
      this.stopActiveGame();
      if (this.crtRenderer) {
        this.crtRenderer.stop();
      }
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
      const targetCanvas = this.crtRenderer ? this.crtRenderer.getGameCanvas() : this.canvas;
      if (this.crtRenderer) {
        this.crtRenderer.setRenderHook(() => {
          if (this.activeGame && typeof this.activeGame.render === 'function') {
            this.activeGame.render();
          }
        });
      }
      game.run(targetCanvas);
    }

    stopActiveGame() {
      if (!this.activeGame) {
        if (this.crtRenderer) {
          this.crtRenderer.setRenderHook(null);
        }
        return;
      }

      try {
        this.activeGame.stop();
      } finally {
        this.activeGame = null;
        this.activeGameName = null;
        if (this.crtRenderer) {
          this.crtRenderer.setRenderHook(null);
        }
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
      if (this.crtRenderer) {
        this.crtRenderer.clear();
        return;
      }

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
