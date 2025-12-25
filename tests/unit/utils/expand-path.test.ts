import { expect, test, describe, beforeEach, afterEach } from "bun:test";
import * as path from "path";
import * as os from "os";
import { expandPath } from "../../../src/utils/helpers";

describe("expandPath", () => {
  const originalEnv = { ...process.env };
  const HOME = os.homedir();

  beforeEach(() => {
    process.env.TEST_HOME = "/custom/home";
    process.env.TEST_VAR = "foo";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test("1. Tilde expansion: ~/path -> /home/user/path", () => {
    expect(expandPath("~/test/file.txt")).toBe(path.join(HOME, "test/file.txt"));
  });

  test("2. Windows tilde with backslash: ~\\path", () => {
    // expandPath handles both ~/ and ~\ regardless of platform
    expect(expandPath("~\\test\\file.txt")).toBe(path.join(HOME, "test/file.txt"));
  });

  test("3. Environment variable expansion: ${VAR}/path", () => {
    expect(expandPath("${TEST_HOME}/file.txt")).toBe(path.normalize("/custom/home/file.txt"));
  });

  test("4. Dollar sign env vars: $VAR/path", () => {
    expect(expandPath("$TEST_HOME/file.txt")).toBe(path.normalize("/custom/home/file.txt"));
  });

  test("5. Windows %VAR% expansion: %VAR%\\path (simulated)", () => {
    // We can't easily mock process.platform if it's not win32,
    // but the function check process.platform === 'win32'
    if (process.platform === 'win32') {
      expect(expandPath("%TEST_HOME%\\file.txt")).toBe(path.normalize("/custom/home/file.txt"));
    } else {
      // Should remain unchanged on non-windows (but separators normalized)
      expect(expandPath("%TEST_HOME%\\file.txt")).toBe(path.normalize("%TEST_HOME%/file.txt"));
    }
  });

  test("6. Mixed path separators normalization", () => {
    const result = expandPath("path/to\\some/file");
    expect(result).toBe(path.normalize("path/to/some/file"));
  });

  test("7. Nested env vars: ${HOME}/${VAR}/path", () => {
    expect(expandPath("${TEST_HOME}/${TEST_VAR}/file.txt")).toBe(path.normalize("/custom/home/foo/file.txt"));
  });

  test("8. Empty/null path handling", () => {
    expect(expandPath("")).toBe(".");
  });

  test("9. Already absolute paths stay unchanged", () => {
    const absPath = "/absolute/path";
    expect(expandPath(absPath)).toBe(path.normalize(absPath));
  });

  test("10. Undefined env vars -> empty string", () => {
    expect(expandPath("${UNDEFINED_VAR}/file.txt")).toBe(path.normalize("/file.txt"));
    expect(expandPath("$UNDEFINED_VAR/file.txt")).toBe(path.normalize("/file.txt"));
  });

  test("11. Windows drive letters stay intact", () => {
    // Windows drive letter paths should be preserved
    const result = expandPath("C:\\Users\\test\\file.txt");
    expect(result).toContain("Users");
    expect(result).toContain("test");
  });

  test("12. Windows UNC paths handled", () => {
    // UNC paths start with \\
    const uncPath = "\\\\server\\share\\folder";
    const result = expandPath(uncPath);
    // Should normalize but preserve the structure
    expect(result).toContain("server");
    expect(result).toContain("share");
  });

  test("13. Null-like input throws TypeError", () => {
    // Function requires string input - documents current behavior
    // @ts-ignore - testing runtime edge case
    expect(() => expandPath(undefined as unknown as string)).toThrow(TypeError);
    // @ts-ignore - testing runtime edge case
    expect(() => expandPath(null as unknown as string)).toThrow(TypeError);
  });

  test("14. Path with spaces preserved", () => {
    const pathWithSpaces = "~/My Documents/file.txt";
    const result = expandPath(pathWithSpaces);
    expect(result).toContain("My Documents");
  });

  test("15. Multiple consecutive slashes normalized", () => {
    const result = expandPath("path//to///file.txt");
    expect(result).toBe(path.normalize("path/to/file.txt"));
  });
});
