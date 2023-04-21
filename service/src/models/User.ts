enum UserRole {
  Admin = 'admin',
  Moderator = 'moderator',
  User = 'user',
}

class User {
  private id: number
  private name: string
  private email: string
  private password: string
  private role: UserRole

  constructor(id: number, name: string, email: string, password: string, role: UserRole) {
    this.id = id
    this.name = name
    this.email = email
    this.password = password
    this.role = role
  }

  getId(): number {
    return this.id
  }

  getName(): string {
    return this.name
  }

  getEmail(): string {
    return this.email
  }

  getPassword(): string {
    return this.password
  }

  getRole(): UserRole {
    return this.role
  }

  setPassword(password: string): void {
    this.password = password
  }

  setRole(role: UserRole): void {
    this.role = role
  }
}

export { User, UserRole }
