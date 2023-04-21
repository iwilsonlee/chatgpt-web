import { createLogger, format, transports } from 'winston'
const { combine, timestamp, printf } = format

const errorStackFormat = format((info) => {
  if (info instanceof Error) {
    return Object.assign({}, info, {
      stack: info.stack,
      message: info.message,
    })
  }
  return info
})

const logger = createLogger({
  format: combine(
    // splat(),
    timestamp(),
    errorStackFormat(),
    printf((p) => {
      const stack = p.stack ? `\n ${p.stack}` : ''
      return `${p.timestamp} [${p.level}]: ${p.message} ${stack}`
    }),
  ),
  transports: [new transports.Console({ level: 'info' })],
})
export default logger
