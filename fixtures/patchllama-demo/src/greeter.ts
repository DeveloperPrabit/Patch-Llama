export function greet(name: number): string {
  return `Hello, ${name}!`
}

export function run(): string {
  return greet('PatchLlama')
}
