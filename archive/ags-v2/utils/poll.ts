import { createState, onCleanup } from "ags"

export function createPoll<T>(
  initial: T,
  interval: number,
  callback: () => T
): () => T {
  const [state, setState] = createState(initial)

  const id = setInterval(() => {
    setState(callback())
  }, interval)

  onCleanup(() => {
    clearInterval(id)
  })

  // Run immediately
  setState(callback())

  return state
}
