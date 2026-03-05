import Phaser from 'phaser';
import { NPC } from '../npc/NPC';
import { LLMClient } from '../ai/LLMClient';
import { WorldState } from '../world/WorldState';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

interface DialogueData {
  npc: NPC;
  llmClient: LLMClient;
  worldState: WorldState;
  onClose: () => void;
}

export class DialogueScene extends Phaser.Scene {
  private npc!: NPC;
  private llmClient!: LLMClient;
  private worldState!: WorldState;
  private onClose!: () => void;
  private dialogueText!: Phaser.GameObjects.Text;
  private inputElement!: HTMLInputElement;
  private isWaiting = false;
  private conversationLog: { speaker: string; text: string }[] = [];

  constructor() {
    super({ key: 'DialogueScene' });
  }

  init(data: DialogueData): void {
    this.npc = data.npc;
    this.llmClient = data.llmClient;
    this.worldState = data.worldState;
    this.onClose = data.onClose;
    this.conversationLog = [];
  }

  create(): void {
    // Semi-transparent backdrop
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

    // Dialogue box
    const boxY = GAME_HEIGHT - 140;
    const box = this.add.rectangle(
      GAME_WIDTH / 2,
      boxY,
      GAME_WIDTH - 40,
      200,
      0x1a1a2e,
      0.95
    );
    box.setStrokeStyle(2, 0x4488ff);
    box.setDepth(51);

    // NPC name header
    const header = this.add.text(40, boxY - 85, `💬 ${this.npc.persona.name} (${this.npc.persona.role})`, {
      fontSize: '16px',
      color: '#ffcc00',
      stroke: '#000000',
      strokeThickness: 2,
    });
    header.setDepth(52);

    // Dialogue text area
    this.dialogueText = this.add.text(40, boxY - 55, '', {
      fontSize: '14px',
      color: '#ffffff',
      wordWrap: { width: GAME_WIDTH - 80 },
      lineSpacing: 4,
    });
    this.dialogueText.setDepth(52);

    // Instructions
    const instructions = this.add.text(
      GAME_WIDTH / 2,
      boxY + 80,
      'Type your message and press Enter | Press Escape to leave',
      {
        fontSize: '11px',
        color: '#888888',
      }
    );
    instructions.setOrigin(0.5);
    instructions.setDepth(52);

    // Create HTML input for typing
    this.createInput(boxY);

    // Show greeting
    this.showNPCGreeting();

    // Escape to close
    this.input.keyboard!.on('keydown-ESC', () => {
      this.closeDialogue();
    });
  }

  private createInput(boxY: number): void {
    this.inputElement = document.createElement('input');
    this.inputElement.type = 'text';
    this.inputElement.placeholder = 'Say something...';
    this.inputElement.style.cssText = `
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      bottom: ${GAME_HEIGHT - boxY - 50}px;
      width: ${GAME_WIDTH - 100}px;
      padding: 8px 12px;
      font-size: 14px;
      background: #2a2a4e;
      color: #ffffff;
      border: 1px solid #4488ff;
      border-radius: 4px;
      outline: none;
      z-index: 1000;
    `;

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

    document.body.appendChild(this.inputElement);
    setTimeout(() => this.inputElement.focus(), 100);
  }

  private async showNPCGreeting(): Promise<void> {
    this.isWaiting = true;
    const response = await this.npc.generateResponse(
      this.llmClient,
      '(Player approaches)',
      this.worldState
    );
    this.conversationLog.push({ speaker: this.npc.persona.name, text: response });
    this.updateDialogueDisplay();
    this.isWaiting = false;
  }

  private async sendMessage(message: string): Promise<void> {
    this.isWaiting = true;

    this.conversationLog.push({ speaker: 'You', text: message });
    this.updateDialogueDisplay();

    // Show thinking indicator
    this.dialogueText.setText(this.formatLog() + `\n${this.npc.persona.name}: ...`);

    const response = await this.npc.generateResponse(
      this.llmClient,
      message,
      this.worldState
    );

    this.conversationLog.push({ speaker: this.npc.persona.name, text: response });
    this.updateDialogueDisplay();
    this.isWaiting = false;
  }

  private updateDialogueDisplay(): void {
    this.dialogueText.setText(this.formatLog());
  }

  private formatLog(): string {
    // Show last 4 messages
    const recent = this.conversationLog.slice(-4);
    return recent.map((entry) => `${entry.speaker}: ${entry.text}`).join('\n\n');
  }

  private closeDialogue(): void {
    if (this.inputElement && this.inputElement.parentNode) {
      this.inputElement.parentNode.removeChild(this.inputElement);
    }
    this.onClose();
    this.scene.stop();
  }

  shutdown(): void {
    if (this.inputElement && this.inputElement.parentNode) {
      this.inputElement.parentNode.removeChild(this.inputElement);
    }
  }
}
