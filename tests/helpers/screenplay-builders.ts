export class ScreenplayBuilder {
  private readonly lines: string[] = [];

  addSceneHeader(text: string): this {
    this.lines.push(text.trim());
    return this;
  }

  addAction(text: string): this {
    this.lines.push(text.trim());
    return this;
  }

  addCharacter(name: string): this {
    const normalized = name.trim();
    this.lines.push(normalized.endsWith(":") ? normalized : `${normalized}:`);
    return this;
  }

  addDialogue(text: string): this {
    this.lines.push(text.trim());
    return this;
  }

  addParenthetical(text: string): this {
    const normalized = text.trim();
    if (normalized.startsWith("(") && normalized.endsWith(")")) {
      this.lines.push(normalized);
      return this;
    }
    this.lines.push(`(${normalized.replace(/^\(+|\)+$/g, "")})`);
    return this;
  }

  addTransition(text: string): this {
    const normalized = text.trim();
    this.lines.push(normalized.endsWith(":") ? normalized : `${normalized}:`);
    return this;
  }

  build(): string[] {
    return [...this.lines];
  }

  buildRaw(): string {
    return this.lines.join("\n");
  }
}
