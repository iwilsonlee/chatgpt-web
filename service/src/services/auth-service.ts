import dotenv from 'dotenv'
import jwt from 'jsonwebtoken'

interface UserPayload {
  username: string
}

interface JwtService {
  signUser(user: UserPayload): string
  verifyToken(token: string): UserPayload | null
}

interface UserCredentials {
  username: string
  password: string
}

const jwtService: JwtService = {
  signUser(user: UserPayload) {
    return jwt.sign(user, process.env.JWT_SECRET!)
  },

  verifyToken(token: string) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as UserPayload
      return decoded
    }
    catch (err) {
      return null
    }
  },
}

class AuthService {
  private readonly userCredentials: UserCredentials[]

  constructor() {
    dotenv.config()
    const us = process.env.USER_CREDENTIALS
    this.userCredentials = JSON.parse(us ?? '[]')
  }

  // async register(username: string, password: string): Promise<boolean> {
  //   // TODO: 实现注册接口
  //   return true
  // }

  async login(username: string, password: string): Promise<boolean | string> {
    const userCredential = this.userCredentials.find(
      credential => credential.username === username && credential.password === password,
    )
    if (!userCredential)
      return Boolean(userCredential)
    else
      return jwtService.signUser({ username })
  }
}

export { AuthService, jwtService }
