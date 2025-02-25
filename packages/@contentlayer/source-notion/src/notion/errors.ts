import { errorToString } from '@contentlayer/utils'
import { Tagged } from '@contentlayer/utils/effect'

export class UnknownNotionError extends Tagged('UnknownNotionError')<{ readonly error: unknown }> {
  toString = () => `UnknowNotionError: ${errorToString(this.error)}`
}
