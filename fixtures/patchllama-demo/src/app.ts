import { label } from './missing-util'

export function main(): string {
  return label()
}

if (import.meta.main) {
  console.log(main())
}
