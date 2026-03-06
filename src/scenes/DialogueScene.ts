import Phaser from 'phaser';
import { NPC } from '../npc/NPC';
import { LLMClient } from '../ai/LLMClient';
import { WorldState } from '../world/WorldState';
import { StorylineManager } from '../story/StorylineManager';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

interface DialogueData {
  npc: NPC;
  llmClient: LLMClient;
  worldState: WorldState;
  storylineManager?: StorylineManager;
  onClose: () => void;
}

export class DialogueScene extends Phaser.Scene {
  private npc!: NPC;
  private llmClient!: LLMClient;
  private worldState!: WorldState;
  private storylineManager?: StorylineManager;
  private onClose!: () => void;
  private conversationContainer!: HTMLDivElement;
  private conversationDom!: Phaser.GameObjects.DOMElement;
  private inputElement!: HTMLInputElement;
  private inputDom!: Phaser.GameObjects.DOMElement;
  private isWaiting = false;
  private conversationLog: { speaker: string; text: string; isTyping?: boolean }[] = [];
  private styleElement?: HTMLStyleElement;

  constructor() {
    super({ key: 'DialogueScene' });
  }

  init(data: DialogueData): void {
    this.npc = data.npc;
    this.llmClient = data.llmClient;
    this.worldState = data.worldState;
    this.storylineManager = data.storylineManager;
    this.onClose = data.onClose;
    this.conversationLog = [];
  }

  create(): void {
    const backdrop = this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH,
      GAME_HEIGHT,
      0x000000,
      0.5
    );
    backdrop.setDepth(50);
    backdrop.setInteractive();

    const boxHeight = 280;
    const boxY = GAME_HEIGHT - (boxHeight / 2) - 20;
    const box = this.add.rectangle(
      GAME_WIDTH / 2,
      boxY,
      GAME_WIDTH - 40,
      boxHeight,
      0x1a1a2e,
      0.95
    );
    box.setStrokeStyle(2, 0x4488ff);
    box.setDepth(51);

    const header = this.add.text(40, boxY - (boxHeight / 2) + 20, `💬 ${this.npc.persona.name} (${this.npc.persona.role})`, {
      fontSize: '18px',
      color: '#ffcc00',
      stroke: '#000000',
      strokeThickness: 2,
      resolution: window.devicePixelRatio,
    });
    header.setDepth(52);

    this.createConversationDisplay(boxY, boxHeight);

    const instructions = this.add.text(
      GAME_WIDTH / 2,
      boxY + (boxHeight / 2) + 20,
      'Type your message and press Enter | Press Escape to leave',
      {
        fontSize: '12px',
        color: '#888888',
        resolution: window.devicePixelRatio,
      }
    );
    instructions.setOrigin(0.5);
    instructions.setDepth(52);

    this.createInput(boxY, boxHeight);
    this.showNPCGreeting();

