/**
 * Returns a simple greeting message.
 * @param name - Optional name to greet (defaults to "World")
 * @returns Greeting message
 */
export function hello(name = "World"): string {
  return `Hello, ${name}!`;
}
