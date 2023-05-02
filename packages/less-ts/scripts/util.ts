export type Callback = () => void;

export class Semaphore {
  active: number = 0;
  waiting: Callback[] = [];

  constructor(readonly max: number) {}

  acquire(cb: Callback): void {
    if (this.active >= this.max) {
      this.waiting.push(cb);
    } else {
      this.lock(cb);
    }
  }

  release(): void {
    if (this.active === 0) {
      return;
    }
    this.active--;
    this.lock(this.waiting.pop());
  }

  private lock(cb: Callback | undefined): void {
    if (cb) {
      cb();
      this.active++;
    }
  }
}
