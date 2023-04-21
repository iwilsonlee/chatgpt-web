import { isNotEmptyString } from '../utils/is'
import { jwtService } from '../services/auth-service'
import logger from '../logger'

const auth = async (req, res, next) => {
  const AUTH_SECRET_KEY = process.env.AUTH_SECRET_KEY
  if (isNotEmptyString(AUTH_SECRET_KEY)) {
    try {
      const Authorization = req.header('Authorization')
      logger.info('Authorization={}', Authorization)
      if (!Authorization || Authorization.replace('Bearer ', '').trim() !== AUTH_SECRET_KEY.trim())
        throw new Error('Error: 无访问权限 | No access rights')
      next()
    }
    catch (error) {
      res.send({ status: 'Unauthorized', message: error.message ?? 'Please authenticate.', data: null })
    }
  }
  else {
    next()
  }
}

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization
  if (!authHeader)
    return res.status(401).json({ message: 'No authorization header provided' })

  const [bearer, token] = authHeader.split(' ')
  if (!bearer || !token)
    return res.status(401).json({ message: 'Authorization header is invalid' })

  const user = jwtService.verifyToken(token)
  if (!user)
    return res.status(401).json({ message: 'Invalid token' })

  // 在 req 对象上添加 user 属性
  req.user = user

  next()
}

export { auth, authMiddleware }