    this.input.keyboard!.on('keydown-ESC', () => {
      this.closeDialogue();
    });
  }

  private createConversationDisplay(boxY: number, boxHeight: number): void {
    this.conversationContainer = document.createElement('div');
    this.conversationContainer.style.cssText = [
      `width: ${GAME_WIDTH - 80}px`,
      `height: ${boxHeight - 110}px`,
      'overflow-y: auto',
      'background: rgba(0, 0, 0, 0.3)',
      'padding: 10px',
      'border-radius: 4px',
      'font-family: monospace',
      'font-size: 14px',
      'line-height: 1.5',
      'color: #ffffff',
    ].join('; ');

    this.conversationContainer.className = 'dialogue-log';

    this.styleElement = document.createElement('style');
    this.styleElement.textContent = `
      .dialogue-log::-webkit-scrollbar { width: 8px; }
      .dialogue-log::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.3); }
      .dialogue-log::-webkit-scrollbar-thumb { background: #4488ff; border-radius: 4px; }
      .dialogue-log::-webkit-scrollbar-thumb:hover { background: #66aaff; }
      .typing { color: #888; font-style: italic; }
    `;
    document.head.appendChild(this.styleElement);

    this.conversationDom = this.add.dom(GAME_WIDTH / 2, boxY - 10, this.conversationContainer);
    this.conversationDom.setDepth(52);
  }

  private createInput(boxY: number, boxHeight: number): void {
    this.inputElement = document.createElement('input');
    this.inputElement.type = 'text';
    this.inputElement.placeholder = 'Say something...';
    this.inputElement.style.cssText = [
      `width: ${GAME_WIDTH - 80}px`,
      'padding: 10px 12px',
      'font-size: 14px',
      'background: #2a2a4e',
      'color: #ffffff',
      'border: 1px solid #4488ff',
      'border-radius: 4px',
      'outline: none',
    ].join('; ');

    this.inputElement.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !this.isWaiting) {
        const message = this.inputElement.value.trim();
        if (message) {
          this.sendMessage(message);
          this.inputElement.value = '';
        }
      }
      if (e.key === 'Escape') {
        this.closeDialogue();
      }
      e.stopPropagation();
    });

    this.inputDom = this.add.dom(GAME_WIDTH / 2, boxY + (boxHeight / 2) - 30, this.inputElement);
    this.inputDom.setDepth(53);
    setTimeout(() => this.inputElement.focus(), 100);
  }

  private async showNPCGreeting(): Promise<void> {
    this.isWaiting = true;

    const typingIdx = this.conversationLog.length;
    this.conversationLog.push({ speaker: this.npc.persona.name, text: '...', isTyping: true });
    this.updateDialogueDisplay();

    const response = await this.npc.generateResponse(
      this.llmClient,
      '(Player approaches)',
      this.worldState,
      this.storylineManager
    );
    
    this.conversationLog[typingIdx] = { speaker: this.npc.persona.name, text: response.dialogue };
    this.updateDialogueDisplay();
    this.isWaiting = false;
  }

  private async sendMessage(message: string): Promise<void> {
    this.isWaiting = true;

    this.conversationLog.push({ speaker: 'You', text: message });
    this.updateDialogueDisplay();

    const typingIdx = this.conversationLog.length;
    this.conversationLog.push({ speaker: this.npc.persona.name, text: '...', isTyping: true });
    this.updateDialogueDisplay();

    const response = await this.npc.generateResponse(
      this.llmClient,
      message,
      this.worldState,
      this.storylineManager
    );

    this.conversationLog[typingIdx] = { speaker: this.npc.persona.name, text: response.dialogue };
    this.updateDialogueDisplay();
    this.isWaiting = false;
  }

  private updateDialogueDisplay(): void {
    if (!this.conversationContainer) return;

    const messagesHtml = this.conversationLog
      .map((entry) => {
        const isPlayer = entry.speaker === 'You';
        const color = isPlayer ? '#4488ff' : '#ffcc00';
        
        // Escape HTML to prevent injection
        const safeText = entry.text
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        
        const textClass = entry.isTyping ? 'typing' : '';
        const textStyle = entry.isTyping ? '' : 'color: #eeeeee';

        return `<div style="margin-bottom: 8px;">
          <strong style="color: ${color}">${entry.speaker}:</strong> 
          <span class="${textClass}" style="${textStyle}">${safeText}</span>
        </div>`;
      })
      .join('');

    this.conversationContainer.innerHTML = messagesHtml;
    
    // Auto-scroll to bottom
    this.conversationContainer.scrollTop = this.conversationContainer.scrollHeight;
  }

  private closeDialogue(): void {
    this.cleanup();
    this.onClose();
    this.scene.stop();
  }

  shutdown(): void {
    this.cleanup();
  }

  private cleanup(): void {
    if (this.inputDom) {
      this.inputDom.destroy();
    }
    if (this.conversationDom) {
      this.conversationDom.destroy();
    }
    if (this.styleElement?.parentNode) {
      this.styleElement.parentNode.removeChild(this.styleElement);
    }
  }
}
