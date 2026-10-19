import { describe, it, expect, vi } from "vitest";
import {
  generateTransferPin,
  encodeTransferQrData,
  decodeTransferQrData,
  triggerHaptic,
  TransferPayloadMeta,
} from "../lib/wireless-transfer-service";

describe("Wireless Transfer Service", () => {
  it("generates a valid 4-digit PIN", () => {
    const pin = generateTransferPin();
    expect(pin).toMatch(/^\d{4}$/);
    const num = parseInt(pin, 10);
    expect(num).toBeGreaterThanOrEqual(1000);
    expect(num).toBeLessThanOrEqual(9999);
  });

  it("encodes and decodes QR payload correctly", () => {
    const meta: TransferPayloadMeta = {
      version: 1,
      type: "dar_stories_transfer",
      pin: "4821",
      ip: "192.168.1.45",
      port: 8080,
      url: "http://192.168.1.45:8080/api/transfer/stories?pin=4821",
      count: 24,
      words: 154000,
      timestamp: 1729000000000,
    };

    const encoded = encodeTransferQrData(meta);
    expect(typeof encoded).toBe("string");
    expect(encoded.length).toBeLessThan(160); // Must be ultra-compact for fast scanning

    const decoded = decodeTransferQrData(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded?.pin).toBe("4821");
    expect(decoded?.count).toBe(24);
    expect(decoded?.words).toBe(154000);
    expect(decoded?.ip).toBe("192.168.1.45");
    expect(decoded?.port).toBe(8080);
    expect(decoded?.url).toContain("http://192.168.1.45:8080/api/transfer/stories?pin=4821");
  });

  it("decodes raw direct URL scanned from QR", () => {
    const directUrl = "http://192.168.1.88:3000/api/transfer/stories?pin=9912";
    const decoded = decodeTransferQrData(directUrl);
    expect(decoded).not.toBeNull();
    expect(decoded?.pin).toBe("9912");
    expect(decoded?.ip).toBe("192.168.1.88");
    expect(decoded?.port).toBe(3000);
    expect(decoded?.url).toBe(directUrl);
  });

  it("returns null for invalid or corrupted QR payload", () => {
    expect(decodeTransferQrData("")).toBeNull();
    expect(decodeTransferQrData("just random text")).toBeNull();
    expect(decodeTransferQrData('{"other":"json"}')).toBeNull();
  });

  it("triggers vibration without throwing in environments without vibrate", () => {
    expect(() => triggerHaptic("scan")).not.toThrow();
    expect(() => triggerHaptic("success")).not.toThrow();
  });

  it("triggers vibration when navigator.vibrate is available", () => {
    const vibrateMock = vi.fn();
    // Use Object.defineProperty to override navigator.vibrate correctly
    Object.defineProperty(globalThis, "navigator", {
      value: { vibrate: vibrateMock },
      configurable: true,
      writable: true,
    });

    triggerHaptic("scan");
    expect(vibrateMock).toHaveBeenCalledWith([35, 45, 35]);

    triggerHaptic("success");
    expect(vibrateMock).toHaveBeenCalledWith([40, 60, 40, 60, 80]);
  });
});
