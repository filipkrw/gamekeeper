class CommandLock {
  private locked = false;
  private owner: string | null = null;

  acquire(command: string): boolean {
    if (this.locked) return false;
    this.locked = true;
    this.owner = command;
    return true;
  }

  release(): void {
    this.locked = false;
    this.owner = null;
  }

  isLocked(): boolean {
    return this.locked;
  }

  getOwner(): string | null {
    return this.owner;
  }
}

export const commandLock = new CommandLock();
