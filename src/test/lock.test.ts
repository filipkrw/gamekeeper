import { describe, test, expect, beforeEach } from "bun:test";
import { commandLock } from "../lock.ts";

describe("CommandLock", () => {
  beforeEach(() => {
    commandLock.release();
  });

  test("acquire succeeds when unlocked", () => {
    expect(commandLock.acquire("start")).toBe(true);
    expect(commandLock.isLocked()).toBe(true);
    expect(commandLock.getOwner()).toBe("start");
  });

  test("acquire fails when already locked", () => {
    commandLock.acquire("start");
    expect(commandLock.acquire("stop")).toBe(false);
    expect(commandLock.getOwner()).toBe("start");
  });

  test("release resets state", () => {
    commandLock.acquire("start");
    commandLock.release();
    expect(commandLock.isLocked()).toBe(false);
    expect(commandLock.getOwner()).toBeNull();
  });

  test("double release is safe", () => {
    commandLock.acquire("start");
    commandLock.release();
    commandLock.release();
    expect(commandLock.isLocked()).toBe(false);
  });

  test("can re-acquire after release", () => {
    commandLock.acquire("start");
    commandLock.release();
    expect(commandLock.acquire("stop")).toBe(true);
    expect(commandLock.getOwner()).toBe("stop");
  });
});
