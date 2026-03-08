import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, fs, fsn, getFontScale } from '../config';
import { EventBus, Events } from '../world/EventBus';

function getInputStyle(): string {
  return [
    'width: 380px',
    'padding: 10px',
    `font-size: ${fsn(34)}px`,
    'background: #2a2a4e',
    'color: #ffffff',
    'border: 1px solid #4488ff',
    'border-radius: 4px',
    'outline: none',
    'transition: border-color 0.2s',
  ].join('; ');
}

export class SettingsScene extends Phaser.Scene {
  private apiInput!: HTMLInputElement;
  private baseUrlInput!: HTMLInputElement;
  private modelInput!: HTMLInputElement;
  private domElements: Phaser.GameObjects.DOMElement[] = [];
  private onClose?: () => void;

  constructor() {
    super({ key: 'SettingsScene' });
  }

  init(data: { onClose?: () => void }): void {
    this.onClose = data.onClose;
  }

  create(): void {
    const backdrop = this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH,
      GAME_HEIGHT,
      0x000000,
      0.85
    );
    backdrop.setDepth(50);
    backdrop.setInteractive();

    const panelX = GAME_WIDTH / 2;
    const panelY = GAME_HEIGHT / 2;

    const panelW = Math.min(GAME_WIDTH - 40, Math.max(500, 500 * getFontScale()));
    const panel = this.add.rectangle(panelX, panelY, panelW, 580, 0x1a1a2e, 1);
    panel.setStrokeStyle(2, 0x4488ff);
    panel.setDepth(51);

    const title = this.add.text(panelX, panelY - 210, '⚙️ LLM Settings', {
      fontSize: fs(56),
      color: '#ffcc00',
      stroke: '#000000',
      strokeThickness: 3,
      resolution: window.devicePixelRatio,
    });
    title.setOrigin(0.5);
    title.setDepth(52);

