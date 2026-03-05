import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { EventBus, Events } from '../world/EventBus';

const INPUT_STYLE = [
  'width: 340px',
  'padding: 8px',
  'font-size: 14px',
  'background: #2a2a4e',
  'color: #ffffff',
  'border: 1px solid #4488ff',
  'border-radius: 4px',
  'outline: none',
].join('; ');

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

    const panel = this.add.rectangle(panelX, panelY, 500, 400, 0x1a1a2e, 1);
    panel.setStrokeStyle(2, 0x4488ff);
    panel.setDepth(51);

    const title = this.add.text(panelX, panelY - 170, '⚙️ LLM Settings', {
      fontSize: '24px',
      color: '#ffcc00',
      stroke: '#000000',
      strokeThickness: 2,
      resolution: window.devicePixelRatio,
    });
    title.setOrigin(0.5);
    title.setDepth(52);

    const labelStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontSize: '14px',
      color: '#ffffff',
      resolution: window.devicePixelRatio,
    };
    this.add.text(panelX - 220, panelY - 130, 'API Key:', labelStyle).setDepth(52);
    this.add.text(panelX - 220, panelY - 55, 'Base URL:', labelStyle).setDepth(52);
    this.add.text(panelX - 220, panelY + 20, 'Model:', labelStyle).setDepth(52);

    this.createInputs(panelX, panelY);
    this.createButtons(panelX, panelY);

    EventBus.emit(Events.SETTINGS_OPEN);
  }

  private createInputs(centerX: number, centerY: number): void {
    this.apiInput = document.createElement('input');
    this.apiInput.type = 'password';
    this.apiInput.placeholder = 'sk-...';
    this.apiInput.value = localStorage.getItem('openai_api_key') || '';
    this.apiInput.style.cssText = INPUT_STYLE;

    const apiDom = this.add.dom(centerX + 10, centerY - 108, this.apiInput);
    apiDom.setDepth(53);
    this.domElements.push(apiDom);

    const toggleBtn = this.add.text(centerX + 200, centerY - 120, '👁️', {
      fontSize: '14px',
      resolution: window.devicePixelRatio,
    });
    toggleBtn.setDepth(53);
    toggleBtn.setInteractive({ useHandCursor: true });
    toggleBtn.on('pointerdown', () => {
      this.apiInput.type = this.apiInput.type === 'password' ? 'text' : 'password';
    });

    this.baseUrlInput = document.createElement('input');
    this.baseUrlInput.type = 'text';
    this.baseUrlInput.placeholder = 'https://api.openai.com/v1';
    this.baseUrlInput.value = localStorage.getItem('llm_base_url') || '';
    this.baseUrlInput.style.cssText = INPUT_STYLE;

    const baseUrlDom = this.add.dom(centerX + 10, centerY - 33, this.baseUrlInput);
    baseUrlDom.setDepth(53);
    this.domElements.push(baseUrlDom);

    this.modelInput = document.createElement('input');
    this.modelInput.type = 'text';
    this.modelInput.placeholder = 'gpt-4o-mini';
    this.modelInput.value = localStorage.getItem('llm_model') || 'gpt-4o-mini';
    this.modelInput.style.cssText = INPUT_STYLE;

    const modelDom = this.add.dom(centerX + 10, centerY + 42, this.modelInput);
    modelDom.setDepth(53);
    this.domElements.push(modelDom);

    setTimeout(() => this.apiInput.focus(), 100);
  }

  private createButtons(centerX: number, centerY: number): void {
    const saveBtn = this.add.rectangle(centerX - 60, centerY + 140, 100, 40, 0x44aa44);
    saveBtn.setDepth(52);
    saveBtn.setInteractive({ useHandCursor: true });

    const saveText = this.add.text(centerX - 60, centerY + 140, 'Save', {
      fontSize: '18px',
      color: '#ffffff',
      resolution: window.devicePixelRatio,
    });
    saveText.setOrigin(0.5);
    saveText.setDepth(53);

    saveBtn.on('pointerdown', () => {
      this.saveSettings();
    });

    const cancelBtn = this.add.rectangle(centerX + 60, centerY + 140, 100, 40, 0xaa4444);
    cancelBtn.setDepth(52);
    cancelBtn.setInteractive({ useHandCursor: true });

    const isFirstRun = !localStorage.getItem('openai_api_key') && !this.onClose;
    const cancelLabel = isFirstRun ? 'Skip' : 'Cancel';

    const cancelText = this.add.text(centerX + 60, centerY + 140, cancelLabel, {
      fontSize: '18px',
      color: '#ffffff',
      resolution: window.devicePixelRatio,
    });
    cancelText.setOrigin(0.5);
    cancelText.setDepth(53);

    cancelBtn.on('pointerdown', () => {
      this.closeSettings();
    });
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
  }
}
