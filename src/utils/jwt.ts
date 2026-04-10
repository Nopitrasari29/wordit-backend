import jwt from "jsonwebtoken"
import { env } from "../config/env"

export interface JwtPayload {
  userId: string
  email: string
  role: string
}

export const generateToken = (payload: JwtPayload): string => {
  return jwt.sign(
    payload,
    env.jwtSecret,
    { expiresIn: "24h" }  // hardcode dulu biar pasti
  )
}

export const verifyToken = (token: string): JwtPayload => {
  const decoded = jwt.verify(token, env.jwtSecret)
  return decoded as JwtPayload
}

export const decodeToken = (token: string): JwtPayload | null => {
  try {
    return jwt.decode(token) as JwtPayload
  } catch {
    return null
  }
}