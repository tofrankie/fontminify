import type { FontSubsetResult } from '../types'
import { minifyOneFont } from './minify'

type MinifyOneFontOptions = Parameters<typeof minifyOneFont>[0]

interface ChildRequest {
  type: 'minifyOneFont'
  payload: MinifyOneFontOptions
}
type ChildResponse =
  | { ok: true; result: FontSubsetResult[] }
  | { ok: false; error: { message: string } }

async function handle(req: ChildRequest): Promise<ChildResponse> {
  try {
    const result = await minifyOneFont(req.payload)
    return { ok: true, result }
  } catch (err) {
    return { ok: false, error: { message: err instanceof Error ? err.message : String(err) } }
  }
}

process.on('message', (msg: unknown) => {
  const req = msg as Partial<ChildRequest>
  if (req?.type !== 'minifyOneFont' || !req.payload) return

  void handle(req as ChildRequest).then(res => {
    if (typeof process.send === 'function') process.send(res)
    const code = res.ok ? 0 : 1
    // Ensure the IPC channel is closed; otherwise the child may keep running.
    if (typeof process.disconnect === 'function') process.disconnect()
    // Exit promptly after flushing the IPC message.
    setImmediate(() => process.exit(code))
  })
})