    const labelStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontSize: fs(34),
      color: '#aaccff',
      resolution: window.devicePixelRatio,
    };
    this.add.text(panelX - 240, panelY - 170, 'API Key:', labelStyle).setDepth(52);
    this.add.text(panelX - 240, panelY - 95, 'Base URL:', labelStyle).setDepth(52);
    this.add.text(panelX - 240, panelY - 20, 'Model:', labelStyle).setDepth(52);

    this.createInputs(panelX, panelY);
    this.createFontScaleSelector(panelX, panelY);
    this.createButtons(panelX, panelY);
    this.createClearDataButton(panelX, panelY);

    EventBus.emit(Events.SETTINGS_OPEN);
  }

  private createInputs(centerX: number, centerY: number): void {
    this.apiInput = document.createElement('input');
    this.apiInput.type = 'password';
    this.apiInput.placeholder = 'sk-...';
    this.apiInput.value = localStorage.getItem('openai_api_key') || '';
    this.apiInput.style.cssText = getInputStyle();

    const apiDom = this.add.dom(centerX + 30, centerY - 148, this.apiInput);
    apiDom.setDepth(53);
    this.domElements.push(apiDom);

    const toggleBtn = this.add.text(centerX + 235, centerY - 148, '👁️', {
      fontSize: fs(38),
      resolution: window.devicePixelRatio,
    });
    toggleBtn.setOrigin(0.5);
    toggleBtn.setDepth(53);
    toggleBtn.setInteractive({ useHandCursor: true });
    toggleBtn.on('pointerdown', () => {
      this.apiInput.type = this.apiInput.type === 'password' ? 'text' : 'password';
    });
    toggleBtn.on('pointerover', () => toggleBtn.setScale(1.1));
    toggleBtn.on('pointerout', () => toggleBtn.setScale(1));

    this.baseUrlInput = document.createElement('input');
    this.baseUrlInput.type = 'text';
    this.baseUrlInput.placeholder = 'https://api.openai.com/v1';
    this.baseUrlInput.value = localStorage.getItem('llm_base_url') || '';
    this.baseUrlInput.style.cssText = getInputStyle();

    const baseUrlDom = this.add.dom(centerX + 30, centerY - 73, this.baseUrlInput);
    baseUrlDom.setDepth(53);
    this.domElements.push(baseUrlDom);

    this.modelInput = document.createElement('input');
    this.modelInput.type = 'text';
    this.modelInput.placeholder = 'gpt-4o-mini';
    this.modelInput.value = localStorage.getItem('llm_model') || 'gpt-4o-mini';
    this.modelInput.style.cssText = getInputStyle();

    const modelDom = this.add.dom(centerX + 30, centerY + 2, this.modelInput);
    modelDom.setDepth(53);
    this.domElements.push(modelDom);

    setTimeout(() => this.apiInput.focus(), 100);
  }

  private createFontScaleSelector(centerX: number, centerY: number): void {
    const selectorY = centerY + 60;
    const currentScale = localStorage.getItem('font_scale') || 'medium';

    this.add.text(centerX - 240, selectorY, 'Font Scale:', {
      fontSize: fs(34),
      color: '#aaccff',
      resolution: window.devicePixelRatio,
    }).setDepth(52);

    const options: { label: string; value: string; x: number }[] = [
      { label: 'Small', value: 'small', x: centerX - 40 },
      { label: 'Medium', value: 'medium', x: centerX + 60 },
      { label: 'Large', value: 'large', x: centerX + 170 },
    ];

    for (const opt of options) {
      const isActive = currentScale === opt.value;
      const text = this.add.text(opt.x, selectorY, opt.label, {
        fontSize: fs(30),
        color: isActive ? '#ffcc00' : '#888888',
        fontStyle: isActive ? 'bold' : 'normal',
        resolution: window.devicePixelRatio,
      });
      text.setDepth(53);
      text.setInteractive({ useHandCursor: true });

      text.on('pointerover', () => {
        if (currentScale !== opt.value) text.setColor('#cccccc');
      });
      text.on('pointerout', () => {
        if (currentScale !== opt.value) text.setColor('#888888');
      });
      text.on('pointerdown', () => {
        localStorage.setItem('font_scale', opt.value);
        this.cleanupInputs();
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        this.scene.restart({ onClose: this.onClose });
      });
    }
  }

  private createButtons(centerX: number, centerY: number): void {
    const saveBtn = this.add.rectangle(centerX - 80, centerY + 180, 120, 48, 0x44aa44);
    saveBtn.setDepth(52);
    saveBtn.setInteractive({ useHandCursor: true });

    const saveText = this.add.text(centerX - 80, centerY + 180, 'Save', {
      fontSize: fs(42),
      color: '#ffffff',
      resolution: window.devicePixelRatio,
    });
    saveText.setOrigin(0.5);
    saveText.setDepth(53);

    saveBtn.on('pointerdown', () => {
      this.saveSettings();
    });
    saveBtn.on('pointerover', () => saveBtn.setFillStyle(0x55cc55));
    saveBtn.on('pointerout', () => saveBtn.setFillStyle(0x44aa44));

    const cancelBtn = this.add.rectangle(centerX + 80, centerY + 180, 120, 48, 0xaa4444);
    cancelBtn.setDepth(52);
    cancelBtn.setInteractive({ useHandCursor: true });

    const isFirstRun = !localStorage.getItem('openai_api_key') && !this.onClose;
    const cancelLabel = isFirstRun ? 'Skip' : 'Cancel';

    const cancelText = this.add.text(centerX + 80, centerY + 180, cancelLabel, {
      fontSize: fs(42),
      color: '#ffffff',
      resolution: window.devicePixelRatio,
    });
    cancelText.setOrigin(0.5);
    cancelText.setDepth(53);

    cancelBtn.on('pointerdown', () => {
      this.closeSettings();
    });
    cancelBtn.on('pointerover', () => cancelBtn.setFillStyle(0xcc5555));
    cancelBtn.on('pointerout', () => cancelBtn.setFillStyle(0xaa4444));
  }

  // --- Clear Data / New Game ---

  private createClearDataButton(centerX: number, centerY: number): void {
    const btnY = centerY + 250;

    const clearBtn = this.add.rectangle(centerX, btnY, 260, 48, 0x882222);
    clearBtn.setStrokeStyle(1, 0xff4444);
    clearBtn.setDepth(52);
    clearBtn.setInteractive({ useHandCursor: true });

    const clearText = this.add.text(centerX, btnY, '🗑️ New Game (Clear Data)', {
      fontSize: fs(28),
      color: '#ffaaaa',
      resolution: window.devicePixelRatio,
    });
    clearText.setOrigin(0.5);
    clearText.setDepth(53);

    clearBtn.on('pointerover', () => clearBtn.setFillStyle(0xaa3333));
    clearBtn.on('pointerout', () => clearBtn.setFillStyle(0x882222));

    clearBtn.on('pointerdown', () => {
      this.showClearConfirmation(centerX, centerY);
    });
  }

  private showClearConfirmation(centerX: number, centerY: number): void {
    const overlay = this.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2,
      GAME_WIDTH, GAME_HEIGHT,
      0x000000, 0.7
    );
    overlay.setDepth(60);
    overlay.setInteractive();

    const confirmPanel = this.add.rectangle(centerX, centerY, 440, 240, 0x1a1a2e, 1);
    confirmPanel.setStrokeStyle(2, 0xff4444);
    confirmPanel.setDepth(61);

    const warningText = this.add.text(centerX, centerY - 70, '⚠️ Reset Game?', {
      fontSize: fs(42),
      color: '#ff6666',
      stroke: '#000000',
      strokeThickness: 2,
      resolution: window.devicePixelRatio,
    });
    warningText.setOrigin(0.5);
    warningText.setDepth(62);

    const descText = this.add.text(centerX, centerY - 20, 'This will erase ALL save data,\nmemories, and progress.', {
      fontSize: fs(24),
      color: '#cccccc',
      align: 'center',
      resolution: window.devicePixelRatio,
    });
    descText.setOrigin(0.5);
    descText.setDepth(62);

    const confirmBtn = this.add.rectangle(centerX - 80, centerY + 60, 130, 48, 0xaa2222);
    confirmBtn.setDepth(62);
    confirmBtn.setInteractive({ useHandCursor: true });
    const confirmLabel = this.add.text(centerX - 80, centerY + 60, 'Erase All', {
      fontSize: fs(30),
      color: '#ffffff',
      resolution: window.devicePixelRatio,
    });
    confirmLabel.setOrigin(0.5);
    confirmLabel.setDepth(63);
    confirmBtn.on('pointerover', () => confirmBtn.setFillStyle(0xcc3333));
    confirmBtn.on('pointerout', () => confirmBtn.setFillStyle(0xaa2222));
    confirmBtn.on('pointerdown', () => {
      this.clearAllData();
    });

    const cancelBtn = this.add.rectangle(centerX + 80, centerY + 60, 130, 48, 0x444466);
    cancelBtn.setDepth(62);
    cancelBtn.setInteractive({ useHandCursor: true });
    const cancelLabel = this.add.text(centerX + 80, centerY + 60, 'Cancel', {
      fontSize: fs(30),
      color: '#ffffff',
      resolution: window.devicePixelRatio,
    });
    cancelLabel.setOrigin(0.5);
    cancelLabel.setDepth(63);
    cancelBtn.on('pointerover', () => cancelBtn.setFillStyle(0x555577));
    cancelBtn.on('pointerout', () => cancelBtn.setFillStyle(0x444466));
    cancelBtn.on('pointerdown', () => {
      overlay.destroy();
      confirmPanel.destroy();
      warningText.destroy();
      descText.destroy();
      confirmBtn.destroy();
      confirmLabel.destroy();
      cancelBtn.destroy();
      cancelLabel.destroy();
    });
  }

  private clearAllData(): void {
    const keysToKeep = ['openai_api_key', 'llm_base_url', 'llm_model'];
    const allKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) allKeys.push(key);
    }
    for (const key of allKeys) {
      if (!keysToKeep.includes(key)) {
        localStorage.removeItem(key);
      }
    }
    window.location.reload();
  }

  private saveSettings(): void {
    const apiKey = this.apiInput.value.trim();
    const baseUrl = this.baseUrlInput.value.trim();
    const model = this.modelInput.value.trim();

    if (apiKey) {
      localStorage.setItem('openai_api_key', apiKey);
    } else {
      localStorage.removeItem('openai_api_key');
    }

    if (baseUrl) {
      localStorage.setItem('llm_base_url', baseUrl);
    } else {
      localStorage.removeItem('llm_base_url');
    }

    if (model) {
      localStorage.setItem('llm_model', model);
    } else {
      localStorage.removeItem('llm_model');
    }

    EventBus.emit(Events.LLM_CONFIG_CHANGED);
    EventBus.emit(Events.SHOW_NOTIFICATION, {
      text: 'Settings saved! LLM config updated.',
    });

    this.closeSettings();
  }

  private closeSettings(): void {
    this.cleanupInputs();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    EventBus.emit(Events.SETTINGS_CLOSE);

    if (this.onClose) {
      this.onClose();
    }

    this.scene.stop();
  }

  private cleanupInputs(): void {
    this.domElements.forEach((dom) => dom.destroy());
    this.domElements = [];
  }

  shutdown(): void {
    this.cleanupInputs();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }
}
