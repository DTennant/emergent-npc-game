export interface JournalPage {
  id: string;
  title: string;
  content: string;
  position: { x: number; y: number };
  discovered: boolean;
}

export const JOURNAL_PAGES: JournalPage[] = [
  {
    id: 'aldric_journal_1',
    title: "The Blight's Origin",
    content: "The Blight comes from beneath the Ancient Forest. I've traced its tendrils to three sealed chambers — a cave, a mine, and a tower. Each holds something vital...",
    position: { x: 480, y: 250 },
    discovered: false,
  },
  {
    id: 'aldric_journal_2',
    title: 'The Three Runestones',
    content: "Three Runestones were placed by Thornwick's founders to keep the darkness at bay. They were scattered to prevent misuse — one in each sealed chamber...",
    position: { x: 180, y: 220 },
    discovered: false,
  },
  {
    id: 'aldric_journal_3',
    title: 'The Forest Cave',
    content: 'The Forest Cave holds the first Runestone, but beware the Shadow Wolf that guards it. Bring a lantern — the depths are pitch black without one...',
    position: { x: 140, y: 400 },
    discovered: false,
  },
  {
    id: 'aldric_journal_4',
    title: 'The Abandoned Mine',
    content: 'The second Runestone lies deep in the Abandoned Mine. A rope is needed to cross the great chasm within. The Crystal Golem guards the stone...',
    position: { x: 600, y: 380 },
    discovered: false,
  },
  {
    id: 'aldric_journal_5',
    title: 'The Ruined Tower',
    content: "Only an enchanted blade can pierce the Blight Wraith's veil in the Ruined Tower. The third Runestone is the most dangerous to retrieve...",
    position: { x: 550, y: 140 },
    discovered: false,
  },
];

interface AldricJournalJSON {
  discoveredPages: string[];
}

export class AldricJournal {
  private discoveredPages: Set<string> = new Set();

  discoverPage(pageId: string): void {
    this.discoveredPages.add(pageId);
  }

  isDiscovered(pageId: string): boolean {
    return this.discoveredPages.has(pageId);
  }

  getDiscoveredContent(): Array<{ title: string; content: string }> {
    return JOURNAL_PAGES
      .filter((page) => this.discoveredPages.has(page.id))
      .map((page) => ({ title: page.title, content: page.content }));
  }

  toJSON(): AldricJournalJSON {
    return {
      discoveredPages: Array.from(this.discoveredPages),
    };
  }

  fromJSON(data: AldricJournalJSON): void {
    this.discoveredPages = new Set(data.discoveredPages);
  }
}
