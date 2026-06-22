export type PromptSection = {
  id: string;
  content: string;
  dependencies?: string[];
};

export class SystemPromptBuilder {
  private sections: PromptSection[] = [];

  addSection(section: PromptSection) {
    this.sections.push(section);
    return this;
  }

  build(activeToolGroups: string[] = []): string {
    const included = new Set<string>();

    // Always include core instructions
    const core = this.sections.find(s => s.id === 'core');
    if (core) included.add('core');

    // Add sections based on active groups
    for (const group of activeToolGroups) {
      const section = this.sections.find(s => s.id === group);
      if (section) {
        included.add(group);
        if (section.dependencies) {
          section.dependencies.forEach(d => included.add(d));
        }
      }
    }

    return this.sections
      .filter(s => included.has(s.id))
      .map(s => s.content)
      .join('\n\n');
  }
}
